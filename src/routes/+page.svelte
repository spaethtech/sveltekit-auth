<!--
  Home Page

  Demonstrates accessing auth state on the home page
-->
<script lang="ts">
  let { data } = $props();
</script>

<div class="home">
  <section class="hero">
    <h1>SvelteKit Auth</h1>
    <p class="subtitle">
      Authentication library for SvelteKit 5 with runes mode support
    </p>
  </section>

  <section class="status-card">
    <h2>Authentication Status</h2>

    {#if data.user}
      <div class="authenticated">
        <div class="user-card">
          {#if data.user.image}
            <img src={data.user.image} alt={data.user.name ?? 'User'} class="avatar" />
          {:else}
            <div class="avatar-placeholder">
              {(data.user.name ?? data.user.email ?? 'U').charAt(0).toUpperCase()}
            </div>
          {/if}

          <div class="user-details">
            <h3>{data.user.name ?? 'User'}</h3>
            {#if data.user.email}
              <p>{data.user.email}</p>
            {/if}
          </div>
        </div>

        <p class="status-text">You are signed in!</p>

        <a href="/protected" class="btn btn-primary">View Protected Page</a>
      </div>
    {:else}
      <div class="unauthenticated">
        <p class="status-text">You are not signed in.</p>
        <a href="/auth/signin" class="btn btn-primary">Sign In</a>
      </div>
    {/if}
  </section>

  <section class="features">
    <h2>Features</h2>

    <div class="feature-grid">
      <div class="feature">
        <h3>SvelteKit 5 Runes</h3>
        <p>Built for SvelteKit 5 with native $state and $derived runes support</p>
      </div>

      <div class="feature">
        <h3>Multiple Providers</h3>
        <p>Support for credentials, GitHub, Google, Discord, and custom OAuth</p>
      </div>

      <div class="feature">
        <h3>Middleware API</h3>
        <p>Easy-to-use middleware for hooks.server.ts with route protection</p>
      </div>

      <div class="feature">
        <h3>Type Safe</h3>
        <p>Full TypeScript support with comprehensive type definitions</p>
      </div>

      <div class="feature">
        <h3>JWT Sessions</h3>
        <p>Secure JWT-based sessions with encryption and signing</p>
      </div>

      <div class="feature">
        <h3>Callbacks</h3>
        <p>Customizable callbacks for sign-in, session, and redirect logic</p>
      </div>
    </div>
  </section>

  <section class="usage">
    <h2>Quick Start</h2>

    <div class="code-block">
      <h3>1. Configure hooks.server.ts</h3>
      <pre><code>{`import { createAuth } from '@sveltekit-auth/core';
import { Credentials, GitHub } from '@sveltekit-auth/core/providers';

export const handle = createAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      authorize: async (credentials) => {
        // Validate credentials
        return user;
      }
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    })
  ]
});`}</code></pre>
    </div>

    <div class="code-block">
      <h3>2. Use in components</h3>
      <pre><code>{`<script lang="ts">
  import { createAuthClient, signIn, signOut } from '@sveltekit-auth/core/client';

  let { data } = $props();
  const auth = createAuthClient({ session: data.session });
</script>

{#if auth.user}
  <p>Welcome, {auth.user.name}!</p>
  <button onclick={() => signOut()}>Sign Out</button>
{:else}
  <button onclick={() => signIn({ provider: 'github' })}>
    Sign in with GitHub
  </button>
{/if}`}</code></pre>
    </div>
  </section>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  .hero {
    text-align: center;
    padding: 2rem 0;
  }

  .hero h1 {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    font-size: 1.25rem;
    color: #666;
  }

  .status-card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .status-card h2 {
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
  }

  .avatar-placeholder {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #0070f3;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .user-details h3 {
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }

  .user-details p {
    color: #666;
  }

  .status-text {
    margin-bottom: 1rem;
    color: #666;
  }

  .btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    border: none;
    font-size: 1rem;
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

  .features h2 {
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .feature {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .feature h3 {
    margin-bottom: 0.5rem;
    font-size: 1.125rem;
  }

  .feature p {
    color: #666;
    font-size: 0.9375rem;
  }

  .usage h2 {
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
  }

  .code-block {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .code-block h3 {
    margin-bottom: 1rem;
    font-size: 1rem;
    color: #666;
  }

  .code-block pre {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .code-block code {
    font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  }
</style>
