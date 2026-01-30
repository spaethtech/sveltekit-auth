#!/usr/bin/env node
/**
 * SvelteKit Auth CLI
 *
 * Usage:
 *   npx @sveltekit-auth/core init
 *   npx @sveltekit-auth/core init --database postgres
 *   npx @sveltekit-auth/core init --database mysql --orm drizzle
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type Database = 'postgres' | 'mysql' | 'sqlite';
type ORM = 'drizzle' | 'prisma';

interface InitOptions {
  database: Database;
  orm: ORM;
  outputDir: string;
}

const SCHEMA_TEMPLATES: Record<ORM, Record<Database, string>> = {
  drizzle: {
    postgres: 'drizzle-pg.ts',
    mysql: 'drizzle-mysql.ts',
    sqlite: 'drizzle-sqlite.ts'
  },
  prisma: {
    postgres: 'prisma.prisma',
    mysql: 'prisma.prisma',
    sqlite: 'prisma.prisma'
  }
};

const DEFAULT_OUTPUT: Record<ORM, string> = {
  drizzle: 'src/lib/server/schemas/auth.ts',
  prisma: 'prisma/schema/auth.prisma'
};

function parseArgs(args: string[]): InitOptions {
  const options: InitOptions = {
    database: 'postgres',
    orm: 'drizzle',
    outputDir: ''
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--database':
      case '-d':
        if (next && ['postgres', 'mysql', 'sqlite'].includes(next)) {
          options.database = next as Database;
          i++;
        }
        break;
      case '--orm':
      case '-o':
        if (next && ['drizzle', 'prisma'].includes(next)) {
          options.orm = next as ORM;
          i++;
        }
        break;
      case '--output':
      case '-O':
        if (next) {
          options.outputDir = next;
          i++;
        }
        break;
    }
  }

  if (!options.outputDir) {
    options.outputDir = DEFAULT_OUTPUT[options.orm];
  }

  return options;
}

function getSchemaContent(orm: ORM, database: Database): string {
  const templateFile = SCHEMA_TEMPLATES[orm][database];
  const templatePath = join(__dirname, '..', 'lib', 'adapters', 'schema', templateFile);

  // Try to read from the installed package location
  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }

  // Fallback: generate inline
  if (orm === 'drizzle') {
    return getDrizzleSchema(database);
  } else {
    return getPrismaSchema(database);
  }
}

function getDrizzleSchema(database: Database): string {
  const imports = {
    postgres: `import { pgTable, text, timestamp, integer, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';`,
    mysql: `import { mysqlTable, varchar, text, timestamp, int, primaryKey, uniqueIndex } from 'drizzle-orm/mysql-core';`,
    sqlite: `import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';`
  };

  const tableFunc = {
    postgres: 'pgTable',
    mysql: 'mysqlTable',
    sqlite: 'sqliteTable'
  };

  const idType = {
    postgres: `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`,
    mysql: `varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID())`,
    sqlite: `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`
  };

  const timestampType = {
    postgres: `timestamp('created_at', { mode: 'date' }).defaultNow().notNull()`,
    mysql: `timestamp('created_at', { mode: 'date' }).defaultNow().notNull()`,
    sqlite: `integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())`
  };

  return `/**
 * SvelteKit Auth - Database Schema
 *
 * Generated for: ${database} with Drizzle ORM
 * Modify this file as needed, then run migrations.
 */

${imports[database]}

export const users = ${tableFunc[database]}('user', {
  ${idType[database]},
  email: text('email').notNull(),
  emailVerified: ${database === 'sqlite' ? `integer('email_verified', { mode: 'timestamp' })` : `timestamp('email_verified', { mode: 'date' })`},
  name: text('name'),
  image: text('image'),
  ${timestampType[database]},
  ${timestampType[database].replace('created_at', 'updated_at')}
}, (table) => [
  uniqueIndex('user_email_idx').on(table.email)
]);

export const accounts = ${tableFunc[database]}('account', {
  ${idType[database]},
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').$type<'oauth' | 'credentials' | 'email'>().notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  ${timestampType[database]},
  ${timestampType[database].replace('created_at', 'updated_at')}
}, (table) => [
  uniqueIndex('account_provider_idx').on(table.provider, table.providerAccountId)
]);

export const sessions = ${tableFunc[database]}('session', {
  ${idType[database]},
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: ${database === 'sqlite' ? `integer('expires', { mode: 'timestamp' }).notNull()` : `timestamp('expires', { mode: 'date' }).notNull()`},
  ${timestampType[database]},
  ${timestampType[database].replace('created_at', 'updated_at')}
});

