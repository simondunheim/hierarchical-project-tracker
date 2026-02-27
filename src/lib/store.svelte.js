const V1_KEY = 'tracker-post-v1'
const V2_KEY = 'tracker-post-v2'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function newItem(title = 'New Item') {
  return {
    id: genId(),
    title,
    status: 'todo',   // 'todo' | 'in-progress' | 'done' | 'blocked'
    progress: 0,      // 0–100, only used on leaf nodes
    expanded: true,
    children: [],
    bugs: [],         // [{ id, name, status: 'open'|'fixed'|'wont-fix' }]
    notes: '',        // free text, <BUG_NAME> references highlighted
    detailOpen: false
  }
}

/** Recursively compute progress: average of children, or own progress if leaf */
export function computeProgress(item) {
  if (!item.children.length) return item.progress
  const sum = item.children.reduce((acc, c) => acc + computeProgress(c), 0)
  return Math.round(sum / item.children.length)
}

/** Average computeProgress across root items in a project */
export function projectProgress(items) {
  if (!items.length) return 0
  const sum = items.reduce((acc, i) => acc + computeProgress(i), 0)
  return Math.round(sum / items.length)
}

function find(items, id) {
  for (const item of items) {
    if (item.id === id) return item
    const found = find(item.children, id)
    if (found) return found
  }
  return null
}

/** Returns { list, idx } where list is the array containing the item and idx its index.
 *  Returns null if not found. */
function findLocation(items, id) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return { list: items, idx: i }
    const found = findLocation(items[i].children, id)
    if (found) return found
  }
  return null
}

function collectAllBugs(items, path = []) {
  const result = []
  for (const item of items) {
    const itemPath = [...path, item.title]
    for (const bug of (item.bugs ?? [])) {
      result.push({ bug, item, itemPath })
    }
    if (item.children?.length) result.push(...collectAllBugs(item.children, itemPath))
  }
  return result
}

/** Walk tree bottom-up and auto-set parent statuses based on computed progress.
 *  Skips parents manually set to 'blocked'. */
function syncParentStatuses(items) {
  for (const item of items) {
    if (!item.children.length) continue
    syncParentStatuses(item.children)   // children first (bottom-up)
    if (item.status === 'blocked') continue
    const p = computeProgress(item)
    if (p === 100) item.status = 'done'
    else if (p === 0) item.status = 'todo'
    else item.status = 'in-progress'
  }
}

function setAllExpanded(items, val) {
  for (const item of items) {
    item.expanded = val
    setAllExpanded(item.children, val)
  }
}

function loadV2() {
  try { return JSON.parse(localStorage.getItem(V2_KEY)) } catch { return null }
}

function migrateFromV1() {
  try {
    const v1 = JSON.parse(localStorage.getItem(V1_KEY))
    if (!Array.isArray(v1)) return null
    const project = { id: genId(), name: 'My Project', items: v1 }
    return { projects: [project], currentId: project.id }
  } catch { return null }
}

function defaultData() {
  const project = { id: genId(), name: 'My Project', items: [newItem('My First Item')] }
  return { projects: [project], currentId: project.id }
}

function persist(data) {
  try { localStorage.setItem(V2_KEY, JSON.stringify(data)) } catch {}
}

// --- Reactive state ---

let _data = $state(loadV2() ?? migrateFromV1() ?? defaultData())

function save() {
  persist($state.snapshot(_data))
}

function currentProject() {
  return _data.projects.find(p => p.id === _data.currentId) ?? _data.projects[0]
}

function items() {
  return currentProject().items
}

