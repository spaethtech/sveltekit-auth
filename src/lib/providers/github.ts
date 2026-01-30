/**
 * GitHub OAuth provider
 */

import type { OAuthProviderConfig, Profile, TokenSet, User } from '../types.js';

export interface GitHubConfig {
  /**
   * GitHub OAuth App client ID
   */
  clientId: string;

  /**
   * GitHub OAuth App client secret
   */
  clientSecret: string;

  /**
   * OAuth scopes to request (default: 'read:user user:email')
   */
  scope?: string;

  /**
   * Custom profile transformer
   */
  profile?: (profile: GitHubProfile, tokens: TokenSet) => User | Promise<User>;
}

export interface GitHubProfile extends Profile {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  type: string;
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/**
 * Create a GitHub OAuth provider
 *
 * @example
 * ```ts
 * GitHub({
 *   clientId: process.env.GITHUB_CLIENT_ID,
 *   clientSecret: process.env.GITHUB_CLIENT_SECRET
 * })
 * ```
 */
export function GitHub(config: GitHubConfig): OAuthProviderConfig {
  const scope = config.scope ?? 'read:user user:email';

  return {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://github.com/login/oauth/authorize',
      params: { scope }
    },
    token: 'https://github.com/login/oauth/access_token',
    userinfo: 'https://api.github.com/user',
    profile:
      config.profile ??
      ((profile: Profile) => {
        const ghProfile = profile as GitHubProfile;
        return {
          id: String(ghProfile.id),
          name: ghProfile.name ?? ghProfile.login,
          email: ghProfile.email,
          image: ghProfile.avatar_url
        };
      })
  };
}
