# Authentication Flows Specification

## Overview

Authentication flows handle multi-step authentication processes like email verification and password reset. These flows use the `verifications` table to store temporary tokens.

## Email Verification Flow

### Purpose
Verify that a user owns the email address they registered with.

### Functions

#### `createVerification()`
Creates a verification token and optionally sends an email.

```typescript
interface VerificationConfig {
  adapter: Adapter;
  sendEmail: (params: {
    email: string;
    token: string;
    url: string;
  }) => Promise<void>;
  baseUrl: string;
  maxAge?: number;  // Token validity in seconds (default: 24 hours)
}

interface CreateVerificationResult {
  success: boolean;
  token?: string;
  url?: string;
  error?: string;
}

async function createVerification(
  adapter: Adapter,
  identifier: string,
  config: VerificationConfig,
  request?: Request
): Promise<CreateVerificationResult>
```

**Implementation:**
1. Generate secure random token
2. Hash token before storing (prevent DB leaks)
3. Store in verifications table with expiration
4. Build verification URL
5. Send email via provided callback
6. Return result

#### `verifyToken()`
Verifies and consumes a verification token.

```typescript
async function verifyToken(
  adapter: Adapter,
  identifier: string,
  token: string
): Promise<{ verified: boolean; userId?: string }>
```

**Implementation:**
1. Hash provided token
2. Look up in verifications table
3. Check expiration
4. If valid, delete token (one-time use)
5. Update account's `loginVerified` field
6. Return result with userId

#### `isLoginVerified()`
Checks if a login has been verified.

```typescript
async function isLoginVerified(
  adapter: Adapter,
  provider: string,
  login: string
): Promise<boolean>
```

#### `resendVerification()`
Resend verification email with rate limiting.

```typescript
async function resendVerification(
  adapter: Adapter,
  identifier: string,
  config: VerificationConfig,
  request?: Request,
  cooldownSeconds?: number  // Default: 60
): Promise<{
  success: boolean;
  error?: string;
  retryAfter?: number;
}>
```

### Usage Example

```typescript
// In registration endpoint
import { createVerification, hashPassword } from '@sveltekit-auth/core';

export const actions = {
  register: async ({ request, locals }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');

    // Create user
    const user = await adapter.createUser({ email, emailVerified: null });

    // Create credentials account
    const passwordHash = await hashPassword(password);
    await adapter.linkAccount({
      userId: user.id,
      provider: 'credentials',
      login: email,
      type: 'credentials',
      passwordHash
    });

    // Send verification email
    await createVerification(adapter, email, {
      sendEmail: async ({ email, url }) => {
        await sendgrid.send({
          to: email,
          subject: 'Verify your email',
          html: `<a href="${url}">Click to verify</a>`
        });
      },
      baseUrl: 'https://myapp.com/auth/verify'
    });

    return { success: true };
  }
};
```

```typescript
// In verify endpoint
import { verifyToken } from '@sveltekit-auth/core';

export const load = async ({ url, locals }) => {
  const token = url.searchParams.get('token');
  const email = url.searchParams.get('email');

  const result = await verifyToken(locals.adapter, email, token);

  if (result.verified) {
    // Update user's emailVerified
    await adapter.updateUser({
      id: result.userId,
      emailVerified: new Date()
    });
  }

  return { verified: result.verified };
};
```

## Password Reset Flow

### Purpose
Allow users to reset their password via email.

### Functions

#### `createPasswordReset()`
Creates a password reset token and sends email.

```typescript
interface PasswordResetConfig {
  adapter: Adapter;
  sendEmail: (params: {
    email: string;
    token: string;
    url: string;
  }) => Promise<void>;
  baseUrl: string;
  maxAge?: number;  // Token validity in seconds (default: 1 hour)
}

interface CreateResetResult {
  success: boolean;
  error?: string;
}

async function createPasswordReset(
  adapter: Adapter,
  login: string,
  config: PasswordResetConfig,
  request?: Request
): Promise<CreateResetResult | null>
```

**Implementation:**
1. Look up account by login
2. If not found, return null (prevent enumeration)
3. Generate secure token
4. Store hashed token in verifications
5. Send reset email
6. Return result

#### `verifyResetToken()`
Verify a reset token without consuming it.

```typescript
async function verifyResetToken(
  adapter: Adapter,
  login: string,
  token: string
): Promise<boolean>
```

#### `resetPassword()`
Complete the password reset.

```typescript
async function resetPassword(
  adapter: Adapter,
  login: string,
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }>
```

**Implementation:**
1. Verify token
2. Validate new password strength
3. Hash new password
4. Update account's passwordHash
5. Delete token (one-time use)
6. Optionally invalidate all sessions

#### `validatePassword()`
Validate password strength.

```typescript
interface PasswordValidationOptions {
  minLength?: number;       // Default: 8
  maxLength?: number;       // Default: 128
  requireUppercase?: boolean;  // Default: true
  requireLowercase?: boolean;  // Default: true
  requireNumbers?: boolean;    // Default: true
  requireSpecial?: boolean;    // Default: false
}

function validatePassword(
  password: string,
  options?: PasswordValidationOptions
): { valid: boolean; errors: string[] }
```

### Usage Example

```typescript
// Request password reset
import { createPasswordReset } from '@sveltekit-auth/core';

export const actions = {
  requestReset: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email');

    // Always return success to prevent email enumeration
    await createPasswordReset(adapter, email, {
      sendEmail: async ({ email, url }) => {
        await sendgrid.send({
          to: email,
          subject: 'Reset your password',
          html: `<a href="${url}">Reset password</a>`
        });
      },
      baseUrl: 'https://myapp.com/auth/reset-password'
    });

    return { success: true, message: 'If an account exists, a reset email was sent.' };
  }
};
```

```typescript
// Complete password reset
import { resetPassword, validatePassword } from '@sveltekit-auth/core';

export const actions = {
  reset: async ({ request, url }) => {
    const data = await request.formData();
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');
    const password = data.get('password');

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Reset password
    const result = await resetPassword(adapter, email, token, password);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, message: 'Password has been reset.' };
  }
};
```

## Token Security

### Token Generation
- Uses `crypto.getRandomValues()` for cryptographic randomness
- Default length: 32 bytes (64 hex characters)
- URL-safe encoding

### Token Storage
- Tokens are hashed before storage (SHA-256)
- Original token sent to user, hash stored in database
- Prevents token theft from database breaches

### Token Expiration
- Email verification: 24 hours (default)
- Password reset: 1 hour (default)
- Configurable via `maxAge` option

### Rate Limiting
- Resend cooldown: 60 seconds (default)
- Prevents email spam
- Returns `retryAfter` for UI feedback

## Future Enhancements

### Magic Link Authentication
Same flow as verification, but creates a session on successful verification.

### Two-Factor Authentication
- TOTP (Time-based One-Time Password)
- Uses verifications table for setup codes
- Separate secret storage for TOTP secrets
