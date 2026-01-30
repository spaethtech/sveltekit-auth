/**
 * Generic OAuth provider factory
 */

import type { OAuthProviderConfig, Profile, User, TokenSet } from '../types.js';

export interface OAuthConfig {
  /**
   * Unique identifier for the provider
   */
  id: string;

  /**
   * Display name for the provider
   */
  name: string;

  /**
   * OAuth client ID
   */
  clientId: string;

  /**
   * OAuth client secret
   */
  clientSecret: string;

  /**
   * Authorization endpoint URL or configuration
   */
  authorization: string | { url: string; params?: Record<string, string> };

  /**
   * Token endpoint URL or configuration
   */
  token: string | { url: string; params?: Record<string, string> };

  /**
   * User info endpoint URL or configuration
   */
  userinfo?: string | { url: string };

  /**
   * OpenID Connect issuer URL
   */
  issuer?: string;

  /**
   * OpenID Connect well-known configuration URL
   */
  wellKnown?: string;

  /**
   * Security checks to perform
   */
  checks?: ('state' | 'pkce' | 'nonce')[];

  /**
   * Transform profile to user
   */
  profile?: (profile: Profile, tokens: TokenSet) => User | Promise<User>;
}

/**
 * Create a generic OAuth provider
 *
 * @example
 * ```ts
 * OAuth({
 *   id: 'custom',
 *   name: 'Custom OAuth',
 *   clientId: process.env.CUSTOM_CLIENT_ID,
 *   clientSecret: process.env.CUSTOM_CLIENT_SECRET,
 *   authorization: 'https://custom.com/oauth/authorize',
 *   token: 'https://custom.com/oauth/token',
 *   userinfo: 'https://custom.com/api/user',
 *   profile(profile) {
 *     return {
 *       id: profile.id,
 *       name: profile.name,
 *       email: profile.email,
 *       image: profile.avatar
 *     };
 *   }
 * })
 * ```
 */
export function OAuth(config: OAuthConfig): OAuthProviderConfig {
  return {
    id: config.id,
    name: config.name,
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: config.authorization,
    token: config.token,
    userinfo: config.userinfo,
    issuer: config.issuer,
    wellKnown: config.wellKnown,
    checks: config.checks ?? ['state'],
    profile:
      config.profile ??
      ((profile: Profile) => ({
        id: String(profile.sub ?? profile.id ?? ''),
        name: profile.name ?? null,
        email: profile.email ?? null,
        image: (profile.picture ?? profile.image ?? profile.avatar_url ?? null) as string | null
      }))
  };
}
