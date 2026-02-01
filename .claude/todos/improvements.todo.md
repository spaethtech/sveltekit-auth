# SvelteKit Auth - Outstanding TODOs

## High Priority

### Account Linking for OAuth
**Status:** Not Started
**Description:** Allow users to link multiple OAuth providers to a single account.

**Requirements:**
- Detect when OAuth email matches existing user
- Prompt user to link accounts or create new
- Support unlinking accounts (keep at least one auth method)
- Handle conflicts (e.g., different emails from different providers)

**Files to modify:**
- `src/lib/middleware/routes.ts` - OAuth callback handling
- `src/lib/types.ts` - Add linking-related types
- New: `src/lib/flows/account-linking.ts`

---

### More OAuth Providers
**Status:** Not Started
**Description:** Add support for additional OAuth providers.

**Providers to add:**
- [ ] Apple
- [ ] Microsoft
- [ ] Twitter/X
- [ ] Facebook
- [ ] LinkedIn

**Template:** See `.claude/specs/providers.spec.md` for provider template.

**Files to create:**
- `src/lib/providers/apple.ts`
- `src/lib/providers/microsoft.ts`
- `src/lib/providers/twitter.ts`
- `src/lib/providers/facebook.ts`
- `src/lib/providers/linkedin.ts`

---

### Rate Limiting
**Status:** Not Started
**Description:** Prevent brute force attacks on auth endpoints.

**Requirements:**
- Per-IP rate limiting
- Configurable limits per endpoint
- In-memory store (dev) + Redis adapter (prod)
- Return `Retry-After` header

**Limits:**
| Endpoint | Limit |
|----------|-------|
| `/auth/signin` | 5/minute |
| `/auth/signup` | 3/minute |
| Password reset | 3/hour |
| Verification resend | 1/minute |

**Files to create:**
- `src/lib/middleware/rate-limit.ts`
- `src/lib/adapters/rate-limit/memory.ts`
- `src/lib/adapters/rate-limit/redis.ts`

---

## Medium Priority

### Magic Link Authentication
**Status:** Not Started
**Description:** Passwordless authentication via email links.

**Requirements:**
- Generate secure one-time token
- Send email with magic link
- Verify token and create session
- Token expiration (15 minutes default)

**Files to create:**
- `src/lib/providers/magic-link.ts`
- `src/lib/flows/magic-link.ts`

---

### Two-Factor Authentication (TOTP)
**Status:** Not Started
**Description:** Time-based one-time passwords for additional security.

**Requirements:**
- Generate TOTP secret
- QR code generation for authenticator apps
- Verify TOTP codes
- Backup codes
- Recovery flow

**Dependencies:**
- `otpauth` or similar TOTP library

**Files to create:**
- `src/lib/flows/totp.ts`
- `src/lib/utils/totp.ts`

**Schema changes:**
- Add `totpSecret` to accounts or new `twoFactor` table

---

### Session Management Utilities
**Status:** Not Started
**Description:** Utilities for managing user sessions.

**Requirements:**
- List active sessions for a user
- Revoke specific sessions
- Revoke all sessions except current
- Session metadata (device, IP, last active)

**Files to create:**
- `src/lib/utils/session-management.ts`

---

## Lower Priority

### CSRF Protection
**Status:** Partial (OAuth state parameter exists)
**Description:** Full CSRF protection for all forms.

**Requirements:**
- CSRF token generation
- Double-submit cookie pattern
- Origin header validation
- Middleware integration

**Files to create:**
- `src/lib/middleware/csrf.ts`
- `src/lib/utils/csrf.ts`

---

### Audit Logging
**Status:** Not Started
**Description:** Log authentication events for security monitoring.

**Events to log:**
- Sign in (success/failure)
- Sign out
- Password change
- Account linking/unlinking
- Verification attempts
- Session creation/destruction

**Files to create:**
- `src/lib/utils/audit.ts`
- `src/lib/adapters/audit/` (console, file, custom)

---

## Technical Debt

### Improve Type Safety
- Remove `as unknown as` casts where possible
- Better generic typing for providers
- Stricter adapter return types

### Testing
- Unit tests for all utilities
- Integration tests for auth flows
- E2E tests for OAuth flows (mocked)

### Documentation
- JSDoc comments on all exports
- README with full usage guide
- Example applications
