import argon2 from 'argon2';

/** Hashes a password with Argon2id for storage. */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string.');
  }

  return argon2.hash(password, { type: argon2.argon2id });
}

/** Verifies a plaintext password against a stored Argon2 hash. */
export async function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string' || passwordHash.length === 0) {
    return false;
  }

  return argon2.verify(passwordHash, password);
}