export const verificationTokens = ${tableFunc[database]}('verification_token', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: ${database === 'sqlite' ? `integer('expires', { mode: 'timestamp' }).notNull()` : `timestamp('expires', { mode: 'date' }).notNull()`}
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] })
]);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
`;
}

function getPrismaSchema(database: Database): string {
  const datasource = {
    postgres: 'postgresql',
    mysql: 'mysql',
    sqlite: 'sqlite'
  };

  return `// SvelteKit Auth - Prisma Schema
//
// Generated for: ${database}
// Copy these models to your schema.prisma file, then run:
//   npx prisma migrate dev

// Add this datasource if not already present:
// datasource db {
//   provider = "${datasource[database]}"
//   url      = env("DATABASE_URL")
// }

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  emailVerified DateTime? @map("email_verified")
  name          String?
  image         String?
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  accounts Account[]
  sessions Session[]

  @@map("user")
}

model Account {
  id                String   @id @default(uuid())
  userId            String   @map("user_id")
  type              String
  provider          String
  providerAccountId String   @map("provider_account_id")
  refreshToken      String?  @map("refresh_token") ${database !== 'sqlite' ? '@db.Text' : ''}
  accessToken       String?  @map("access_token") ${database !== 'sqlite' ? '@db.Text' : ''}
  expiresAt         Int?     @map("expires_at")
  tokenType         String?  @map("token_type")
  scope             String?
  idToken           String?  @map("id_token") ${database !== 'sqlite' ? '@db.Text' : ''}
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("account")
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_token")
}
`;
}

function init(options: InitOptions): void {
  const { database, orm, outputDir } = options;

  console.log(`\n🔐 SvelteKit Auth - Schema Setup\n`);
  console.log(`   Database: ${database}`);
  console.log(`   ORM:      ${orm}`);
  console.log(`   Output:   ${outputDir}\n`);

  // Ensure output directory exists
  const outputPath = resolve(process.cwd(), outputDir);
  const outputDirPath = dirname(outputPath);

  if (!existsSync(outputDirPath)) {
    mkdirSync(outputDirPath, { recursive: true });
    console.log(`   Created directory: ${outputDirPath}`);
  }

  // Check if file already exists
  if (existsSync(outputPath)) {
    console.log(`   ⚠️  File already exists: ${outputDir}`);
    console.log(`   Skipping to avoid overwriting your changes.\n`);
    console.log(`   To regenerate, delete the file first.\n`);
    return;
  }

  // Get and write schema content
  const content = getSchemaContent(orm, database);
  writeFileSync(outputPath, content, 'utf-8');

  console.log(`   ✅ Created: ${outputDir}\n`);

  // Next steps
  console.log(`📋 Next steps:\n`);

  if (orm === 'drizzle') {
    console.log(`   1. Review and customize the schema in ${outputDir}`);
    console.log(`   2. Update your drizzle.config.ts to include the schema`);
    console.log(`   3. Run migrations: npx drizzle-kit generate && npx drizzle-kit migrate`);
  } else {
    console.log(`   1. Copy the models from ${outputDir} to your schema.prisma`);
    console.log(`   2. Customize as needed`);
    console.log(`   3. Run migrations: npx prisma migrate dev`);
  }

  console.log(`\n   See docs: https://github.com/spaethtech/sveltekit-auth\n`);
}

function showHelp(): void {
  console.log(`
🔐 SvelteKit Auth CLI

Usage:
  npx @sveltekit-auth/core init [options]

Commands:
  init    Generate auth schema files

Options:
  -d, --database <type>   Database type: postgres, mysql, sqlite (default: postgres)
  -o, --orm <type>        ORM type: drizzle, prisma (default: drizzle)
  -O, --output <path>     Output path (default: src/lib/server/db/auth.schema.ts)
  -h, --help              Show this help message

Examples:
  npx @sveltekit-auth/core init
  npx @sveltekit-auth/core init --database postgres --orm drizzle
  npx @sveltekit-auth/core init -d mysql -o prisma
  npx @sveltekit-auth/core init --output src/db/schema.ts
`);
}

// Main
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '-h' || command === '--help') {
  showHelp();
  process.exit(0);
}

if (command === 'init') {
  const options = parseArgs(args.slice(1));
  init(options);
} else {
  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}
