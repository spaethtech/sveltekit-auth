# SvelteKit Auth - Project Overview

A modern authentication library for SvelteKit 5 with runes mode support, designed to be flexible, secure, and easy to integrate.

## Quick Start

```bash
npm install @sveltekit-auth/core
npx sveltekit-auth init --orm=drizzle --database=postgres
```

## Architecture

```
src/lib/
├── middleware/       # SvelteKit hooks integration
├── providers/        # OAuth and credentials providers
├── adapters/         # Database adapters (Memory, Drizzle, Prisma)
├── flows/            # Auth flows (verification, password reset)
├── utils/            # Utilities (session, crypto, password)
├── client/           # Client-side auth state (runes)
└── types.ts          # Core type definitions
```

## Key Concepts

### Authentication Flow
1. User authenticates via provider (OAuth or credentials)
2. Session created with JWT encryption
3. Session stored in HTTP-only cookie
4. Server validates session on each request via middleware

### Database Schema
- **users** - Minimal user model (only `id` required for auth)
- **accounts** - Links providers to users via `login` field
- **sessions** - Server-side session storage (optional)
- **verifications** - Email verification and password reset tokens

### Provider Types
- **OAuth**: GitHub, Google, Discord (+ planned: Apple, Microsoft, Twitter, Facebook, LinkedIn)
- **Credentials**: Email/password with configurable login types (email, username, either)
- **Magic Link**: (planned) Passwordless email authentication

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run package      # Build library package
npm run check        # TypeScript check
npm test             # Run tests
```

## Configuration

```typescript
// src/hooks.server.ts
import { createAuth } from '@sveltekit-auth/core';
import { GitHub, Credentials } from '@sveltekit-auth/core/providers';
import { createDrizzleAdapter } from '@sveltekit-auth/core/adapters';

export const handle = createAuth({
  providers: [
    GitHub({ clientId: '...', clientSecret: '...' }),
    Credentials({
      loginType: 'email',
      authorize: async (credentials) => { /* ... */ }
    })
  ],
  adapter: createDrizzleAdapter(db, schema),
  secret: process.env.AUTH_SECRET
});
```

## Specifications

Detailed specifications are in `.claude/specs/`:
- `architecture.spec.md` - System architecture and design
- `providers.spec.md` - Authentication providers
- `adapters.spec.md` - Database adapters
- `cli.spec.md` - Schema generation CLI
- `flows.spec.md` - Auth flows (verification, password reset)
- `security.spec.md` - Security considerations

## Key Design Decisions

1. **Generic `login` field** - Accounts use a `login` field instead of separate email/username fields, supporting any identifier type
2. **Minimal User model** - Only `id` is required; email is optional and can come from OAuth
3. **Schema split** - Generated schemas are split into `users.ts` (extendable) and `auth.ts` (internal)
4. **Web Crypto API** - Zero-dependency password hashing via PBKDF2 (optional Argon2)
5. **SvelteKit 5 Runes** - Client-side state uses `$state` and `$derived` for reactivity

## Pending Features

- [ ] Account linking for OAuth
- [ ] More OAuth providers (Apple, Microsoft, Twitter, Facebook, LinkedIn)
- [ ] Rate limiting for auth endpoints
- [ ] Magic link authentication
- [ ] Two-factor authentication (TOTP)
- [ ] Session management utilities
- [ ] CSRF protection
