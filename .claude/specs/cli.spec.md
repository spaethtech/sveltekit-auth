# CLI Schema Generator Specification

## Overview

The CLI tool generates database schema files for the authentication system. It supports multiple ORMs, databases, and naming conventions.

## Command

```bash
npx sveltekit-auth init [options]
```

## Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--database`, `-d` | `postgres`, `mysql`, `sqlite` | `postgres` | Target database |
| `--orm`, `-o` | `drizzle`, `prisma` | `drizzle` | ORM to generate for |
| `--output`, `-o` | path | `src/lib/server/schemas/` | Output directory |
| `--tables`, `-t` | `snake`, `camel`, `pascal` | `snake` | Table naming convention |
| `--columns`, `-c` | `snake`, `camel` | `snake` | Column naming convention |
| `--id` | `uuid`, `cuid` | `uuid` | ID generation strategy |
| `--singular` | flag | false | Use singular table names |
| `--prefix` | string | none | Table name prefix |
| `--soft-delete` | flag | false | Add soft delete columns |
| `--dry-run` | flag | false | Preview without writing |
| `--force`, `-f` | flag | false | Overwrite existing files |

## Output Structure

The CLI generates a folder with two files:

```
src/lib/server/schemas/
├── users.ts      # User model (extendable by developers)
└── auth.ts       # Internal auth tables (accounts, sessions, verifications)
```

### users.ts

This file contains the minimal User model that developers can extend:

```typescript
// users.ts - Drizzle PostgreSQL example
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Users table - extend this with your own fields
 *
 * WARNING: Do not remove or rename these fields as they are required
 * for authentication. You may add additional fields as needed.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
});
```

### auth.ts

This file contains the internal auth tables:

```typescript
// auth.ts - Drizzle PostgreSQL example
import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id'),
  login: text('login').notNull(),
  loginVerified: timestamp('login_verified', { mode: 'date' }),
  passwordHash: text('password_hash'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
}, (table) => ({
  providerLoginIdx: uniqueIndex('accounts_provider_login_idx').on(table.provider, table.login)
}));

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
});

export const verifications = pgTable('verifications', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: timestamp('expires', { mode: 'date' }).notNull()
}, (table) => ({
  identifierTokenIdx: uniqueIndex('verifications_identifier_token_idx').on(table.identifier, table.token)
}));
```

## Naming Conventions

### Table Names

| Style | Example |
|-------|---------|
| `snake` | `user_accounts` |
| `camel` | `userAccounts` |
| `pascal` | `UserAccounts` |

### Column Names

| Style | Example |
|-------|---------|
| `snake` | `provider_account_id` |
| `camel` | `providerAccountId` |

### With Options

```bash
# Prefix all tables
npx sveltekit-auth init --prefix=auth_
# Result: auth_users, auth_accounts, auth_sessions, auth_verifications

# Singular table names
npx sveltekit-auth init --singular
# Result: user, account, session, verification

# Combined
npx sveltekit-auth init --prefix=app_ --singular --tables=pascal
# Result: App_User, App_Account, App_Session, App_Verification
```

## ID Strategies

### UUID (default)
```typescript
id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID())
```

### CUID
```typescript
import { createId } from '@paralleldrive/cuid2';
id: text('id').primaryKey().$defaultFn(() => createId())
```

## Soft Delete

When `--soft-delete` is enabled:

```typescript
export const users = pgTable('users', {
  // ... other fields
  deletedAt: timestamp('deleted_at', { mode: 'date' })
});
```

## Database-Specific Output

### PostgreSQL (Drizzle)
```typescript
import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
```

### MySQL (Drizzle)
```typescript
import { mysqlTable, varchar, datetime, int } from 'drizzle-orm/mysql-core';
```

### SQLite (Drizzle)
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
```

### Prisma
```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  // ...
}
```

## Dry Run Output

```bash
npx sveltekit-auth init --dry-run
```

Output:
```
Would create: src/lib/server/schemas/users.ts
Would create: src/lib/server/schemas/auth.ts

--- users.ts ---
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
...

--- auth.ts ---
import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
...
```

## Error Handling

- If output files exist and `--force` is not set, prompt for confirmation
- If output directory doesn't exist, create it
- Validate option values and show helpful error messages
