# Database Adapters Specification

## Overview

Adapters provide the persistence layer for authentication data. They abstract database operations so the core library works with any database.

## Supported Adapters

1. **Memory Adapter** - For development and testing
2. **Drizzle Adapter** - For Drizzle ORM (PostgreSQL, MySQL, SQLite)
3. **Prisma Adapter** - For Prisma ORM

## Database Schema

### Users Table
```typescript
interface AdapterUser {
  id: string;                    // Primary key (UUID or CUID)
  email: string;                 // User email (can be populated from OAuth)
  emailVerified: Date | null;    // Email verification timestamp
  name?: string | null;          // Display name
  image?: string | null;         // Avatar URL
  createdAt: Date;
  updatedAt: Date;
}
```

**Design Note:** The User model is intentionally minimal. Only `id` is truly required for auth pairing. Email can be optional/populated from OAuth providers. Users can extend this model with additional fields.

### Accounts Table
```typescript
interface AdapterAccount {
  id: string;                    // Primary key
  userId: string;                // Foreign key to users
  provider: string;              // Provider ID (e.g., 'github', 'credentials')
  providerAccountId?: string;    // Provider's user ID (for OAuth)
  login: string;                 // Generic login identifier (email, username, etc.)
  loginVerified?: Date | null;   // Login verification timestamp
  passwordHash?: string | null;  // Password hash (for credentials)
  type: 'oauth' | 'credentials' | 'email';
  accessToken?: string;          // OAuth access token
  refreshToken?: string;         // OAuth refresh token
  expiresAt?: number;            // Token expiration (Unix timestamp)
  tokenType?: string;            // Token type (usually 'Bearer')
  scope?: string;                // OAuth scopes
  idToken?: string;              // OIDC ID token
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Design Decision - `login` Field:**
The `login` field is a generic identifier that can hold:
- Email address (for email-based auth)
- Username (for username-based auth)
- Phone number (for SMS auth)
- Any other unique identifier

This allows a single schema to support multiple authentication types without separate columns.

**Unique Constraint:** `(provider, login)` - One login per provider

### Sessions Table
```typescript
interface AdapterSession {
  id: string;
  sessionToken: string;          // Unique session token
  userId: string;                // Foreign key to users
  expires: Date;                 // Session expiration
  createdAt: Date;
  updatedAt: Date;
}
```

### Verifications Table
```typescript
interface VerificationToken {
  identifier: string;            // Email or login being verified
  token: string;                 // Verification token (hashed)
  expires: Date;                 // Token expiration
}
```

**Unique Constraint:** `(identifier, token)`

## Adapter Interface

```typescript
interface Adapter {
  // User Methods
  createUser(user: Omit<AdapterUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdapterUser>;
  getUser(id: string): Promise<AdapterUser | null>;
  getUserByEmail(email: string): Promise<AdapterUser | null>;
  getUserByAccount(params: { provider: string; providerAccountId: string }): Promise<AdapterUser | null>;
  updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>): Promise<AdapterUser>;
  deleteUser(id: string): Promise<void>;

  // Account Methods
  linkAccount(account: Omit<AdapterAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdapterAccount>;
  unlinkAccount(params: { provider: string; providerAccountId: string }): Promise<void>;
  getAccount(params: { provider: string; providerAccountId: string }): Promise<AdapterAccount | null>;
  getAccountByLogin?(provider: string, login: string): Promise<AdapterAccount | null>;
  updateAccount?(accountId: string, data: Partial<AdapterAccount>): Promise<AdapterAccount | null>;

  // Session Methods
  createSession(session: Omit<AdapterSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdapterSession>;
  getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null>;
  updateSession(session: Partial<AdapterSession> & { sessionToken: string }): Promise<AdapterSession | null>;
  deleteSession(sessionToken: string): Promise<void>;

  // Verification Token Methods
  createVerificationToken(token: VerificationToken): Promise<VerificationToken>;
  useVerificationToken(params: { identifier: string; token: string }): Promise<VerificationToken | null>;
}
```

## Memory Adapter

For development and testing only. Data is lost on server restart.

```typescript
import { createMemoryAdapter, MemoryAdapter } from '@sveltekit-auth/core/adapters';

// Factory function
const adapter = createMemoryAdapter();

// Or class-based
const adapter = new MemoryAdapter();
```

**Internal Storage:**
- Uses `Map` objects for each entity type
- Secondary indexes for efficient lookups:
  - `accounts` - by `(provider, providerAccountId)`
  - `accountsByLogin` - by `(provider, login)`
  - `accountsById` - by account ID

## Drizzle Adapter

For Drizzle ORM with PostgreSQL, MySQL, or SQLite.

```typescript
import { createDrizzleAdapter } from '@sveltekit-auth/core/adapters';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/schemas';

const adapter = createDrizzleAdapter(db, schema);
```

**Requirements:**
- Schema must export: `users`, `accounts`, `sessions`, `verifications`
- Tables must have the required columns

**Drizzle Client Interface:**
```typescript
interface DrizzleClient {
  select(): SelectQueryBuilder;
  insert(table: Table): InsertQueryBuilder;
  update(table: Table): UpdateQueryBuilder;
  delete(table: Table): DeleteQueryBuilder;
}
```

## Prisma Adapter

For Prisma ORM.

```typescript
import { createPrismaAdapter } from '@sveltekit-auth/core/adapters';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const adapter = createPrismaAdapter(prisma);
```

**Required Prisma Models:**
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String   @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String?
  login             String
  loginVerified     DateTime?
  passwordHash      String?
  accessToken       String?  @db.Text
  refreshToken      String?  @db.Text
  expiresAt         Int?
  tokenType         String?
  scope             String?
  idToken           String?  @db.Text
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, login])
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

## Error Handling

Adapters throw `AdapterError` for known error conditions:

```typescript
class AdapterError extends Error {
  code: string;
}

const AdapterErrorCodes = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_ALREADY_LINKED: 'ACCOUNT_ALREADY_LINKED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED'
};
```
