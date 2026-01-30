/**
 * Client-side authentication utilities for SvelteKit 5
 */

export { createAuthClient, type AuthClientOptions } from './auth-client.js';
export { signIn, signOut, getSession, getProviders } from './actions.js';
export type { SignInOptions, SignOutOptions } from './actions.js';
