/**
 * Credentials authentication provider
 */

import type {
  CredentialsProviderConfig,
  CredentialInput,
  Credentials as CredentialsType,
  LoginType,
  User
} from '../types.js';

export type { LoginType };

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
   * What type of login identifier to accept
   * - 'email': Only accept valid email addresses
   * - 'username': Only accept usernames (alphanumeric, 3-32 chars)
   * - 'either': Accept both email and username formats
   * @default 'email'
   */
  loginType?: LoginType;

  /**
   * Credential input fields configuration
   * If not provided, defaults based on loginType
   */
  credentials?: Record<string, CredentialInput>;

  /**
   * Authorization function to validate credentials
   * @param credentials - The login and password from the form
   * @param request - The original request
   * @returns User object if valid, null if invalid
   */
  authorize: (
    credentials: CredentialsType,
    request: Request
  ) => User | null | Promise<User | null>;
}

// Validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;

/**
 * Validate login based on loginType
 */
export function validateLogin(login: string, loginType: LoginType): { valid: boolean; error?: string } {
  if (!login || typeof login !== 'string') {
    return { valid: false, error: 'Login is required' };
  }

  const trimmed = login.trim();

  switch (loginType) {
    case 'email':
      if (!EMAIL_REGEX.test(trimmed)) {
        return { valid: false, error: 'Invalid email address' };
      }
      break;
    case 'username':
      if (!USERNAME_REGEX.test(trimmed)) {
        return { valid: false, error: 'Username must be 3-32 characters (letters, numbers, _ or -)' };
      }
      break;
    case 'either':
      if (!EMAIL_REGEX.test(trimmed) && !USERNAME_REGEX.test(trimmed)) {
        return { valid: false, error: 'Invalid email or username' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Get default credentials config based on loginType
 */
function getDefaultCredentials(loginType: LoginType): Record<string, CredentialInput> {
  switch (loginType) {
    case 'email':
      return {
        login: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' }
      };
    case 'username':
      return {
        login: { label: 'Username', type: 'text', placeholder: 'johndoe' },
        password: { label: 'Password', type: 'password' }
      };
    case 'either':
      return {
        login: { label: 'Email or Username', type: 'text', placeholder: 'user@example.com or johndoe' },
        password: { label: 'Password', type: 'password' }
      };
  }
}

/**
 * Create a credentials authentication provider
 *
 * @example
 * ```ts
 * // Email-based login (default)
 * Credentials({
 *   async authorize({ login, password }) {
 *     const account = await db.account.findFirst({
 *       where: { provider: 'credentials', login }
 *     });
 *
 *     if (account && await verifyPassword(password, account.passwordHash)) {
 *       return { id: account.userId };
 *     }
 *
 *     return null;
 *   }
 * })
 *
 * // Username-based login
 * Credentials({
 *   loginType: 'username',
 *   async authorize({ login, password }) {
 *     // login is a username
 *   }
 * })
 *
 * // Accept either email or username
 * Credentials({
 *   loginType: 'either',
 *   async authorize({ login, password }) {
 *     // login could be email or username
 *     const isEmail = login.includes('@');
 *   }
 * })
 * ```
 */
export function Credentials(config: CredentialsConfig): CredentialsProviderConfig {
  const loginType = config.loginType ?? 'email';

  return {
    id: config.id ?? 'credentials',
    name: config.name ?? 'Credentials',
    type: 'credentials',
    loginType,
    credentials: config.credentials ?? getDefaultCredentials(loginType),
    authorize: config.authorize
  };
}
