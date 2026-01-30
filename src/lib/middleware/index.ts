/**
 * Authentication middleware for SvelteKit hooks.server.ts
 */

import type { Handle, RequestEvent } from '@sveltejs/kit';
import type {
  AuthConfig,
  ResolvedAuthConfig,
  AuthContext,
  Session,
  User,
  MiddlewareOptions,
  OAuthProviderConfig,
  CredentialsProviderConfig
} from '../types.js';
import {
  getSessionFromCookies,
  setSessionCookie,
  deleteSessionCookie,
  createSession,
  defaultCookieConfig
} from '../utils/session.js';
import { handleAuthRoutes } from './routes.js';

/**
 * Default configuration values
 */
const defaults = {
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60 // 24 hours
  },
  basePath: '/auth',
  debug: false,
  trustHost: false
};

/**
 * Resolve configuration with defaults
 */
export function resolveConfig(config: AuthConfig): ResolvedAuthConfig {
  return {
    providers: config.providers,
    secret: config.secret,
    session: {
      ...defaults.session,
      ...config.session
    },
    cookies: {
      ...defaultCookieConfig,
      ...config.cookies
    },
    pages: config.pages ?? {},
    callbacks: config.callbacks ?? {},
    debug: config.debug ?? defaults.debug,
    trustHost: config.trustHost ?? defaults.trustHost,
    basePath: config.basePath ?? defaults.basePath
  };
}

/**
 * Create the authentication context for a request event
 */
function createAuthContext(
  event: RequestEvent,
  config: ResolvedAuthConfig,
  sessionPromise: Promise<Session | null>
): AuthContext {
  return {
    async getSession() {
      return sessionPromise;
    },

    async getUser() {
      const session = await sessionPromise;
      return session?.user ?? null;
    },

    async signIn(provider: string, options?: { redirectTo?: string; redirect?: boolean }) {
      const providerConfig = config.providers.find((p) => p.id === provider);
      if (!providerConfig) {
        throw new Error(`Provider "${provider}" not found`);
      }

      const redirectTo = options?.redirectTo ?? event.url.origin;
      const redirect = options?.redirect ?? true;

      if (providerConfig.type === 'oauth') {
        const authUrl = buildOAuthAuthorizationUrl(
          providerConfig as OAuthProviderConfig,
          event,
          config,
          redirectTo
        );

        if (redirect) {
          return new Response(null, {
            status: 302,
            headers: { Location: authUrl.toString() }
          });
        }
      }

      // For credentials, this would be handled via form submission
      throw new Error('Use form submission for credentials provider');
    },

    async signOut(options?: { redirectTo?: string; redirect?: boolean }) {
      deleteSessionCookie(event.cookies, config);

      const redirectTo = options?.redirectTo ?? config.pages.signOut ?? '/';
      const redirect = options?.redirect ?? true;

      if (redirect) {
        return new Response(null, {
          status: 302,
          headers: { Location: redirectTo }
        });
      }
    }
  };
}

/**
 * Build OAuth authorization URL
 */
function buildOAuthAuthorizationUrl(
  provider: OAuthProviderConfig,
  event: RequestEvent,
  config: ResolvedAuthConfig,
  redirectTo: string
): URL {
  const authConfig =
    typeof provider.authorization === 'string'
      ? { url: provider.authorization }
      : provider.authorization;

  const url = new URL(authConfig.url);
  const callbackUrl = new URL(`${config.basePath}/callback/${provider.id}`, event.url.origin);

  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', callbackUrl.toString());
  url.searchParams.set('response_type', 'code');

  if (authConfig.params) {
    for (const [key, value] of Object.entries(authConfig.params)) {
      url.searchParams.set(key, value);
    }
  }

  // Store state for CSRF protection
  const state = crypto.randomUUID();
  event.cookies.set(`${config.cookies.name}.state`, state, {
    path: '/',
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: 'lax',
    maxAge: 60 * 15 // 15 minutes
  });

  // Store callback URL
  event.cookies.set(`${config.cookies.name}.callback-url`, redirectTo, {
    path: '/',
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: 'lax',
    maxAge: 60 * 15
  });

  url.searchParams.set('state', state);

  return url;
}

/**
 * Create the authentication middleware handle function
 */
export function createAuth(config: AuthConfig): Handle {
  const resolvedConfig = resolveConfig(config);

  return async ({ event, resolve }) => {
    // Check if this is an auth route
    if (event.url.pathname.startsWith(resolvedConfig.basePath)) {
      const response = await handleAuthRoutes(event, resolvedConfig);
      if (response) {
        return response;
      }
    }

    // Get session (lazy loaded)
    const sessionPromise = getSessionFromCookies(event.cookies, resolvedConfig);

    // Create auth context
    const auth = createAuthContext(event, resolvedConfig, sessionPromise);

    // Attach to locals
    event.locals.auth = auth;

    // Resolve session for locals (await it once)
    const session = await sessionPromise;
    event.locals.session = session;
    event.locals.user = session?.user ?? null;

    // Continue with request
    return resolve(event);
  };
}

/**
 * Create a protected routes middleware
 */
export function createProtectedRoutesMiddleware(options: MiddlewareOptions = {}): Handle {
  const {
    protectedRoutes = [],
    publicRoutes = [],
    authorize,
    unauthorizedRedirect = '/auth/signin'
  } = options;

  return async ({ event, resolve }) => {
    const pathname = event.url.pathname;

    // Check if route is explicitly public
    const isPublic = publicRoutes.some((route) => {
      if (route.endsWith('*')) {
        return pathname.startsWith(route.slice(0, -1));
      }
      return pathname === route;
    });

    if (isPublic) {
      return resolve(event);
    }

    // Check if route is protected
    const isProtected = protectedRoutes.some((route) => {
      if (route.endsWith('*')) {
        return pathname.startsWith(route.slice(0, -1));
      }
      return pathname === route;
    });

    if (!isProtected && protectedRoutes.length > 0) {
      return resolve(event);
    }

    // Get session from locals (set by createAuth middleware)
    const session = event.locals.session as Session | null;

    // Custom authorization check
    if (authorize) {
      const allowed = await authorize(event, session);
      if (!allowed) {
        const redirectUrl = new URL(unauthorizedRedirect, event.url.origin);
        redirectUrl.searchParams.set('callbackUrl', event.url.pathname);
        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl.toString() }
        });
      }
      return resolve(event);
    }

    // Default: require authenticated session
    if (!session) {
      const redirectUrl = new URL(unauthorizedRedirect, event.url.origin);
      redirectUrl.searchParams.set('callbackUrl', event.url.pathname);
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl.toString() }
      });
    }

    return resolve(event);
  };
}

/**
 * Sequence multiple Handle functions
 */
export function sequence(...handlers: Handle[]): Handle {
  return async ({ event, resolve }) => {
    let index = 0;

    async function next(): Promise<Response> {
      if (index >= handlers.length) {
        return resolve(event);
      }

      const handler = handlers[index++];
      return handler({
        event,
        resolve: next
      });
    }

    return next();
  };
}
