<!--
  Sign In Page

  Custom sign-in page demonstrating both credentials and OAuth sign-in
-->
<script lang="ts">
  import { signIn, getProviders, type ProviderInfo } from '$lib/client/actions.js';
  import { onMount } from 'svelte';

  let { data } = $props();

  // Form state using $state rune
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let providers = $state<ProviderInfo[]>([]);

  // Get URL parameters for error messages and callback
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const callbackUrl = urlParams?.get('callbackUrl') ?? '/';
  const urlError = urlParams?.get('error');

  // Set initial error from URL
  if (urlError) {
    error = getErrorMessage(urlError);
  }

  // Fetch available providers on mount
  onMount(async () => {
    providers = await getProviders();
  });

  function getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'CredentialsSignin':
        return 'Invalid email or password';
      case 'AccessDenied':
        return 'Access denied';
      case 'OAuthAccountNotLinked':
        return 'This email is already associated with another account';
      default:
        return 'An error occurred during sign in';
    }
  }

  async function handleCredentialsSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      const response = await signIn({
        provider: 'credentials',
        credentials: { email, password },
        redirectTo: callbackUrl,
        redirect: false
      });

      if (response && response.ok) {
        window.location.href = callbackUrl;
      } else if (response && response.status === 302) {
        // Redirect response - follow it
        const location = response.headers.get('Location');
        if (location) {
          window.location.href = location;
        }
      } else {
        error = 'Invalid email or password';
      }
    } catch (e) {
      error = 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }

  function handleOAuthSignIn(providerId: string) {
    signIn({ provider: providerId, redirectTo: callbackUrl });
  }

  // Filter providers by type
  const oauthProviders = $derived(providers.filter((p) => p.type === 'oauth'));
  const hasCredentials = $derived(providers.some((p) => p.type === 'credentials'));
</script>

<div class="signin-page">
  <div class="signin-card">
    <h1>Sign In</h1>

    {#if error}
      <div class="error-message" role="alert">
        {error}
      </div>
    {/if}

    {#if data.user}
      <div class="already-signed-in">
        <p>You are already signed in as {data.user.name ?? data.user.email}</p>
        <a href="/" class="btn btn-secondary">Go to Home</a>
      </div>
    {:else}
      <!-- OAuth Providers -->
      {#if oauthProviders.length > 0}
        <div class="oauth-providers">
          {#each oauthProviders as provider}
            <button
              type="button"
              class="btn btn-oauth"
              onclick={() => handleOAuthSignIn(provider.id)}
            >
              {#if provider.id === 'github'}
                <svg viewBox="0 0 24 24" class="icon">
                  <path
                    fill="currentColor"
                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                  />
                </svg>
              {:else if provider.id === 'google'}
                <svg viewBox="0 0 24 24" class="icon">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              {:else if provider.id === 'discord'}
                <svg viewBox="0 0 24 24" class="icon">
                  <path
                    fill="#5865F2"
                    d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
                  />
                </svg>
              {:else}
                <span class="provider-icon">{provider.name.charAt(0)}</span>
              {/if}
              Continue with {provider.name}
            </button>
          {/each}
        </div>

        {#if hasCredentials}
          <div class="divider">
            <span>or</span>
          </div>
        {/if}
      {/if}

      <!-- Credentials Form -->
      {#if hasCredentials}
        <form onsubmit={handleCredentialsSubmit} class="credentials-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              bind:value={email}
              placeholder="demo@example.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              bind:value={password}
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            />
          </div>

          <button type="submit" class="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p class="demo-hint">
          Demo credentials: <code>demo@example.com</code> / <code>password123</code>
        </p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .signin-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - 200px);
  }

  .signin-card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .signin-card h1 {
    text-align: center;
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
  }

  .error-message {
    background: #fee2e2;
    color: #dc2626;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .already-signed-in {
    text-align: center;
  }

  .already-signed-in p {
    margin-bottom: 1rem;
    color: #666;
  }

  .oauth-providers {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    border: none;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #0070f3;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0060df;
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover {
    background: #e0e0e0;
  }

  .btn-oauth {
    background: #f5f5f5;
    color: #333;
    border: 1px solid #e0e0e0;
  }

  .btn-oauth:hover {
    background: #e8e8e8;
  }

  .icon {
    width: 20px;
    height: 20px;
  }

  .provider-icon {
    width: 20px;
    height: 20px;
    background: #666;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.5rem 0;
    color: #999;
    font-size: 0.875rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e0e0e0;
  }

  .credentials-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #333;
  }

  .form-group input {
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 0.9375rem;
    transition: border-color 0.2s;
  }

  .form-group input:focus {
    outline: none;
    border-color: #0070f3;
  }

  .demo-hint {
    margin-top: 1.5rem;
    padding: 0.75rem;
    background: #f0f9ff;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #0369a1;
    text-align: center;
  }

  .demo-hint code {
    background: rgba(0, 112, 243, 0.1);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-family: monospace;
  }
</style>
