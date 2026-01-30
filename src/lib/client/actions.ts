/**
 * Client-side authentication actions
 */

import type { Session } from '../types.js';

export interface SignInOptions {
  /**
   * Provider ID to sign in with
   */
  provider?: string;

  /**
   * URL to redirect to after sign in
   */
  redirectTo?: string;

  /**
   * Whether to redirect (default: true for OAuth, false for credentials)
   */
  redirect?: boolean;

  /**
   * Credentials for credentials provider
   */
  credentials?: Record<string, string>;
}

export interface SignOutOptions {
  /**
   * URL to redirect to after sign out
   */
  redirectTo?: string;

  /**
   * Whether to redirect (default: true)
   */
  redirect?: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  type: 'oauth' | 'credentials' | 'email';
  signinUrl: string;
  callbackUrl: string;
}

/**
 * Get the base path for auth routes
 */
function getBasePath(): string {
  return '/auth';
}

/**
 * Sign in with a provider
 *
 * @example
 * ```ts
 * // OAuth sign in (redirects to provider)
 * await signIn({ provider: 'github' });
 *
 * // Credentials sign in
 * await signIn({
 *   provider: 'credentials',
 *   credentials: { email: 'user@example.com', password: 'secret' },
 *   redirect: false
 * });
 * ```
 */
export async function signIn(options: SignInOptions = {}): Promise<Response | void> {
  const basePath = getBasePath();
  const provider = options.provider ?? 'credentials';
  const redirectTo = options.redirectTo ?? window.location.href;

  if (provider === 'credentials' || options.credentials) {
    // Credentials sign in via form POST
    const formData = new FormData();

    if (options.credentials) {
      for (const [key, value] of Object.entries(options.credentials)) {
        formData.append(key, value);
      }
    }

    formData.append('callbackUrl', redirectTo);

    const response = await fetch(`${basePath}/signin/${provider}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      redirect: options.redirect === false ? 'manual' : 'follow'
    });

    if (options.redirect === false) {
      return response;
    }

    // If redirect is enabled, the fetch will follow the redirect
    if (response.redirected) {
      window.location.href = response.url;
    }

    return;
  }

  // OAuth sign in - redirect to provider
  const url = new URL(`${basePath}/signin/${provider}`, window.location.origin);
  url.searchParams.set('callbackUrl', redirectTo);

  if (options.redirect === false) {
    return fetch(url.toString(), {
      credentials: 'include',
      redirect: 'manual'
    });
  }

  window.location.href = url.toString();
}

/**
 * Sign out the current user
 *
 * @example
 * ```ts
 * // Sign out and redirect to home
 * await signOut();
 *
 * // Sign out without redirect
 * await signOut({ redirect: false });
 * ```
 */
export async function signOut(options: SignOutOptions = {}): Promise<Response | void> {
  const basePath = getBasePath();
  const redirectTo = options.redirectTo ?? '/';
  const redirect = options.redirect ?? true;

  const formData = new FormData();
  formData.append('callbackUrl', redirectTo);

  const response = await fetch(`${basePath}/signout`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    redirect: redirect ? 'follow' : 'manual'
  });

  if (!redirect) {
    return response;
  }

  if (response.redirected) {
    window.location.href = response.url;
  } else {
    window.location.href = redirectTo;
  }
}

/**
 * Get the current session from the server
 *
 * @example
 * ```ts
 * const session = await getSession();
 * if (session) {
 *   console.log('Signed in as:', session.user.name);
 * }
 * ```
 */
export async function getSession(): Promise<Session | null> {
  const basePath = getBasePath();

  try {
    const response = await fetch(`${basePath}/session`, {
      credentials: 'include'
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.user) {
      return null;
    }

    return {
      user: data.user,
      expires: new Date(data.expires)
    };
  } catch {
    return null;
  }
}

/**
 * Get available authentication providers
 *
 * @example
 * ```ts
 * const providers = await getProviders();
 * providers.forEach(p => console.log(p.name));
 * ```
 */
export async function getProviders(): Promise<ProviderInfo[]> {
  const basePath = getBasePath();

  try {
    const response = await fetch(`${basePath}/providers`, {
      credentials: 'include'
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch {
    return [];
  }
}
