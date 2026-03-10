<script>
  import { store } from './lib/store.svelte.js'
  import TreeNode from './lib/TreeNode.svelte'
  import Sidebar from './lib/Sidebar.svelte'
  import GlobalBugList from './lib/GlobalBugList.svelte'
  import Auth from './lib/Auth.svelte'

  let bugPanelOpen = $state(false)
  let sidebarOpen = $state(false)
  let totalBugs = $derived(store.allBugs.length)

  let fileInput
  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const ok = store.importProject(ev.target.result)
      if (!ok) alert('Invalid JSON — could not import.')
    }
    reader.readAsText(file)
    e.target.value = ''
  }
</script>

{#if store.loading}
  <div class="init">// LOADING...</div>
{:else if !store.user}
  <Auth />
{:else}
<div class="shell">
  <header>
    <div class="header-inner">
      <div class="header-left">
        <button class="btn hamburger" onclick={() => sidebarOpen = !sidebarOpen} aria-label="Toggle sidebar">
          <svg viewBox="0 0 14 12" width="14" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="1" y1="1" x2="13" y2="1"/>
            <line x1="1" y1="6" x2="13" y2="6"/>
            <line x1="1" y1="11" x2="13" y2="11"/>
          </svg>
        </button>
        <h1><span class="prompt">&gt;_</span> <span class="title-text">PROJECT TRACKER</span></h1>
      </div>
      <div class="toolbar">
        <button class="btn" onclick={() => store.expandAll()}>EXPAND ALL</button>
        <button class="btn" onclick={() => store.collapseAll()}>COLLAPSE</button>
        <button class="btn primary" onclick={() => store.addRoot()}>+ ADD</button>
        <button class="btn" onclick={() => store.exportProject()}>EXPORT</button>
        <button class="btn" onclick={() => fileInput.click()}>IMPORT</button>
        <input bind:this={fileInput} type="file" accept=".json" style="display:none" onchange={handleImport} />
        <button
          class="btn"
          class:active={bugPanelOpen}
          onclick={() => bugPanelOpen = !bugPanelOpen}
        >
          BUGS
          {#if totalBugs > 0}
            <span class="bug-count-badge">{totalBugs}</span>
          {/if}
        </button>
        <button class="btn" onclick={() => store.logout()}>LOG OUT</button>
      </div>
    </div>
  </header>

  {#if sidebarOpen}
    <div class="sidebar-overlay" onclick={() => sidebarOpen = false} role="presentation"></div>
  {/if}

  <div class="body">
    <div class="sidebar-wrap" class:mobile-open={sidebarOpen}>
      <Sidebar onclose={() => sidebarOpen = false} />
    </div>

    <main>
      <div class="content">
        {#if store.items.length === 0}
          <div class="empty">
            <p>// NO ITEMS FOUND</p>
            <button class="btn primary" onclick={() => store.addRoot()}>+ ADD FIRST ITEM</button>
          </div>
        {:else}
          <div class="tree-card">
            {#each store.items as item (item.id)}
              <TreeNode {item} depth={0} />
            {/each}
          </div>
          <p class="hint">// dblclick title to edit &nbsp;·&nbsp; click badge to cycle status &nbsp;·&nbsp; hover row to act &nbsp;·&nbsp; drag handle to reorder</p>
        {/if}
      </div>
    </main>

    <div class="bug-panel" class:open={bugPanelOpen}>
      <div class="bug-panel-header">
        <button class="bug-panel-close" onclick={() => bugPanelOpen = false}>x CLOSE</button>
      </div>
      <GlobalBugList />
    </div>
  </div>
</div>
{/if}

<style>
  .init {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #888;
  }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  header {
    background: var(--yellow);
    border-bottom: 3px solid var(--black);
    flex-shrink: 0;
  }

  .header-inner {
    padding: 0.7rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  h1 {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: var(--black);
    text-transform: uppercase;
  }

  .prompt {
    color: #555;
    margin-right: 0.25rem;
  }

  .hamburger {
    display: none;
    padding: 0.3rem 0.5rem;
  }

  .toolbar {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.3rem 0.75rem;
    border: 2px solid var(--black);
    background: var(--white);
    color: var(--black);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    box-shadow: 2px 2px 0 var(--black);
    transition: transform 0.06s, box-shadow 0.06s, background 0.06s;
  }
  .btn:hover {
    background: var(--bg3);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--black);
  }
  .btn:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 var(--black);
  }
  .btn.primary {
    background: var(--yellow);
  }
  .btn.primary:hover {
    background: var(--yellow-hi);
  }
  .btn.active {
    background: var(--blue);
    color: var(--white);
  }
  .btn.active:hover {
    background: #1a4fe0;
  }

  .bug-count-badge {
    background: var(--red);
    color: var(--white);
    font-size: 0.65rem;
    font-weight: 900;
    padding: 0.05rem 0.35rem;
    line-height: 1.4;
    border: 1px solid var(--black);
  }

  .sidebar-overlay {
    display: none;
  }

  .sidebar-wrap {
    display: contents;
  }

  .body {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  main {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  .content {
    max-width: 1100px;
    margin: 0 auto;
  }

  .tree-card {
    background: var(--bg2);
    border: 2px solid var(--black);
    box-shadow: 4px 4px 0 var(--black);
  }

  .empty {
    background: var(--bg2);
    border: 2px solid var(--black);
    box-shadow: 4px 4px 0 var(--black);
    text-align: center;
    padding: 4rem 2rem;
    color: var(--black);
  }
  .empty p {
    margin-bottom: 1.25rem;
    font-size: 0.9rem;
    letter-spacing: 0.05em;
  }

  .hint {
    margin-top: 0.5rem;
    font-size: 0.72rem;
    color: #888;
    text-align: center;
    letter-spacing: 0.03em;
  }

  /* Toggleable bug panel */
  .bug-panel {
    width: 0;
    overflow: hidden;
    flex-shrink: 0;
    transition: width 0.2s ease;
    background: var(--bg2);
    border-left: 0px solid var(--black);
  }
  .bug-panel.open {
    width: 320px;
    border-left-width: 3px;
    overflow-y: auto;
  }

  .bug-panel-header {
    display: none;
  }
  .bug-panel-close {
    padding: 0.3rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    border: 2px solid var(--black);
    background: var(--white);
    box-shadow: 2px 2px 0 var(--black);
    cursor: pointer;
  }
  .bug-panel-close:hover { background: var(--bg3); }

  /* ===== MOBILE / RESPONSIVE ===== */
  @media (max-width: 700px) {
    .hamburger {
      display: flex;
    }

    .title-text {
      display: none;
    }

    .header-inner {
      padding: 0.5rem 0.75rem;
      gap: 0.5rem;
    }

    .toolbar {
      gap: 0.3rem;
    }

    .btn {
      padding: 0.28rem 0.5rem;
      font-size: 0.7rem;
    }

    /* Sidebar: fixed drawer */
    .sidebar-wrap {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      height: 100%;
      z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.22s ease;
    }
    .sidebar-wrap.mobile-open {
      transform: translateX(0);
    }

    /* Overlay behind sidebar */
    .sidebar-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 199;
    }

    /* Bug panel: full-width overlay from right */
    .bug-panel {
      position: fixed;
      top: 0;
      right: 0;
      height: 100%;
      z-index: 200;
      width: 0;
      border-left: none;
      display: flex;
      flex-direction: column;
    }
    .bug-panel.open {
      width: min(320px, 100vw);
      border-left-width: 3px;
      overflow-y: hidden;
    }

    .bug-panel-header {
      display: flex;
      justify-content: flex-end;
      padding: 0.5rem 0.6rem;
      border-bottom: 2px solid var(--black);
      background: var(--yellow);
      flex-shrink: 0;
    }

    main {
      padding: 0.75rem;
    }
  }
</style>
