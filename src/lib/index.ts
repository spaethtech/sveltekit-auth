/**
 * @sveltekit-auth/core
 *
 * Authentication library for SvelteKit 5 with runes mode support
 */

// Main middleware and configuration
export { createAuth, createProtectedRoutesMiddleware, sequence, resolveConfig } from './middleware/index.js';

// Authentication flows
export {
  // Email verification
  createVerification,
  verifyToken,
  isLoginVerified,
  resendVerification,
  type VerificationConfig,
  type CreateVerificationResult,

  // Password reset
  createPasswordReset,
  verifyResetToken,
  resetPassword,
  validatePassword,
  type PasswordResetConfig,
  type CreateResetResult
} from './flows/index.js';

// Password utilities
export {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateToken,
  type HashOptions
} from './utils/password.js';

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
  LoginType,

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
  MiddlewareOptions,

  // Adapter types
  Adapter,
  PartialAdapter,
  AdapterConfig,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from './types.js';
