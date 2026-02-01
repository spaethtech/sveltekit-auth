# Architecture Specification

## Overview

SvelteKit Auth is a modular authentication library built for SvelteKit 5 with first-class support for runes mode. It follows a middleware-based architecture that integrates with SvelteKit's hooks system.

## Core Components

### 1. Middleware Layer (`src/lib/middleware/`)

The middleware provides the main integration point with SvelteKit.

```typescript
// Entry point: createAuth()
export function createAuth(config: AuthConfig): Handle {
  // 1. Resolve configuration with defaults
  // 2. Return handle function for hooks.server.ts
}
```

**Responsibilities:**
- Parse and validate incoming requests
- Route to appropriate auth handlers (signin, signout, callback, session)
- Manage session cookies
- Populate `event.locals.auth` for route access

**Route Handlers:**
- `GET /auth/signin` - Render signin page or redirect to OAuth
- `POST /auth/signin/:provider` - Handle credentials signin
- `GET /auth/callback/:provider` - OAuth callback handler
- `POST /auth/signout` - Sign out and clear session
- `GET /auth/session` - Return current session as JSON

### 2. Provider System (`src/lib/providers/`)

Providers handle the authentication logic for different identity sources.

**Provider Types:**
```typescript
type ProviderType = 'oauth' | 'credentials' | 'email';
```

**OAuth Provider Interface:**
```typescript
interface OAuthProviderConfig<P extends Profile = Profile> {
  id: string;
  name: string;
  type: 'oauth';
  clientId: string;
  clientSecret: string;
  authorization: string | { url: string; params?: Record<string, string> };
  token: string | { url: string; params?: Record<string, string> };
  userinfo?: string | { url: string };
  profile?: (profile: P, tokens: TokenSet) => User | Promise<User>;
}
```

**Credentials Provider Interface:**
```typescript
interface CredentialsProviderConfig {
  id: string;
  name: string;
  type: 'credentials';
  loginType?: 'email' | 'username' | 'either';
  credentials: Record<string, CredentialInput>;
  authorize: (credentials: Credentials, request: Request) => Promise<User | null>;
}
```

### 3. Adapter System (`src/lib/adapters/`)

Adapters provide database persistence for users, accounts, sessions, and tokens.

**Adapter Interface:**
```typescript
interface Adapter {
  // User methods
  createUser(user: Omit<AdapterUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdapterUser>;
  getUser(id: string): Promise<AdapterUser | null>;
  getUserByEmail(email: string): Promise<AdapterUser | null>;
  getUserByAccount(params: { provider: string; providerAccountId: string }): Promise<AdapterUser | null>;
  updateUser(user: Partial<AdapterUser> & { id: string }): Promise<AdapterUser>;
  deleteUser(id: string): Promise<void>;

  // Account methods
  linkAccount(account: Omit<AdapterAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdapterAccount>;
  unlinkAccount(params: { provider: string; providerAccountId: string }): Promise<void>;
  getAccount(params: { provider: string; providerAccountId: string }): Promise<AdapterAccount | null>;
  getAccountByLogin?(provider: string, login: string): Promise<AdapterAccount | null>;
  updateAccount?(accountId: string, data: Partial<AdapterAccount>): Promise<AdapterAccount | null>;

  // Session methods
  createSession(session: Omit<AdapterSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdapterSession>;
  getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null>;
  updateSession(session: Partial<AdapterSession> & { sessionToken: string }): Promise<AdapterSession | null>;
  deleteSession(sessionToken: string): Promise<void>;

  // Verification token methods
  createVerificationToken(token: VerificationToken): Promise<VerificationToken>;
  useVerificationToken(params: { identifier: string; token: string }): Promise<VerificationToken | null>;
}
```

### 4. Session Management (`src/lib/utils/session.ts`)

Sessions are JWT-based with AES-GCM encryption.

**Session Structure:**
```typescript
interface Session {
  user: User;
  expires: string;
  accessToken?: string;
  refreshToken?: string;
}
```

**Session Flow:**
1. Create session object with user data and expiration
2. Encode session as JWT
3. Encrypt JWT using AES-GCM with derived key
4. Store in HTTP-only cookie

### 5. Client State (`src/lib/client/`)

Client-side authentication state uses SvelteKit 5 runes.

```typescript
function createAuthClient(options?: AuthClientOptions) {
  let session = $state<Session | null>(options?.session ?? null);

  return {
    get session() { return session; },
    get user() { return session?.user ?? null; },
    get isAuthenticated() { return !!session; },
    signIn,
    signOut,
    refresh
  };
}
```

## Data Flow

### OAuth Authentication Flow
```
1. User clicks "Sign in with GitHub"
2. Redirect to /auth/signin/github
3. Generate state/PKCE, store in cookie
4. Redirect to GitHub authorization URL
5. User authorizes, GitHub redirects to /auth/callback/github
6. Exchange code for tokens
7. Fetch user profile from GitHub
8. Create/update user and account in database
9. Create session, set cookie
10. Redirect to callback URL
```

### Credentials Authentication Flow
```
1. User submits login form to /auth/signin/credentials
2. Validate credentials format based on loginType
3. Call authorize() callback with credentials
4. If user returned, create session
5. Set session cookie
6. Redirect to callback URL
```

## Security Considerations

1. **Session Security**
   - HTTP-only, Secure, SameSite cookies
   - AES-GCM encryption for session data
   - Configurable expiration

2. **CSRF Protection**
   - State parameter for OAuth flows
   - PKCE for authorization code flow

3. **Password Security**
   - PBKDF2 with 100,000 iterations (default)
   - Optional Argon2 support
   - Constant-time comparison

4. **Rate Limiting** (planned)
   - Per-IP rate limiting for auth endpoints
   - Configurable thresholds
