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
  accountsByLogin: Map<string, AdapterAccount>; // Secondary index for login lookups
  accountsById: Map<string, AdapterAccount>; // Index by account ID
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
    accountsByLogin: new Map(),
    accountsById: new Map(),
    sessions: new Map(),
    verificationTokens: new Map()
  };

  /**
   * Get account key for lookups by providerAccountId
   */
  function getAccountKey(provider: string, providerAccountId: string): string {
    return `${provider}:${providerAccountId}`;
  }

  /**
   * Get account key for lookups by login
   */
  function getLoginKey(provider: string, login: string): string {
    return `login:${provider}:${login}`;
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

      const user = {
        ...userData,
        id,
        createdAt: now,
        updatedAt: now
      } as AdapterUser;

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
      // Delete user's accounts from all indexes
      for (const [key, account] of store.accounts.entries()) {
        if (account.userId === id) {
          store.accounts.delete(key);
          store.accountsById.delete(account.id);

          if (account.login) {
            const loginKey = getLoginKey(account.provider, account.login);
            store.accountsByLogin.delete(loginKey);
          }
        }
      }

      // Also check accountsById for any accounts not in the primary index
      for (const [accountId, account] of store.accountsById.entries()) {
        if (account.userId === id) {
          store.accountsById.delete(accountId);
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

      // Check for existing account by providerAccountId (if provided)
      if (accountData.providerAccountId) {
        const accountKey = getAccountKey(
          accountData.provider,
          accountData.providerAccountId
        );
        if (store.accounts.has(accountKey)) {
          throw new AdapterError(
            `Account ${accountData.provider}:${accountData.providerAccountId} already linked`,
            AdapterErrorCodes.ACCOUNT_ALREADY_LINKED
          );
        }
      }

      // Check for existing account by login (if provided)
      if (accountData.login) {
        const loginKey = getLoginKey(accountData.provider, accountData.login);
        if (store.accountsByLogin.has(loginKey)) {
          throw new AdapterError(
            `Account ${accountData.provider}:${accountData.login} already linked`,
            AdapterErrorCodes.ACCOUNT_ALREADY_LINKED
          );
        }
      }

      const account = {
        ...accountData,
        id,
        providerAccountId: accountData.providerAccountId,
        login: accountData.login,
        loginVerified: accountData.loginVerified,
        passwordHash: accountData.passwordHash,
        accessToken: accountData.accessToken,
        refreshToken: accountData.refreshToken,
        expiresAt: accountData.expiresAt,
        tokenType: accountData.tokenType,
        scope: accountData.scope,
        idToken: accountData.idToken,
        createdAt: now,
        updatedAt: now
      } as AdapterAccount;

      // Store in primary index (by providerAccountId)
      if (accountData.providerAccountId) {
        const accountKey = getAccountKey(accountData.provider, accountData.providerAccountId);
        store.accounts.set(accountKey, account);
      }

      // Store in secondary index (by login)
      if (accountData.login) {
        const loginKey = getLoginKey(accountData.provider, accountData.login);
        store.accountsByLogin.set(loginKey, account);
      }

      // Store by ID
      store.accountsById.set(id, account);

      return account;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const accountKey = getAccountKey(provider, providerAccountId);
      const account = store.accounts.get(accountKey);

      if (account) {
        // Remove from all indexes
        store.accounts.delete(accountKey);
        store.accountsById.delete(account.id);

        if (account.login) {
          const loginKey = getLoginKey(provider, account.login);
          store.accountsByLogin.delete(loginKey);
        }
      }
    },

    async getAccount({ provider, providerAccountId }) {
      const accountKey = getAccountKey(provider, providerAccountId);
      return store.accounts.get(accountKey) ?? null;
    },

    async getAccountByLogin(provider, login) {
      const loginKey = getLoginKey(provider, login);
      return store.accountsByLogin.get(loginKey) ?? null;
    },

    async updateAccount(accountId, data) {
      const account = store.accountsById.get(accountId);

      if (!account) {
        return null;
      }

      const updated: AdapterAccount = {
        ...account,
        ...data,
        updatedAt: helpers.now()
      };

      // Update all indexes
      store.accountsById.set(accountId, updated);

      if (account.providerAccountId) {
        const accountKey = getAccountKey(account.provider, account.providerAccountId);
        store.accounts.set(accountKey, updated);
      }

      if (account.login) {
        const loginKey = getLoginKey(account.provider, account.login);
        store.accountsByLogin.set(loginKey, updated);
      }

      return updated;
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
  private _adapter: Adapter;

  createUser: Adapter['createUser'];
  getUser: Adapter['getUser'];
  getUserByEmail: Adapter['getUserByEmail'];
  getUserByAccount: Adapter['getUserByAccount'];
  updateUser: Adapter['updateUser'];
  deleteUser: Adapter['deleteUser'];
  linkAccount: Adapter['linkAccount'];
  unlinkAccount: Adapter['unlinkAccount'];
  getAccount: Adapter['getAccount'];
  getAccountByLogin: Adapter['getAccountByLogin'];
  updateAccount: Adapter['updateAccount'];
  createSession: Adapter['createSession'];
  getSessionAndUser: Adapter['getSessionAndUser'];
  updateSession: Adapter['updateSession'];
  deleteSession: Adapter['deleteSession'];
  createVerificationToken: Adapter['createVerificationToken'];
  useVerificationToken: Adapter['useVerificationToken'];

  constructor() {
    this._adapter = createMemoryAdapter();
    this.createUser = this._adapter.createUser.bind(this._adapter);
    this.getUser = this._adapter.getUser.bind(this._adapter);
    this.getUserByEmail = this._adapter.getUserByEmail.bind(this._adapter);
    this.getUserByAccount = this._adapter.getUserByAccount.bind(this._adapter);
    this.updateUser = this._adapter.updateUser.bind(this._adapter);
    this.deleteUser = this._adapter.deleteUser.bind(this._adapter);
    this.linkAccount = this._adapter.linkAccount.bind(this._adapter);
    this.unlinkAccount = this._adapter.unlinkAccount.bind(this._adapter);
    this.getAccount = this._adapter.getAccount.bind(this._adapter);
    this.getAccountByLogin = this._adapter.getAccountByLogin?.bind(this._adapter);
    this.updateAccount = this._adapter.updateAccount?.bind(this._adapter);
    this.createSession = this._adapter.createSession.bind(this._adapter);
    this.getSessionAndUser = this._adapter.getSessionAndUser.bind(this._adapter);
    this.updateSession = this._adapter.updateSession.bind(this._adapter);
    this.deleteSession = this._adapter.deleteSession.bind(this._adapter);
    this.createVerificationToken = this._adapter.createVerificationToken.bind(this._adapter);
    this.useVerificationToken = this._adapter.useVerificationToken.bind(this._adapter);
  }
}
