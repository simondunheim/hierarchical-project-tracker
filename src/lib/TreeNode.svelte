<script module>
  // Shared across all TreeNode instances
  let dragging   = $state(null)
  let dropTarget = $state(null)
</script>

<script>
  import { store, computeProgress } from './store.svelte.js'
  import TreeNode from './TreeNode.svelte'

  let { item, depth = 0 } = $props()

  // === Title editing ===
  let editing = $state(false)
  let editVal = $state('')

  function startEdit() { editing = true; editVal = item.title }
  function commitEdit() {
    const t = editVal.trim()
    if (t) store.updateTitle(item.id, t)
    editing = false
  }
  function handleTitleKey(e) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') editing = false
  }

  // === Progress ===
  function handleProgressNumber(e) {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val)) store.updateProgress(item.id, val)
  }

  // === Notes editing ===
  let editingNotes = $state(false)
  let notesVal = $state('')

  function startNotesEdit() { editingNotes = true; notesVal = item.notes ?? '' }
  function commitNotesEdit() { store.updateNotes(item.id, notesVal); editingNotes = false }
  function handleNotesKey(e) { if (e.key === 'Escape') e.target.blur() }

  // === Bug name editing ===
  let editingBugId = $state(null)
  let bugEditVal = $state('')
  let newBugName = $state('')

  function startBugEdit(bug) { editingBugId = bug.id; bugEditVal = bug.name }
  function commitBugEdit(bugId) {
    const t = bugEditVal.trim()
    if (t) store.renameBug(item.id, bugId, t)
    editingBugId = null
  }
  function handleBugEditKey(e, bugId) {
    if (e.key === 'Enter') commitBugEdit(bugId)
    if (e.key === 'Escape') editingBugId = null
  }
  function handleAddBug() {
    const name = newBugName.trim()
    if (!name) return
    store.addBug(item.id, name)
    newBugName = ''
  }
  function handleAddBugKey(e) { if (e.key === 'Enter') handleAddBug() }

  // === Bug-reference rendering ===
  function renderNotes(text, bugs) {
    if (!text) return ''
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
    return escaped.replace(/&lt;([^&\n]+)&gt;/g, (_, name) => {
      const found = (bugs ?? []).some(b => b.name === name)
      return `<span class="bug-ref ${found ? 'found' : 'missing'}">&lt;${name}&gt;</span>`
    })
  }

  // === Drag and drop ===
  function onDragStart(e) {
    dragging = item.id
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragEnd() {
    dragging = null
    dropTarget = null
  }
  function onDragOver(e) {
    e.preventDefault()
    if (!dragging || dragging === item.id) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientY - rect.top) / rect.height
    const position = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside'
    dropTarget = { id: item.id, position }
    e.dataTransfer.dropEffect = 'move'
  }
  function onDrop(e) {
    e.preventDefault()
    if (!dropTarget || dropTarget.id !== item.id || !dragging) return
    store.moveItem(dragging, item.id, dropTarget.position)
    dragging = null
    dropTarget = null
  }

  // === Constants ===
  const STATUS_LABEL = {
    'todo': 'TODO', 'in-progress': 'IN PROG', 'done': 'DONE', 'blocked': 'BLOCKED'
  }
  const BUG_STATUS_LABEL = { 'open': 'OPEN', 'fixed': 'FIXED', 'wont-fix': "WON'T FIX" }

  // === Derived ===
  let progress       = $derived(computeProgress(item))
  let hasChildren    = $derived(item.children.length > 0)
  let bugs           = $derived(item.bugs ?? [])
  let notes          = $derived(item.notes ?? '')
  let detailOpen     = $derived(item.detailOpen ?? false)
  let hasContent     = $derived(bugs.length > 0 || notes !== '')
  let renderedNotes  = $derived(renderNotes(notes, bugs))
  let dropPos        = $derived(dropTarget?.id === item.id ? dropTarget.position : null)
  let isDraggingThis = $derived(dragging === item.id)
