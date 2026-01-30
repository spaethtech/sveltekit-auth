/**
 * Database adapters for sveltekit-auth
 *
 * Adapters allow you to persist users, accounts, sessions, and
 * verification tokens to your database of choice.
 */

export { MemoryAdapter, createMemoryAdapter } from './memory.js';
export { createPrismaAdapter, type PrismaClient } from './prisma.js';
export { createDrizzleAdapter, type DrizzleAdapterConfig } from './drizzle.js';
export {
  isAdapterError,
  AdapterError,
  createAdapterHelpers,
  type AdapterHelpers
} from './utils.js';

// Re-export adapter types
export type {
  Adapter,
  PartialAdapter,
  AdapterConfig,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from '../types.js';
