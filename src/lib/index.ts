/**
 * @sveltekit-auth/core
 *
 * Authentication library for SvelteKit 5 with runes mode support
 */

// Main middleware and configuration
export { createAuth, createProtectedRoutesMiddleware, sequence, resolveConfig } from './middleware/index.js';

// Types
export type {
  // Core types
  User,
  Session,
  SessionData,
  Account,
  Profile,
  Credentials,
  TokenSet,

  // Provider types
  AuthProvider,
  OAuthProvider,
  CredentialsProvider,
  ProviderConfig,
  OAuthProviderConfig,
  CredentialsProviderConfig,
  CredentialInput,

  // Configuration types
  AuthConfig,
  ResolvedAuthConfig,
  CookieConfig,
  AuthCallbacks,

  // Context types
  AuthContext,
  AuthLocals,
  AuthHandle,
  MiddlewareOptions
} from './types.js';
