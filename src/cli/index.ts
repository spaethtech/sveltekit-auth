#!/usr/bin/env node
/**
 * SvelteKit Auth CLI
 *
 * Usage:
 *   npx @sveltekit-auth/core init
 *   npx @sveltekit-auth/core init --database postgres
 *   npx @sveltekit-auth/core init --tables snake --columns snake
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Database = 'postgres' | 'mysql' | 'sqlite';
type ORM = 'drizzle' | 'prisma';
type Casing = 'snake' | 'camel' | 'pascal';
type IdType = 'uuid' | 'cuid';

interface InitOptions {
  database: Database;
  orm: ORM;
  outputDir: string;
  tableCasing: Casing;
  columnCasing: Casing;
  pluralTables: boolean;
  idType: IdType;
  prefix: string;
  softDelete: boolean;
  dryRun: boolean;
  force: boolean;
}

const DEFAULT_OUTPUT: Record<ORM, string> = {
  drizzle: 'src/lib/server/schemas',
  prisma: 'prisma/schema'
};

// =============================================================================
// Naming Utilities
// =============================================================================

function toSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function pluralize(str: string): string {
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh')) {
    return str + 'es';
  }
  if (str.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(str[str.length - 2])) {
    return str.slice(0, -1) + 'ies';
  }
  return str + 's';
}

function applyCasing(str: string, casing: Casing): string {
  switch (casing) {
    case 'snake': return toSnakeCase(str);
    case 'camel': return toCamelCase(str);
    case 'pascal': return toPascalCase(str);
    default: return str;
  }
}

interface NameMapper {
  table(name: string): string;
  column(name: string): string;
}

function createNameMapper(options: InitOptions): NameMapper {
  return {
    table(name: string): string {
      let result = name;
      if (options.pluralTables) {
        result = pluralize(result);
      }
      result = applyCasing(result, options.tableCasing);
      if (options.prefix) {
        result = options.prefix + result;
      }
      return result;
    },
    column(name: string): string {
      return applyCasing(name, options.columnCasing);
    }
  };
}

// =============================================================================
// Argument Parsing
// =============================================================================

function parseArgs(args: string[]): InitOptions {
  const options: InitOptions = {
    database: 'postgres',
    orm: 'drizzle',
    outputDir: '',
    tableCasing: 'snake',
    columnCasing: 'snake',
    pluralTables: true,
    idType: 'uuid',
    prefix: '',
    softDelete: false,
    dryRun: false,
    force: false
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
        if (next && ['drizzle', 'prisma'].includes(next)) {
          options.orm = next as ORM;
          i++;
        }
        break;
      case '--output':
      case '-o':
        if (next) {
          options.outputDir = next;
          i++;
        }
        break;
      case '--tables':
      case '-t':
        if (next && ['snake', 'camel', 'pascal'].includes(next)) {
          options.tableCasing = next as Casing;
          i++;
        }
        break;
      case '--columns':
      case '-c':
        if (next && ['snake', 'camel', 'pascal'].includes(next)) {
          options.columnCasing = next as Casing;
          i++;
        }
        break;
      case '--plural':
        options.pluralTables = true;
        break;
      case '--singular':
        options.pluralTables = false;
        break;
      case '--id':
        if (next && ['uuid', 'cuid'].includes(next)) {
          options.idType = next as IdType;
          i++;
        }
        break;
      case '--prefix':
        if (next && !next.startsWith('-')) {
          options.prefix = next;
          i++;
        }
        break;
      case '--soft-delete':
        options.softDelete = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
    }
  }

  if (!options.outputDir) {
    options.outputDir = DEFAULT_OUTPUT[options.orm];
  }

  return options;
}

// =============================================================================
// Schema Generators - Drizzle
// =============================================================================

interface SchemaOptions {
  idType: IdType;
  softDelete: boolean;
}

interface DrizzleHelpers {
  imports: string;
  tableFunc: string;
  intType: string;
  idDef: string;
  cuidImport: string;
  timestampDef: (col: string) => string;
  nullableTimestamp: (col: string) => string;
  expiresTimestamp: (col: string) => string;
  textCol: (col: string, extra?: string) => string;
}

function createDrizzleHelpers(database: Database, nm: NameMapper, opts: SchemaOptions): DrizzleHelpers {
  const { idType } = opts;

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

  const intType = database === 'mysql' ? 'int' : 'integer';

  const idGenerator = idType === 'cuid' ? `createId()` : `crypto.randomUUID()`;
  const idLength = idType === 'cuid' ? 24 : 36;

  const idDef = database === 'mysql'
    ? `varchar('${nm.column('id')}', { length: ${idLength} }).primaryKey().$defaultFn(() => ${idGenerator})`
    : `text('${nm.column('id')}').primaryKey().$defaultFn(() => ${idGenerator})`;

  const cuidImport = idType === 'cuid' ? `import { createId } from '@paralleldrive/cuid2';\n` : '';

  const timestampDef = (col: string) => {
    if (database === 'sqlite') {
      return `integer('${nm.column(col)}', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())`;
    }
    return `timestamp('${nm.column(col)}', { mode: 'date' }).defaultNow().notNull()`;
  };

  const nullableTimestamp = (col: string) => {
    if (database === 'sqlite') {
      return `integer('${nm.column(col)}', { mode: 'timestamp' })`;
    }
    return `timestamp('${nm.column(col)}', { mode: 'date' })`;
  };

  const expiresTimestamp = (col: string) => {
    if (database === 'sqlite') {
      return `integer('${nm.column(col)}', { mode: 'timestamp' }).notNull()`;
    }
    return `timestamp('${nm.column(col)}', { mode: 'date' }).notNull()`;
  };

  const textCol = (col: string, extra = '') => {
    if (database === 'mysql' && ['id', 'userId', 'provider', 'tokenType'].includes(col)) {
      return `varchar('${nm.column(col)}', { length: 255 })${extra}`;
    }
    return `text('${nm.column(col)}')${extra}`;
  };

  return {
    imports: imports[database],
    tableFunc: tableFunc[database],
    intType,
    idDef,
    cuidImport,
    timestampDef,
    nullableTimestamp,
    expiresTimestamp,
    textCol
  };
}

function getDrizzleUsersSchema(database: Database, nm: NameMapper, opts: SchemaOptions): string {
  const { softDelete } = opts;
  const h = createDrizzleHelpers(database, nm, opts);

  return `/**
 * SvelteKit Auth - Users Schema
 *
 * This file contains the User model. Extend it with your app-specific fields.
 * The auth system only requires the 'id' field for linking accounts.
 *
 * The 'email' field here is optional profile/contact info, separate from
 * auth credentials which are stored in the accounts table.
 *
 * Generated for: ${database} with Drizzle ORM
 */

