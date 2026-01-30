import type { Cookies, RequestEvent } from '@sveltejs/kit';

/**
 * Represents a user in the authentication system
 */
export interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  [key: string]: unknown;
}

/**
 * Represents a session in the authentication system
 */
export interface Session {
  user: User;
  expires: Date;
  accessToken?: string;
  refreshToken?: string;
  [key: string]: unknown;
}

/**
 * Session data stored in cookies/storage
 */
export interface SessionData {
  user: User;
  expires: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Account information from an authentication provider
 */
export interface Account {
  provider: string;
  providerAccountId: string;
  type: 'oauth' | 'credentials' | 'email';
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
}

/**
 * Profile information returned from OAuth providers
 */
export interface Profile {
  id?: string;
  sub?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  [key: string]: unknown;
}

/**
 * Credentials for username/password authentication
 */
export interface Credentials {
  [key: string]: string | undefined;
}

/**
 * Configuration for cookie handling
 */
export interface CookieConfig {
  name: string;
  maxAge: number;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

/**
 * Base configuration for authentication providers
 */
export interface ProviderConfig {
  id: string;
  name: string;
  type: 'oauth' | 'credentials' | 'email';
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig extends ProviderConfig {
  type: 'oauth';
  clientId: string;
  clientSecret: string;
  authorization: string | { url: string; params?: Record<string, string> };
  token: string | { url: string; params?: Record<string, string> };
  userinfo?: string | { url: string };
  issuer?: string;
  wellKnown?: string;
  checks?: ('state' | 'pkce' | 'nonce')[];
  profile?: (profile: Profile, tokens: TokenSet) => User | Promise<User>;
}

/**
 * Credentials provider configuration
 */
export interface CredentialsProviderConfig extends ProviderConfig {
  type: 'credentials';
  credentials: Record<string, CredentialInput>;
  authorize: (
    credentials: Credentials,
    request: Request
  ) => User | null | Promise<User | null>;
}

/**
 * Input field configuration for credentials provider
 */
export interface CredentialInput {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string;
}

/**
 * Token set returned from OAuth token endpoint
 */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

/**
 * Authentication provider interface
 */
export interface AuthProvider {
  id: string;
  name: string;
  type: 'oauth' | 'credentials' | 'email';
}

/**
 * OAuth authentication provider
 */
export interface OAuthProvider extends AuthProvider {
  type: 'oauth';
  authorization: string | { url: string; params?: Record<string, string> };
  token: string | { url: string; params?: Record<string, string> };
  userinfo?: string | { url: string };
  profile: (profile: Profile, tokens: TokenSet) => User | Promise<User>;
}

/**
 * Credentials authentication provider
 */
export interface CredentialsProvider extends AuthProvider {
  type: 'credentials';
  credentials: Record<string, CredentialInput>;
  authorize: (
    credentials: Credentials,
    request: Request
  ) => User | null | Promise<User | null>;
}

/**
 * Callback functions for authentication events
 */
export interface AuthCallbacks {
  /**
   * Called when a JWT is created or updated
   */
  jwt?: (params: {
    token: Record<string, unknown>;
    user?: User;
    account?: Account;
    profile?: Profile;
    trigger?: 'signIn' | 'signUp' | 'update';
  }) => Record<string, unknown> | Promise<Record<string, unknown>>;

  /**
   * Called when a session is created
   */
  session?: (params: {
    session: Session;
    token: Record<string, unknown>;
    user?: User;
  }) => Session | Promise<Session>;

  /**
   * Called before sign in is completed
   */
  signIn?: (params: {
    user: User;
    account: Account | null;
    profile?: Profile;
  }) => boolean | string | Promise<boolean | string>;

  /**
   * Called when a redirect is needed
   */
  redirect?: (params: {
    url: string;
    baseUrl: string;
  }) => string | Promise<string>;
}

/**
 * Main authentication configuration
 */
export interface AuthConfig {
  /**
   * Authentication providers
   */
  providers: (OAuthProviderConfig | CredentialsProviderConfig)[];

  /**
   * Secret used to sign tokens and encrypt data
   */
  secret: string;

  /**
   * Session configuration
   */
  session?: {
    /**
     * Session strategy: 'jwt' or 'database'
     */
    strategy?: 'jwt' | 'database';

    /**
     * Maximum session age in seconds (default: 30 days)
     */
    maxAge?: number;

    /**
     * Update session age on activity (default: 24 hours)
     */
    updateAge?: number;
  };

  /**
   * Cookie configuration
   */
  cookies?: Partial<CookieConfig>;

  /**
   * Pages configuration
   */
  pages?: {
    signIn?: string;
    signOut?: string;
    error?: string;
    verifyRequest?: string;
    newUser?: string;
  };

  /**
   * Callback functions
   */
  callbacks?: AuthCallbacks;

  /**
   * Enable debug mode
   */
  debug?: boolean;

  /**
   * Trust the host header
   */
  trustHost?: boolean;

  /**
   * Base path for auth routes (default: '/auth')
   */
  basePath?: string;
}

/**
 * Resolved authentication configuration with defaults applied
 */
export interface ResolvedAuthConfig extends Required<Omit<AuthConfig, 'callbacks' | 'pages' | 'cookies'>> {
  callbacks: AuthCallbacks;
  pages: NonNullable<AuthConfig['pages']>;
  cookies: CookieConfig;
}

/**
 * Authentication context available in hooks and routes
 */
export interface AuthContext {
  /**
   * Get the current session
   */
  getSession: () => Promise<Session | null>;

  /**
   * Get the current user
   */
  getUser: () => Promise<User | null>;

  /**
   * Sign in with a provider
   */
  signIn: (
    provider: string,
    options?: { redirectTo?: string; redirect?: boolean }
  ) => Promise<Response | void>;

  /**
   * Sign out the current user
   */
  signOut: (options?: { redirectTo?: string; redirect?: boolean }) => Promise<Response | void>;
}

/**
 * Extended locals interface for SvelteKit
 */
export interface AuthLocals {
  auth: AuthContext;
  session: Session | null;
  user: User | null;
}

/**
 * Handle function type for middleware
 */
export type AuthHandle = (input: {
  event: RequestEvent;
  resolve: (event: RequestEvent) => Promise<Response>;
}) => Promise<Response>;

/**
 * Middleware options
 */
export interface MiddlewareOptions {
  /**
   * Routes that require authentication
   */
  protectedRoutes?: string[];

  /**
   * Routes that are always public
   */
  publicRoutes?: string[];

  /**
   * Custom authorization function
   */
  authorize?: (event: RequestEvent, session: Session | null) => boolean | Promise<boolean>;

  /**
   * Redirect URL when unauthorized
   */
  unauthorizedRedirect?: string;
}
