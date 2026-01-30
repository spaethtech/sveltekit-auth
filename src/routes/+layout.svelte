<!--
  Root Layout Component

  This component wraps all pages and provides:
  - Navigation with auth state
  - Client-side auth context using SvelteKit 5 runes
-->
<script lang="ts">
  import { createAuthClient } from '$lib/client/index.js';
  import { signOut } from '$lib/client/actions.js';

  // Get server-side data
  let { data, children } = $props();

  // Create reactive auth client with initial session from SSR
  const auth = createAuthClient({
    session: data.session,
    refetchOnWindowFocus: true
  });
</script>

<svelte:head>
  <title>SvelteKit Auth Demo</title>
  <meta name="description" content="Demo application for sveltekit-auth library" />
</svelte:head>

<div class="app">
  <header>
    <nav>
      <a href="/" class="logo">SvelteKit Auth</a>

      <div class="nav-links">
        <a href="/">Home</a>
        <a href="/protected">Protected</a>
      </div>

      <div class="auth-status">
        {#if auth.user}
          <span class="user-info">
            {#if auth.user.image}
              <img src={auth.user.image} alt={auth.user.name ?? 'User'} class="avatar" />
            {/if}
            <span>{auth.user.name ?? auth.user.email}</span>
          </span>
          <button onclick={() => signOut({ redirectTo: '/' })} class="btn btn-secondary">
            Sign Out
          </button>
        {:else}
          <a href="/auth/signin" class="btn btn-primary">Sign In</a>
        {/if}
      </div>
    </nav>
  </header>

  <main>
    {@render children()}
  </main>

  <footer>
    <p>SvelteKit Auth Demo - Built with SvelteKit 5 Runes</p>
  </footer>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      Oxygen,
      Ubuntu,
      Cantarell,
      sans-serif;
    background: #f5f5f5;
    color: #333;
    line-height: 1.6;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    background: white;
    border-bottom: 1px solid #e0e0e0;
    padding: 1rem 2rem;
  }

  nav {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    color: #333;
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-links a {
    color: #666;
    text-decoration: none;
    transition: color 0.2s;
  }

  .nav-links a:hover {
    color: #333;
  }

  .auth-status {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #666;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #0070f3;
    color: white;
  }

  .btn-primary:hover {
    background: #0060df;
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover {
    background: #e0e0e0;
  }

  main {
    flex: 1;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  footer {
    background: white;
    border-top: 1px solid #e0e0e0;
    padding: 1rem 2rem;
    text-align: center;
    color: #666;
    font-size: 0.875rem;
  }
</style>
