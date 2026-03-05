<script>
  import { store } from './store.svelte.js'

  let { projectId, onclose } = $props()

  let email = $state('')
  let invites = $state([])
  let error = $state('')
  let loading = $state(false)

  async function loadInvites() {
    try {
      invites = await store.loadInvitesForProject(projectId)
    } catch {
      invites = []
    }
  }

  $effect(() => {
    loadInvites()
  })

  async function submit() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      error = 'Invalid email address'
      return
    }
    error = ''
    loading = true
    try {
      await store.sendInvite(projectId, trimmed)
      email = ''
      await loadInvites()
    } catch (e) {
      error = e.message ?? 'Failed to send invite'
    } finally {
      loading = false
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') submit()
  }
</script>

<div class="share-panel">
  <div class="share-header">
    <span class="share-label">// SHARE</span>
    <button class="close-btn" onclick={onclose} title="Close">×</button>
  </div>

  <div class="share-body">
    <div class="invite-row">
      <input
        class="email-input"
        type="email"
        placeholder="colleague@email.com"
        bind:value={email}
        onkeydown={handleKey}
        disabled={loading}
      />
      <button class="invite-btn" onclick={submit} disabled={loading}>
        {loading ? '...' : 'INVITE'}
      </button>
    </div>

    {#if error}
      <div class="share-error">{error}</div>
    {/if}

    {#if invites.length > 0}
      <div class="invite-list">
        {#each invites as inv (inv.id)}
          <div class="invite-row-item">
            <span class="invite-email">{inv.email}</span>
            <span class="invite-badge" class:accepted={inv.status === 'accepted'} class:declined={inv.status === 'declined'}>
              [{inv.status}]
            </span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="invite-empty">No invites yet</div>
    {/if}
  </div>
</div>

<style>
  .share-panel {
    border-left: 3px solid #4488ff;
    margin: 0 0.4rem 0.4rem 0.4rem;
    background: var(--bg2);
    border-top: 1px solid #ccc;
  }

  .share-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.3rem 0.5rem 0.25rem;
    background: #e8f0ff;
    border-bottom: 1px solid #ccd8f0;
  }

  .share-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #2255cc;
  }

  .close-btn {
    width: 1.1rem;
    height: 1.1rem;
    font-size: 0.95rem;
    line-height: 1;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    transition: color 0.1s;
  }
  .close-btn:hover { color: var(--black); border-color: #999; }

  .share-body {
    padding: 0.4rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .invite-row {
    display: flex;
    gap: 0.3rem;
  }

  .email-input {
    flex: 1;
    min-width: 0;
    font-size: 0.72rem;
    padding: 0.2rem 0.35rem;
    border: 2px solid var(--black);
    background: var(--white);
    color: var(--black);
    box-shadow: 1px 1px 0 var(--black);
  }
  .email-input:focus { outline: none; border-color: #4488ff; box-shadow: 1px 1px 0 #4488ff; }

  .invite-btn {
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.2rem 0.4rem;
    border: 2px solid var(--black);
    background: #4488ff;
    color: #fff;
    cursor: pointer;
    box-shadow: 1px 1px 0 var(--black);
    transition: background 0.06s;
  }
  .invite-btn:hover:not(:disabled) { background: #2255cc; }
  .invite-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .share-error {
    font-size: 0.68rem;
    color: #cc2200;
  }

  .invite-list {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .invite-row-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.3rem;
  }

  .invite-email {
    font-size: 0.7rem;
    color: var(--black);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .invite-badge {
    flex-shrink: 0;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #cc7700;
  }
  .invite-badge.accepted { color: #228833; }
  .invite-badge.declined { color: #aa3300; }

  .invite-empty {
    font-size: 0.68rem;
    color: #999;
  }
</style>
