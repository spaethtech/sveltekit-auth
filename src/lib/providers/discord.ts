/**
 * Discord OAuth provider
 */

import type { OAuthProviderConfig, Profile, TokenSet, User } from '../types.js';

export interface DiscordConfig {
  /**
   * Discord OAuth client ID
   */
  clientId: string;

  /**
   * Discord OAuth client secret
   */
  clientSecret: string;

  /**
   * OAuth scopes to request (default: 'identify email')
   */
  scope?: string;

  /**
   * Custom profile transformer
   */
  profile?: (profile: DiscordProfile, tokens: TokenSet) => User | Promise<User>;
}

export interface DiscordProfile extends Profile {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  banner?: string | null;
  accent_color?: number | null;
  locale?: string;
  verified?: boolean;
  email?: string | null;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

/**
 * Get Discord avatar URL
 */
function getDiscordAvatarUrl(profile: DiscordProfile): string | null {
  if (profile.avatar) {
    const format = profile.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
  }

  // Default avatar based on discriminator or user ID
  const defaultIndex =
    profile.discriminator === '0'
      ? Number(BigInt(profile.id) >> BigInt(22)) % 6
      : Number(profile.discriminator) % 5;

  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

/**
 * Create a Discord OAuth provider
 *
 * @example
 * ```ts
 * Discord({
 *   clientId: process.env.DISCORD_CLIENT_ID,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET
 * })
 * ```
 */
export function Discord(config: DiscordConfig): OAuthProviderConfig {
  const scope = config.scope ?? 'identify email';

  return {
    id: 'discord',
    name: 'Discord',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://discord.com/api/oauth2/authorize',
      params: { scope }
    },
    token: 'https://discord.com/api/oauth2/token',
    userinfo: 'https://discord.com/api/users/@me',
    profile:
      config.profile ??
      ((profile: Profile) => {
        const discordProfile = profile as DiscordProfile;
        return {
          id: discordProfile.id,
          name: discordProfile.global_name ?? discordProfile.username,
          email: discordProfile.email ?? null,
          image: getDiscordAvatarUrl(discordProfile)
        };
      })
  };
}
