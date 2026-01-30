/**
 * Built-in auth route handlers
 */

import type { RequestEvent } from '@sveltejs/kit';
import type {
  ResolvedAuthConfig,
  Session,
  User,
  Account,
  Profile,
  OAuthProviderConfig,
  CredentialsProviderConfig,
  TokenSet
} from '../types.js';
import {
  createSession,
  setSessionCookie,
  deleteSessionCookie
} from '../utils/session.js';

/**
 * Handle authentication routes
 */
export async function handleAuthRoutes(
  event: RequestEvent,
  config: ResolvedAuthConfig
): Promise<Response | null> {
  const { pathname } = event.url;
  const basePath = config.basePath;

  // Remove base path prefix
  const route = pathname.slice(basePath.length);

  // GET /auth/session - Get current session
  if (route === '/session' && event.request.method === 'GET') {
    return handleGetSession(event, config);
  }

  // GET /auth/signin - Sign in page
  if (route === '/signin' && event.request.method === 'GET') {
    return handleSignInPage(event, config);
  }

  // POST /auth/signin/:provider - Sign in with provider
  if (route.startsWith('/signin/') && event.request.method === 'POST') {
    const provider = route.slice('/signin/'.length);
    return handleSignIn(event, config, provider);
  }

  // GET /auth/signin/:provider - OAuth redirect
  if (route.startsWith('/signin/') && event.request.method === 'GET') {
    const provider = route.slice('/signin/'.length);
    return handleOAuthRedirect(event, config, provider);
  }

  // GET /auth/callback/:provider - OAuth callback
  if (route.startsWith('/callback/') && event.request.method === 'GET') {
    const provider = route.slice('/callback/'.length);
    return handleOAuthCallback(event, config, provider);
  }

  // POST /auth/signout - Sign out
  if (route === '/signout' && event.request.method === 'POST') {
    return handleSignOut(event, config);
  }

  // GET /auth/signout - Sign out page/redirect
  if (route === '/signout' && event.request.method === 'GET') {
    return handleSignOut(event, config);
  }

  // GET /auth/providers - List providers
  if (route === '/providers' && event.request.method === 'GET') {
    return handleGetProviders(event, config);
  }

  // GET /auth/csrf - Get CSRF token
  if (route === '/csrf' && event.request.method === 'GET') {
    return handleGetCsrf(event, config);
  }

  return null;
}

/**
 * GET /auth/session
 */
async function handleGetSession(
  event: RequestEvent,
  config: ResolvedAuthConfig
): Promise<Response> {
  const session = event.locals.session as Session | null;

  if (!session) {
    return Response.json({ user: null, expires: null });
  }

  // Apply session callback if provided
  let finalSession = session;
  if (config.callbacks.session) {
    finalSession = await config.callbacks.session({
      session,
      token: {},
      user: session.user
    });
  }

  return Response.json({
    user: finalSession.user,
    expires: finalSession.expires.toISOString()
  });
}

/**
 * GET /auth/signin - Render sign in page or redirect
 */
async function handleSignInPage(
  event: RequestEvent,
  config: ResolvedAuthConfig
): Promise<Response> {
  // If custom sign in page is configured, redirect there
  if (config.pages.signIn) {
    const callbackUrl = event.url.searchParams.get('callbackUrl') ?? '/';
    const redirectUrl = new URL(config.pages.signIn, event.url.origin);
    redirectUrl.searchParams.set('callbackUrl', callbackUrl);
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl.toString() }
    });
  }

  // Return a simple JSON response with available providers
  const providers = config.providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    signinUrl: `${config.basePath}/signin/${p.id}`,
    callbackUrl: `${config.basePath}/callback/${p.id}`
  }));

  return Response.json({ providers });
}

/**
 * POST /auth/signin/:provider - Handle credentials sign in
 */
