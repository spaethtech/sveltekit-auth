/**
 * Session management utilities
 */

import type { Cookies } from '@sveltejs/kit';
import type { Session, SessionData, User, CookieConfig, ResolvedAuthConfig } from '../types.js';
import { createJWT, verifyJWT } from './jwt.js';
import { encrypt, decrypt } from './crypto.js';

/**
 * Default cookie configuration
 */
export const defaultCookieConfig: CookieConfig = {
  name: 'sveltekit-auth.session-token',
  maxAge: 30 * 24 * 60 * 60, // 30 days
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax'
};

/**
 * Create a session from user data
 */
export function createSession(user: User, maxAge: number): Session {
  const expires = new Date(Date.now() + maxAge * 1000);
  return {
    user,
    expires
  };
}

/**
 * Encode session data to a JWT token
 */
export async function encodeSession(
  session: Session,
  secret: string,
  maxAge: number
): Promise<string> {
  const payload = {
    sub: session.user.id,
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };

  return createJWT(payload, secret, { expiresIn: maxAge });
}

/**
 * Decode a session token back to session data
 */
export async function decodeSession(
  token: string,
  secret: string
): Promise<Session | null> {
  const payload = await verifyJWT(token, secret);
  if (!payload || !payload.user) {
    return null;
  }

  return {
    user: payload.user as User,
    expires: new Date((payload.exp ?? 0) * 1000),
    accessToken: payload.accessToken as string | undefined,
    refreshToken: payload.refreshToken as string | undefined
  };
}

/**
 * Get session from cookies
 */
export async function getSessionFromCookies(
  cookies: Cookies,
  config: ResolvedAuthConfig
): Promise<Session | null> {
  const token = cookies.get(config.cookies.name);
  if (!token) {
    return null;
  }

  try {
    return await decodeSession(token, config.secret);
  } catch {
    return null;
  }
}

/**
 * Set session in cookies
 */
export async function setSessionCookie(
  cookies: Cookies,
  session: Session,
  config: ResolvedAuthConfig
): Promise<void> {
  const maxAge = config.session.maxAge;
  const token = await encodeSession(session, config.secret, maxAge);

  cookies.set(config.cookies.name, token, {
    path: config.cookies.path,
    httpOnly: config.cookies.httpOnly,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    maxAge
  });
}

/**
 * Delete session cookie
 */
export function deleteSessionCookie(
  cookies: Cookies,
  config: ResolvedAuthConfig
): void {
  cookies.delete(config.cookies.name, {
    path: config.cookies.path
  });
}

/**
 * Check if a session needs to be updated (based on updateAge)
 */
export function shouldUpdateSession(session: Session, updateAge: number): boolean {
  const now = Date.now();
  const expires = session.expires.getTime();
  const timeLeft = expires - now;
  const maxAge = expires - (session as { iat?: number }).iat! * 1000;

  // Update if more than updateAge has passed since last update
  return timeLeft < maxAge - updateAge * 1000;
}

/**
 * Refresh a session (update expiration time)
 */
export function refreshSession(session: Session, maxAge: number): Session {
  return {
    ...session,
    expires: new Date(Date.now() + maxAge * 1000)
  };
}
