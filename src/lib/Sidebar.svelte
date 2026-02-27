<script>
  import { store, projectProgress } from './store.svelte.js'

  let renamingId = $state(null)
  let renameVal = $state('')

  function startRename(p) {
    renamingId = p.id
    renameVal = p.name
  }

  function commitRename(id) {
    const t = renameVal.trim()
    if (t) store.renameProject(id, t)
    renamingId = null
  }

  function handleRenameKey(e, id) {
    if (e.key === 'Enter') commitRename(id)
    if (e.key === 'Escape') renamingId = null
  }

  function tryDelete(p) {
    if (store.projects.length <= 1) return
    if (confirm(`Delete project "${p.name}"? This cannot be undone.`)) {
      store.deleteProject(p.id)
    }
  }
</script>

<aside class="sidebar">
  <div class="sidebar-label">// PROJECTS</div>

  <div class="project-list">
    {#each store.projects as p (p.id)}
      {@const active = p.id === store.currentProjectId}
      {@const pct = projectProgress(p.items)}
      <div
        class="project-item"
        class:active
        onclick={() => { if (renamingId !== p.id) store.switchProject(p.id) }}
        role="button"
        tabindex="0"
        onkeydown={e => e.key === 'Enter' && store.switchProject(p.id)}
      >
        <span class="project-arrow">{active ? '>' : ' '}</span>
        <div class="project-main">
          {#if renamingId === p.id}
            <input
              class="rename-input"
              bind:value={renameVal}
              onblur={() => commitRename(p.id)}
              onkeydown={e => handleRenameKey(e, p.id)}
              onclick={e => e.stopPropagation()}
              autofocus
            />
          {:else}
            <span
              class="project-name"
              ondblclick={e => { e.stopPropagation(); startRename(p) }}
              title="Double-click to rename"
            >{p.name}</span>
          {/if}
          <span class="project-pct">{pct}%</span>
        </div>

        {#if store.projects.length > 1}
          <button
            class="delete-btn"
            onclick={e => { e.stopPropagation(); tryDelete(p) }}
            title="Delete project"
          >×</button>
        {/if}
      </div>
    {/each}
  </div>

  <div class="sidebar-footer">
    <button class="new-project-btn" onclick={() => store.addProject()}>
      + NEW PROJECT
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--bg2);
    border-right: 3px solid var(--black);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sidebar-label {
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    color: var(--black);
    font-weight: 700;
    padding: 0.6rem 0.75rem 0.4rem;
    border-bottom: 2px solid var(--black);
    background: var(--yellow);
  }

  .project-list {
    flex: 1;
    padding: 0.4rem 0;
    display: flex;
    flex-direction: column;
  }

  .project-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.45rem 0.6rem;
    cursor: pointer;
    border-left: 3px solid transparent;
    border-bottom: 1px solid #E0E0D0;
    transition: background 0.06s;
  }
  .project-item:hover { background: var(--bg3); }
  .project-item.active {
    background: var(--yellow);
    border-left-color: var(--black);
  }

  .project-arrow {
    font-size: 0.8rem;
    color: var(--black);
    width: 0.85rem;
    flex-shrink: 0;
    font-weight: 700;
  }

  .project-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    overflow: hidden;
  }

  .project-name {
    font-size: 0.8rem;
    color: var(--black);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .project-item.active .project-name {
    font-weight: 700;
  }

  .project-pct {
    font-size: 0.7rem;
    color: #666;
    flex-shrink: 0;
  }

  .rename-input {
    font-size: 0.8rem;
    color: var(--black);
    flex: 1;
    min-width: 0;
    background: var(--bg2);
    border: 2px solid var(--black);
    padding: 0.1rem 0.3rem;
    box-shadow: 2px 2px 0 var(--black);
  }

  .delete-btn {
    flex-shrink: 0;
    width: 1.2rem;
    height: 1.2rem;
    font-size: 0.95rem;
    line-height: 1;
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    border: 1px solid transparent;
    transition: opacity 0.1s, background 0.1s, color 0.1s, border-color 0.1s;
  }
  .project-item:hover .delete-btn { opacity: 1; }
  .delete-btn:hover { background: var(--red-dim); color: var(--red); border-color: var(--red); }

  .sidebar-footer {
    padding: 0.5rem 0.6rem;
    border-top: 2px solid var(--black);
  }

  .new-project-btn {
    width: 100%;
    padding: 0.4rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--black);
    background: var(--white);
    border: 2px solid var(--black);
    cursor: pointer;
    text-align: center;
    box-shadow: 2px 2px 0 var(--black);
    transition: transform 0.06s, box-shadow 0.06s, background 0.06s;
  }
  .new-project-btn:hover {
    background: var(--yellow);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--black);
  }
  .new-project-btn:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 var(--black);
  }
</style>
