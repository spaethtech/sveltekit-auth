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
import { dirname, resolve } from 'node:path';

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
  force: boolean;
}

const DEFAULT_OUTPUT: Record<ORM, string> = {
  drizzle: 'src/lib/server/schemas/auth.ts',
  prisma: 'prisma/schema/auth.prisma'
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
      return applyCasing(result, options.tableCasing);
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
// Schema Generators
// =============================================================================

function getDrizzleSchema(database: Database, nm: NameMapper, idType: IdType): string {
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

  // ID generation based on idType
  const idGenerator = idType === 'cuid'
    ? `createId()`  // from @paralleldrive/cuid2
    : `crypto.randomUUID()`;

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

  return `/**
 * SvelteKit Auth - Database Schema
 *
 * Generated for: ${database} with Drizzle ORM
 * ID type: ${idType}
 * Table casing: ${nm.table('user')} (from 'user')
 * Column casing: ${nm.column('userId')} (from 'userId')
 *
 * Modify this file as needed, then run migrations.
 */

${cuidImport}${imports[database]}

export const users = ${tableFunc[database]}('${nm.table('user')}', {
  ${idDef},
  ${textCol('email', '.notNull()')},
  ${nullableTimestamp('emailVerified')},
  ${textCol('name')},
  ${textCol('image')},
  ${timestampDef('createdAt')},
  ${timestampDef('updatedAt')}
}, (table) => [
  uniqueIndex('${nm.table('user')}_email_idx').on(table.email)
]);

export const accounts = ${tableFunc[database]}('${nm.table('account')}', {
  ${idDef},
  ${textCol('userId', `.notNull().references(() => users.id, { onDelete: 'cascade' })`)},
  ${textCol('type', `.$type<'oauth' | 'credentials' | 'email'>().notNull()`)},
  ${textCol('provider', '.notNull()')},
  ${textCol('providerAccountId', '.notNull()')},
  ${textCol('refreshToken')},
  ${textCol('accessToken')},
  ${intType}('${nm.column('expiresAt')}'),
  ${textCol('tokenType')},
  ${textCol('scope')},
  ${textCol('idToken')},
  ${timestampDef('createdAt')},
  ${timestampDef('updatedAt')}
}, (table) => [
  uniqueIndex('${nm.table('account')}_provider_idx').on(table.provider, table.providerAccountId)
]);

export const sessions = ${tableFunc[database]}('${nm.table('session')}', {
  ${idDef},
  ${textCol('sessionToken', '.notNull().unique()')},
  ${textCol('userId', `.notNull().references(() => users.id, { onDelete: 'cascade' })`)},
  ${expiresTimestamp('expires')},
  ${timestampDef('createdAt')},
  ${timestampDef('updatedAt')}
});

export const verifications = ${tableFunc[database]}('${nm.table('verification')}', {
  ${textCol('identifier', '.notNull()')},
  ${textCol('token', '.notNull().unique()')},
  ${expiresTimestamp('expires')}
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
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
`;
}

function getPrismaSchema(database: Database, nm: NameMapper, idType: IdType): string {
  const datasource = {
    postgres: 'postgresql',
    mysql: 'mysql',
    sqlite: 'sqlite'
  };

  const dbText = database !== 'sqlite' ? ' @db.Text' : '';

  // For Prisma, model names are always PascalCase in code
  // We use @@map() to set the actual DB table name
  // And @map() for column names

  const mapCol = (tsName: string) => {
    const dbName = nm.column(tsName);
    return dbName !== tsName ? ` @map("${dbName}")` : '';
  };

  const mapTable = (tsName: string) => {
    const dbName = nm.table(tsName);
    return `  @@map("${dbName}")`;
  };

  const idDefault = idType === 'cuid' ? 'cuid()' : 'uuid()';

  return `// SvelteKit Auth - Prisma Schema
//
// Generated for: ${database}
// ID type: ${idType}
// Table casing: ${nm.table('user')} (from 'user')
// Column casing: ${nm.column('userId')} (from 'userId')
//
// Copy these models to your schema.prisma file, then run:
//   npx prisma migrate dev

// Add this datasource if not already present:
// datasource db {
//   provider = "${datasource[database]}"
//   url      = env("DATABASE_URL")
// }

model User {
  id            String    @id @default(${idDefault})${mapCol('id')}
  email         String    @unique${mapCol('email')}
  emailVerified DateTime?${mapCol('emailVerified')}
  name          String?${mapCol('name')}
  image         String?${mapCol('image')}
  createdAt     DateTime  @default(now())${mapCol('createdAt')}
  updatedAt     DateTime  @updatedAt${mapCol('updatedAt')}

  accounts Account[]
  sessions Session[]

${mapTable('user')}
}

model Account {
  id                String   @id @default(${idDefault})${mapCol('id')}
  userId            String${mapCol('userId')}
  type              String${mapCol('type')}
  provider          String${mapCol('provider')}
  providerAccountId String${mapCol('providerAccountId')}
  refreshToken      String?${dbText}${mapCol('refreshToken')}
  accessToken       String?${dbText}${mapCol('accessToken')}
  expiresAt         Int?${mapCol('expiresAt')}
  tokenType         String?${mapCol('tokenType')}
  scope             String?${mapCol('scope')}
  idToken           String?${dbText}${mapCol('idToken')}
  createdAt         DateTime @default(now())${mapCol('createdAt')}
  updatedAt         DateTime @updatedAt${mapCol('updatedAt')}

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
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

function init(options: InitOptions): void {
  const { database, orm, outputDir, tableCasing, columnCasing, pluralTables, idType, force } = options;
  const nm = createNameMapper(options);

  console.log(`\n🔐 SvelteKit Auth - Schema Setup\n`);
  console.log(`   Database:  ${database}`);
  console.log(`   ORM:       ${orm}`);
  console.log(`   ID Type:   ${idType}`);
  console.log(`   Tables:    ${tableCasing}${pluralTables ? ' (plural)' : ''}`);
  console.log(`   Columns:   ${columnCasing}`);
  console.log(`   Output:    ${outputDir}${force ? ' (force)' : ''}\n`);

  // Ensure output directory exists
  const outputPath = resolve(process.cwd(), outputDir);
  const outputDirPath = dirname(outputPath);

  if (!existsSync(outputDirPath)) {
    mkdirSync(outputDirPath, { recursive: true });
    console.log(`   Created directory: ${outputDirPath}`);
  }

  // Check if file already exists
  if (existsSync(outputPath) && !options.force) {
    console.log(`   ⚠️  File already exists: ${outputDir}`);
    console.log(`   Skipping to avoid overwriting your changes.\n`);
    console.log(`   Use --force to overwrite.\n`);
    return;
  }

  // Generate and write schema content
  const content = orm === 'drizzle'
    ? getDrizzleSchema(database, nm, idType)
    : getPrismaSchema(database, nm, idType);

  const existed = existsSync(outputPath);
  writeFileSync(outputPath, content, 'utf-8');

  console.log(`   ✅ ${existed ? 'Overwrote' : 'Created'}: ${outputDir}\n`);

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

Options:
  -d, --database <type>   Database: postgres, mysql, sqlite (default: postgres)
      --orm <type>        ORM: drizzle, prisma (default: drizzle)
  -o, --output <path>     Output path (default: src/lib/server/schemas/auth.ts)

  -t, --tables <casing>   Table name casing: snake, camel, pascal (default: snake)
  -c, --columns <casing>  Column name casing: snake, camel, pascal (default: snake)
      --id <type>         ID generation: uuid, cuid (default: uuid)
      --singular          Use singular table names (user, account, etc.)
  -f, --force             Overwrite existing schema file

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

  # Singular table names (user, account, session, verification)
  npx @sveltekit-auth/core init --singular

  # Everything camelCase with CUID
  npx @sveltekit-auth/core init --tables camel --columns camel --id cuid
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