${h.cuidImport}${h.imports}

export const users = ${h.tableFunc}('${nm.table('user')}', {
  ${h.idDef},
  ${h.textCol('name')},
  ${h.textCol('email')},
  ${h.textCol('image')},
  ${h.timestampDef('createdAt')},
  ${h.timestampDef('updatedAt')}${softDelete ? `,
  ${h.nullableTimestamp('deletedAt')}` : ''}

  // Add your custom fields here:
  // role: text('role').$type<'user' | 'admin'>().default('user'),
  // bio: text('bio'),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
`;
}

function getDrizzleAuthSchema(database: Database, nm: NameMapper, opts: SchemaOptions): string {
  const h = createDrizzleHelpers(database, nm, opts);

  return `/**
 * SvelteKit Auth - Auth Schema
 *
 * Internal auth tables: accounts, sessions, verifications.
 * You typically don't need to modify this file.
 *
 * Generated for: ${database} with Drizzle ORM
 */

${h.cuidImport}${h.imports}
import { users } from './users.js';

export const accounts = ${h.tableFunc}('${nm.table('account')}', {
  ${h.idDef},
  ${h.textCol('userId', `.notNull().references(() => users.id, { onDelete: 'cascade' })`)},
  ${h.textCol('type', `.$type<'oauth' | 'credentials' | 'email'>().notNull()`)},
  ${h.textCol('provider', '.notNull()')},
  ${h.textCol('providerAccountId')},
  ${h.textCol('login', '.notNull()')},
  ${h.nullableTimestamp('loginVerified')},
  ${h.textCol('passwordHash')},
  ${h.textCol('refreshToken')},
  ${h.textCol('accessToken')},
  ${h.intType}('${nm.column('expiresAt')}'),
  ${h.textCol('tokenType')},
  ${h.textCol('scope')},
  ${h.textCol('idToken')},
  ${h.timestampDef('createdAt')},
  ${h.timestampDef('updatedAt')}
}, (table) => [
  uniqueIndex('${nm.table('account')}_provider_login_idx').on(table.provider, table.login)
]);

export const sessions = ${h.tableFunc}('${nm.table('session')}', {
  ${h.idDef},
  ${h.textCol('sessionToken', '.notNull().unique()')},
  ${h.textCol('userId', `.notNull().references(() => users.id, { onDelete: 'cascade' })`)},
  ${h.expiresTimestamp('expires')},
  ${h.timestampDef('createdAt')},
  ${h.timestampDef('updatedAt')}
});

export const verifications = ${h.tableFunc}('${nm.table('verification')}', {
  ${h.textCol('identifier', '.notNull()')},
  ${h.textCol('token', '.notNull().unique()')},
  ${h.expiresTimestamp('expires')}
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] })
]);

