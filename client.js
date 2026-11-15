/**
 * Client half of the DDL board.
 *
 * Contributes two surfaces, both keyed by the same panel id:
 * - `main` (`key: 'ddl-board'`): the board page the sidebar selects.
 * - `sidebar.panellist` (`id: 'ddl-board'`): the left-sidebar entry.
 *
 * Ordering rules implemented here:
 * - A deadline task sorts on its estimated finish when it has one and on its
 *   deadline otherwise, so the estimate always outranks the deadline.
 * - A subtask sorts on its own estimated finish; an untimed subtask keeps its
 *   added order behind the timed ones.
 *
 * The board is read from and written to the Host route
 * `/plugin/ddl-board/state`; browser storage is the fallback when that route
 * is unavailable.
 */
window.__ModuleLoader__.load({
  id: '@local/ddl-board',
  factory(require) {
    const React = require('react')
    const { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } = React
    const h = React.createElement

    const NS = 'ddl-board'
    const PANEL_ID = 'ddl-board'
    const STATE_PATH = '/plugin/ddl-board/state'
    const LOCAL_KEY = 'dsh.ddl-board.state.v1'
    const SAVE_DELAY_MS = 250

    // ---------------------------------------------------------------------
    // Copy
    // ---------------------------------------------------------------------

    const zh = {
      panel: 'DDL 看板',
      title: 'DDL 看板',
      subtitle: '进行中 {open} · 已完成 {done}',
      newTask: '新建 DDL',
      create: '创建',
      save: '保存',
      cancel: '取消',
      edit: '编辑',
      delete: '删除',
      addSubtask: '添加小任务',
      subtaskLabel: '小任务清单',
      taskForm: '截止任务表单',
      subtaskForm: '小任务表单',
      titleLabel: '事件名称',
      titlePlaceholder: '例如：提交课程论文',
      deadlineLabel: '截止时间',
      estimateLabel: '预计完成',
      estimateHelper: '预计完成时间决定排序位置',
      notesLabel: '备注',
      notesPlaceholder: '可选：交付要求、参考资料等',
      sortHint: '排序：预计完成时间与截止时间放在同一条时间线上比较——填了预计完成就按它排，没填就按截止时间排；小任务按预计完成时间排序，没填的保持添加顺序并排在已填之后。',
      storageHost: '已保存到本机看板文件',
      storageLocal: '只保存在此浏览器',
      saving: '保存中…',
      saved: '已保存',
      saveFailed: '保存失败',
      hostUnreachable: '无法读写主机看板文件，当前使用这台浏览器里的副本。',
      saveFailedHint: '保存失败，改动暂时只在这台浏览器里。',
      pendingLocal: '浏览器里有一份没写进主机的新副本（{count} 项）。',
      restore: '恢复这份副本',
      dismiss: '忽略',
      retry: '重试',
      loading: '正在读取…',
      emptyTitle: '还没有 DDL',
      emptyBody: '先添加一个截止任务，再把它的工作量拆成小任务，并给每个小任务填写预计完成时间。',
      statusOverdue: '已逾期',
      statusLate: '预计晚于截止',
      statusDone: '已完成',
      markDone: '标记完成：{title}',
      markOpen: '标记未完成：{title}',
      deleteTaskConfirm: '确认删除「{title}」及其小任务？',
      deleteSubtask: '删除小任务「{title}」',
      editSubtask: '编辑小任务「{title}」',
      openSection: '进行中（{count}）',
      doneSection: '已完成（{count}）',
      sortedByDeadline: '按截止时间排序',
      subtaskCount: '{count} 个小任务',
      subtaskCountOne: '1 个小任务',
      remaining: '剩 {value}',
      overdueBy: '已超 {value}',
      unitDays: '{value} 天',
      unitHours: '{value} 小时',
      unitMinutes: '{value} 分钟',
      notSet: '未填',
      errorTitle: '请填写事件名称',
      errorDeadline: '请填写截止时间',
      errorDate: '日期看不懂，例如 26-11-20 18:00；只写日期默认 12:00',
      datePlaceholder: '26-11-20 18:00',
      openPicker: '打开日期选择器',
    }

    const en = {
      panel: 'DDL board',
      title: 'DDL board',
      subtitle: '{open} open · {done} done',
      newTask: 'New deadline task',
      create: 'Create',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      addSubtask: 'Add subtask',
      subtaskLabel: 'Subtasks',
      taskForm: 'Deadline task form',
      subtaskForm: 'Subtask form',
      titleLabel: 'Event',
      titlePlaceholder: 'For example: submit the term paper',
      deadlineLabel: 'Deadline',
      estimateLabel: 'Estimate',
      estimateHelper: 'The estimate decides its place in the list',
      notesLabel: 'Notes',
      notesPlaceholder: 'Optional: requirements, references',
      sortHint: 'Ordering: estimates and deadlines share one timeline — a task uses its estimate when set and its deadline otherwise; subtasks sort by estimate, and untimed ones keep their added order after the timed ones.',
      storageHost: 'Saved to the host board file',
      storageLocal: 'Saved in this browser only',
      saving: 'Saving…',
      saved: 'Saved',
      saveFailed: 'Save failed',
      hostUnreachable: 'The host board file is unreachable; this browser copy is in use.',
      saveFailedHint: 'Save failed; changes are only in this browser for now.',
      pendingLocal: 'A browser copy of {count} tasks was never written to the host.',
      restore: 'Restore this copy',
      dismiss: 'Dismiss',
      retry: 'Retry',
      loading: 'Loading…',
      emptyTitle: 'No deadline tasks yet',
      emptyBody: 'Add a deadline task, break its work into subtasks, and give each subtask an estimated finish.',
      statusOverdue: 'Overdue',
      statusLate: 'Estimate after deadline',
      statusDone: 'Done',
      markDone: 'Mark done: {title}',
      markOpen: 'Mark open: {title}',
      deleteTaskConfirm: 'Delete "{title}" and its subtasks?',
      deleteSubtask: 'Delete subtask "{title}"',
      editSubtask: 'Edit subtask "{title}"',
      openSection: 'Open ({count})',
      doneSection: 'Done ({count})',
      sortedByDeadline: 'placed by deadline',
      subtaskCount: '{count} subtasks',
      subtaskCountOne: '1 subtask',
      remaining: '{value} left',
      overdueBy: '{value} over',
      unitDays: '{value}d',
      unitHours: '{value}h',
      unitMinutes: '{value}m',
      notSet: 'Not set',
      errorTitle: 'Enter the event name',
      errorDeadline: 'Enter the deadline',
      errorDate: 'Check the date, for example 26-11-20 18:00 (a date alone means 12:00)',
      datePlaceholder: '26-11-20 18:00',
      openPicker: 'Open the date picker',
    }

    // ---------------------------------------------------------------------
    // Time helpers
    // ---------------------------------------------------------------------

    const MINUTE_MS = 60 * 1000
    const HOUR_MS = 60 * MINUTE_MS
    const DAY_MS = 24 * HOUR_MS

    /**
     * Read a `datetime-local` value as a local instant.
     * @param value - stored form value.
     * @returns epoch milliseconds, or null when the value is empty or invalid.
     */
    function stampOf(value) {
      if (typeof value !== 'string' || value.trim() === '') return null
      const parsed = Date.parse(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    /**
     * Render a stored value as a compact local stamp.
     * @param value - stored form value.
     * @param t - translator.
     * @returns display text.
     */
    function formatStamp(value, t) {
      const stamp = stampOf(value)
      if (stamp === null) return t('notSet')
      const date = new Date(stamp)
      const pad = number => String(number).padStart(2, '0')
      const monthDay = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
      return date.getFullYear() === new Date().getFullYear()
        ? `${monthDay} ${clock}`
        : `${date.getFullYear()}-${monthDay} ${clock}`
    }

    /**
     * Describe the distance to one instant.
     * @param delta - milliseconds from now; negative values are in the past.
     * @param t - translator.
     * @returns display text.
     */
    function distanceText(delta, t) {
      const size = Math.abs(delta)
      const value = size >= DAY_MS
        ? t('unitDays', { value: Math.max(1, Math.floor(size / DAY_MS)) })
        : size >= HOUR_MS
          ? t('unitHours', { value: Math.max(1, Math.floor(size / HOUR_MS)) })
          : t('unitMinutes', { value: Math.max(1, Math.round(size / MINUTE_MS)) })
      return delta < 0 ? t('overdueBy', { value }) : t('remaining', { value })
    }

    /**
     * Pad one date component.
     * @param number - the component value.
     * @returns two digits.
     */
    function pad2(number) {
      return String(number).padStart(2, '0')
    }

    /**
     * Render a stored stamp in the short typed form, with a two-digit year.
     * @param value - stored `YYYY-MM-DDTHH:mm` value.
     * @returns the short stamp, or an empty string.
     */
    function displayStamp(value) {
      const stamp = stampOf(value)
      if (stamp === null) return ''
      const date = new Date(stamp)
      return `${String(date.getFullYear()).slice(-2)}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
        + ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
    }

    /**
     * Build a canonical stamp from its parts.
     * @param year - four-digit year.
     * @param month - 1-based month.
     * @param day - day of month.
     * @param timePart - `HH:mm`, `HH`, or an empty string for noon.
     * @returns `{ value }` with a canonical stamp, or `{ error }`.
     */
    function buildStamp(year, month, day, timePart) {
      let hour = 12
      let minute = 0
      if (timePart !== '') {
        const time = /^(\d{1,2})(?::(\d{1,2}))?(?::\d{1,2})?$/.exec(timePart)
        if (time === null) return { error: 'format' }
        hour = Number(time[1])
        minute = time[2] === undefined ? 0 : Number(time[2])
      }
      if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return { error: 'range' }
      const built = new Date(year, month - 1, day, hour, minute, 0, 0)
      if (built.getFullYear() !== year || built.getMonth() !== month - 1 || built.getDate() !== day) {
        return { error: 'range' }
      }
      return { value: `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}` }
    }

    /**
     * Parse one typed stamp. Accepted forms include `26-11-20 18:00`,
     * `2026-11-20 18:00`, `26/11/20`, `26年11月20日 18:00`, and `11-20`; a
     * missing time means 12:00, and a missing year means this year — or next
     * year when that day has already passed. Full-width digits and colon are
     * accepted, so a Chinese input method cannot block the field.
     * @param raw - the typed text.
     * @param now - clock used to place a year-less date.
     * @returns `{ value }` with a canonical stamp (empty for empty text), or `{ error }`.
     */
    function parseStampInput(raw, now = Date.now()) {
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (text === '') return { value: '' }
      const normalized = text
        .replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
        .replace(/[：]/g, ':')
        .replace(/[－—–−]/g, '-')
        .replace(/[／]/g, '/')
        .replace(/[．。]/g, '.')
        .replace(/[　]/g, ' ')
        .replace(/[年月]/g, '-')
        .replace(/日/g, ' ')
        .replace(/[./]/g, '-')
        .replace(/[Tt]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const [datePart = '', timePart = ''] = normalized.split(' ')
      if (datePart === '' || normalized.split(' ').length > 2) return { error: 'format' }

      const dated = /^(\d{4}|\d{2})-(\d{1,2})-(\d{1,2})$/.exec(datePart)
      if (dated !== null) {
        const year = Number(dated[1]) + (dated[1].length === 2 ? 2000 : 0)
        return buildStamp(year, Number(dated[2]), Number(dated[3]), timePart)
      }

      const yearless = /^(\d{1,2})-(\d{1,2})$/.exec(datePart)
      if (yearless === null) return { error: 'format' }
      const month = Number(yearless[1])
      const day = Number(yearless[2])
      const thisYear = new Date(now).getFullYear()
      const candidate = buildStamp(thisYear, month, day, timePart)
      if ('error' in candidate) return candidate
      // A calendar day that is entirely behind the clock means the next
      // occurrence; a day that is still today keeps this year even when its
      // default noon has already passed.
      const dayEnd = new Date(thisYear, month - 1, day, 23, 59, 59, 999).getTime()
      return Number.isFinite(dayEnd) && dayEnd < now
        ? buildStamp(thisYear + 1, month, day, timePart)
        : candidate
    }

    // ---------------------------------------------------------------------
    // Ordering
    // ---------------------------------------------------------------------

    /**
     * Sort key of one deadline task: its estimate outranks its deadline.
     * @param task - the board task.
     * @returns epoch milliseconds, or Infinity when neither value is set.
     */
    function taskSortKey(task) {
      const estimate = stampOf(task.expectedAt)
      if (estimate !== null) return estimate
      const deadline = stampOf(task.deadline)
      return deadline === null ? Number.POSITIVE_INFINITY : deadline
    }

    /**
     * Compare deadline tasks for display: open ones first, then estimate-first.
     * @param left - first task.
     * @param right - second task.
     * @returns sort result.
     */
    function compareTasks(left, right) {
      if (left.done !== right.done) return left.done ? 1 : -1
      const key = taskSortKey(left) - taskSortKey(right)
      if (key !== 0) return key
      const deadline = (stampOf(left.deadline) ?? Number.POSITIVE_INFINITY)
        - (stampOf(right.deadline) ?? Number.POSITIVE_INFINITY)
      if (deadline !== 0) return deadline
      const added = (stampOf(left.createdAt) ?? 0) - (stampOf(right.createdAt) ?? 0)
      if (added !== 0) return added
      return String(left.title).localeCompare(String(right.title))
    }

    /**
     * Sort a task list without mutating the stored order.
     * @param tasks - stored tasks.
     * @returns a new sorted array.
     */
    function sortTasks(tasks) {
      return [...tasks].sort(compareTasks)
    }

    /**
     * Sort subtasks by their estimate, leaving untimed ones in added order.
     * The index tiebreak makes the comparison total, so equal estimates keep
     * their stored order too.
     * @param subtasks - stored subtasks.
     * @returns a new sorted array.
     */
    function sortSubtasks(subtasks) {
      return subtasks
        .map((task, index) => ({ task, index }))
        .sort((left, right) => {
          const leftStamp = stampOf(left.task.expectedAt)
          const rightStamp = stampOf(right.task.expectedAt)
          if (leftStamp === null && rightStamp === null) return left.index - right.index
          if (leftStamp === null) return 1
          if (rightStamp === null) return -1
          return leftStamp - rightStamp || left.index - right.index
        })
        .map(entry => entry.task)
    }

    // ---------------------------------------------------------------------
    // Document shape
    // ---------------------------------------------------------------------

    /**
     * Build an id for a new task or subtask.
     * @returns a unique id.
     */
    function createId() {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
      return `ddl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

    /**
     * Normalize one stored subtask.
     * @param raw - untrusted stored value.
     * @returns the subtask, or null when it is unusable.
     */
    function normalizeSubtask(raw) {
      if (raw === null || typeof raw !== 'object') return null
      if (typeof raw.title !== 'string' || raw.title.trim() === '') return null
      return {
        id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : createId(),
        title: raw.title,
        expectedAt: typeof raw.expectedAt === 'string' ? raw.expectedAt : '',
        done: raw.done === true,
        createdAt: typeof raw.createdAt === 'string' && raw.createdAt !== ''
          ? raw.createdAt
          : new Date().toISOString(),
      }
    }

    /**
     * Normalize one stored deadline task.
     * @param raw - untrusted stored value.
     * @returns the task, or null when it is unusable.
     */
    function normalizeTask(raw) {
      if (raw === null || typeof raw !== 'object') return null
      if (typeof raw.title !== 'string' || raw.title.trim() === '') return null
      const subtasks = Array.isArray(raw.subtasks) ? raw.subtasks : []
      return {
        id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : createId(),
        title: raw.title,
        deadline: typeof raw.deadline === 'string' ? raw.deadline : '',
        expectedAt: typeof raw.expectedAt === 'string' ? raw.expectedAt : '',
        notes: typeof raw.notes === 'string' ? raw.notes : '',
        done: raw.done === true,
        createdAt: typeof raw.createdAt === 'string' && raw.createdAt !== ''
          ? raw.createdAt
          : new Date().toISOString(),
        subtasks: subtasks.map(normalizeSubtask).filter(task => task !== null),
      }
    }

    /**
     * Normalize a whole stored document.
     * @param value - untrusted stored value.
     * @returns the stored tasks.
     */
    function normalizeDocument(value) {
      if (value === null || typeof value !== 'object' || !Array.isArray(value.tasks)) return []
      return value.tasks.map(normalizeTask).filter(task => task !== null)
    }

    // ---------------------------------------------------------------------
    // Board store
    // ---------------------------------------------------------------------

    /**
     * Read the browser mirror of the board.
     * @returns the stored tasks and whether they still have to reach the Host.
     */
    function readBrowserRecord() {
      try {
        const text = window.localStorage.getItem(LOCAL_KEY)
        if (text === null) return { tasks: [], pending: false }
        const record = JSON.parse(text)
        return {
          tasks: normalizeDocument(record),
          pending: record?.pending === true,
        }
      } catch {
        return { tasks: [], pending: false }
      }
    }

    /**
     * Write the browser mirror of the board.
     * @param tasks - the current board.
     * @param pending - whether these tasks still have to reach the Host file.
     * @returns whether the browser accepted the document.
     */
    function writeBrowserRecord(tasks, pending) {
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ version: 1, tasks, pending }))
        return true
      } catch {
        return false
      }
    }

    /**
     * Create the board store shared by the page and its cards.
     * @returns the store: snapshot, subscription, actions, and the initial load.
     */
    function createBoard() {
      let state = { status: 'loading', tasks: [], source: 'host', save: 'idle', pending: null }
      let timer = null
      const listeners = new Set()

      const getSnapshot = () => state
      const subscribe = (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      }
      const notify = () => {
        for (const listener of [...listeners]) listener()
      }
      const publish = (patch) => {
        state = { ...state, ...patch }
        notify()
      }

      const schedulePersist = () => {
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          void persist()
        }, SAVE_DELAY_MS)
      }

      const mutate = (mapper) => {
        state = { ...state, tasks: mapper(state.tasks) }
        notify()
        schedulePersist()
      }

      async function persist() {
        const tasks = state.tasks
        publish({ save: 'saving' })
        if (state.source !== 'host') {
          // Nothing to write but the browser mirror; it stays pending so the
          // Host file can be offered the copy once the route answers again.
          const stored = writeBrowserRecord(tasks, true)
          publish({ save: stored ? 'saved' : 'error' })
          return
        }
        try {
          const response = await fetch(STATE_PATH, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ version: 1, tasks }),
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          writeBrowserRecord(tasks, false)
          publish({ save: 'saved', pending: null })
        } catch {
          // Keep the document in the browser and mark it pending, so the work
          // survives a reload and can be pushed to the Host later.
          writeBrowserRecord(tasks, true)
          publish({ save: 'error', pending: null })
        }
      }

      async function load() {
        const mirror = readBrowserRecord()
        try {
          const response = await fetch(STATE_PATH, {
            headers: { accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const document = await response.json()
          const tasks = normalizeDocument(document)
          // A browser copy that never reached the Host is offered, not applied:
          // the Host file stays authoritative until the user chooses.
          publish({
            status: 'ready',
            source: 'host',
            tasks,
            save: 'idle',
            pending: mirror.pending && mirror.tasks.length > 0 ? mirror.tasks : null,
          })
        } catch {
          publish({
            status: 'ready',
            source: 'local',
            tasks: mirror.tasks,
            save: 'idle',
            pending: null,
          })
        }
      }

      return {
        getSnapshot,
        subscribe,
        load,
        dispose() {
          if (timer !== null) {
            clearTimeout(timer)
            timer = null
          }
          listeners.clear()
        },
        /** Re-read the Host board, or retry the write that failed. */
        retry() {
          if (state.source === 'local') {
            void load()
            return
          }
          if (timer !== null) {
            clearTimeout(timer)
            timer = null
          }
          void persist()
        },
        /** Replace the Host board with the browser copy that never reached it. */
        restorePending() {
          const tasks = state.pending
          if (tasks === null) return
          state = { ...state, tasks, pending: null, source: 'host' }
          notify()
          schedulePersist()
        },
        /** Drop the browser copy and keep the Host board. */
        dismissPending() {
          writeBrowserRecord(state.tasks, false)
          publish({ pending: null })
        },
        addTask(draft) {
          const task = normalizeTask({
            id: createId(),
            title: draft.title,
            deadline: draft.deadline,
            expectedAt: draft.expectedAt,
            notes: draft.notes,
            done: false,
            createdAt: new Date().toISOString(),
            subtasks: [],
          })
          if (task === null) return
          mutate(tasks => [...tasks, task])
        },
        updateTask(id, patch) {
          mutate(tasks => tasks.map(task => task.id === id ? { ...task, ...patch } : task))
        },
        removeTask(id) {
          mutate(tasks => tasks.filter(task => task.id !== id))
        },
        toggleTask(id, done) {
          mutate(tasks => tasks.map(task => task.id === id ? { ...task, done } : task))
        },
        addSubtask(taskId, draft) {
          const subtask = normalizeSubtask({
            id: createId(),
            title: draft.title,
            expectedAt: draft.expectedAt,
            done: false,
            createdAt: new Date().toISOString(),
          })
          if (subtask === null) return
          mutate(tasks => tasks.map(task => task.id === taskId
            ? { ...task, subtasks: [...task.subtasks, subtask] }
            : task))
        },
        updateSubtask(taskId, subtaskId, patch) {
          mutate(tasks => tasks.map(task => task.id === taskId
            ? { ...task, subtasks: task.subtasks.map(subtask => subtask.id === subtaskId ? { ...subtask, ...patch } : subtask) }
            : task))
        },
        removeSubtask(taskId, subtaskId) {
          mutate(tasks => tasks.map(task => task.id === taskId
            ? { ...task, subtasks: task.subtasks.filter(subtask => subtask.id !== subtaskId) }
            : task))
        },
        toggleSubtask(taskId, subtaskId, done) {
          mutate(tasks => tasks.map(task => task.id === taskId
            ? { ...task, subtasks: task.subtasks.map(subtask => subtask.id === subtaskId ? { ...subtask, done } : subtask) }
            : task))
        },
      }
    }

    // ---------------------------------------------------------------------
    // Shared presentation pieces
    // ---------------------------------------------------------------------

    /**
     * Join truthy class names.
     * @param parts - class names or falsy values.
     * @returns the class attribute value.
     */
    function cx(...parts) {
      return parts.filter(part => typeof part === 'string' && part !== '').join(' ')
    }

    function plusGlyph() {
      return h('svg', {
        className: 'ddl-glyph', width: 13, height: 13, viewBox: '0 0 16 16',
        'aria-hidden': true, focusable: 'false',
      }, h('path', {
        d: 'M8 3.2v9.6M3.2 8h9.6', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
      }))
    }

    function trashGlyph() {
      return h('svg', {
        className: 'ddl-glyph', width: 12, height: 12, viewBox: '0 0 16 16',
        'aria-hidden': true, focusable: 'false',
      },
      h('path', {
        d: 'M3.4 4.6h9.2M6.4 4.6V3.2h3.2v1.4M4.8 4.6l.6 8.2h5.2l.6-8.2',
        stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    function calendarGlyph() {
      return h('svg', {
        className: 'ddl-glyph', width: 13, height: 13, viewBox: '0 0 16 16',
        'aria-hidden': true, focusable: 'false',
      },
      h('rect', {
        x: 2.4, y: 3.6, width: 11.2, height: 10, rx: 2,
        stroke: 'currentColor', strokeWidth: 1.4, fill: 'none',
      }),
      h('path', {
        d: 'M2.8 6.5h10.4M5.6 2.2v2.5M10.4 2.2v2.5',
        stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
      }))
    }

    function badge(text, className) {
      return h('span', { className: cx('ddl-badge', className), key: text }, text)
    }

    function metaItem(key, label, value, tone) {
      return h('span', { className: cx('ddl-meta-item', tone), key },
        h('span', { className: 'ddl-meta-key' }, label),
        h('span', { className: 'ddl-meta-value' }, value))
    }

    /**
     * One labeled form control.
     * @param id - input id the label points at.
     * @param label - visible label text.
     * @param control - the input or textarea.
     * @returns the field markup.
     */
    function field(id, label, control) {
      return h('label', { className: 'ddl-field', htmlFor: id, key: id },
        h('span', null, label),
        control)
    }

    /**
     * The left-sidebar glyph; the sidebar owns the button and its label.
     * @param props - requested edge and selection state.
     * @returns the panel icon.
     */
    function BoardIcon(props) {
      const edge = typeof props.size === 'number' && props.size > 0 ? props.size : 20
      return h('svg', {
        width: edge, height: edge, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': true, focusable: 'false',
      },
      h('rect', {
        x: 4.2, y: 4.8, width: 15.6, height: 14.8, rx: 3,
        stroke: 'currentColor', strokeWidth: 1.5,
      }),
      h('path', {
        d: 'M8 11.9l1.8 1.8 3.4-3.9', stroke: 'currentColor', strokeWidth: 1.7,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
      h('path', {
        d: 'M15.4 12.3h2', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
      }),
      h('path', {
        d: 'M8.2 16.4h8.2', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', opacity: 0.55,
      }))
    }

    // ---------------------------------------------------------------------
    // Task form
    // ---------------------------------------------------------------------

    /**
     * Create or edit one task, or one subtask when `compact` is set.
     * @param props - translator, initial values, labels, and submit handlers.
     * @returns the form markup.
     */
    function TaskForm(props) {
      const { t, initial, submitLabel, onSubmit, onCancel, compact } = props
      const id = useId()
      const [title, setTitle] = useState(typeof initial?.title === 'string' ? initial.title : '')
      const [deadlineText, setDeadlineText] = useState(displayStamp(initial?.deadline))
      const [estimateText, setEstimateText] = useState(displayStamp(initial?.expectedAt))
      const [notes, setNotes] = useState(typeof initial?.notes === 'string' ? initial.notes : '')
      const [error, setError] = useState(null)
      const errorText = error === null ? '' : t(error)
      const errorId = `${id}-error`

      const deadlineResult = parseStampInput(deadlineText)
      const estimateResult = parseStampInput(estimateText)

      const submit = (event) => {
        event.preventDefault()
        if (title.trim() === '') {
          setError('errorTitle')
          return
        }
        if (compact !== true && deadlineText.trim() === '') {
          setError('errorDeadline')
          return
        }
        if ('error' in deadlineResult || 'error' in estimateResult) {
          setError('errorDate')
          return
        }
        setError(null)
        onSubmit({
          title: title.trim(),
          deadline: compact === true ? (initial?.deadline ?? '') : deadlineResult.value,
          expectedAt: estimateResult.value,
          notes: compact === true ? (initial?.notes ?? '') : notes.trim(),
        })
      }

      return h('form', {
        className: cx('ddl-form', compact === true && 'is-compact'),
        onSubmit: submit,
        'aria-label': compact === true ? t('subtaskForm') : t('taskForm'),
      },
      h('div', { className: 'ddl-form-grid' },
        field(`${id}-title`, t('titleLabel'),
          h('input', {
            id: `${id}-title`, className: 'ddl-input', value: title, autoFocus: true,
            placeholder: t('titlePlaceholder'),
            'aria-invalid': error === 'errorTitle',
            'aria-describedby': error === 'errorTitle' ? errorId : undefined,
            onChange: event => setTitle(event.target.value),
          })),
        compact === true
          ? null
          : h(DateTimeField, {
            t,
            id: `${id}-deadline`,
            label: t('deadlineLabel'),
            value: deadlineText,
            onChange: setDeadlineText,
            'aria-describedby': error === 'errorDeadline' || error === 'errorDate' ? errorId : undefined,
          }),
        h(DateTimeField, {
          t,
          id: `${id}-estimate`,
          label: t('estimateLabel'),
          value: estimateText,
          onChange: setEstimateText,
          hintWhenEmpty: t('estimateHelper'),
          'aria-describedby': error === 'errorDate' ? errorId : undefined,
        })),
      compact === true
        ? null
        : h('label', { className: 'ddl-field', htmlFor: `${id}-notes` },
          h('span', null, t('notesLabel')),
          h('textarea', {
            id: `${id}-notes`, className: 'ddl-input ddl-textarea', value: notes,
            placeholder: t('notesPlaceholder'),
            onChange: event => setNotes(event.target.value),
          })),
      errorText === '' ? null : h('p', { className: 'ddl-error', id: errorId, role: 'alert' }, errorText),
      h('div', { className: 'ddl-form-actions' },
        h('button', { type: 'button', className: 'ddl-btn ddl-btn-sm', onClick: onCancel }, t('cancel')),
        h('button', { type: 'submit', className: 'ddl-btn ddl-btn-primary ddl-btn-sm' }, submitLabel)))
    }

    /**
     * One date/time field: a short typed stamp with a two-digit year, plus the
     * native picker behind a button for anyone who prefers clicking a calendar.
     *
     * A parsed value is echoed with its full year, so "26" is visible as 2026
     * before the form is submitted.
     * @param props - translator, field id and label, current text, and its setter.
     * @returns the field markup.
     */
    function DateTimeField(props) {
      const { t, id, label, value, onChange, hintWhenEmpty } = props
      const nativeInput = useRef(null)
      const hintId = `${id}-hint`
      const parsed = parseStampInput(value)
      const resolved = 'value' in parsed ? parsed.value : ''

      const openPicker = () => {
        const input = nativeInput.current
        if (input === null) return
        try {
          input.showPicker()
        } catch {
          input.focus()
        }
      }

      const hintText = 'error' in parsed
        ? t('errorDate')
        : resolved === ''
          ? (hintWhenEmpty ?? '')
          : `→ ${resolved.replace('T', ' ')}`
      const describedBy = [props['aria-describedby'], hintId].filter(Boolean).join(' ')

      return h('div', { className: 'ddl-field' },
        h('label', { className: 'ddl-field-label', htmlFor: id }, label),
        h('span', { className: 'ddl-input-row' },
          h('input', {
            id,
            className: 'ddl-input',
            value,
            placeholder: t('datePlaceholder'),
            inputMode: 'numeric',
            autoComplete: 'off',
            spellCheck: false,
            'aria-invalid': 'error' in parsed,
            'aria-describedby': describedBy,
            onChange: event => onChange(event.target.value),
            onBlur: () => {
              const result = parseStampInput(value)
              // Normalize a parseable stamp so the next edit starts from the form
              // the parser reads, including the noon default for a date only.
              if ('value' in result && result.value !== '') onChange(displayStamp(result.value))
            },
          }),
          h('button', {
            type: 'button',
            className: 'ddl-icon-btn ddl-picker-btn',
            'aria-label': t('openPicker'),
            onClick: openPicker,
          }, calendarGlyph()),
          h('input', {
            className: 'ddl-hidden-input',
            type: 'datetime-local',
            ref: nativeInput,
            value: resolved,
            tabIndex: -1,
            'aria-hidden': true,
            onChange: (event) => {
              if (event.target.value !== '') onChange(displayStamp(event.target.value))
            },
          })),
        h('span', {
          className: cx('ddl-field-hint', 'error' in parsed && 'is-error'),
          id: hintId,
          role: 'error' in parsed ? 'alert' : undefined,
        }, hintText))
    }

    // ---------------------------------------------------------------------
    // Task card
    // ---------------------------------------------------------------------

    /**
     * Render one deadline task with its subtasks.
     * @param props - the task, translator, current clock, and board actions.
     * @returns the card markup.
     */
    function TaskCard(props) {
      const { task, t, now, board } = props
      const [editing, setEditing] = useState(false)
      const [confirming, setConfirming] = useState(false)
      const [addingSubtask, setAddingSubtask] = useState(false)
      const [editingSubtaskId, setEditingSubtaskId] = useState(null)
      const [confirmSubtaskId, setConfirmSubtaskId] = useState(null)
      const editTrigger = useRef(null)
      const addTrigger = useRef(null)
      const deleteTrigger = useRef(null)
      const cancelTrigger = useRef(null)

      const deadline = stampOf(task.deadline)
      const estimate = stampOf(task.expectedAt)
      const overdue = task.done !== true && deadline !== null && deadline < now
      const lateFinish = estimate !== null && deadline !== null && estimate > deadline
      const subtasks = sortSubtasks(task.subtasks ?? [])
      const closeEditing = () => {
        setEditing(false)
        editTrigger.current?.focus()
      }
      const closeAdding = () => {
        setAddingSubtask(false)
        addTrigger.current?.focus()
      }
      const closeConfirm = () => {
        setConfirming(false)
        deleteTrigger.current?.focus()
      }

      // Opening the confirmation moves focus onto its cancel button, so a
      // keyboard user never has to tab through the card again to answer it.
      useEffect(() => {
        if (confirming) cancelTrigger.current?.focus()
      }, [confirming])

      const head = h('div', { className: 'ddl-card-head' },
        h('input', {
          type: 'checkbox',
          className: 'ddl-check',
          checked: task.done === true,
          'aria-label': t(task.done === true ? 'markOpen' : 'markDone', { title: task.title }),
          onChange: event => board.toggleTask(task.id, event.target.checked),
        }),
        h('div', { className: 'ddl-card-body' },
          h('div', { className: 'ddl-card-title-row' },
            h('h3', { className: 'ddl-card-title' }, task.title),
            overdue ? badge(t('statusOverdue'), 'ddl-badge-error') : null,
            lateFinish ? badge(t('statusLate'), 'ddl-badge-warn') : null,
            task.done === true ? badge(t('statusDone'), 'ddl-badge-ok') : null),
          h('div', { className: 'ddl-meta' },
            metaItem('deadline', `${t('deadlineLabel')} `, formatStamp(task.deadline, t)),
            metaItem('estimate', `${t('estimateLabel')} `, formatStamp(task.expectedAt, t)),
            deadline === null || task.done === true
              ? null
              : metaItem('remaining', '', distanceText(deadline - now, t), overdue ? 'is-error' : null),
            estimate === null && deadline !== null
              ? h('span', { className: 'ddl-meta-item ddl-meta-note', key: 'sorted' }, t('sortedByDeadline'))
              : null,
            subtasks.length === 0
              ? null
              : h('span', { className: 'ddl-meta-item', key: 'subtasks' },
                h('span', { className: 'ddl-meta-key' },
                  t(subtasks.length === 1 ? 'subtaskCountOne' : 'subtaskCount', { count: subtasks.length })))),
          task.notes === '' ? null : h('p', { className: 'ddl-notes' }, task.notes)),
        h('div', { className: 'ddl-card-actions' },
          h('button', {
            type: 'button', className: 'ddl-btn ddl-btn-ghost ddl-btn-sm', ref: addTrigger,
            'aria-expanded': addingSubtask === true,
            onClick: () => {
              const next = !addingSubtask
              setAddingSubtask(next)
              setEditing(false)
              if (!next) addTrigger.current?.focus()
            },
          }, plusGlyph(), h('span', null, t('addSubtask'))),
          h('button', {
            type: 'button', className: 'ddl-btn ddl-btn-ghost ddl-btn-sm', ref: editTrigger,
            'aria-expanded': editing === true,
            onClick: () => {
              const next = !editing
              setEditing(next)
              setAddingSubtask(false)
              if (!next) editTrigger.current?.focus()
            },
          }, t('edit')),
          h('button', {
            type: 'button', className: 'ddl-btn ddl-btn-ghost ddl-btn-sm', ref: deleteTrigger,
            onClick: () => setConfirming(true),
          }, t('delete'))))

      return h('li', {
        className: cx('ddl-card', task.done === true && 'is-done', overdue && 'is-overdue'),
        onKeyDown: (event) => {
          if (event.key !== 'Escape') return
          if (confirming) {
            event.stopPropagation()
            closeConfirm()
          } else if (addingSubtask) {
            event.stopPropagation()
            closeAdding()
          } else if (editing) {
            event.stopPropagation()
            closeEditing()
          }
        },
      },
      head,
      editing
        ? h(TaskForm, {
          t,
          initial: task,
          submitLabel: t('save'),
          onCancel: closeEditing,
          onSubmit: (draft) => {
            board.updateTask(task.id, draft)
            closeEditing()
          },
        })
        : null,
      confirming
        ? h('div', {
          className: 'ddl-confirm',
          role: 'group',
          'aria-label': t('deleteTaskConfirm', { title: task.title }),
        },
        h('span', null, t('deleteTaskConfirm', { title: task.title })),
        h('span', { className: 'ddl-confirm-actions' },
          h('button', {
            type: 'button', className: 'ddl-btn ddl-btn-sm', ref: cancelTrigger, onClick: closeConfirm,
          }, t('cancel')),
          h('button', {
            type: 'button', className: 'ddl-btn ddl-btn-sm ddl-btn-danger',
            onClick: () => board.removeTask(task.id),
          }, t('delete'))))
        : null,
      subtasks.length === 0
        ? null
        : h('ul', { className: 'ddl-subtasks', 'aria-label': t('subtaskLabel') },
          subtasks.map((subtask) => {
            if (editingSubtaskId === subtask.id) {
              return h('li', { className: 'ddl-subtask is-editing', key: subtask.id },
                h(TaskForm, {
                  t,
                  compact: true,
                  initial: subtask,
                  submitLabel: t('save'),
                  onCancel: () => setEditingSubtaskId(null),
                  onSubmit: (draft) => {
                    board.updateSubtask(task.id, subtask.id, draft)
                    setEditingSubtaskId(null)
                  },
                }))
            }
            const confirmingSubtask = confirmSubtaskId === subtask.id
            return h('li', { className: 'ddl-subtask', key: subtask.id },
              h('input', {
                type: 'checkbox',
                className: 'ddl-check ddl-check-sm',
                checked: subtask.done === true,
                'aria-label': t(subtask.done === true ? 'markOpen' : 'markDone', { title: subtask.title }),
                onChange: event => board.toggleSubtask(task.id, subtask.id, event.target.checked),
              }),
              h('button', {
                type: 'button',
                className: cx('ddl-subtask-title', subtask.done === true && 'is-done'),
                title: t('editSubtask', { title: subtask.title }),
                'aria-label': t('editSubtask', { title: subtask.title }),
                onClick: () => setEditingSubtaskId(subtask.id),
              }, subtask.title),
              h('span', { className: 'ddl-subtask-time' }, formatStamp(subtask.expectedAt, t)),
              confirmingSubtask
                ? h('span', { className: 'ddl-subtask-confirm' },
                  h('button', {
                    type: 'button', className: 'ddl-btn ddl-btn-sm', autoFocus: true,
                    onClick: () => setConfirmSubtaskId(null),
                  }, t('cancel')),
                  h('button', {
                    type: 'button', className: 'ddl-btn ddl-btn-sm ddl-btn-danger',
                    onClick: () => board.removeSubtask(task.id, subtask.id),
                  }, t('delete')))
                : h('button', {
                  type: 'button',
                  className: 'ddl-icon-btn',
                  'aria-label': t('deleteSubtask', { title: subtask.title }),
                  onClick: () => setConfirmSubtaskId(subtask.id),
                }, trashGlyph()))
          })),
      addingSubtask
        ? h(TaskForm, {
          t,
          compact: true,
          submitLabel: t('addSubtask'),
          onCancel: closeAdding,
          onSubmit: (draft) => {
            board.addSubtask(task.id, draft)
            closeAdding()
          },
        })
        : null)
    }

    // ---------------------------------------------------------------------
    // Page
    // ---------------------------------------------------------------------

    /**
     * Render the board page the sidebar entry selects.
     * @param props - injected board store and localized copy.
     * @returns the page markup.
     */
    function ManagerPage(props) {
      const { t, board } = props
      const state = useSyncExternalStore(board.subscribe, board.getSnapshot)
      const [now, setNow] = useState(() => Date.now())
      const [creating, setCreating] = useState(false)
      const createTrigger = useRef(null)

      useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(timer)
      }, [])

      const tasks = useMemo(() => sortTasks(state.tasks), [state.tasks])
      const open = tasks.filter(task => task.done !== true)
      const finished = tasks.filter(task => task.done === true)
      const storage = state.source === 'local' ? t('storageLocal') : t('storageHost')
      const progress = state.save === 'saving'
        ? ` · ${t('saving')}`
        : state.save === 'error'
          ? ` · ${t('saveFailed')}`
          : state.save === 'saved'
            ? ` · ${t('saved')}`
            : ''

      const subtitle = state.status === 'loading'
        ? t('loading')
        : t('subtitle', { open: open.length, done: finished.length })

      const empty = state.status === 'ready' && tasks.length === 0 && !creating
      const closeCreate = () => {
        setCreating(false)
        createTrigger.current?.focus()
      }

      const createButton = (className) => h('button', {
        type: 'button',
        className,
        ref: createTrigger,
        onClick: () => setCreating(true),
      }, plusGlyph(), h('span', null, t('newTask')))

      const emptyNotice = h('div', { className: 'ddl-empty', role: 'status' },
        h('div', { className: 'ddl-empty-glyph' }, h(BoardIcon, { size: 40 })),
        h('h2', null, t('emptyTitle')),
        h('p', null, t('emptyBody')),
        createButton('ddl-btn ddl-btn-primary'))

      // A storage problem is stated where the list is, not hidden in the status
      // line: an unreachable Host or a copy that never reached it changes what
      // the user is looking at.
      const problem = state.pending !== null
        ? {
          key: 'pending',
          text: t('pendingLocal', { count: state.pending.length }),
          actions: [
            { label: t('restore'), onClick: () => board.restorePending() },
            { label: t('dismiss'), onClick: () => board.dismissPending() },
          ],
        }
        : state.source === 'local'
          ? {
            key: 'hostUnreachable',
            text: t('hostUnreachable'),
            actions: [{ label: t('retry'), onClick: () => board.retry() }],
          }
          : state.save === 'error'
            ? {
              key: 'saveFailed',
              text: t('saveFailedHint'),
              actions: [{ label: t('retry'), onClick: () => board.retry() }],
            }
            : null

      const problemBanner = problem === null
        ? null
        : h('div', { className: 'ddl-banner', role: 'status', key: problem.key },
          h('span', { className: 'ddl-banner-text' }, problem.text),
          h('span', { className: 'ddl-banner-actions' },
            problem.actions.map(action => h('button', {
              type: 'button', className: 'ddl-btn ddl-btn-sm', key: action.label, onClick: action.onClick,
            }, action.label))))

      const openList = h('section', { className: 'ddl-group' },
        h('h2', { className: 'ddl-group-title' }, t('openSection', { count: open.length })),
        h('ul', { className: 'ddl-list', 'aria-label': t('openSection', { count: open.length }) },
          open.map(task => h(TaskCard, { key: task.id, task, t, now, board }))))

      const finishedList = h('section', { className: 'ddl-group ddl-finished' },
        h('h2', { className: 'ddl-group-title' }, t('doneSection', { count: finished.length })),
        h('ul', { className: 'ddl-list', 'aria-label': t('doneSection', { count: finished.length }) },
          finished.map(task => h(TaskCard, { key: task.id, task, t, now, board }))))

      const header = h('header', { className: 'ddl-head' },
        h('div', { className: 'ddl-head-text' },
          h('h1', { className: 'ddl-title' }, t('title')),
          h('p', { className: 'ddl-subtitle' }, subtitle)),
        h('div', { className: 'ddl-head-actions' },
          creating ? null : createButton('ddl-btn ddl-btn-primary')))

      const hint = h('div', { className: 'ddl-hint' },
        h('span', { className: 'ddl-hint-text' }, t('sortHint')),
        h('span', {
          className: cx('ddl-hint-state', state.save === 'error' && 'is-error'),
          role: 'status',
          'aria-live': 'polite',
        }, `${storage}${progress}`))

      const form = creating
        ? h(TaskForm, {
          t,
          submitLabel: t('create'),
          onCancel: closeCreate,
          onSubmit: (draft) => {
            board.addTask(draft)
            closeCreate()
          },
        })
        : null

      const content = h('div', { className: 'ddl-content' },
        header,
        hint,
        problemBanner,
        form,
        state.status === 'loading' ? h('div', { className: 'ddl-empty', role: 'status' }, h('p', null, t('loading'))) : null,
        empty ? emptyNotice : null,
        open.length === 0 ? null : openList,
        finished.length === 0 ? null : finishedList)

      return h('section', { className: 'ddl-page', 'aria-label': t('title') },
        h('style', null, PAGE_CSS),
        h('div', { className: 'ddl-scroll' }, content))
    }

    // ---------------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------------

    const PAGE_CSS = `
.ddl-page { display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font-size: 14px; line-height: 1.6; }
.ddl-scroll { flex: 1; min-height: 0; overflow: auto; scrollbar-gutter: stable; --dsh-scrollbar-width: 9px; --dsh-scrollbar-thumb-border: 2px; }
.ddl-content { box-sizing: border-box; max-width: 960px; margin: 0 auto; padding: 0 clamp(24px, 4vw, 48px) 56px; }
.ddl-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; padding-top: 28px; margin-bottom: 16px; }
[data-platform='darwin'] .ddl-head { padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px)); }
.ddl-head-text { min-width: 0; }
.ddl-title { margin: 0; font-size: 20px; line-height: 28px; font-weight: 500; }
.ddl-subtitle { margin: 2px 0 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.ddl-head-actions { display: flex; align-items: center; gap: 8px; flex: none; }
.ddl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 16px; border: 0.5px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; white-space: nowrap; transition: background-color .12s ease, color .12s ease, border-color .12s ease; }
.ddl-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ddl-btn:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.ddl-btn-sm { height: 26px; padding: 0 10px; border-radius: 13px; font-size: 12px; }
.ddl-btn-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base)); font-weight: 500; }
.ddl-btn-primary:hover { background: var(--dsw-alias-brand-primary); opacity: .88; }
.ddl-btn-ghost { border-color: transparent; color: var(--dsw-alias-label-secondary); }
.ddl-btn-ghost:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.ddl-btn-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.ddl-btn-danger:hover { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); }
.ddl-glyph { flex: none; }
.ddl-hint { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 16px; margin: 0 0 18px; padding: 8px 12px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-layer-1)); font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ddl-hint-text { min-width: 0; }
.ddl-hint-state { margin-left: auto; font-variant-numeric: tabular-nums; }
.ddl-hint-state.is-error { color: var(--dsw-alias-state-error-primary); }
.ddl-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; margin: 0 0 18px; padding: 8px 12px; border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent); border-radius: 10px; background: var(--dsw-alias-state-warn-tertiary, transparent); color: var(--dsw-alias-label-primary); font-size: 12px; }
.ddl-banner-actions { display: flex; gap: 6px; margin-left: auto; }
.ddl-group { margin-top: 4px; }
.ddl-finished { margin-top: 24px; }
.ddl-group-title { margin: 0 0 10px; font-size: 14px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.ddl-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ddl-card { border: 0.5px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); padding: 12px 14px; }
.ddl-card.is-overdue { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, var(--dsw-alias-border-l3)); }
.ddl-card.is-done { opacity: .75; }
.ddl-card-head { display: flex; align-items: flex-start; gap: 10px; }
.ddl-check { flex: none; width: 16px; height: 16px; margin: 4px 0 0; accent-color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.ddl-check-sm { width: 14px; height: 14px; margin-top: 2px; }
.ddl-card-body { flex: 1; min-width: 0; }
.ddl-card-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.ddl-card-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 22px; overflow-wrap: anywhere; }
.ddl-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; margin-top: 2px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ddl-meta-item { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; }
.ddl-meta-value { color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }
.ddl-meta-item.is-error, .ddl-meta-item.is-error .ddl-meta-value { color: var(--dsw-alias-state-error-primary); }
.ddl-meta-note { color: var(--dsw-alias-label-secondary); opacity: .85; }
.ddl-notes { margin: 6px 0 0; font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: pre-wrap; overflow-wrap: anywhere; }
.ddl-card-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 2px; flex: none; }
.ddl-badge { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; border-radius: 9px; border: 0.5px solid transparent; font-size: 12px; line-height: 16px; white-space: nowrap; }
.ddl-badge-error { color: var(--dsw-alias-state-error-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent); }
.ddl-badge-warn { background: var(--dsw-alias-state-warn-tertiary); color: var(--dsw-alias-label-primary); }
.ddl-badge-ok { background: var(--dsw-alias-state-success-tertiary); color: var(--dsw-alias-label-primary); }
.ddl-subtasks { list-style: none; margin: 10px 0 0; padding: 8px 0 0; border-top: 0.5px dashed var(--dsw-alias-border-l1); display: flex; flex-direction: column; gap: 1px; }
.ddl-subtask { display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 8px; }
.ddl-subtask:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ddl-subtask.is-editing { display: block; padding: 0; background: none; }
.ddl-subtask-title { flex: 1; min-width: 0; padding: 2px 0; border: 0; background: transparent; color: inherit; font: inherit; font-size: 13px; text-align: left; cursor: pointer; overflow-wrap: anywhere; }
.ddl-subtask-title:hover { color: var(--dsw-alias-state-business-primary); }
.ddl-subtask-title.is-done { text-decoration: line-through; color: var(--dsw-alias-label-secondary); }
.ddl-subtask-time { flex: none; font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.ddl-subtask-confirm { display: flex; gap: 6px; flex: none; }
.ddl-icon-btn { flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.ddl-icon-btn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ddl-icon-btn:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px; }
.ddl-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; padding: 14px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-interactive-bg-hover); }
.ddl-card .ddl-form { margin: 12px 0 0 26px; }
.ddl-card .ddl-form.is-compact { margin: 8px 0 0 26px; }
.ddl-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.ddl-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ddl-field > span, .ddl-field > label { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ddl-field-label { cursor: pointer; }
.ddl-field-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); opacity: .9; }
.ddl-field-hint.is-error { color: var(--dsw-alias-state-error-primary); opacity: 1; }
.ddl-input-row { display: flex; align-items: center; gap: 6px; }
.ddl-input-row .ddl-input { flex: 1; min-width: 0; }
.ddl-picker-btn { width: 32px; height: 32px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 8px; }
.ddl-picker-btn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ddl-hidden-input { position: absolute; width: 1px; height: 1px; padding: 0; margin: 0; border: 0; opacity: 0; pointer-events: none; }
.ddl-input { box-sizing: border-box; width: 100%; height: 32px; padding: 0 10px; border-radius: 8px; border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; }
.ddl-input:focus-visible { outline: none; border-color: var(--dsw-alias-state-business-primary); box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary); }
.ddl-input[aria-invalid='true'] { border-color: var(--dsw-alias-state-error-primary); }
.ddl-textarea { height: auto; min-height: 64px; padding: 8px 10px; resize: vertical; line-height: 1.5; }
.ddl-error { margin: 0; font-size: 12px; color: var(--dsw-alias-state-error-primary); }
.ddl-form-actions { display: flex; justify-content: flex-end; gap: 8px; }
.ddl-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 20px; border: 1px dashed var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); border-radius: 12px; text-align: center; }
.ddl-empty h2 { margin: 0; font-size: 15px; font-weight: 500; }
.ddl-empty p { margin: 0; max-width: 480px; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.ddl-empty-glyph { margin-bottom: 2px; color: var(--dsw-alias-label-secondary); opacity: .7; }
.ddl-empty .ddl-btn { margin-top: 8px; }
.ddl-confirm { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent); font-size: 12px; }
.ddl-confirm-actions { display: flex; gap: 6px; margin-left: auto; }
@media (max-width: 767px) { .ddl-content { padding-inline: 20px; } }
@media (max-width: 640px) {
  .ddl-card-head { flex-wrap: wrap; }
  .ddl-card-actions { width: 100%; justify-content: flex-start; padding-left: 26px; }
  .ddl-card .ddl-form { margin-left: 0; }
}
@media (pointer: coarse) {
  .ddl-btn { height: 36px; }
  .ddl-btn-sm { height: 30px; padding: 0 12px; }
  .ddl-icon-btn { width: 30px; height: 30px; }
  .ddl-input { height: 38px; font-size: 16px; }
  .ddl-picker-btn { width: 38px; height: 38px; }
  .ddl-check { width: 18px; height: 18px; }
  .ddl-check-sm { width: 16px; height: 16px; }
}
`

    // ---------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ddl-board: dictionaries')
        const t = ctx.locale.bind(NS)
        const board = createBoard()
        ctx.effect(() => {
          void board.load()
          return () => board.dispose()
        }, 'ddl-board: board state')

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ board }),
        }, ManagerPage))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          locale: NS,
          label: () => t('panel'),
        }, BoardIcon))
      },
    }
  },
})
