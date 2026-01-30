/**
 * Client-side authentication state management with SvelteKit 5 runes
 */

import type { Session, User } from '../types.js';

export interface AuthClientOptions {
  /**
   * Base path for auth API routes (default: '/auth')
   */
  basePath?: string;

  /**
   * Initial session data (for SSR hydration)
   */
  session?: Session | null;

  /**
   * Automatically refresh session on window focus
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Interval in seconds to refetch session (0 to disable)
   */
  refetchInterval?: number;
}

export interface AuthClient {
  /**
   * Current session (reactive with $state)
   */
  readonly session: Session | null;

  /**
   * Current user (derived from session)
   */
  readonly user: User | null;

  /**
   * Loading state
   */
  readonly loading: boolean;

  /**
   * Refresh the session from the server
   */
  refresh(): Promise<void>;

  /**
   * Update the session client-side
   */
  update(session: Session | null): void;
}

/**
 * Create an authentication client with reactive state
 *
 * This function creates a client-side authentication manager that uses
 * SvelteKit 5's $state rune for reactivity. Use it in your root layout
 * to manage authentication state across your app.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createAuthClient } from '@sveltekit-auth/core/client';
 *
 *   // Get initial session from page data (SSR)
 *   let { data } = $props();
 *
 *   // Create reactive auth client
 *   const auth = createAuthClient({
 *     session: data.session,
 *     refetchOnWindowFocus: true
 *   });
 *
 *   // Access reactive state
 *   // auth.session - current session
 *   // auth.user - current user
 *   // auth.loading - loading state
 * </script>
 *
 * {#if auth.user}
 *   <p>Welcome, {auth.user.name}!</p>
 * {:else}
 *   <p>Please sign in</p>
 * {/if}
 * ```
 */
export function createAuthClient(options: AuthClientOptions = {}): AuthClient {
  const basePath = options.basePath ?? '/auth';

  // Reactive state using $state (SvelteKit 5 runes)
  let session = $state<Session | null>(options.session ?? null);
  let loading = $state(false);

  // Derived user state
  const user = $derived(session?.user ?? null);

  /**
   * Fetch session from server
   */
  async function fetchSession(): Promise<Session | null> {
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
   * Refresh session from server
   */
  async function refresh(): Promise<void> {
    loading = true;
    try {
      session = await fetchSession();
    } finally {
      loading = false;
    }
  }

  /**
   * Update session client-side
   */
  function update(newSession: Session | null): void {
    session = newSession;
  }

  // Set up automatic refetching
  if (typeof window !== 'undefined') {
    // Refetch on window focus
    if (options.refetchOnWindowFocus) {
      window.addEventListener('focus', () => {
        refresh();
      });
    }

    // Refetch on interval
    if (options.refetchInterval && options.refetchInterval > 0) {
      setInterval(
        () => {
          refresh();
        },
        options.refetchInterval * 1000
      );
    }

    // Listen for storage events (cross-tab sync)
    window.addEventListener('storage', (event) => {
      if (event.key === 'sveltekit-auth.session-token') {
        refresh();
      }
    });
  }

  return {
    get session() {
      return session;
    },
    get user() {
      return user;
    },
    get loading() {
      return loading;
    },
    refresh,
    update
  };
}
