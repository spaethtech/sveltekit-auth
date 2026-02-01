/**
 * Drizzle ORM adapter for sveltekit-auth
 *
 * Generate the required schema using the CLI:
 * ```bash
 * npx sveltekit-auth init -d postgres
 * ```
 *
 * This creates two files in `src/lib/server/schemas/`:
 * - `users.ts` - User model (extendable with custom fields)
 * - `auth.ts` - Internal auth tables (accounts, sessions, verifications)
 *
 * Example schema (PostgreSQL with Drizzle):
 *
 * ```ts
 * // users.ts
 * import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
 *
 * export const users = pgTable('users', {
 *   id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
 *   name: text('name'),
 *   email: text('email'),
 *   image: text('image'),
 *   createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
 *   updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
 *   // Add your custom fields here
 * });
 *
 * // auth.ts
 * import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
 * import { users } from './users.js';
 *
 * export const accounts = pgTable('accounts', {
 *   id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
 *   userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
 *   type: text('type').$type<'oauth' | 'credentials' | 'email'>().notNull(),
 *   provider: text('provider').notNull(),
 *   providerAccountId: text('provider_account_id'),
 *   login: text('login').notNull(),
 *   loginVerified: timestamp('login_verified', { mode: 'date' }),
 *   passwordHash: text('password_hash'),
 *   refreshToken: text('refresh_token'),
 *   accessToken: text('access_token'),
 *   expiresAt: integer('expires_at'),
 *   tokenType: text('token_type'),
 *   scope: text('scope'),
 *   idToken: text('id_token'),
 *   createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
 *   updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
 * }, (table) => [
 *   uniqueIndex('accounts_provider_login_idx').on(table.provider, table.login)
 * ]);
 *
 * export const sessions = pgTable('sessions', {
 *   id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
 *   sessionToken: text('session_token').notNull().unique(),
 *   userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
 *   expires: timestamp('expires', { mode: 'date' }).notNull(),
 *   createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
 *   updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
 * });
 *
 * export const verifications = pgTable('verifications', {
 *   identifier: text('identifier').notNull(),
 *   token: text('token').notNull().unique(),
 *   expires: timestamp('expires', { mode: 'date' }).notNull()
 * }, (table) => [
 *   uniqueIndex('verifications_identifier_token_idx').on(table.identifier, table.token)
 * ]);
 * ```
 */

import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from '../types.js';
import { createAdapterHelpers } from './utils.js';

/**
 * Drizzle database instance interface
 */
export interface DrizzleDatabase {
  select: (fields?: Record<string, unknown>) => {
    from: (table: unknown) => {
      where: (condition: unknown) => Promise<Record<string, unknown>[]>;
      leftJoin: (table: unknown, condition: unknown) => {
        where: (condition: unknown) => Promise<Record<string, unknown>[]>;
      };
    };
  };
  insert: (table: unknown) => {
    values: (data: Record<string, unknown>) => {
      returning: () => Promise<Record<string, unknown>[]>;
    };
  };
  update: (table: unknown) => {
    set: (data: Record<string, unknown>) => {
      where: (condition: unknown) => {
        returning: () => Promise<Record<string, unknown>[]>;
      };
    };
  };
  delete: (table: unknown) => {
    where: (condition: unknown) => {
      returning: () => Promise<Record<string, unknown>[]>;
    };
  };
}

/**
 * Drizzle schema tables interface
 */
export interface DrizzleSchema {
  users: unknown;
  accounts: unknown;
  sessions: unknown;
  verifications: unknown;
}

/**
 * Drizzle adapter configuration
 */
export interface DrizzleAdapterConfig {
  /**
   * Drizzle database instance
   */
  db: DrizzleDatabase;

  /**
   * Drizzle schema tables
   */
  schema: DrizzleSchema;

  /**
   * Drizzle operators (eq, and, etc.)
   */
  operators: {
    eq: (column: unknown, value: unknown) => unknown;
    and: (...conditions: unknown[]) => unknown;
  };
}

/**
 * Create a Drizzle ORM adapter instance
 *
 * @example
 * ```ts
 * import { drizzle } from 'drizzle-orm/postgres-js';
 * import { eq, and } from 'drizzle-orm';
 * import postgres from 'postgres';
 * import * as schema from './schema';
 * import { createDrizzleAdapter } from '@sveltekit-auth/core/adapters';
 *
 * const client = postgres(process.env.DATABASE_URL);
 * const db = drizzle(client, { schema });
 *
 * const adapter = createDrizzleAdapter({
 *   db,
 *   schema,
 *   operators: { eq, and }
 * });
 *
 * const auth = createAuth({
 *   adapter,
 *   providers: [...],
 *   secret: '...'
 * });
 * ```
 */
