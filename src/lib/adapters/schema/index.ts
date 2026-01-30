/**
 * Database schema exports
 *
 * These schemas are provided as starting points. Copy them to your project
 * and modify as needed before running migrations.
 *
 * @example PostgreSQL with Drizzle
 * ```ts
 * // Copy the schema to your project
 * import { users, accounts, sessions, verificationTokens } from './schema';
 * // Or re-export directly (if no customization needed)
 * export * from '@sveltekit-auth/core/adapters/schema/drizzle-pg';
 * ```
 *
 * @example Prisma
 * ```
 * // Copy prisma.prisma contents to your schema.prisma file
 * // Then run: npx prisma migrate dev
 * ```
 */

// Re-export PostgreSQL schema as default
export * from './drizzle-pg.js';