// Type exports
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

// Re-export users for convenience
export { users, type User, type NewUser } from './users.js';
`;
}

// =============================================================================
// Schema Generators - Prisma
// =============================================================================

function getPrismaUsersSchema(database: Database, nm: NameMapper, opts: SchemaOptions): string {
  const { idType, softDelete } = opts;
  const idDefault = idType === 'cuid' ? 'cuid()' : 'uuid()';

  const mapCol = (tsName: string) => {
    const dbName = nm.column(tsName);
    return dbName !== tsName ? ` @map("${dbName}")` : '';
  };

  const mapTable = (tsName: string) => {
    const dbName = nm.table(tsName);
    return `  @@map("${dbName}")`;
  };

  return `// SvelteKit Auth - Users Schema
//
// This file contains the User model. Extend it with your app-specific fields.
// The auth system only requires the 'id' field for linking accounts.
//
// The 'email' field here is optional profile/contact info, separate from
// auth credentials which are stored in the accounts table.
//
// Generated for: ${database}

model User {
  id            String    @id @default(${idDefault})${mapCol('id')}
  name          String?${mapCol('name')}
  email         String?${mapCol('email')}
  image         String?${mapCol('image')}
  createdAt     DateTime  @default(now())${mapCol('createdAt')}
  updatedAt     DateTime  @updatedAt${mapCol('updatedAt')}${softDelete ? `
  deletedAt     DateTime?${mapCol('deletedAt')}` : ''}

  // Add your custom fields here:
  // role          String    @default("user")
  // bio           String?

  accounts Account[]
  sessions Session[]

${mapTable('user')}
}
`;
}

function getPrismaAuthSchema(database: Database, nm: NameMapper, opts: SchemaOptions): string {
  const { idType } = opts;
  const idDefault = idType === 'cuid' ? 'cuid()' : 'uuid()';
  const dbText = database !== 'sqlite' ? ' @db.Text' : '';

  const mapCol = (tsName: string) => {
    const dbName = nm.column(tsName);
    return dbName !== tsName ? ` @map("${dbName}")` : '';
  };

  const mapTable = (tsName: string) => {
    const dbName = nm.table(tsName);
    return `  @@map("${dbName}")`;
  };

  return `// SvelteKit Auth - Auth Schema
//
// Internal auth tables: accounts, sessions, verifications.
// You typically don't need to modify this file.
//
// Generated for: ${database}

model Account {
  id                String    @id @default(${idDefault})${mapCol('id')}
  userId            String${mapCol('userId')}
  type              String${mapCol('type')}
  provider          String${mapCol('provider')}
  providerAccountId String?${mapCol('providerAccountId')}
  login             String${mapCol('login')}
  loginVerified     DateTime?${mapCol('loginVerified')}
  passwordHash      String?${mapCol('passwordHash')}
  refreshToken      String?${dbText}${mapCol('refreshToken')}
  accessToken       String?${dbText}${mapCol('accessToken')}
  expiresAt         Int?${mapCol('expiresAt')}
  tokenType         String?${mapCol('tokenType')}
  scope             String?${mapCol('scope')}
  idToken           String?${dbText}${mapCol('idToken')}
  createdAt         DateTime  @default(now())${mapCol('createdAt')}
  updatedAt         DateTime  @updatedAt${mapCol('updatedAt')}

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, login])
${mapTable('account')}
}

model Session {
  id           String   @id @default(${idDefault})${mapCol('id')}
  sessionToken String   @unique${mapCol('sessionToken')}
  userId       String${mapCol('userId')}
  expires      DateTime${mapCol('expires')}
  createdAt    DateTime @default(now())${mapCol('createdAt')}
  updatedAt    DateTime @updatedAt${mapCol('updatedAt')}

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

${mapTable('session')}
}

