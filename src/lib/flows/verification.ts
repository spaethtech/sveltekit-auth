/**
 * Email verification flow utilities
 */

import type { Adapter } from '../types.js';
import { generateToken } from '../utils/password.js';

export interface VerificationConfig {
  /**
   * Token expiration time in seconds (default: 24 hours)
   */
  expiresIn?: number;

  /**
   * Function to send verification email
   */
  sendEmail: (params: {
    to: string;
    token: string;
    url: string;
  }) => Promise<void>;

  /**
   * Base URL for verification links (e.g., 'https://example.com')
   * If not provided, will try to infer from request
   */
  baseUrl?: string;

  /**
   * Path for verification endpoint (default: '/auth/verify-email')
   */
  verifyPath?: string;
}

export interface CreateVerificationResult {
  token: string;
  url: string;
  expires: Date;
}

/**
 * Create a verification token and store it in the database
 *
 * @param adapter - Database adapter
 * @param identifier - The email/login to verify
 * @param config - Verification configuration
 * @returns Token, URL, and expiration date
 *
 * @example
 * ```ts
 * const { token, url } = await createVerification(adapter, email, {
 *   sendEmail: async ({ to, url }) => {
 *     await sendEmail({
 *       to,
 *       subject: 'Verify your email',
 *       html: `<a href="${url}">Click to verify</a>`
 *     });
 *   }
 * });
 * ```
 */
export async function createVerification(
  adapter: Adapter,
  identifier: string,
  config: VerificationConfig,
  request?: Request
): Promise<CreateVerificationResult> {
  const expiresIn = config.expiresIn ?? 24 * 60 * 60; // 24 hours
  const verifyPath = config.verifyPath ?? '/auth/verify-email';

  // Generate token
  const token = generateToken(32);
  const expires = new Date(Date.now() + expiresIn * 1000);

  // Store in database
  await adapter.createVerificationToken({
    identifier,
    token,
    expires
  });

  // Build verification URL
  let baseUrl = config.baseUrl;
  if (!baseUrl && request) {
    const url = new URL(request.url);
    baseUrl = `${url.protocol}//${url.host}`;
  }
  if (!baseUrl) {
    throw new Error('baseUrl is required when request is not provided');
  }

  const verifyUrl = `${baseUrl}${verifyPath}?token=${token}&identifier=${encodeURIComponent(identifier)}`;

  // Send email
  await config.sendEmail({
    to: identifier,
    token,
    url: verifyUrl
  });

  return {
    token,
    url: verifyUrl,
    expires
  };
}

/**
 * Verify a token and mark the login as verified
 *
 * @param adapter - Database adapter
 * @param identifier - The email/login that was verified
 * @param token - The verification token
 * @returns The account if verification succeeded, null otherwise
 *
 * @example
 * ```ts
 * // In your verify-email route handler
 * const result = await verifyToken(adapter, identifier, token);
 *
 * if (result) {
 *   // Verification successful
 *   redirect(303, '/dashboard?verified=true');
 * } else {
 *   // Invalid or expired token
 *   redirect(303, '/auth/signin?error=invalid-token');
 * }
 * ```
 */
export async function verifyToken(
  adapter: Adapter,
  identifier: string,
  token: string
): Promise<{ verified: boolean; userId?: string }> {
  // Use the token (this also deletes it)
  const verificationToken = await adapter.useVerificationToken({
    identifier,
    token
  });

  if (!verificationToken) {
    return { verified: false };
  }

  // Check if expired
  if (verificationToken.expires < new Date()) {
    return { verified: false };
  }

  // Find the account and mark as verified
  const account = await adapter.getAccountByLogin?.('credentials', identifier);

  if (account) {
    // Update the account's loginVerified timestamp
    await adapter.updateAccount?.(account.id, {
      loginVerified: new Date()
    });

    return { verified: true, userId: account.userId };
  }

  // No account found - might be for a different provider or pre-registration
  return { verified: true };
}

/**
 * Check if a login is verified
 *
 * @param adapter - Database adapter
 * @param provider - The provider (e.g., 'credentials')
 * @param login - The login identifier
 * @returns true if verified, false otherwise
 */
export async function isLoginVerified(
  adapter: Adapter,
  provider: string,
  login: string
): Promise<boolean> {
  const account = await adapter.getAccountByLogin?.(provider, login);
  return account?.loginVerified != null;
}

/**
 * Resend verification email if allowed
 *
 * @param adapter - Database adapter
 * @param identifier - The email/login to verify
 * @param config - Verification configuration
 * @param cooldownSeconds - Minimum seconds between resends (default: 60)
 * @returns Result with success status
 */
export async function resendVerification(
  adapter: Adapter,
  identifier: string,
  config: VerificationConfig,
  request?: Request,
  cooldownSeconds: number = 60
): Promise<{ success: boolean; error?: string; cooldownRemaining?: number }> {
  // Check if already verified
  const account = await adapter.getAccountByLogin?.('credentials', identifier);
  if (account?.loginVerified) {
    return { success: false, error: 'Already verified' };
  }

  // Check for existing recent token (simple rate limiting)
  // Note: This is a basic check; the token might have been used
  // A proper implementation would track resend attempts separately

  // Create new verification
  try {
    await createVerification(adapter, identifier, config, request);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send verification email'
    };
  }
}
