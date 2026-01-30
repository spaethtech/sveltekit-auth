/**
 * Prisma adapter for sveltekit-auth
 *
 * Requires the following Prisma schema:
 *
 * ```prisma
 * model User {
 *   id            String    @id @default(cuid())
 *   email         String    @unique
 *   emailVerified DateTime?
 *   name          String?
 *   image         String?
 *   createdAt     DateTime  @default(now())
 *   updatedAt     DateTime  @updatedAt
 *   accounts      Account[]
 *   sessions      Session[]
 * }
 *
 * model Account {
 *   id                String   @id @default(cuid())
 *   userId            String
 *   type              String
 *   provider          String
 *   providerAccountId String
 *   refreshToken      String?  @db.Text
 *   accessToken       String?  @db.Text
 *   expiresAt         Int?
 *   tokenType         String?
 *   scope             String?
 *   idToken           String?  @db.Text
 *   createdAt         DateTime @default(now())
 *   updatedAt         DateTime @updatedAt
 *   user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
 *
 *   @@unique([provider, providerAccountId])
 * }
 *
 * model Session {
 *   id           String   @id @default(cuid())
 *   sessionToken String   @unique
 *   userId       String
 *   expires      DateTime
 *   createdAt    DateTime @default(now())
 *   updatedAt    DateTime @updatedAt
 *   user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
 * }
 *
 * model VerificationToken {
 *   identifier String
 *   token      String   @unique
 *   expires    DateTime
 *
 *   @@unique([identifier, token])
 * }
 * ```
 */

import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from '../types.js';

/**
 * Minimal Prisma client interface
 * This allows the adapter to work without importing Prisma directly
 */
export interface PrismaClient {
  user: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findUnique: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    findFirst: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    delete: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
  account: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findUnique: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    findFirst: (args: { where: Record<string, unknown>; include?: Record<string, boolean> }) => Promise<Record<string, unknown> | null>;
    delete: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
  };
  session: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findUnique: (args: { where: Record<string, unknown>; include?: Record<string, boolean> }) => Promise<Record<string, unknown> | null>;
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    delete: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
  };
  verificationToken: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findUnique: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    delete: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
}

/**
 * Create a Prisma adapter instance
 *
 * @example
 * ```ts
 * import { PrismaClient } from '@prisma/client';
 * import { createPrismaAdapter } from '@sveltekit-auth/core/adapters';
 *
 * const prisma = new PrismaClient();
 * const adapter = createPrismaAdapter(prisma);
 *
 * const auth = createAuth({
 *   adapter,
 *   providers: [...],
 *   secret: '...'
 * });
 * ```
 */
export function createPrismaAdapter(prisma: PrismaClient): Adapter {
  return {
    // -------------------------------------------------------------------------
    // User Methods
    // -------------------------------------------------------------------------

    async createUser(userData) {
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          emailVerified: userData.emailVerified,
          name: userData.name,
          image: userData.image
        }
      });

      return user as unknown as AdapterUser;
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({
        where: { id }
      });

      return user as AdapterUser | null;
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({
        where: { email }
      });

      return user as AdapterUser | null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await prisma.account.findFirst({
        where: { provider, providerAccountId },
        include: { user: true }
      });

      if (!account?.user) {
        return null;
      }

      return account.user as unknown as AdapterUser;
    },

    async updateUser(userData) {
      const user = await prisma.user.update({
        where: { id: userData.id },
        data: {
          email: userData.email,
          emailVerified: userData.emailVerified,
          name: userData.name,
          image: userData.image
        }
      });

      return user as unknown as AdapterUser;
    },

    async deleteUser(id) {
      // Cascade delete handles accounts and sessions
      await prisma.user.delete({
        where: { id }
      });
    },

    // -------------------------------------------------------------------------
    // Account Methods
    // -------------------------------------------------------------------------

    async linkAccount(accountData) {
      const account = await prisma.account.create({
        data: {
          userId: accountData.userId,
          type: accountData.type,
          provider: accountData.provider,
          providerAccountId: accountData.providerAccountId,
          refreshToken: accountData.refreshToken,
          accessToken: accountData.accessToken,
          expiresAt: accountData.expiresAt,
          tokenType: accountData.tokenType,
          scope: accountData.scope,
          idToken: accountData.idToken
        }
      });

      return account as unknown as AdapterAccount;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await prisma.account.delete({
        where: {
          provider_providerAccountId: { provider, providerAccountId }
        } as Record<string, unknown>
      });
    },

    async getAccount({ provider, providerAccountId }) {
      const account = await prisma.account.findFirst({
        where: { provider, providerAccountId }
      });

      return account as AdapterAccount | null;
    },

    // -------------------------------------------------------------------------
    // Session Methods
    // -------------------------------------------------------------------------

    async createSession(sessionData) {
      const session = await prisma.session.create({
        data: {
          userId: sessionData.userId,
          sessionToken: sessionData.sessionToken,
          expires: sessionData.expires
        }
      });

      return session as unknown as AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true }
      });

      if (!session?.user) {
        return null;
      }

      return {
        session: session as unknown as AdapterSession,
        user: session.user as unknown as AdapterUser
      };
    },

    async updateSession(sessionData) {
      const session = await prisma.session.update({
        where: { sessionToken: sessionData.sessionToken },
        data: {
          expires: sessionData.expires
        }
      });

      return session as unknown as AdapterSession;
    },

    async deleteSession(sessionToken) {
      await prisma.session.delete({
        where: { sessionToken }
      });
    },

    // -------------------------------------------------------------------------
    // Verification Token Methods
    // -------------------------------------------------------------------------

    async createVerificationToken(token) {
      const verificationToken = await prisma.verificationToken.create({
        data: {
          identifier: token.identifier,
          token: token.token,
          expires: token.expires
        }
      });

      return verificationToken as unknown as VerificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const verificationToken = await prisma.verificationToken.delete({
          where: {
            identifier_token: { identifier, token }
          } as Record<string, unknown>
        });

        return verificationToken as unknown as VerificationToken;
      } catch {
        // Token not found
        return null;
      }
    }
  };
}