model Verification {
  identifier String${mapCol('identifier')}
  token      String   @unique${mapCol('token')}
  expires    DateTime${mapCol('expires')}

  @@unique([identifier, token])
${mapTable('verification')}
}
`;
}

// =============================================================================
// Init Command
// =============================================================================

interface SchemaFile {
  name: string;
  content: string;
}

function init(options: InitOptions): void {
  const { database, orm, outputDir, tableCasing, columnCasing, pluralTables, idType, prefix, softDelete, dryRun, force } = options;
  const nm = createNameMapper(options);
  const schemaOpts: SchemaOptions = { idType, softDelete };

  const ext = orm === 'drizzle' ? 'ts' : 'prisma';
  const files: SchemaFile[] = orm === 'drizzle'
    ? [
        { name: `users.${ext}`, content: getDrizzleUsersSchema(database, nm, schemaOpts) },
        { name: `auth.${ext}`, content: getDrizzleAuthSchema(database, nm, schemaOpts) }
      ]
    : [
        { name: `users.${ext}`, content: getPrismaUsersSchema(database, nm, schemaOpts) },
        { name: `auth.${ext}`, content: getPrismaAuthSchema(database, nm, schemaOpts) }
      ];

  console.log(`\n🔐 SvelteKit Auth - Schema Setup\n`);
  console.log(`   Database:  ${database}`);
  console.log(`   ORM:       ${orm}`);
  console.log(`   ID Type:   ${idType}`);
  console.log(`   Tables:    ${tableCasing}${pluralTables ? ' (plural)' : ''}${prefix ? ` (prefix: ${prefix})` : ''}`);
  console.log(`   Columns:   ${columnCasing}`);
  if (softDelete) {
    console.log(`   Features:  soft-delete`);
  }
  console.log(`   Output:    ${outputDir}/${dryRun ? ' (dry-run)' : ''}${force ? ' (force)' : ''}\n`);

  // Dry run - just show the content
  if (dryRun) {
    for (const file of files) {
      console.log(`   Preview of ${outputDir}/${file.name}:\n`);
      console.log('─'.repeat(60));
      console.log(file.content);
      console.log('─'.repeat(60));
      console.log('');
    }
    console.log(`   (dry-run mode - no files written)\n`);
    return;
  }

  // Ensure output directory exists
  const outputPath = resolve(process.cwd(), outputDir);

  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
    console.log(`   Created directory: ${outputDir}/`);
  }

  // Write each file
  for (const file of files) {
    const filePath = join(outputPath, file.name);
    const existed = existsSync(filePath);

    if (existed && !force) {
      console.log(`   ⚠️  Skipped ${file.name} (already exists, use --force to overwrite)`);
      continue;
    }

    writeFileSync(filePath, file.content, 'utf-8');
    console.log(`   ✅ ${existed ? 'Overwrote' : 'Created'}: ${outputDir}/${file.name}`);
  }

  // Next steps
  console.log(`\n📋 Next steps:\n`);

  if (orm === 'drizzle') {
    console.log(`   1. Add custom fields to ${outputDir}/users.ts`);
    console.log(`   2. Update your drizzle.config.ts to include the schemas`);
    console.log(`   3. Run migrations: npx drizzle-kit generate && npx drizzle-kit migrate`);
  } else {
    console.log(`   1. Add custom fields to ${outputDir}/users.prisma`);
    console.log(`   2. Import both files in your main schema.prisma`);
    console.log(`   3. Run migrations: npx prisma migrate dev`);
  }

  console.log(`\n   See docs: https://github.com/spaethtech/sveltekit-auth\n`);
}

// =============================================================================
// Help
// =============================================================================

function showHelp(): void {
  console.log(`
🔐 SvelteKit Auth CLI

Usage:
  npx @sveltekit-auth/core init [options]

Commands:
  init    Generate auth schema files

Output:
  Creates two schema files in the output directory:
    users.ts   - User model (extend with your custom fields)
    auth.ts    - Auth tables (accounts, sessions, verifications)

Options:
  -d, --database <type>   Database: postgres, mysql, sqlite (default: postgres)
      --orm <type>        ORM: drizzle, prisma (default: drizzle)
  -o, --output <dir>      Output directory (default: src/lib/server/schemas)

  -t, --tables <casing>   Table name casing: snake, camel, pascal (default: snake)
  -c, --columns <casing>  Column name casing: snake, camel, pascal (default: snake)
      --id <type>         ID generation: uuid, cuid (default: uuid)
      --singular          Use singular table names (user, account, etc.)
      --prefix <string>   Add prefix to table names (e.g., auth_)
      --soft-delete       Add deletedAt column for soft deletes

      --dry-run           Preview schema without writing to disk
  -f, --force             Overwrite existing schema files
  -h, --help              Show this help message

Examples:
  # Default: PostgreSQL + Drizzle with snake_case, plural tables, UUID
  npx @sveltekit-auth/core init

  # Use CUID for IDs
  npx @sveltekit-auth/core init --id cuid

  # MySQL with camelCase columns
  npx @sveltekit-auth/core init -d mysql --columns camel

  # Prisma with snake_case tables and columns
  npx @sveltekit-auth/core init --orm prisma -t snake -c snake

  # Add table prefix for shared databases
  npx @sveltekit-auth/core init --prefix auth_

  # Preview what will be generated
  npx @sveltekit-auth/core init --dry-run

  # Enable soft deletes
  npx @sveltekit-auth/core init --soft-delete
`);
}

// =============================================================================
// Main
// =============================================================================

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
