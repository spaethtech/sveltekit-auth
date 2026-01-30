/**
 * Credentials authentication provider
 */

import type {
  CredentialsProviderConfig,
  CredentialInput,
  Credentials as CredentialsType,
  User
} from '../types.js';

export interface CredentialsConfig {
  /**
   * Unique identifier for the provider
   */
  id?: string;

  /**
   * Display name for the provider
   */
  name?: string;

  /**
   * Credential input fields configuration
   */
  credentials?: Record<string, CredentialInput>;

  /**
   * Authorization function to validate credentials
   */
  authorize: (
    credentials: CredentialsType,
    request: Request
  ) => User | null | Promise<User | null>;
}

/**
 * Create a credentials authentication provider
 *
 * @example
 * ```ts
 * Credentials({
 *   credentials: {
 *     email: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
 *     password: { label: 'Password', type: 'password' }
 *   },
 *   async authorize(credentials) {
 *     const user = await db.user.findUnique({
 *       where: { email: credentials.email }
 *     });
 *
 *     if (user && await verifyPassword(credentials.password, user.password)) {
 *       return { id: user.id, name: user.name, email: user.email };
 *     }
 *
 *     return null;
 *   }
 * })
 * ```
 */
export function Credentials(config: CredentialsConfig): CredentialsProviderConfig {
  return {
    id: config.id ?? 'credentials',
    name: config.name ?? 'Credentials',
    type: 'credentials',
    credentials: config.credentials ?? {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' }
    },
    authorize: config.authorize
  };
}
