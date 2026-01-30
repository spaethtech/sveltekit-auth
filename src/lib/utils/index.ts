/**
 * Utility exports
 */

export {
  encrypt,
  decrypt,
  sign,
  verify,
  generateRandomString,
  generateCodeVerifier,
  generateCodeChallenge,
  base64UrlEncode,
  base64UrlDecode
} from './crypto.js';

export { createJWT, verifyJWT, decodeJWT, type JWTPayload, type JWTHeader } from './jwt.js';

export {
  createSession,
  encodeSession,
  decodeSession,
  getSessionFromCookies,
  setSessionCookie,
  deleteSessionCookie,
  shouldUpdateSession,
  refreshSession,
  defaultCookieConfig
} from './session.js';

export {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateToken,
  type HashOptions
} from './password.js';
