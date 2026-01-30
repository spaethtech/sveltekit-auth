/**
 * Google OAuth provider
 */

import type { OAuthProviderConfig, Profile, TokenSet, User } from '../types.js';

export interface GoogleConfig {
  /**
   * Google OAuth client ID
   */
  clientId: string;

  /**
   * Google OAuth client secret
   */
  clientSecret: string;

  /**
   * OAuth scopes to request (default: 'openid email profile')
   */
  scope?: string;

  /**
   * Custom profile transformer
   */
  profile?: (profile: GoogleProfile, tokens: TokenSet) => User | Promise<User>;
}

export interface GoogleProfile extends Profile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  locale: string;
}

/**
 * Create a Google OAuth provider
 *
 * @example
 * ```ts
 * Google({
 *   clientId: process.env.GOOGLE_CLIENT_ID,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET
 * })
 * ```
 */
export function Google(config: GoogleConfig): OAuthProviderConfig {
  const scope = config.scope ?? 'openid email profile';

  return {
    id: 'google',
    name: 'Google',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
      params: {
        scope,
        access_type: 'offline',
        prompt: 'consent'
      }
    },
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    issuer: 'https://accounts.google.com',
    profile:
      config.profile ??
      ((profile: Profile) => {
        const googleProfile = profile as GoogleProfile;
        return {
          id: googleProfile.sub,
          name: googleProfile.name,
          email: googleProfile.email,
          image: googleProfile.picture
        };
      })
  };
}
