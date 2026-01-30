<!--
  Protected Page

  This page is only accessible to authenticated users.
  The protection is handled by the middleware in hooks.server.ts
-->
<script lang="ts">
  let { data } = $props();
</script>

<div class="protected-page">
  <div class="card">
    <div class="badge">Protected</div>

    <h1>Protected Page</h1>

    <p class="intro">
      This page is only accessible to authenticated users. If you're seeing this,
      you're signed in!
    </p>

    {#if data.user}
      <div class="user-info">
        <h2>Your Profile</h2>

        <div class="info-grid">
          <div class="info-item">
            <span class="label">ID</span>
            <span class="value">{data.user.id}</span>
          </div>

          {#if data.user.name}
            <div class="info-item">
              <span class="label">Name</span>
              <span class="value">{data.user.name}</span>
            </div>
          {/if}

          {#if data.user.email}
            <div class="info-item">
              <span class="label">Email</span>
              <span class="value">{data.user.email}</span>
            </div>
          {/if}

          {#if data.user.image}
            <div class="info-item">
              <span class="label">Avatar</span>
              <img src={data.user.image} alt="Avatar" class="avatar" />
            </div>
          {/if}
        </div>
      </div>

      <div class="session-info">
        <h2>Session Data</h2>

        <pre><code>{JSON.stringify(data.session, null, 2)}</code></pre>
      </div>
    {/if}

    <div class="actions">
      <a href="/" class="btn btn-secondary">Back to Home</a>
    </div>
  </div>
</div>

<style>
  .protected-page {
    display: flex;
    justify-content: center;
  }

  .card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    width: 100%;
    max-width: 600px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .badge {
    display: inline-block;
    background: #dcfce7;
    color: #166534;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .intro {
    color: #666;
    margin-bottom: 2rem;
  }

  .user-info,
  .session-info {
    margin-bottom: 2rem;
  }

  h2 {
    font-size: 1.125rem;
    margin-bottom: 1rem;
    color: #333;
  }

  .info-grid {
    display: grid;
    gap: 0.75rem;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .label {
    font-weight: 500;
    color: #666;
    min-width: 80px;
  }

  .value {
    color: #333;
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
  }

  .session-info pre {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .session-info code {
    font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  }

  .actions {
    display: flex;
    gap: 1rem;
  }

  .btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover {
    background: #e0e0e0;
  }
</style>
