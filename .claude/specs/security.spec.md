# Security Specification

## Overview

This document outlines the security considerations and implementations in SvelteKit Auth.

## Password Security

### Hashing Algorithm

**Primary: PBKDF2 (Web Crypto API)**
- Algorithm: PBKDF2-HMAC-SHA256
- Iterations: 100,000 (configurable)
- Salt: 16 bytes (cryptographically random)
- Hash length: 32 bytes
- Zero external dependencies

**Optional: Argon2**
- Requires `@node-rs/argon2` package
- Recommended for high-security applications
- Memory-hard algorithm resistant to GPU attacks

### Hash Format

```
algorithm:iterations:saltLength:hashLength:salt:hash
```

Example:
```
pbkdf2:100000:16:32:a1b2c3...:d4e5f6...
```

### Password Verification

- Constant-time comparison to prevent timing attacks
- Automatic algorithm detection from hash format
- `needsRehash()` for upgrading hash parameters

```typescript
import { hashPassword, verifyPassword, needsRehash } from '@sveltekit-auth/core';

// Hash a password
const hash = await hashPassword('mypassword', { iterations: 150000 });

// Verify password
const valid = await verifyPassword('mypassword', hash);

// Check if hash needs upgrade
if (needsRehash(hash, { iterations: 200000 })) {
  const newHash = await hashPassword('mypassword', { iterations: 200000 });
}
```

### Password Validation

```typescript
import { validatePassword } from '@sveltekit-auth/core';

const result = validatePassword(password, {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: false
});

if (!result.valid) {
  console.log(result.errors);
}
```

## Session Security

### Session Token

- Generated using `crypto.getRandomValues()`
- 32 bytes of cryptographic randomness
- Hex-encoded (64 characters)

### Session Encryption

Sessions are encrypted using AES-GCM:

1. Derive key from secret using PBKDF2
2. Generate random IV (12 bytes)
3. Encrypt session JSON with AES-256-GCM
4. Combine: `salt + iv + ciphertext`
5. Base64 encode for cookie storage

```typescript
// Internal encryption flow
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const key = await deriveKey(secret, salt, ['encrypt']);
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  encoder.encode(JSON.stringify(session))
);
```

### Cookie Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `httpOnly` | `true` | Prevent XSS access |
| `secure` | `true` (production) | HTTPS only |
| `sameSite` | `lax` | CSRF protection |
| `path` | `/` | Available site-wide |
| `maxAge` | 30 days (default) | Session lifetime |

## OAuth Security

### State Parameter

- Random 32-byte hex string
- Stored in cookie before OAuth redirect
- Verified on callback to prevent CSRF

### PKCE (Proof Key for Code Exchange)

- Code verifier: 32 random bytes, base64url encoded
- Code challenge: SHA-256 hash of verifier, base64url encoded
- Prevents authorization code interception

```typescript
// Generate PKCE pair
const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);

// Include in authorization request
const authUrl = new URL(authorization.url);
authUrl.searchParams.set('code_challenge', challenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
```

### Token Storage

- Access tokens stored in encrypted session cookie
- Refresh tokens stored in encrypted session cookie
- Tokens never exposed to client-side JavaScript

## Verification Token Security

### Token Generation

```typescript
const token = generateToken(32);  // 64 hex characters
```

### Token Storage

- Tokens hashed with SHA-256 before database storage
- Original token sent to user (via email)
- Hash comparison on verification
- One-time use (deleted after verification)

### Token Expiration

| Flow | Default Expiration |
|------|-------------------|
| Email verification | 24 hours |
| Password reset | 1 hour |

## CSRF Protection

### Current Implementation

- State parameter for OAuth flows
- SameSite cookie attribute

### Planned Enhancements

- CSRF tokens for form submissions
- Double-submit cookie pattern
- Origin header validation

## Rate Limiting (Planned)

### Endpoints to Protect

| Endpoint | Limit |
|----------|-------|
| `/auth/signin` | 5 attempts / minute |
| `/auth/signup` | 3 attempts / minute |
| Password reset request | 3 attempts / hour |
| Verification resend | 1 / minute |

### Implementation Strategy

- In-memory rate limiting (development)
- Redis-based rate limiting (production)
- Configurable limits and windows

## Input Validation

### Email Validation

```typescript
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

### Login Type Validation

```typescript
function validateLogin(login: string, loginType: LoginType): { valid: boolean; error?: string } {
  if (!login || typeof login !== 'string') {
    return { valid: false, error: 'Login is required' };
  }

  if (loginType === 'email') {
    if (!isValidEmail(login)) {
      return { valid: false, error: 'Invalid email format' };
    }
  }

  if (loginType === 'either' && login.includes('@')) {
    if (!isValidEmail(login)) {
      return { valid: false, error: 'Invalid email format' };
    }
  }

  return { valid: true };
}
```

## Error Handling

### Information Disclosure Prevention

- Generic error messages for auth failures
- No differentiation between "user not found" and "wrong password"
- Password reset always returns success (prevents email enumeration)

```typescript
// Bad: Reveals user existence
if (!user) return { error: 'User not found' };
if (!validPassword) return { error: 'Wrong password' };

// Good: Generic message
if (!user || !validPassword) return { error: 'Invalid credentials' };
```

## Security Headers (Recommended)

Add to your SvelteKit app:

```typescript
// hooks.server.ts
export const handle = sequence(
  createAuth({ ... }),
  ({ event, resolve }) => {
    return resolve(event, {
      transformPageChunk: ({ html }) => html,
      filterSerializedResponseHeaders: (name) => name.startsWith('x-'),
    });
  }
);
```

Recommended headers:
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`

## Secret Management

### Requirements

- Minimum 32 characters
- Cryptographically random
- Stored in environment variables
- Never committed to version control

### Generation

```bash
openssl rand -hex 32
# or
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

### Configuration

```typescript
// Use environment variable
const auth = createAuth({
  secret: process.env.AUTH_SECRET,
  // ...
});
```

## Audit Logging (Planned)

Events to log:
- Successful/failed sign-in attempts
- Password changes
- Account linking/unlinking
- Session creation/destruction
- Verification attempts

Log format:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "event": "signin.success",
  "userId": "user_123",
  "provider": "credentials",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```
