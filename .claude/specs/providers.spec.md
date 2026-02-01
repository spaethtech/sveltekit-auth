# Authentication Providers Specification

## Overview

Providers handle the authentication logic for different identity sources. Each provider implements a specific authentication strategy (OAuth, credentials, magic link, etc.).

## Provider Types

### 1. OAuth Providers

OAuth providers handle OAuth 2.0 / OpenID Connect authentication flows.

**Current Implementations:**
- GitHub
- Google
- Discord

**Planned Implementations:**
- Apple
- Microsoft
- Twitter/X
- Facebook
- LinkedIn

**Configuration:**
```typescript
interface OAuthProviderConfig<P extends Profile = Profile> {
  id: string;                    // Unique provider identifier
  name: string;                  // Display name
  type: 'oauth';
  clientId: string;              // OAuth client ID
  clientSecret: string;          // OAuth client secret
  authorization: string | {      // Authorization endpoint
    url: string;
    params?: Record<string, string>;
  };
  token: string | {              // Token endpoint
    url: string;
    params?: Record<string, string>;
  };
  userinfo?: string | {          // Userinfo endpoint
    url: string;
  };
  issuer?: string;               // OIDC issuer URL
  wellKnown?: string;            // OIDC discovery URL
  checks?: ('state' | 'pkce' | 'nonce')[];  // Security checks
  profile?: (profile: P, tokens: TokenSet) => User | Promise<User>;
}
```

**Example - GitHub:**
```typescript
GitHub({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  scope: 'read:user user:email',  // Optional, defaults provided
  profile: (profile) => ({        // Optional custom mapping
    id: String(profile.id),
    name: profile.name ?? profile.login,
    email: profile.email,
    image: profile.avatar_url
  })
})
```

**Example - Google:**
```typescript
Google({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  scope: 'openid email profile'   // Defaults to this
})
```

### 2. Credentials Provider

The credentials provider handles email/password authentication.

**Configuration:**
```typescript
interface CredentialsProviderConfig {
  id?: string;                   // Defaults to 'credentials'
  name?: string;                 // Defaults to 'Credentials'
  type: 'credentials';
  loginType?: LoginType;         // 'email' | 'username' | 'either'
  credentials?: Record<string, CredentialInput>;  // Form fields
  authorize: (
    credentials: Credentials,
    request: Request
  ) => Promise<User | null>;
}

type LoginType = 'email' | 'username' | 'either';
```

**Login Type Behavior:**
- `email`: Validates login as email format, label shows "Email"
- `username`: No email validation, label shows "Username"
- `either`: Accepts both, validates email if contains '@', label shows "Email or Username"

**Example:**
```typescript
Credentials({
  loginType: 'email',
  authorize: async (credentials) => {
    const { login, password } = credentials;

    // Find account by login
    const account = await adapter.getAccountByLogin('credentials', login);
    if (!account?.passwordHash) return null;

    // Verify password
    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) return null;

    // Get user
    const user = await adapter.getUser(account.userId);
    return user;
  }
})
```

**Default Credentials Fields:**
```typescript
// For loginType: 'email'
{
  login: { label: 'Email', type: 'email', required: true },
  password: { label: 'Password', type: 'password', required: true }
}

// For loginType: 'username'
{
  login: { label: 'Username', type: 'text', required: true },
  password: { label: 'Password', type: 'password', required: true }
}

// For loginType: 'either'
{
  login: { label: 'Email or Username', type: 'text', required: true },
  password: { label: 'Password', type: 'password', required: true }
}
```

### 3. Magic Link Provider (Planned)

Passwordless authentication via email links.

**Planned Configuration:**
```typescript
interface MagicLinkProviderConfig {
  id?: string;
  name?: string;
  type: 'email';
  sendMagicLink: (params: {
    email: string;
    url: string;
    token: string;
  }) => Promise<void>;
  maxAge?: number;  // Token validity in seconds
}
```

## Profile Mapping

Each OAuth provider returns a provider-specific profile. The `profile` callback transforms this to a standard User.

**Standard User Interface:**
```typescript
interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}
```

**Provider-Specific Profiles:**

GitHub:
```typescript
interface GitHubProfile {
  id: number;           // Note: number, converted to string
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  // ... many more fields
}
```

Google:
```typescript
interface GoogleProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  locale: string;
}
```

Discord:
```typescript
interface DiscordProfile {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  email?: string | null;
  verified?: boolean;
}
```

## Adding New OAuth Providers

1. Create provider file in `src/lib/providers/`
2. Define provider-specific profile interface
3. Implement provider factory function
4. Export from `src/lib/providers/index.ts`

**Template:**
```typescript
import type { OAuthProviderConfig, Profile, TokenSet, User } from '../types.js';

export interface NewProviderProfile extends Profile {
  // Provider-specific fields
}

export interface NewProviderConfig {
  clientId: string;
  clientSecret: string;
  scope?: string;
  profile?: (profile: NewProviderProfile, tokens: TokenSet) => User | Promise<User>;
}

export function NewProvider(config: NewProviderConfig): OAuthProviderConfig<Profile> {
  const defaultProfile = (profile: Profile) => {
    const p = profile as NewProviderProfile;
    return {
      id: p.id ?? p.sub ?? '',
      name: p.name,
      email: p.email,
      image: p.picture ?? p.avatar_url
    };
  };

  return {
    id: 'newprovider',
    name: 'New Provider',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://provider.com/oauth/authorize',
      params: { scope: config.scope ?? 'default scope' }
    },
    token: 'https://provider.com/oauth/token',
    userinfo: 'https://provider.com/api/userinfo',
    profile: config.profile
      ? (profile, tokens) => config.profile!(profile as NewProviderProfile, tokens)
      : defaultProfile
  };
}
```