</script>

<div class="node">
  <div
    class="row"
    ondragover={onDragOver}
    ondrop={onDrop}
    class:is-dragging={isDraggingThis}
    class:drop-before={dropPos === 'before'}
    class:drop-inside={dropPos === 'inside'}
    class:drop-after={dropPos === 'after'}
  >

    <!-- Drag handle -->
    <div
      class="drag-handle"
      draggable="true"
      ondragstart={onDragStart}
      ondragend={onDragEnd}
      aria-hidden="true"
    >
      <svg viewBox="0 0 8 14" width="8" height="14" fill="currentColor">
        <circle cx="2" cy="2.5"  r="1.3"/>
        <circle cx="6" cy="2.5"  r="1.3"/>
        <circle cx="2" cy="7"    r="1.3"/>
        <circle cx="6" cy="7"    r="1.3"/>
        <circle cx="2" cy="11.5" r="1.3"/>
        <circle cx="6" cy="11.5" r="1.3"/>
      </svg>
    </div>

    <!-- Expand / collapse arrow -->
    <button
      class="toggle"
      class:hidden={!hasChildren}
      onclick={() => store.toggleExpanded(item.id)}
      aria-label={item.expanded ? 'Collapse' : 'Expand'}
    >
      <svg class="arrow" class:open={item.expanded} viewBox="0 0 10 10" width="10" height="10">
        <path d="M3 2 L7 5 L3 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Title -->
    <div class="title-wrap">
      {#if editing}
        <input
          class="title-input"
          bind:value={editVal}
          onblur={commitEdit}
          onkeydown={handleTitleKey}
          autofocus
        />
      {:else}
        <span
          class="title"
          ondblclick={startEdit}
          title="Double-click to edit"
        >{item.title}</span>
      {/if}

      {#if hasContent && !detailOpen}
        <span class="content-dot" title="Has notes or bugs"></span>
      {/if}
    </div>

    <!-- Progress -->
    <div class="progress-area">
      {#if hasChildren}
        <div class="bar-outer">
          <div class="bar-inner" style="width: {progress}%" class:full={progress === 100}></div>
        </div>
        <span class="pct rollup">{progress}%</span>
      {:else}
        <span class="leaf-default">{item.progress}%</span>
        <div class="slider-controls">
          <input
            type="range"
            class="slider"
            min="0" max="100"
            value={item.progress}
            oninput={e => store.updateProgress(item.id, +e.target.value)}
          />
          <input
            type="number"
            class="num-input"
            min="0" max="100"
            value={item.progress}
            oninput={handleProgressNumber}
          />
          <span class="pct-symbol">%</span>
        </div>
      {/if}
    </div>

    <!-- Status badge -->
    <button
      class="badge status-{item.status}"
      onclick={() => store.cycleStatus(item.id)}
      title="Click to cycle status"
    >[{STATUS_LABEL[item.status]}]</button>

    <!-- Row actions (visible on hover) -->
    <div class="actions">
      <button class="act" onclick={() => store.addChild(item.id)} title="Add child item">
        <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
        </svg>
      </button>
      <button class="act" onclick={() => store.addParent(item.id)} title="Wrap in new parent">
        <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="7" y1="11" x2="7" y2="3"/>
          <polyline points="4,6 7,3 10,6"/>
          <line x1="3" y1="12" x2="11" y2="12"/>
        </svg>
      </button>
      <button
        class="act"
        class:act-active={detailOpen}
        onclick={() => store.toggleDetail(item.id)}
        title="Toggle notes & bugs"
      >
        <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="1.5" width="10" height="11" rx="0"/>
          <line x1="4.5" y1="5"   x2="9.5" y2="5"/>
          <line x1="4.5" y1="7.5" x2="9.5" y2="7.5"/>
          <line x1="4.5" y1="10"  x2="7.5" y2="10"/>
        </svg>
      </button>
      <button class="act danger" onclick={() => store.delete(item.id)} title="Delete item">
        <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
        </svg>
      </button>
    </div>

  </div>

  <!-- Detail panel -->
  {#if detailOpen}
    <div class="detail-panel">

      <div class="detail-notes">
        <div class="detail-label">// NOTES</div>
        {#if editingNotes}
          <textarea
            class="notes-textarea"
            bind:value={notesVal}
            onblur={commitNotesEdit}
            onkeydown={handleNotesKey}
            rows="4"
            placeholder="// add notes… use <BUG_NAME> to reference bugs"
            autofocus
          ></textarea>
        {:else}
          <div
            class="notes-display"
            onclick={startNotesEdit}
            role="button"
            tabindex="0"
            onkeydown={e => e.key === 'Enter' && startNotesEdit()}
          >
            {#if notes}
              {@html renderedNotes}
            {:else}
              <span class="notes-empty">// click to add notes… use &lt;BUG_NAME&gt; to reference</span>
            {/if}
          </div>
        {/if}
      </div>

      <div class="detail-bugs">
        <div class="detail-label">// BUGS</div>

        <div class="bug-list">
          {#each bugs as bug (bug.id)}
            <div class="bug-row">
              {#if editingBugId === bug.id}
                <input
                  class="bug-name-input"
                  bind:value={bugEditVal}
                  onblur={() => commitBugEdit(bug.id)}
                  onkeydown={e => handleBugEditKey(e, bug.id)}
                  autofocus
                />
              {:else}
                <span
                  class="bug-name"
                  ondblclick={() => startBugEdit(bug)}
                  title="Double-click to rename"
                >{bug.name}</span>
              {/if}
              <button
                class="bug-badge bug-status-{bug.status}"
                onclick={() => store.cycleBugStatus(item.id, bug.id)}
                title="Click to cycle status"
              >[{BUG_STATUS_LABEL[bug.status] ?? bug.status}]</button>
              <button class="bug-del" onclick={() => store.deleteBug(item.id, bug.id)} title="Delete bug">×</button>
            </div>
          {/each}
          {#if bugs.length === 0}
            <div class="bug-empty">// no bugs yet</div>
          {/if}
        </div>

        <div class="bug-add-row">
          <input
            class="bug-add-input"
            placeholder="bug name..."
            bind:value={newBugName}
            onkeydown={handleAddBugKey}
          />
          <button class="bug-add-btn" onclick={handleAddBug}>+ ADD</button>
        </div>
      </div>

    </div>
  {/if}

  <!-- Children -->
  {#if item.expanded && hasChildren}
    <div class="children">
      {#each item.children as child (child.id)}
        <TreeNode item={child} depth={depth + 1} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .node {
    border-bottom: 1px solid #DDDDC8;
  }
  .node:last-child { border-bottom: none; }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem 0.5rem 0.5rem;
    min-height: 2.6rem;
    transition: background 0.06s;
    position: relative;
    background: var(--bg2);
  }
  .row:hover { background: var(--bg3); }

  /* Drag handle */
  .drag-handle {
    flex-shrink: 0;
    width: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #AAAAAA;
    cursor: grab;
    opacity: 0;
    transition: opacity 0.1s;
    user-select: none;
  }
  .row:hover .drag-handle { opacity: 1; color: var(--black); }
  .row:active .drag-handle { cursor: grabbing; }

  /* Drag states */
  .row.is-dragging { opacity: 0.3; }
  .row.drop-before::before {
    content: '';
    position: absolute;
    top: -2px; left: 0; right: 0;
    height: 3px;
    background: var(--blue);
    pointer-events: none;
    z-index: 10;
  }
  .row.drop-after::after {
    content: '';
    position: absolute;
    bottom: -2px; left: 0; right: 0;
    height: 3px;
    background: var(--blue);
    pointer-events: none;
    z-index: 10;
  }
  .row.drop-inside {
    background: var(--blue-dim) !important;
    outline: 2px solid var(--blue);
    outline-offset: -2px;
  }

  /* Toggle arrow */
  .toggle {
    flex-shrink: 0;
    width: 1.3rem;
    height: 1.3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    transition: color 0.1s;
  }
  .toggle:hover { color: var(--black); }
  .toggle.hidden { display: none; }
  .arrow { transition: transform 0.15s ease; }
  .arrow.open { transform: rotate(90deg); }

  /* Title */
  .title-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .title {
    font-size: 0.85rem;
    color: var(--black);
    cursor: text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title-input {
    font-size: 0.85rem;
    flex: 1;
    background: var(--bg2);
    border: 2px solid var(--black);
    color: var(--black);
    padding: 0.15rem 0.4rem;
    box-shadow: 2px 2px 0 var(--black);
  }

  /* Content dot */
  .content-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    background: var(--blue);
    border: 1px solid var(--black);
  }

  /* Progress area */
  .progress-area {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    width: 15rem;
  }

  /* Parent bar */
  .bar-outer {
    flex: 1;
    height: 8px;
    background: var(--bg4);
    border: 2px solid var(--black);
    overflow: hidden;
  }
  .bar-inner {
    height: 100%;
    background: var(--blue);
    transition: width 0.3s ease;
    min-width: 0;
  }
  .bar-inner.full {
    background: var(--green);
  }

  .pct {
    font-size: 0.75rem;
    font-weight: 700;
    min-width: 2.4rem;
    text-align: right;
    color: #888;
  }
  .pct.rollup { color: var(--black); }

  /* Leaf slider */
  .leaf-default {
    width: 100%;
    font-size: 0.75rem;
    font-weight: 700;
    color: #888;
    text-align: right;
  }
  .slider-controls {
    display: none;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
  }
  .row:hover .leaf-default  { display: none; }
  .row:hover .slider-controls { display: flex; }

  .slider {
    flex: 1;
    accent-color: var(--blue);
    cursor: pointer;
    height: 4px;
  }
  .num-input {
    width: 3rem;
    padding: 0.12rem 0.3rem;
    border: 2px solid var(--black);
    font-size: 0.78rem;
    text-align: right;
    color: var(--black);
    background: var(--bg2);
    outline: none;
  }
  .num-input:focus { box-shadow: 2px 2px 0 var(--black); }
  .pct-symbol { font-size: 0.75rem; color: #888; }

  /* Status badge */
  .badge {
    flex-shrink: 0;
    padding: 0.15rem 0.5rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    white-space: nowrap;
    min-width: 6.5rem;
    text-align: center;
    cursor: pointer;
    border: 2px solid var(--black);
    box-shadow: 2px 2px 0 var(--black);
    transition: transform 0.06s, box-shadow 0.06s;
  }
  .badge:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--black);
  }
  .badge:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 var(--black);
  }

  .status-todo        { background: #E8E8D8; color: var(--black); }
  .status-in-progress { background: var(--blue); color: var(--white); }
  .status-done        { background: var(--green); color: var(--white); }
  .status-blocked     { background: var(--red); color: var(--white); }

  /* Row actions */
  .actions {
    display: flex;
    gap: 0.15rem;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .row:hover .actions { opacity: 1; }

  .act {
    width: 1.45rem;
    height: 1.45rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    border: 1.5px solid transparent;
    transition: color 0.1s, background 0.1s, border-color 0.1s;
  }
  .act:hover { color: var(--black); background: var(--yellow); border-color: var(--black); }
  .act.danger:hover { color: var(--red); background: var(--red-dim); border-color: var(--red); }
  .act.act-active { color: var(--black); background: var(--yellow); border-color: var(--black); }

  /* Children indent */
  .children {
    border-left: 3px solid var(--black);
    margin-left: 1.5rem;
  }

  /* ===== Detail panel ===== */
  .detail-panel {
    display: flex;
    gap: 1rem;
    padding: 0.65rem 0.75rem;
    background: var(--bg3);
    border-top: 2px solid var(--black);
  }

  .detail-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--black);
    margin-bottom: 0.35rem;
  }

  /* Notes */
  .detail-notes { flex: 1; min-width: 0; }
  .notes-display {
    min-height: 2.5rem;
    padding: 0.35rem 0.5rem;
    border: 2px solid var(--black);
    background: var(--bg2);
    font-size: 0.82rem;
    color: var(--black);
    cursor: text;
    line-height: 1.6;
    transition: box-shadow 0.06s;
  }
  .notes-display:hover { box-shadow: 2px 2px 0 var(--black); }
  .notes-empty { color: #888; font-style: italic; }
  .notes-textarea {
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: 2px solid var(--black);
    background: var(--bg2);
    color: var(--black);
    font-size: 0.82rem;
    resize: vertical;
    outline: none;
    font-family: var(--font);
    line-height: 1.6;
    box-sizing: border-box;
    box-shadow: 3px 3px 0 var(--black);
  }

  /* Bug-ref spans via {@html} */
  :global(.bug-ref) {
    display: inline-block;
    padding: 0.05rem 0.3rem;
    font-size: 0.78rem;
    font-weight: 700;
    font-family: var(--font);
    border: 1.5px solid;
  }
  :global(.bug-ref.found)   { background: var(--blue-dim); color: var(--blue); border-color: var(--blue); }
  :global(.bug-ref.missing) { background: var(--orange-dim); color: var(--orange); border-color: var(--orange); }

  /* Bug list */
  .detail-bugs { width: 260px; flex-shrink: 0; }
  .bug-list { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.45rem; }
  .bug-row { display: flex; align-items: center; gap: 0.3rem; }
  .bug-name {
    flex: 1; min-width: 0;
    font-size: 0.8rem; color: var(--black);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    cursor: text;
  }
  .bug-name-input {
    flex: 1; min-width: 0; font-size: 0.8rem;
    background: var(--bg2); border: 2px solid var(--black);
    color: var(--black); padding: 0.1rem 0.3rem;
    box-shadow: 2px 2px 0 var(--black);
  }
  .bug-badge {
    flex-shrink: 0; font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.04em; cursor: pointer; white-space: nowrap;
    background: transparent; border: 1.5px solid;
    padding: 0.05rem 0.3rem;
    transition: opacity 0.1s;
  }
  .bug-badge:hover { opacity: 0.7; }
  .bug-status-open     { color: var(--red); border-color: var(--red); }
  .bug-status-fixed    { color: var(--green); border-color: var(--green); }
  .bug-status-wont-fix { color: #666; border-color: #AAA; }
  .bug-del {
    flex-shrink: 0; width: 1.2rem; height: 1.2rem;
    font-size: 0.95rem; color: #888;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid transparent;
    transition: color 0.1s, background 0.1s, border-color 0.1s;
  }
  .bug-del:hover { color: var(--red); background: var(--red-dim); border-color: var(--red); }
  .bug-empty { font-size: 0.78rem; color: #888; font-style: italic; padding: 0.1rem 0; }
  .bug-add-row { display: flex; gap: 0.35rem; }
  .bug-add-input {
    flex: 1; min-width: 0; padding: 0.22rem 0.4rem;
    font-size: 0.78rem; background: var(--bg2);
    border: 2px solid var(--black); color: var(--black);
  }
  .bug-add-input:focus { box-shadow: 2px 2px 0 var(--black); outline: none; }
  .bug-add-input::placeholder { color: #888; }
  .bug-add-btn {
    padding: 0.22rem 0.55rem; font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.06em; color: var(--black);
    background: var(--white); border: 2px solid var(--black);
    cursor: pointer; box-shadow: 2px 2px 0 var(--black);
    transition: transform 0.06s, box-shadow 0.06s, background 0.06s;
  }
  .bug-add-btn:hover { background: var(--yellow); transform: translate(-1px, -1px); box-shadow: 3px 3px 0 var(--black); }
  .bug-add-btn:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 var(--black); }
</style>
