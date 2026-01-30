/**
 * Password hashing utilities
 *
 * Uses PBKDF2 with SHA-256 by default (Web Crypto API, zero dependencies).
 * Optionally supports Argon2 if @node-rs/argon2 is installed.
 */

export interface HashOptions {
  /**
   * Algorithm to use: 'pbkdf2' (default) or 'argon2'
   * Argon2 requires @node-rs/argon2 package to be installed
   */
  algorithm?: 'pbkdf2' | 'argon2';

  /**
   * PBKDF2 iterations (default: 100000)
   * Higher = more secure but slower
   */
  iterations?: number;

  /**
   * Salt length in bytes (default: 16)
   */
  saltLength?: number;

  /**
   * Hash length in bytes (default: 32)
   */
  hashLength?: number;
}

const DEFAULT_OPTIONS: Required<HashOptions> = {
  algorithm: 'pbkdf2',
  iterations: 100000,
  saltLength: 16,
  hashLength: 32
};

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convert Uint8Array to hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Hash password using PBKDF2 (Web Crypto API)
 */
async function hashPBKDF2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  hashLength: number
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    hashLength * 8
  );

  return new Uint8Array(derivedBits);
}

/**
 * Argon2 module interface (optional dependency)
 */
interface Argon2Module {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/**
 * Try to load Argon2 dynamically
 */
async function getArgon2(): Promise<Argon2Module | null> {
  try {
    // Dynamic import - @node-rs/argon2 is optional
    return await import('@node-rs/argon2' as string);
  } catch {
    return null;
  }
}

/**
 * Hash a password securely
 *
 * @param password - The plain text password to hash
 * @param options - Hashing options
 * @returns A string containing the algorithm, parameters, salt, and hash
 *
 * @example
 * ```ts
 * const hash = await hashPassword('mypassword');
 * // Returns: "pbkdf2:100000:16:32:hexsalt:hexhash"
 *
 * // Store hash in database
 * await db.account.update({
 *   where: { id: accountId },
 *   data: { passwordHash: hash }
 * });
 * ```
 */
export async function hashPassword(
  password: string,
  options: HashOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.algorithm === 'argon2') {
    const argon2 = await getArgon2();
    if (!argon2) {
      throw new Error(
        'Argon2 requested but @node-rs/argon2 is not installed. ' +
          'Install it with: npm install @node-rs/argon2'
      );
    }
    // Argon2 handles salt internally and returns a complete hash string
    const hash = await argon2.hash(password);
    return `argon2:${hash}`;
  }

  // PBKDF2
  const salt = generateSalt(opts.saltLength);
  const hash = await hashPBKDF2(password, salt, opts.iterations, opts.hashLength);

  // Format: algorithm:iterations:saltLength:hashLength:salt:hash
  return `pbkdf2:${opts.iterations}:${opts.saltLength}:${opts.hashLength}:${toHex(salt)}:${toHex(hash)}`;
}

/**
 * Verify a password against a hash
 *
 * @param password - The plain text password to verify
 * @param hash - The hash string from hashPassword()
 * @returns true if password matches, false otherwise
 *
 * @example
 * ```ts
 * const account = await db.account.findFirst({
 *   where: { provider: 'credentials', login: email }
 * });
 *
 * if (account && await verifyPassword(password, account.passwordHash)) {
 *   // Password is correct
 * }
 * ```
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash || typeof hash !== 'string') {
    return false;
  }

  const parts = hash.split(':');
  const algorithm = parts[0];

  try {
    if (algorithm === 'argon2') {
      const argon2 = await getArgon2();
      if (!argon2) {
        throw new Error('Argon2 hash found but @node-rs/argon2 is not installed');
      }
      // Reconstruct the argon2 hash string (everything after "argon2:")
      const argon2Hash = parts.slice(1).join(':');
      return await argon2.verify(argon2Hash, password);
    }

    if (algorithm === 'pbkdf2') {
      const [, iterStr, saltLenStr, hashLenStr, saltHex, hashHex] = parts;
      const iterations = parseInt(iterStr, 10);
      const hashLength = parseInt(hashLenStr, 10);
      const salt = fromHex(saltHex);
      const storedHash = fromHex(hashHex);

      const computedHash = await hashPBKDF2(password, salt, iterations, hashLength);

      // Constant-time comparison to prevent timing attacks
      if (computedHash.length !== storedHash.length) {
        return false;
      }

      let result = 0;
      for (let i = 0; i < computedHash.length; i++) {
        result |= computedHash[i] ^ storedHash[i];
      }
      return result === 0;
    }

    // Unknown algorithm
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a hash needs to be rehashed (e.g., after changing options)
 *
 * @param hash - The existing hash string
 * @param options - The desired hashing options
 * @returns true if the hash should be regenerated
 *
 * @example
 * ```ts
 * // After login, check if hash needs upgrade
 * if (needsRehash(account.passwordHash, { iterations: 150000 })) {
 *   const newHash = await hashPassword(password, { iterations: 150000 });
 *   await db.account.update({
 *     where: { id: account.id },
 *     data: { passwordHash: newHash }
 *   });
 * }
 * ```
 */
export function needsRehash(hash: string, options: HashOptions = {}): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts = hash.split(':');
  const algorithm = parts[0];

  // Algorithm mismatch
  if (algorithm !== opts.algorithm) {
    return true;
  }

  // For PBKDF2, check iterations
  if (algorithm === 'pbkdf2') {
    const iterations = parseInt(parts[1], 10);
    if (iterations < opts.iterations) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a secure random token (for password reset, email verification, etc.)
 *
 * @param length - Length of the token in bytes (default: 32)
 * @returns Hex-encoded random token
 *
 * @example
 * ```ts
 * const token = generateToken(); // 64 character hex string
 * const shortToken = generateToken(16); // 32 character hex string
 * ```
 */
export function generateToken(length: number = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(length)));
}