export function createDrizzleAdapter(config: DrizzleAdapterConfig): Adapter {
  const { db, schema, operators } = config;
  const { eq, and } = operators;
  const helpers = createAdapterHelpers();

  return {
    // -------------------------------------------------------------------------
    // User Methods
    // -------------------------------------------------------------------------

    async createUser(userData) {
      const id = helpers.generateId();
      const now = helpers.now();

      const [user] = await db
        .insert(schema.users)
        .values({
          id,
          email: userData.email,
          emailVerified: userData.emailVerified,
          name: userData.name,
          image: userData.image,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      return user as unknown as AdapterUser;
    },

    async getUser(id) {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq((schema.users as { id: unknown }).id, id));

      return (user as AdapterUser) ?? null;
    },

    async getUserByEmail(email) {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq((schema.users as { email: unknown }).email, email));

      return (user as AdapterUser) ?? null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const accounts = schema.accounts as {
        provider: unknown;
        providerAccountId: unknown;
        userId: unknown;
      };
      const users = schema.users as { id: unknown };

      const result = await db
        .select()
        .from(schema.accounts)
        .leftJoin(schema.users, eq(users.id, accounts.userId))
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId)
          )
        );

      if (result.length === 0 || !result[0].user) {
        return null;
      }

      return result[0].user as unknown as AdapterUser;
    },

    async updateUser(userData) {
      const users = schema.users as { id: unknown };

      const [user] = await db
        .update(schema.users)
        .set({
          email: userData.email,
          emailVerified: userData.emailVerified,
          name: userData.name,
          image: userData.image,
          updatedAt: helpers.now()
        })
        .where(eq(users.id, userData.id))
        .returning();

      return user as unknown as AdapterUser;
    },

    async deleteUser(id) {
      const users = schema.users as { id: unknown };

      await db.delete(schema.users).where(eq(users.id, id));
    },

    // -------------------------------------------------------------------------
    // Account Methods
    // -------------------------------------------------------------------------

    async linkAccount(accountData) {
      const id = helpers.generateId();
      const now = helpers.now();

      const [account] = await db
        .insert(schema.accounts)
        .values({
          id,
          userId: accountData.userId,
          type: accountData.type,
          provider: accountData.provider,
          providerAccountId: accountData.providerAccountId,
          login: accountData.login,
          loginVerified: accountData.loginVerified,
          passwordHash: accountData.passwordHash,
          refreshToken: accountData.refreshToken,
          accessToken: accountData.accessToken,
          expiresAt: accountData.expiresAt,
          tokenType: accountData.tokenType,
          scope: accountData.scope,
          idToken: accountData.idToken,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      return account as unknown as AdapterAccount;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const accounts = schema.accounts as {
        provider: unknown;
        providerAccountId: unknown;
      };

      await db
        .delete(schema.accounts)
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId)
          )
        );
    },

    async getAccount({ provider, providerAccountId }) {
      const accounts = schema.accounts as {
        provider: unknown;
        providerAccountId: unknown;
      };

      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId)
          )
        );

      return (account as unknown as AdapterAccount) ?? null;
    },

    async getAccountByLogin(provider, login) {
      const accounts = schema.accounts as {
        provider: unknown;
        login: unknown;
      };

      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.login, login)
          )
        );

      return (account as unknown as AdapterAccount) ?? null;
    },

    async updateAccount(accountId, data) {
      const accounts = schema.accounts as { id: unknown };

      const [account] = await db
        .update(schema.accounts)
        .set({
          ...data,
          updatedAt: helpers.now()
        })
        .where(eq(accounts.id, accountId))
        .returning();

      return (account as unknown as AdapterAccount) ?? null;
    },

    // -------------------------------------------------------------------------
    // Session Methods
    // -------------------------------------------------------------------------

    async createSession(sessionData) {
      const id = helpers.generateId();
      const now = helpers.now();

      const [session] = await db
        .insert(schema.sessions)
        .values({
          id,
          sessionToken: sessionData.sessionToken,
          userId: sessionData.userId,
          expires: sessionData.expires,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      return session as unknown as AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const sessions = schema.sessions as { sessionToken: unknown; userId: unknown };
      const users = schema.users as { id: unknown };

      const result = await db
        .select()
        .from(schema.sessions)
        .leftJoin(schema.users, eq(users.id, sessions.userId))
        .where(eq(sessions.sessionToken, sessionToken));

      if (result.length === 0 || !result[0].user || !result[0].session) {
        return null;
      }

      return {
        session: result[0].session as unknown as AdapterSession,
        user: result[0].user as unknown as AdapterUser
      };
    },

    async updateSession(sessionData) {
      const sessions = schema.sessions as { sessionToken: unknown };

      const [session] = await db
        .update(schema.sessions)
        .set({
          expires: sessionData.expires,
          updatedAt: helpers.now()
        })
        .where(eq(sessions.sessionToken, sessionData.sessionToken))
        .returning();

      return (session as unknown as AdapterSession) ?? null;
    },

    async deleteSession(sessionToken) {
      const sessions = schema.sessions as { sessionToken: unknown };

      await db.delete(schema.sessions).where(eq(sessions.sessionToken, sessionToken));
    },

    // -------------------------------------------------------------------------
    // Verification Token Methods
    // -------------------------------------------------------------------------

    async createVerificationToken(token) {
      const [verificationToken] = await db
        .insert(schema.verifications)
        .values({
          identifier: token.identifier,
          token: token.token,
          expires: token.expires
        })
        .returning();

      return verificationToken as unknown as VerificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      const tokens = schema.verifications as {
        identifier: unknown;
        token: unknown;
      };

      const [verificationToken] = await db
        .delete(schema.verifications)
        .where(and(eq(tokens.identifier, identifier), eq(tokens.token, token)))
        .returning();

      return (verificationToken as unknown as VerificationToken) ?? null;
    }
  };
}
