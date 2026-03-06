import { supabase } from './supabase.js'

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
let _user = $state(null)
let _loading = $state(true)
let _sharedProjects = $state([])  // [{ id, name, owner_id, role, items }]
let _realtimeChannels = []
let _sharedSaveTimers = {}

// --- Supabase sync ---

let _saveTimer = null

function saveToSupabase() {
  if (!_user) return
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(async () => {
    const snapshot = $state.snapshot(_data)
    await supabase.from('user_data').upsert({
      user_id: _user.id,
      data: snapshot,
      updated_at: new Date().toISOString()
    })
  }, 800)
}

async function loadFromSupabase() {
  if (!_user) return
  const { data: row } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', _user.id)
    .single()
  if (row?.data) {
    _data = row.data
  } else {
    _data = loadV2() ?? migrateFromV1() ?? defaultData()
  }
}

// --- Shared project helpers ---

function isShared(id) {
  return _sharedProjects.some(p => p.id === id)
}

function saveCurrentProject() {
  if (isShared(_data.currentId)) saveSharedProject(_data.currentId)
  else save()
}

async function saveSharedProject(projectId) {
  if (!_user) return
  clearTimeout(_sharedSaveTimers[projectId])
  _sharedSaveTimers[projectId] = setTimeout(async () => {
    const sp = _sharedProjects.find(p => p.id === projectId)
    if (!sp) return
    await supabase.from('shared_project_data')
      .update({ items: $state.snapshot(sp.items), updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
  }, 800)
}

async function loadSharedProjects() {
  if (!_user) return
  const { data: memberships, error } = await supabase
    .from('shared_project_members')
    .select(`role, project:shared_projects(id, name, owner_id, data:shared_project_data(items))`)
    .eq('user_id', _user.id)
  if (error) { console.warn('[loadSharedProjects]', error.message); return }
  if (!memberships) return
  _sharedProjects = memberships.map(m => ({
    id: m.project.id, name: m.project.name,
    owner_id: m.project.owner_id, role: m.role,
    items: m.project.data?.items ?? []
  }))
}

function subscribeToSharedProjects() {
  for (const ch of _realtimeChannels) supabase.removeChannel(ch)
  _realtimeChannels = []
  for (const sp of _sharedProjects) {
    const channel = supabase.channel(`spd:${sp.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'shared_project_data',
        filter: `project_id=eq.${sp.id}`
      }, (payload) => {
        const idx = _sharedProjects.findIndex(p => p.id === sp.id)
        if (idx !== -1) _sharedProjects[idx] = { ..._sharedProjects[idx], items: payload.new.items }
      })
      .subscribe()
    _realtimeChannels.push(channel)
  }
}

// Auth state listener — fires on page load (INITIAL_SESSION) and on login/logout
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[auth]', event, session?.user?.email ?? 'no user')
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
    _user = session?.user ?? null
    _loading = false
    if (_user) {
      supabase.rpc('accept_project_invite', { p_email: _user.email })
        .then(r => { if (r.error) console.warn('[rpc]', r.error.message) })
        .catch(e => console.warn('[rpc] failed:', e))
      loadFromSupabase()
        .then(() => loadSharedProjects())
        .then(() => subscribeToSharedProjects())
        .catch(e => console.error('[auth] load error:', e))
    }
  } else if (event === 'SIGNED_OUT') {
    for (const ch of _realtimeChannels) supabase.removeChannel(ch)
    _realtimeChannels = []
    _user = null
    _sharedProjects = []
    _data = defaultData()
    _loading = false
  }
})

function save() {
  persist($state.snapshot(_data))
  saveToSupabase()
}

function currentProject() {
  return _data.projects.find(p => p.id === _data.currentId)
    ?? _sharedProjects.find(p => p.id === _data.currentId)
    ?? _data.projects[0]
}

function items() {
  return currentProject().items
}

export const store = {
  // --- Auth ---
  get user() { return _user },
  get loading() { return _loading },

  async login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  async signup(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  },

  async logout() {
    await supabase.auth.signOut()
  },

  // --- Reads ---
  get projects() {
    return [
      ..._data.projects,
      ..._sharedProjects.map(sp => ({ ...sp, _shared: true, _role: sp.role }))
    ]
  },
  get currentProjectId() { return _data.currentId },
  get currentProjectIsShared() { return isShared(_data.currentId) },

  // --- Project ops ---
  addProject() {
    const p = { id: genId(), name: 'New Project', items: [] }
    _data.projects.push(p)
    _data.currentId = p.id
    save()
  },

  deleteProject(id) {
    if (isShared(id)) {
      const sp = _sharedProjects.find(p => p.id === id)
      if (!sp) return
      if (sp.role === 'owner') {
        supabase.from('shared_projects').delete().eq('id', id).then(() => {})
      } else {
        supabase.from('shared_project_members')
          .delete()
          .eq('project_id', id)
          .eq('user_id', _user.id)
          .then(() => {})
      }
      const idx = _sharedProjects.findIndex(p => p.id === id)
      if (idx !== -1) _sharedProjects.splice(idx, 1)
      // Remove realtime channel for this project
      const chIdx = _realtimeChannels.findIndex(ch => ch.topic === `realtime:spd:${id}`)
      if (chIdx !== -1) {
        supabase.removeChannel(_realtimeChannels[chIdx])
        _realtimeChannels.splice(chIdx, 1)
      }
      if (_data.currentId === id) {
        _data.currentId = _data.projects[0]?.id ?? (_sharedProjects[0]?.id ?? null)
      }
      return
    }
    if (_data.projects.length <= 1 && _sharedProjects.length === 0) return
    if (_data.projects.length <= 1) {
      // Can still delete if there are shared projects to fall back to
    }
    const idx = _data.projects.findIndex(p => p.id === id)
    if (idx === -1) return
    _data.projects.splice(idx, 1)
    if (_data.currentId === id) {
      if (_data.projects.length > 0) {
        _data.currentId = _data.projects[Math.max(0, idx - 1)].id
      } else if (_sharedProjects.length > 0) {
        _data.currentId = _sharedProjects[0].id
      }
    }
    save()
  },

  renameProject(id, name) {
    if (isShared(id)) {
      const sp = _sharedProjects.find(p => p.id === id)
      if (!sp || sp.role !== 'owner') return
      sp.name = name
      supabase.from('shared_projects').update({ name }).eq('id', id).then(() => {})
      return
    }
    const p = _data.projects.find(p => p.id === id)
    if (p) { p.name = name; save() }
  },

  switchProject(id) {
    if (_data.projects.some(p => p.id === id) || isShared(id)) {
      _data.currentId = id
      persist($state.snapshot(_data))
    }
  },

  // --- Shared project ops ---
  async createSharedProject() {
    if (!_user) return
    const { data: sp, error } = await supabase
      .from('shared_projects')
      .insert({ owner_id: _user.id, name: 'Shared Project' })
      .select()
      .single()
    if (error || !sp) return
    await supabase.from('shared_project_members').insert({ project_id: sp.id, user_id: _user.id, role: 'owner' })
    await supabase.from('shared_project_data').insert({ project_id: sp.id, items: [] })
    const newSp = { id: sp.id, name: sp.name, owner_id: sp.owner_id, role: 'owner', items: [] }
    _sharedProjects.push(newSp)
    _data.currentId = sp.id
    persist($state.snapshot(_data))
    // Subscribe realtime for new project
    const channel = supabase.channel(`spd:${sp.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'shared_project_data',
        filter: `project_id=eq.${sp.id}`
      }, (payload) => {
        const idx = _sharedProjects.findIndex(p => p.id === sp.id)
        if (idx !== -1) _sharedProjects[idx] = { ..._sharedProjects[idx], items: payload.new.items }
      })
      .subscribe()
    _realtimeChannels.push(channel)
  },

  async sendInvite(projectId, email) {
    if (!_user) return
    const { error } = await supabase.from('project_invites').insert({
      project_id: projectId,
      invited_by: _user.id,
      email
    })
    if (error) throw error
  },

  async loadInvitesForProject(projectId) {
    const { data, error } = await supabase
      .from('project_invites')
      .select('id, email, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  // --- Item reads ---
  get items() { return items() },

  // --- Item ops (operate on current project) ---
  addRoot() {
    items().push(newItem())
    saveCurrentProject()
  },

  addChild(parentId) {
    const p = find(items(), parentId)
    if (!p) return
    p.children.unshift(newItem())
    p.expanded = true
    saveCurrentProject()
  },

  updateTitle(id, title) {
    const item = find(items(), id)
    if (item) { item.title = title; saveCurrentProject() }
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
    saveCurrentProject()
  },

  cycleStatus(id) {
    const item = find(items(), id)
    if (!item) return
    const order = ['todo', 'in-progress', 'done', 'blocked']
    item.status = order[(order.indexOf(item.status) + 1) % order.length]
    saveCurrentProject()
  },

  toggleExpanded(id) {
    const item = find(items(), id)
    if (item) { item.expanded = !item.expanded; saveCurrentProject() }
  },

  expandAll()   { setAllExpanded(items(), true);  saveCurrentProject() },
  collapseAll() { setAllExpanded(items(), false); saveCurrentProject() },

  delete(id) {
    const loc = findLocation(items(), id)
    if (loc) { loc.list.splice(loc.idx, 1); saveCurrentProject() }
  },

  addParent(itemId) {
    const loc = findLocation(items(), itemId)
    if (!loc) return
    const original = loc.list[loc.idx]
    const wrapper = newItem('New Parent')
    wrapper.children = [original]
    wrapper.expanded = true
    loc.list.splice(loc.idx, 1, wrapper)
    saveCurrentProject()
  },

  // --- Notes & bugs ---
  toggleDetail(id) {
    const item = find(items(), id)
    if (!item) return
    item.detailOpen = !(item.detailOpen ?? false)
    saveCurrentProject()
  },

  updateNotes(id, notes) {
    const item = find(items(), id)
    if (item) { item.notes = notes; saveCurrentProject() }
  },

  get allBugs() { return collectAllBugs(items()) },

  addBug(itemId, name) {
    const item = find(items(), itemId)
    if (!item) return
    if (!item.bugs) item.bugs = []
    item.bugs.push({ id: genId(), name, status: 'open', errorCode: '' })
    saveCurrentProject()
  },

  updateBugErrorCode(itemId, bugId, code) {
    const item = find(items(), itemId)
    const bug = item?.bugs?.find(b => b.id === bugId)
    if (bug) { bug.errorCode = code; saveCurrentProject() }
  },

  deleteBug(itemId, bugId) {
    const item = find(items(), itemId)
    if (!item?.bugs) return
    const idx = item.bugs.findIndex(b => b.id === bugId)
    if (idx !== -1) { item.bugs.splice(idx, 1); saveCurrentProject() }
  },

  renameBug(itemId, bugId, name) {
    const item = find(items(), itemId)
    const bug = item?.bugs?.find(b => b.id === bugId)
    if (bug) { bug.name = name; saveCurrentProject() }
  },

  cycleBugStatus(itemId, bugId) {
    const item = find(items(), itemId)
    const bug = item?.bugs?.find(b => b.id === bugId)
    if (!bug) return
    const order = ['open', 'fixed', 'wont-fix']
    bug.status = order[(order.indexOf(bug.status) + 1) % order.length]
    saveCurrentProject()
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
      const newItems = regenIds(parsed)
      syncParentStatuses(newItems)
      currentProject().items = newItems
      saveCurrentProject()
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
    saveCurrentProject()
  }
}
