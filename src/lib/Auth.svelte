<script>
  import { store } from './store.svelte.js'

  let mode = $state('login') // 'login' | 'signup'
  let email = $state('')
  let password = $state('')
  let error = $state('')
  let submitting = $state(false)

  async function submit() {
    error = ''
    submitting = true
    try {
      if (mode === 'login') {
        await store.login(email, password)
      } else {
        await store.signup(email, password)
        error = '// Check your email to confirm your account.'
      }
    } catch (e) {
      error = e.message ?? 'An error occurred.'
    } finally {
      submitting = false
    }
  }

  function toggleMode() {
    mode = mode === 'login' ? 'signup' : 'login'
    error = ''
  }
</script>

<div class="auth-screen">
  <div class="auth-box">
    <div class="auth-header">
      <span class="prompt">&gt;_</span> PROJECT TRACKER
    </div>

    <div class="auth-title">
      {mode === 'login' ? '// LOG IN' : '// SIGN UP'}
    </div>

    <form onsubmit={(e) => { e.preventDefault(); submit() }}>
      <div class="field">
        <label for="email">EMAIL</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="user@example.com"
          required
          autocomplete="email"
        />
      </div>

      <div class="field">
        <label for="password">PASSWORD</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="••••••••"
          required
          autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </div>

      {#if error}
        <div class="error">{error}</div>
      {/if}

      <button type="submit" class="btn primary" disabled={submitting}>
        {submitting ? '// WORKING...' : (mode === 'login' ? 'LOG IN' : 'SIGN UP')}
      </button>
    </form>

    <div class="toggle">
      {mode === 'login' ? 'No account?' : 'Already registered?'}
      <button class="link-btn" onclick={toggleMode}>
        {mode === 'login' ? 'SIGN UP' : 'LOG IN'}
      </button>
    </div>
  </div>
</div>

<style>
  .auth-screen {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }

  .auth-box {
    background: var(--bg2);
    border: 2px solid var(--black);
    box-shadow: 6px 6px 0 var(--black);
    padding: 2rem 2.5rem;
    width: 100%;
    max-width: 380px;
  }

  .auth-header {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: var(--black);
    text-transform: uppercase;
    background: var(--yellow);
    border: 2px solid var(--black);
    padding: 0.5rem 0.75rem;
    margin: -2rem -2.5rem 1.75rem;
    border-left: none;
    border-right: none;
    border-top: none;
  }

  .prompt {
    color: #555;
    margin-right: 0.25rem;
  }

  .auth-title {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #555;
    margin-bottom: 1.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-bottom: 1rem;
  }

  label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--black);
  }

  input {
    border: 2px solid var(--black);
    background: var(--white);
    padding: 0.45rem 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--black);
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }

  input:focus {
    border-color: var(--blue);
    box-shadow: 2px 2px 0 var(--blue);
  }

  .error {
    font-size: 0.75rem;
    color: var(--red);
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--red);
    background: #fff5f5;
  }

  .btn {
    width: 100%;
    padding: 0.5rem 1rem;
    border: 2px solid var(--black);
    background: var(--white);
    color: var(--black);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    cursor: pointer;
    font-family: inherit;
    box-shadow: 3px 3px 0 var(--black);
    transition: transform 0.06s, box-shadow 0.06s;
    margin-top: 0.25rem;
  }

  .btn:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--black);
  }

  .btn:active:not(:disabled) {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 var(--black);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .btn.primary {
    background: var(--yellow);
  }

  .btn.primary:hover:not(:disabled) {
    background: var(--yellow-hi);
  }

  .toggle {
    margin-top: 1.25rem;
    font-size: 0.75rem;
    color: #666;
    text-align: center;
    letter-spacing: 0.03em;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--blue);
    font-size: 0.75rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    padding: 0;
    margin-left: 0.3rem;
    letter-spacing: 0.05em;
    text-decoration: underline;
  }

  .link-btn:hover {
    color: #1a4fe0;
  }
</style>
