/**
 * JWT utilities for session tokens
 */

import { sign, verify, base64UrlEncode, base64UrlDecode } from './crypto.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface JWTPayload {
  sub?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface JWTHeader {
  alg: string;
  typ: string;
}

/**
 * Create a JWT token
 */
export async function createJWT(
  payload: JWTPayload,
  secret: string,
  options: { expiresIn?: number } = {}
): Promise<string> {
  const header: JWTHeader = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: payload.iat ?? now,
    exp: payload.exp ?? (options.expiresIn ? now + options.expiresIn : undefined)
  };

  const headerBase64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadBase64 = base64UrlEncode(encoder.encode(JSON.stringify(tokenPayload)));
  const signatureInput = `${headerBase64}.${payloadBase64}`;
  const signature = await sign(signatureInput, secret);
  const signatureBase64 = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${headerBase64}.${payloadBase64}.${signatureBase64}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerBase64, payloadBase64, signatureBase64] = parts;
    const signatureInput = `${headerBase64}.${payloadBase64}`;

    // Convert base64url signature back to base64 for verification
    const signature = signatureBase64.replace(/-/g, '+').replace(/_/g, '/');
    const paddedSignature = signature + '='.repeat((4 - (signature.length % 4)) % 4);

    const isValid = await verify(signatureInput, paddedSignature, secret);
    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadBase64))) as JWTPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT token without verification (for debugging)
 */
export function decodeJWT(token: string): { header: JWTHeader; payload: JWTPayload } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(decoder.decode(base64UrlDecode(parts[0]))) as JWTHeader;
    const payload = JSON.parse(decoder.decode(base64UrlDecode(parts[1]))) as JWTPayload;

    return { header, payload };
  } catch {
    return null;
  }
}
