/**
 * Demo: SvelteKit hooks with authentication middleware
 *
 * This file demonstrates how to use the sveltekit-auth library
 * in a SvelteKit application's hooks.server.ts file.
 */

import { createAuth, createProtectedRoutesMiddleware, sequence } from '$lib/index.js';
import { Credentials, GitHub, Google } from '$lib/providers/index.js';

// Environment variables (in a real app, use $env/static/private)
const AUTH_SECRET = 'your-secret-key-at-least-32-characters-long';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';

// Demo user database (in a real app, use a real database)
const users = new Map([
  [
    'demo@example.com',
    {
      id: '1',
      email: 'demo@example.com',
      name: 'Demo User',
      password: 'password123' // In production, use hashed passwords!
    }
  ]
]);

/**
 * Create the authentication middleware
 */
const auth = createAuth({
  // Secret for signing tokens (use a strong, unique secret in production)
  secret: AUTH_SECRET,

  // Configure authentication providers
  providers: [
    // Credentials provider for email/password login
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'demo@example.com' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // Look up user in database
        const user = users.get(credentials.email ?? '');

        // Verify password (use proper password hashing in production!)
        if (user && credentials.password === user.password) {
          // Return user object (without password)
          return {
            id: user.id,
            email: user.email,
            name: user.name
          };
        }

        // Return null if authentication fails
        return null;
      }
    }),

    // GitHub OAuth provider (configure with your GitHub OAuth App credentials)
    ...(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET
      ? [
          GitHub({
            clientId: GITHUB_CLIENT_ID,
            clientSecret: GITHUB_CLIENT_SECRET
          })
        ]
      : []),

    // Google OAuth provider (configure with your Google OAuth credentials)
    ...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET
          })
        ]
      : [])
  ],

  // Session configuration
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },

  // Custom pages (optional)
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin'
  },

  // Callbacks for customizing behavior
  callbacks: {
    // Customize the session object
    async session({ session, token }) {
      // Add custom properties to the session
      return {
        ...session,
        user: {
          ...session.user,
          // Add any additional user properties
        }
      };
    },

    // Control who can sign in
    async signIn({ user, account }) {
      // Allow all sign ins (customize as needed)
      return true;
    }
  },

  // Enable debug mode for development
  debug: true
});

/**
 * Create protected routes middleware
 */
const protectedRoutes = createProtectedRoutesMiddleware({
  // Routes that require authentication
  protectedRoutes: ['/protected/*', '/dashboard/*', '/api/private/*'],

  // Routes that are always public
  publicRoutes: ['/', '/auth/*', '/api/public/*'],

  // Where to redirect unauthorized users
  unauthorizedRedirect: '/auth/signin'
});

/**
 * Combine middlewares using sequence
 */
export const handle = sequence(auth, protectedRoutes);