async function handleSignIn(
  event: RequestEvent,
  config: ResolvedAuthConfig,
  providerId: string
): Promise<Response> {
  const providerConfig = config.providers.find((p) => p.id === providerId);

  if (!providerConfig) {
    return Response.json({ error: 'Provider not found' }, { status: 404 });
  }

  if (providerConfig.type !== 'credentials') {
    return Response.json(
      { error: 'Use GET request for OAuth providers' },
      { status: 400 }
    );
  }

  const credentials = providerConfig as CredentialsProviderConfig;
  const formData = await event.request.formData();
  const credentialData: Record<string, string | undefined> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      credentialData[key] = value;
    }
  }

  try {
    const user = await credentials.authorize(credentialData, event.request);

    if (!user) {
      const errorUrl = config.pages.error
        ? new URL(config.pages.error, event.url.origin)
        : new URL(`${config.basePath}/signin`, event.url.origin);
      errorUrl.searchParams.set('error', 'CredentialsSignin');
      return new Response(null, {
        status: 302,
        headers: { Location: errorUrl.toString() }
      });
    }

    // Create account info
    const account: Account = {
      provider: providerId,
      providerAccountId: user.id,
      type: 'credentials'
    };

    // Call signIn callback if provided
    if (config.callbacks.signIn) {
      const allowed = await config.callbacks.signIn({ user, account });
      if (allowed === false) {
        return Response.json({ error: 'Sign in not allowed' }, { status: 403 });
      }
      if (typeof allowed === 'string') {
        return new Response(null, {
          status: 302,
          headers: { Location: allowed }
        });
      }
    }

    // Create session
    const session = createSession(user, config.session.maxAge);
    await setSessionCookie(event.cookies, session, config);

    // Redirect to callback URL or home
    const callbackUrl = formData.get('callbackUrl')?.toString() ?? '/';
    return new Response(null, {
      status: 302,
      headers: { Location: callbackUrl }
    });
  } catch (error) {
    if (config.debug) {
      console.error('Sign in error:', error);
    }
    return Response.json({ error: 'Sign in failed' }, { status: 500 });
  }
}

/**
 * GET /auth/signin/:provider - Redirect to OAuth provider
 */
async function handleOAuthRedirect(
  event: RequestEvent,
  config: ResolvedAuthConfig,
  providerId: string
): Promise<Response> {
  const providerConfig = config.providers.find((p) => p.id === providerId);

  if (!providerConfig) {
    return Response.json({ error: 'Provider not found' }, { status: 404 });
  }

  if (providerConfig.type !== 'oauth') {
    return Response.json(
      { error: 'Use POST request for credentials providers' },
      { status: 400 }
    );
  }

  const oauth = providerConfig as OAuthProviderConfig;
  const authConfig =
    typeof oauth.authorization === 'string'
      ? { url: oauth.authorization }
      : oauth.authorization;

  const authUrl = new URL(authConfig.url);
  const callbackUrl = new URL(
    `${config.basePath}/callback/${providerId}`,
    event.url.origin
  );

  authUrl.searchParams.set('client_id', oauth.clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authUrl.searchParams.set('response_type', 'code');

  if (authConfig.params) {
    for (const [key, value] of Object.entries(authConfig.params)) {
      authUrl.searchParams.set(key, value);
    }
  }

  // Generate and store state
  const state = crypto.randomUUID();
  event.cookies.set(`${config.cookies.name}.state`, state, {
    path: '/',
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: 'lax',
    maxAge: 60 * 15
  });

  // Store callback URL for after authentication
  const requestCallbackUrl = event.url.searchParams.get('callbackUrl') ?? '/';
  event.cookies.set(`${config.cookies.name}.callback-url`, requestCallbackUrl, {
    path: '/',
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: 'lax',
    maxAge: 60 * 15
  });

  authUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: { Location: authUrl.toString() }
  });
}

/**
 * GET /auth/callback/:provider - Handle OAuth callback
 */
