/**
 * Adapter utilities and helpers
 */

import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from '../types.js';

/**
 * Custom error class for adapter errors
 */
export class AdapterError extends Error {
  code: string;
  cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Check if an error is an AdapterError
 */
export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError;
}

/**
 * Error codes for common adapter errors
 */
export const AdapterErrorCodes = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_ALREADY_LINKED: 'ACCOUNT_ALREADY_LINKED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  DATABASE_ERROR: 'DATABASE_ERROR'
} as const;

/**
 * Helper interface for common adapter operations
 */
export interface AdapterHelpers {
  /**
   * Generate a unique ID
   */
  generateId(): string;

  /**
   * Generate a session token
   */
  generateSessionToken(): string;

  /**
   * Generate a verification token
   */
  generateVerificationToken(): string;

  /**
   * Hash a token for storage
   */
  hashToken(token: string): Promise<string>;

  /**
   * Get the current timestamp
   */
  now(): Date;

  /**
   * Calculate expiration date from seconds
   */
  expires(seconds: number): Date;
}

/**
 * Create adapter helpers with optional custom implementations
 */
export function createAdapterHelpers(
  overrides: Partial<AdapterHelpers> = {}
): AdapterHelpers {
  return {
    generateId() {
      return crypto.randomUUID();
    },

    generateSessionToken() {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    },

    generateVerificationToken() {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    },

    async hashToken(token: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    },

    now() {
      return new Date();
    },

    expires(seconds: number) {
      return new Date(Date.now() + seconds * 1000);
    },

    ...overrides
  };
}

/**
 * Validate that a user object has required fields
 */
export function validateUser(user: Partial<AdapterUser>): user is AdapterUser {
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    user.createdAt instanceof Date &&
    user.updatedAt instanceof Date
  );
}

/**
 * Validate that an account object has required fields
 */
export function validateAccount(
  account: Partial<AdapterAccount>
): account is AdapterAccount {
  return (
    typeof account.id === 'string' &&
    typeof account.userId === 'string' &&
    typeof account.provider === 'string' &&
    typeof account.providerAccountId === 'string' &&
    ['oauth', 'credentials', 'email'].includes(account.type ?? '')
  );
}

/**
 * Validate that a session object has required fields
 */
export function validateSession(
  session: Partial<AdapterSession>
): session is AdapterSession {
  return (
    typeof session.id === 'string' &&
    typeof session.userId === 'string' &&
    typeof session.sessionToken === 'string' &&
    session.expires instanceof Date
  );
}

/**
 * Check if a session has expired
 */
export function isSessionExpired(session: AdapterSession): boolean {
  return session.expires.getTime() < Date.now();
}

/**
 * Check if a verification token has expired
 */
export function isTokenExpired(token: VerificationToken): boolean {
  return token.expires.getTime() < Date.now();
}

/**
 * Create a partial adapter that throws for unimplemented methods
 */
export function createPartialAdapter(
  methods: Partial<Adapter>
): Partial<Adapter> {
  return methods;
}

/**
 * Merge multiple partial adapters into one
 */
export function mergeAdapters(
  ...adapters: Partial<Adapter>[]
): Partial<Adapter> {
  const merged: Partial<Adapter> = {};

  for (const adapter of adapters) {
    Object.assign(merged, adapter);
  }

  return merged;
}
