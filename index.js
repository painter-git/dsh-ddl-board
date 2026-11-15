/**
 * Host half of the DDL board.
 *
 * The board's document lives in one JSON file under the DeepSeek Harness home
 * and is served over a single same-origin route, so the Web page reads and
 * writes durable state instead of browser storage whose origin (and therefore
 * whose local data) can change between launches.
 *
 * Override the file with `DSH_DDL_BOARD_FILE`; otherwise it is
 * `$DSH_HOME/ddl-board/state.json` (`DSH_HOME` defaults to `~/.dsh`).
 * @module @local/ddl-board
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Same-origin route the Client half reads and writes. */
const ROUTE_PATH = '/plugin/ddl-board/state'
/** Upper bound for one saved document; the board is a small hand-written list. */
const MAX_BODY_BYTES = 2 * 1024 * 1024
/** Answer for a board that has never been saved. */
const EMPTY_STATE = '{"version":1,"tasks":[]}'

/**
 * Resolve the JSON file that holds the board.
 * @returns the absolute document path.
 */
function resolveDataFile() {
  const configured = process.env.DSH_DDL_BOARD_FILE?.trim()
  if (configured !== undefined && configured !== '') return configured
  const home = process.env.DSH_HOME?.trim()
  const root = home !== undefined && home !== '' ? home : join(homedir(), '.dsh')
  return join(root, 'ddl-board', 'state.json')
}

/**
 * Read one request body as UTF-8 text.
 * @param req - the incoming request.
 * @returns the body text.
 * @throws when the body exceeds the accepted size.
 */
async function readRequestBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('state document too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Check that a saved document keeps the shape the page expects.
 * @param value - the parsed body.
 * @returns whether the document is a board.
 */
function isBoardDocument(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  if (!Array.isArray(value.tasks)) return false
  return value.tasks.every(task => (
    task !== null
    && typeof task === 'object'
    && typeof task.id === 'string'
    && typeof task.title === 'string'
    && Array.isArray(task.subtasks ?? [])
  ))
}

/**
 * Replace the document atomically, so a reader never sees a half-written file.
 * @param file - the document path.
 * @param text - the complete serialized document.
 */
async function writeStateFile(file, text) {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, text, 'utf8')
  await rename(temporary, file)
}

/**
 * Write one JSON response.
 * @param res - the server response.
 * @param status - HTTP status code.
 * @param body - the serialized body, or `undefined` for an empty response.
 * @param head - whether this answers a HEAD request, which carries no body.
 */
function sendJson(res, status, body, head) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  if (body === undefined) {
    res.end()
    return
  }
  res.setHeader('content-length', String(Buffer.byteLength(body)))
  res.end(head === true ? undefined : body)
}

/**
 * Answer one board request.
 * @param req - the incoming request.
 * @param res - the server response.
 * @param file - the document path.
 */
async function handleStateRequest(req, res, file) {
  const head = req.method === 'HEAD'
  if (req.method === 'GET' || head) {
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      text = EMPTY_STATE
    }
    // A file this route did not write (or a damaged one) must not reach the page
    // as an empty board: an empty board would be saved back over it. Report the
    // problem and leave the file untouched for the user to inspect.
    let stored
    try {
      stored = JSON.parse(text)
    } catch {
      sendJson(res, 500, '{"ok":false,"reason":"corrupt-state"}', head)
      return
    }
    if (!isBoardDocument(stored)) {
      sendJson(res, 500, '{"ok":false,"reason":"corrupt-state"}', head)
      return
    }
    sendJson(res, 200, JSON.stringify(stored), head)
    return
  }
  if (req.method === 'PUT') {
    const text = await readRequestBody(req)
    let document
    try {
      document = JSON.parse(text)
    } catch {
      sendJson(res, 400, '{"ok":false,"reason":"invalid-json"}', false)
      return
    }
    if (!isBoardDocument(document)) {
      sendJson(res, 400, '{"ok":false,"reason":"invalid-board"}', false)
      return
    }
    await writeStateFile(file, JSON.stringify(document))
    sendJson(res, 200, '{"ok":true}', false)
    return
  }
  res.statusCode = 405
  res.setHeader('allow', 'GET, HEAD, PUT')
  res.end()
}

/**
 * Mount the board's route for the lifetime of the plugin.
 * @param ctx - the plugin context.
 */
export function apply(ctx) {
  const server = ctx.get('webServer')
  // Without the browser carrier there is no page to serve; the Client half
  // then keeps its own browser-local copy.
  if (server === undefined) return
  const file = resolveDataFile()
  ctx.effect(() => server.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: async (req, res) => {
      try {
        await handleStateRequest(req, res, file)
      } catch (error) {
        ctx.logger?.warn?.('ddl-board: state request failed: %s', error?.message ?? error)
        if (!res.headersSent) {
          sendJson(res, 500, '{"ok":false,"reason":"storage-failed"}', false)
          return
        }
        res.destroy()
      }
    },
  }), 'ddl-board: state route')
}