async function handleOAuthCallback(
  event: RequestEvent,
  config: ResolvedAuthConfig,
  providerId: string
): Promise<Response> {
  const providerConfig = config.providers.find((p) => p.id === providerId);

  if (!providerConfig || providerConfig.type !== 'oauth') {
    return Response.json({ error: 'Provider not found' }, { status: 404 });
  }

  const oauth = providerConfig as OAuthProviderConfig;

  // Verify state
  const state = event.url.searchParams.get('state');
  const storedState = event.cookies.get(`${config.cookies.name}.state`);

  if (!state || state !== storedState) {
    return Response.json({ error: 'Invalid state' }, { status: 400 });
  }

  // Clean up state cookie
  event.cookies.delete(`${config.cookies.name}.state`, { path: '/' });

  // Check for error
  const error = event.url.searchParams.get('error');
  if (error) {
    const errorUrl = config.pages.error
      ? new URL(config.pages.error, event.url.origin)
      : new URL(`${config.basePath}/signin`, event.url.origin);
    errorUrl.searchParams.set('error', error);
    return new Response(null, {
      status: 302,
      headers: { Location: errorUrl.toString() }
    });
  }

  // Get authorization code
  const code = event.url.searchParams.get('code');
  if (!code) {
    return Response.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  try {
    // Exchange code for tokens
    const tokenConfig =
      typeof oauth.token === 'string' ? { url: oauth.token } : oauth.token;

    const callbackUrl = new URL(
      `${config.basePath}/callback/${providerId}`,
      event.url.origin
    );

    const tokenResponse = await fetch(tokenConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl.toString(),
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        ...(tokenConfig.params ?? {})
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      if (config.debug) {
        console.error('Token exchange failed:', errorText);
      }
      return Response.json({ error: 'Token exchange failed' }, { status: 500 });
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    const tokenSet: TokenSet = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
      scope: tokens.scope
    };

    // Get user profile
    let profile: Profile = {};

    if (oauth.userinfo) {
      const userinfoUrl =
        typeof oauth.userinfo === 'string' ? oauth.userinfo : oauth.userinfo.url;

      const profileResponse = await fetch(userinfoUrl, {
        headers: {
          Authorization: `Bearer ${tokenSet.accessToken}`,
          Accept: 'application/json'
        }
      });

      if (profileResponse.ok) {
        profile = (await profileResponse.json()) as Profile;
      }
    }

    // Transform profile to user
    const user = oauth.profile
      ? await oauth.profile(profile, tokenSet)
      : {
          id: profile.sub ?? profile.id ?? '',
          name: profile.name,
          email: profile.email,
          image: profile.image ?? profile.picture ?? profile.avatar_url
        };

    // Create account info
    const account: Account = {
      provider: providerId,
      providerAccountId: user.id,
      type: 'oauth',
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      expiresAt: tokenSet.expiresIn
        ? Math.floor(Date.now() / 1000) + tokenSet.expiresIn
        : undefined,
      tokenType: tokenSet.tokenType,
      scope: tokenSet.scope,
      idToken: tokenSet.idToken
    };

    // Call signIn callback if provided
    if (config.callbacks.signIn) {
      const allowed = await config.callbacks.signIn({ user, account, profile });
      if (allowed === false) {
        const errorUrl = config.pages.error
          ? new URL(config.pages.error, event.url.origin)
          : new URL(`${config.basePath}/signin`, event.url.origin);
        errorUrl.searchParams.set('error', 'AccessDenied');
        return new Response(null, {
          status: 302,
          headers: { Location: errorUrl.toString() }
        });
      }
      if (typeof allowed === 'string') {
        return new Response(null, {
          status: 302,
          headers: { Location: allowed }
        });
      }
    }

    // Create session
    const session = createSession(user, config.session.maxAge);
    session.accessToken = tokenSet.accessToken;
    session.refreshToken = tokenSet.refreshToken;

    await setSessionCookie(event.cookies, session, config);

    // Redirect to original callback URL
    const finalCallbackUrl =
      event.cookies.get(`${config.cookies.name}.callback-url`) ?? '/';
    event.cookies.delete(`${config.cookies.name}.callback-url`, { path: '/' });

    return new Response(null, {
      status: 302,
      headers: { Location: finalCallbackUrl }
    });
  } catch (error) {
    if (config.debug) {
      console.error('OAuth callback error:', error);
    }
    return Response.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

/**
 * POST/GET /auth/signout - Sign out
 */
async function handleSignOut(
  event: RequestEvent,
  config: ResolvedAuthConfig
): Promise<Response> {
  deleteSessionCookie(event.cookies, config);

  // Get redirect URL
  let redirectUrl = '/';

  if (event.request.method === 'POST') {
    const formData = await event.request.formData();
    redirectUrl = formData.get('callbackUrl')?.toString() ?? '/';
  } else {
    redirectUrl = event.url.searchParams.get('callbackUrl') ?? '/';
  }

  // Apply redirect callback if provided
  if (config.callbacks.redirect) {
    redirectUrl = await config.callbacks.redirect({
      url: redirectUrl,
      baseUrl: event.url.origin
    });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl }
  });
}

/**
 * GET /auth/providers - List available providers
 */
async function handleGetProviders(
  event: RequestEvent,
  config: ResolvedAuthConfig
): Promise<Response> {
  const providers = config.providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    signinUrl: `${config.basePath}/signin/${p.id}`,
    callbackUrl: `${config.basePath}/callback/${p.id}`
  }));

  return Response.json(providers);
}

/**
 * GET /auth/csrf - Get CSRF token
 */
async function handleGetCsrf(
  event: RequestEvent,
  config: ResolvedAuthConfig
): Promise<Response> {
  const csrfToken = crypto.randomUUID();

  event.cookies.set(`${config.cookies.name}.csrf-token`, csrfToken, {
    path: '/',
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: 'strict',
    maxAge: 60 * 60 // 1 hour
  });

  return Response.json({ csrfToken });
}
