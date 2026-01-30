/**
 * In-memory adapter for testing and development
 *
 * WARNING: This adapter stores data in memory and will lose all data
 * when the server restarts. Only use for testing and development!
 */

import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from '../types.js';
import { createAdapterHelpers, AdapterError, AdapterErrorCodes } from './utils.js';

interface MemoryStore {
  users: Map<string, AdapterUser>;
  accounts: Map<string, AdapterAccount>;
  sessions: Map<string, AdapterSession>;
  verificationTokens: Map<string, VerificationToken>;
}

/**
 * Create an in-memory adapter instance
 *
 * @example
 * ```ts
 * const adapter = createMemoryAdapter();
 *
 * const auth = createAuth({
 *   adapter,
 *   providers: [...],
 *   secret: '...'
 * });
 * ```
 */
export function createMemoryAdapter(): Adapter {
  const helpers = createAdapterHelpers();

  const store: MemoryStore = {
    users: new Map(),
    accounts: new Map(),
    sessions: new Map(),
    verificationTokens: new Map()
  };

  /**
   * Get account key for lookups
   */
  function getAccountKey(provider: string, providerAccountId: string): string {
    return `${provider}:${providerAccountId}`;
  }

  /**
   * Get verification token key for lookups
   */
  function getTokenKey(identifier: string, token: string): string {
    return `${identifier}:${token}`;
  }

  return {
    // -------------------------------------------------------------------------
    // User Methods
    // -------------------------------------------------------------------------

    async createUser(userData) {
      const id = helpers.generateId();
      const now = helpers.now();

      const user: AdapterUser = {
        ...userData,
        id,
        createdAt: now,
        updatedAt: now
      };

      // Check for duplicate email
      for (const existingUser of store.users.values()) {
        if (existingUser.email === user.email) {
          throw new AdapterError(
            `User with email ${user.email} already exists`,
            AdapterErrorCodes.USER_ALREADY_EXISTS
          );
        }
      }

      store.users.set(id, user);
      return user;
    },

    async getUser(id) {
      return store.users.get(id) ?? null;
    },

    async getUserByEmail(email) {
      for (const user of store.users.values()) {
        if (user.email === email) {
          return user;
        }
      }
      return null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const accountKey = getAccountKey(provider, providerAccountId);
      const account = store.accounts.get(accountKey);

      if (!account) {
        return null;
      }

      return store.users.get(account.userId) ?? null;
    },

    async updateUser(userData) {
      const existing = store.users.get(userData.id);

      if (!existing) {
        throw new AdapterError(
          `User with id ${userData.id} not found`,
          AdapterErrorCodes.USER_NOT_FOUND
        );
      }

      const updated: AdapterUser = {
        ...existing,
        ...userData,
        updatedAt: helpers.now()
      };

      store.users.set(userData.id, updated);
      return updated;
    },

    async deleteUser(id) {
      // Delete user's accounts
      for (const [key, account] of store.accounts.entries()) {
        if (account.userId === id) {
          store.accounts.delete(key);
        }
      }

      // Delete user's sessions
      for (const [key, session] of store.sessions.entries()) {
        if (session.userId === id) {
          store.sessions.delete(key);
        }
      }

      // Delete user
      store.users.delete(id);
    },

    // -------------------------------------------------------------------------
    // Account Methods
    // -------------------------------------------------------------------------

    async linkAccount(accountData) {
      const id = helpers.generateId();
      const now = helpers.now();
      const accountKey = getAccountKey(
        accountData.provider,
        accountData.providerAccountId
      );

      // Check if account already exists
      if (store.accounts.has(accountKey)) {
        throw new AdapterError(
          `Account ${accountData.provider}:${accountData.providerAccountId} already linked`,
          AdapterErrorCodes.ACCOUNT_ALREADY_LINKED
        );
      }

      const account: AdapterAccount = {
        ...accountData,
        id,
        accessToken: accountData.accessToken ?? null,
        refreshToken: accountData.refreshToken ?? null,
        expiresAt: accountData.expiresAt ?? null,
        tokenType: accountData.tokenType ?? null,
        scope: accountData.scope ?? null,
        idToken: accountData.idToken ?? null,
        createdAt: now,
        updatedAt: now
      };

      store.accounts.set(accountKey, account);
      return account;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const accountKey = getAccountKey(provider, providerAccountId);
      store.accounts.delete(accountKey);
    },

    async getAccount({ provider, providerAccountId }) {
      const accountKey = getAccountKey(provider, providerAccountId);
      return store.accounts.get(accountKey) ?? null;
    },

    // -------------------------------------------------------------------------
    // Session Methods
    // -------------------------------------------------------------------------

    async createSession(sessionData) {
      const id = helpers.generateId();
      const now = helpers.now();

      const session: AdapterSession = {
        ...sessionData,
        id,
        createdAt: now,
        updatedAt: now
      };

      store.sessions.set(sessionData.sessionToken, session);
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const session = store.sessions.get(sessionToken);

      if (!session) {
        return null;
      }

      // Check if expired
      if (session.expires.getTime() < Date.now()) {
        store.sessions.delete(sessionToken);
        return null;
      }

      const user = store.users.get(session.userId);

      if (!user) {
        return null;
      }

      return { session, user };
    },

    async updateSession(sessionData) {
      const existing = store.sessions.get(sessionData.sessionToken);

      if (!existing) {
        return null;
      }

      const updated: AdapterSession = {
        ...existing,
        ...sessionData,
        updatedAt: helpers.now()
      };

      store.sessions.set(sessionData.sessionToken, updated);
      return updated;
    },

    async deleteSession(sessionToken) {
      store.sessions.delete(sessionToken);
    },

    // -------------------------------------------------------------------------
    // Verification Token Methods
    // -------------------------------------------------------------------------

    async createVerificationToken(token) {
      const key = getTokenKey(token.identifier, token.token);
      store.verificationTokens.set(key, token);
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const key = getTokenKey(identifier, token);
      const storedToken = store.verificationTokens.get(key);

      if (!storedToken) {
        return null;
      }

      // Delete the token (one-time use)
      store.verificationTokens.delete(key);

      // Check if expired
      if (storedToken.expires.getTime() < Date.now()) {
        return null;
      }

      return storedToken;
    }
  };
}

/**
 * In-memory adapter class (alternative to factory function)
 *
 * @example
 * ```ts
 * const adapter = new MemoryAdapter();
 * ```
 */
export class MemoryAdapter implements Adapter {
  private adapter: Adapter;

  constructor() {
    this.adapter = createMemoryAdapter();
  }

  createUser = this.adapter.createUser.bind(this.adapter);
  getUser = this.adapter.getUser.bind(this.adapter);
  getUserByEmail = this.adapter.getUserByEmail.bind(this.adapter);
  getUserByAccount = this.adapter.getUserByAccount.bind(this.adapter);
  updateUser = this.adapter.updateUser.bind(this.adapter);
  deleteUser = this.adapter.deleteUser.bind(this.adapter);
  linkAccount = this.adapter.linkAccount.bind(this.adapter);
  unlinkAccount = this.adapter.unlinkAccount.bind(this.adapter);
  getAccount = this.adapter.getAccount.bind(this.adapter);
  createSession = this.adapter.createSession.bind(this.adapter);
  getSessionAndUser = this.adapter.getSessionAndUser.bind(this.adapter);
  updateSession = this.adapter.updateSession.bind(this.adapter);
  deleteSession = this.adapter.deleteSession.bind(this.adapter);
  createVerificationToken = this.adapter.createVerificationToken.bind(this.adapter);
  useVerificationToken = this.adapter.useVerificationToken.bind(this.adapter);
}