export const store = {
  // --- Reads ---
  get projects() { return _data.projects },
  get currentProjectId() { return _data.currentId },

  // --- Project ops ---
  addProject() {
    const p = { id: genId(), name: 'New Project', items: [] }
    _data.projects.push(p)
    _data.currentId = p.id
    save()
  },

  deleteProject(id) {
    if (_data.projects.length <= 1) return
    const idx = _data.projects.findIndex(p => p.id === id)
    if (idx === -1) return
    _data.projects.splice(idx, 1)
    if (_data.currentId === id) {
      _data.currentId = _data.projects[Math.max(0, idx - 1)].id
    }
    save()
  },

  renameProject(id, name) {
    const p = _data.projects.find(p => p.id === id)
    if (p) { p.name = name; save() }
  },

  switchProject(id) {
    if (_data.projects.some(p => p.id === id)) {
      _data.currentId = id
      save()
    }
  },

  // --- Item reads ---
  get items() { return items() },

  // --- Item ops (operate on current project) ---
  addRoot() {
    items().push(newItem())
    save()
  },

  addChild(parentId) {
    const p = find(items(), parentId)
    if (!p) return
    p.children.push(newItem())
    p.expanded = true
    save()
  },

  updateTitle(id, title) {
    const item = find(items(), id)
    if (item) { item.title = title; save() }
  },

  updateProgress(id, val) {
    const item = find(items(), id)
    if (!item) return
    const clamped = Math.max(0, Math.min(100, Math.round(val)))
    item.progress = clamped
    if (clamped === 100) item.status = 'done'
    else if (clamped === 0) item.status = 'todo'
    else item.status = 'in-progress'
    syncParentStatuses(items())
    save()
  },

  cycleStatus(id) {
    const item = find(items(), id)
    if (!item) return
    const order = ['todo', 'in-progress', 'done', 'blocked']
    item.status = order[(order.indexOf(item.status) + 1) % order.length]
    save()
  },

  toggleExpanded(id) {
    const item = find(items(), id)
    if (item) { item.expanded = !item.expanded; save() }
  },

  expandAll()   { setAllExpanded(items(), true);  save() },
  collapseAll() { setAllExpanded(items(), false); save() },

  delete(id) {
    const loc = findLocation(items(), id)
    if (loc) { loc.list.splice(loc.idx, 1); save() }
  },

  addParent(itemId) {
    const loc = findLocation(items(), itemId)
    if (!loc) return
    const original = loc.list[loc.idx]
    const wrapper = newItem('New Parent')
    wrapper.children = [original]
    wrapper.expanded = true
    loc.list.splice(loc.idx, 1, wrapper)
    save()
  },

  // --- Notes & bugs ---
  toggleDetail(id) {
    const item = find(items(), id)
    if (!item) return
    item.detailOpen = !(item.detailOpen ?? false)
    save()
  },

  updateNotes(id, notes) {
    const item = find(items(), id)
    if (item) { item.notes = notes; save() }
  },

  get allBugs() { return collectAllBugs(items()) },

  addBug(itemId, name) {
    const item = find(items(), itemId)
    if (!item) return
    if (!item.bugs) item.bugs = []
    item.bugs.push({ id: genId(), name, status: 'open', errorCode: '' })
    save()
  },

  updateBugErrorCode(itemId, bugId, code) {
    const item = find(items(), itemId)
    const bug = item?.bugs?.find(b => b.id === bugId)
    if (bug) { bug.errorCode = code; save() }
  },

  deleteBug(itemId, bugId) {
    const item = find(items(), itemId)
    if (!item?.bugs) return
    const idx = item.bugs.findIndex(b => b.id === bugId)
    if (idx !== -1) { item.bugs.splice(idx, 1); save() }
  },

  renameBug(itemId, bugId, name) {
    const item = find(items(), itemId)
    const bug = item?.bugs?.find(b => b.id === bugId)
    if (bug) { bug.name = name; save() }
  },

  cycleBugStatus(itemId, bugId) {
    const item = find(items(), itemId)
    const bug = item?.bugs?.find(b => b.id === bugId)
    if (!bug) return
    const order = ['open', 'fixed', 'wont-fix']
    bug.status = order[(order.indexOf(bug.status) + 1) % order.length]
    save()
  },

  // --- Import / Export ---
  exportProject() {
    const p = currentProject()
    const json = JSON.stringify($state.snapshot(p.items), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  importProject(jsonString) {
    try {
      const parsed = JSON.parse(jsonString)
      if (!Array.isArray(parsed)) return false
      function regenIds(items) {
        return items.map(item => ({
          ...item,
          id: genId(),
          children: regenIds(item.children ?? []),
          bugs: (item.bugs ?? []).map(b => ({ ...b, id: genId() }))
        }))
      }
      currentProject().items = regenIds(parsed)
      save()
      return true
    } catch { return false }
  },

  // --- Drag and drop ---
  moveItem(draggedId, targetId, position) {
    if (draggedId === targetId) return
    const allItems = items()
    const dragLoc = findLocation(allItems, draggedId)
    if (!dragLoc) return
    const draggedItem = dragLoc.list[dragLoc.idx]
    // Prevent dropping into own descendants
    if (find([draggedItem], targetId)) return
    // Remove from current position first
    dragLoc.list.splice(dragLoc.idx, 1)
    if (position === 'inside') {
      const target = find(allItems, targetId)
      if (!target) { dragLoc.list.splice(dragLoc.idx, 0, draggedItem); return }
      if (!target.children) target.children = []
      target.children.push(draggedItem)
      target.expanded = true
    } else {
      const targetLoc = findLocation(allItems, targetId)
      if (!targetLoc) { dragLoc.list.splice(dragLoc.idx, 0, draggedItem); return }
      const idx = position === 'before' ? targetLoc.idx : targetLoc.idx + 1
      targetLoc.list.splice(idx, 0, draggedItem)
    }
    save()
  }
}
