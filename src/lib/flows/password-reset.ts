/**
 * Password reset flow utilities
 */

import type { Adapter } from '../types.js';
import { generateToken, hashPassword } from '../utils/password.js';

export interface PasswordResetConfig {
  /**
   * Token expiration time in seconds (default: 1 hour)
   */
  expiresIn?: number;

  /**
   * Function to send password reset email
   */
  sendEmail: (params: {
    to: string;
    token: string;
    url: string;
  }) => Promise<void>;

  /**
   * Base URL for reset links (e.g., 'https://example.com')
   * If not provided, will try to infer from request
   */
  baseUrl?: string;

  /**
   * Path for reset endpoint (default: '/auth/reset-password')
   */
  resetPath?: string;
}

export interface CreateResetResult {
  token: string;
  url: string;
  expires: Date;
}

/**
 * Create a password reset token and send email
 *
 * @param adapter - Database adapter
 * @param login - The email/login requesting reset
 * @param config - Password reset configuration
 * @returns Token, URL, and expiration (or null if login not found)
 *
 * @example
 * ```ts
 * const result = await createPasswordReset(adapter, email, {
 *   sendEmail: async ({ to, url }) => {
 *     await sendEmail({
 *       to,
 *       subject: 'Reset your password',
 *       html: `<a href="${url}">Click to reset password</a>`
 *     });
 *   }
 * });
 *
 * // Always return success to prevent email enumeration
 * return { success: true };
 * ```
 */
export async function createPasswordReset(
  adapter: Adapter,
  login: string,
  config: PasswordResetConfig,
  request?: Request
): Promise<CreateResetResult | null> {
  const expiresIn = config.expiresIn ?? 60 * 60; // 1 hour
  const resetPath = config.resetPath ?? '/auth/reset-password';

  // Check if account exists
  const account = await adapter.getAccountByLogin?.('credentials', login);
  if (!account) {
    // Return null but don't reveal this to the user
    return null;
  }

  // Generate token
  const token = generateToken(32);
  const expires = new Date(Date.now() + expiresIn * 1000);

  // Store in database (using verification tokens table)
  // Prefix identifier to distinguish from email verification
  await adapter.createVerificationToken({
    identifier: `reset:${login}`,
    token,
    expires
  });

  // Build reset URL
  let baseUrl = config.baseUrl;
  if (!baseUrl && request) {
    const url = new URL(request.url);
    baseUrl = `${url.protocol}//${url.host}`;
  }
  if (!baseUrl) {
    throw new Error('baseUrl is required when request is not provided');
  }

  const resetUrl = `${baseUrl}${resetPath}?token=${token}&login=${encodeURIComponent(login)}`;

  // Send email
  await config.sendEmail({
    to: login,
    token,
    url: resetUrl
  });

  return {
    token,
    url: resetUrl,
    expires
  };
}

/**
 * Verify a password reset token (without consuming it)
 *
 * @param adapter - Database adapter
 * @param login - The login that requested reset
 * @param token - The reset token
 * @returns true if token is valid and not expired
 */
export async function verifyResetToken(
  adapter: Adapter,
  login: string,
  token: string
): Promise<boolean> {
  // We need to check without consuming the token
  // This requires a custom adapter method or we peek at the token
  const identifier = `reset:${login}`;

  // Try to use the token to verify it exists
  // Note: This consumes the token, so for forms that verify first,
  // you might want to add a getVerificationToken method to the adapter
  const verificationToken = await adapter.useVerificationToken({
    identifier,
    token
  });

  if (!verificationToken) {
    return false;
  }

  // Check if expired
  if (verificationToken.expires < new Date()) {
    return false;
  }

  // Re-create the token since we consumed it during verification
  // This is a workaround; ideally adapter would have a peek method
  await adapter.createVerificationToken({
    identifier,
    token,
    expires: verificationToken.expires
  });

  return true;
}

/**
 * Complete password reset by setting new password
 *
 * @param adapter - Database adapter
 * @param login - The login that requested reset
 * @param token - The reset token
 * @param newPassword - The new password
 * @returns Result with success status
 *
 * @example
 * ```ts
 * // In your reset-password form handler
 * const result = await resetPassword(adapter, login, token, newPassword);
 *
 * if (result.success) {
 *   redirect(303, '/auth/signin?message=password-reset');
 * } else {
 *   return { error: result.error };
 * }
 * ```
 */
export async function resetPassword(
  adapter: Adapter,
  login: string,
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const identifier = `reset:${login}`;

  // Verify and consume the token
  const verificationToken = await adapter.useVerificationToken({
    identifier,
    token
  });

  if (!verificationToken) {
    return { success: false, error: 'Invalid or expired reset link' };
  }

  // Check if expired
  if (verificationToken.expires < new Date()) {
    return { success: false, error: 'Reset link has expired' };
  }

  // Find the account
  const account = await adapter.getAccountByLogin?.('credentials', login);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update account
  await adapter.updateAccount?.(account.id, {
    passwordHash
  });

  return { success: true };
}

/**
 * Validate password strength
 *
 * @param password - Password to validate
 * @param options - Validation options
 * @returns Validation result with any errors
 */
export function validatePassword(
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecial?: boolean;
  } = {}
): { valid: boolean; errors: string[] } {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecial = false
  } = options;

  const errors: string[] = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }

  if (requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }

  if (requireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain a special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
