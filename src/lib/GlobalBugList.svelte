<script>
  import { store } from './store.svelte.js'

  let filter = $state('')

  const STATUS_LABEL = { 'open': 'OPEN', 'fixed': 'FIXED', 'wont-fix': "WON'T FIX" }

  let displayed = $derived(
    filter.trim()
      ? store.allBugs.filter(({ bug, itemPath }) =>
          bug.name.toLowerCase().includes(filter.toLowerCase()) ||
          itemPath.join(' ').toLowerCase().includes(filter.toLowerCase())
        )
      : store.allBugs
  )
</script>

<div class="gbl">
  <div class="gbl-header">
    <span class="gbl-title">// BUG LIST</span>
    <span class="gbl-count">[{store.allBugs.length}]</span>
  </div>

  <div class="gbl-filter">
    <span class="filter-prompt">&gt;</span>
    <input
      class="filter-input"
      placeholder="filter bugs..."
      bind:value={filter}
    />
  </div>

  <div class="gbl-body">
    {#if displayed.length === 0}
      <div class="gbl-empty">
        {#if filter}
          // no matches for "{filter}"
        {:else}
          // no bugs yet<br>
          open item detail panel (📋) to add bugs
        {/if}
      </div>
    {:else}
      {#each displayed as { bug, item, itemPath } (bug.id)}
        <div class="gentry">
          <div class="gentry-top">
            <span class="gentry-name">{bug.name}</span>
            <button
              class="gentry-badge bug-status-{bug.status}"
              onclick={() => store.cycleBugStatus(item.id, bug.id)}
              title="Click to cycle status"
            >[{STATUS_LABEL[bug.status] ?? bug.status}]</button>
          </div>
          <div class="gentry-path">// {itemPath.join(' > ')}</div>
          <textarea
            class="gentry-code"
            placeholder="// paste error code or stack trace..."
            value={bug.errorCode ?? ''}
            oninput={e => store.updateBugErrorCode(item.id, bug.id, e.target.value)}
            rows="3"
            spellcheck="false"
          ></textarea>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .gbl {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg2);
  }

  .gbl-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0.6rem 0.75rem 0.4rem;
    border-bottom: 2px solid var(--black);
    flex-shrink: 0;
    background: var(--yellow);
  }

  .gbl-title {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--black);
  }

  .gbl-count {
    font-size: 0.72rem;
    color: var(--black);
    font-weight: 700;
  }

  .gbl-filter {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 2px solid var(--black);
    flex-shrink: 0;
  }

  .filter-prompt {
    color: var(--black);
    font-weight: 700;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .filter-input {
    flex: 1;
    padding: 0.25rem 0.4rem;
    font-size: 0.78rem;
    background: var(--bg2);
    border: 2px solid var(--black);
    color: var(--black);
    width: 100%;
  }
  .filter-input:focus {
    box-shadow: 2px 2px 0 var(--black);
    outline: none;
  }
  .filter-input::placeholder { color: #888; }

  .gbl-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .gbl-empty {
    padding: 2rem 0.5rem;
    text-align: center;
    font-size: 0.78rem;
    color: #666;
    line-height: 1.8;
    letter-spacing: 0.03em;
  }

  .gentry {
    background: var(--bg2);
    border: 2px solid var(--black);
    box-shadow: 2px 2px 0 var(--black);
    padding: 0.5rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    transition: transform 0.06s, box-shadow 0.06s;
  }
  .gentry:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--black);
  }

  .gentry-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }

  .gentry-name {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--black);
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gentry-badge {
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    white-space: nowrap;
    background: transparent;
    border: 1.5px solid;
    padding: 0.05rem 0.3rem;
    transition: opacity 0.1s;
  }
  .gentry-badge:hover { opacity: 0.7; }

  .bug-status-open     { color: var(--red); border-color: var(--red); }
  .bug-status-fixed    { color: var(--green); border-color: var(--green); }
  .bug-status-wont-fix { color: #666; border-color: #AAA; }

  .gentry-path {
    font-size: 0.68rem;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.02em;
  }

  .gentry-code {
    width: 100%;
    padding: 0.35rem 0.45rem;
    font-size: 0.72rem;
    font-family: var(--font);
    color: var(--black);
    background: var(--bg);
    border: 2px solid var(--black);
    resize: vertical;
    line-height: 1.5;
    box-sizing: border-box;
    transition: box-shadow 0.06s;
  }
  .gentry-code:focus {
    box-shadow: 2px 2px 0 var(--black);
    outline: none;
  }
  .gentry-code::placeholder { color: #888; font-style: italic; }
</style>
