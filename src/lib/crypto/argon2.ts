/**
 * Argon2id KDF — native via react-native-argon2.
 *
 * Parameters MUST match WebClient app/lib/crypto/keyDerivation.ts.
 * Any drift breaks cross-platform key derivation (login from web, then RN).
 *
 * Hex-salt note:
 * ─────────────
 * We pass `srpSaltHex` with `saltEncoding: 'hex'`.  The native Swift code in
 * RNArgon2.swift calls `Data(hexString: salt)` which correctly decodes the
 * 64-char hex string to 32 bytes — identical to the Web client's
 * `hexToBytes(srpSaltHex)` call before `argon2id()`.
 *
 * Earlier crash (`__stack_chk_fail` in `initial_hash`) was caused by the
 * tssrp6a `crossEnvCrypto.js` throwing at module-init time before any SRP
 * call, corrupting bridge state and then crashing inside the Argon2 native
 * call.  That issue is now fixed via the Metro `crossEnvCrypto` shim.
 */

import argon2 from 'react-native-argon2';

export const ARGON2_ITERATIONS  = 3;
export const ARGON2_MEMORY_KIB  = 64 * 1024; // 64 MiB — must match Web client
export const ARGON2_PARALLELISM = 1;
export const ARGON2_HASH_BYTES  = 32;

/**
 * Derive the Account Master Key (AMK) from password + srpSalt.
 *
 * @param password    User-supplied password (UTF-8).
 * @param srpSaltHex  Even-length hex string (srpSalt from backend, 64 chars = 32 bytes).
 * @returns           AMK as raw 32-byte Uint8Array.
 */
export async function deriveAmk(password: string, srpSaltHex: string): Promise<Uint8Array> {
  if (!password) {
    throw new Error('deriveAmk: password must be non-empty');
  }

  const result = await argon2(password, srpSaltHex, {
    iterations:   ARGON2_ITERATIONS,
    memory:       ARGON2_MEMORY_KIB,
    parallelism:  ARGON2_PARALLELISM,
    hashLength:   ARGON2_HASH_BYTES,
    mode:         'argon2id',
    saltEncoding: 'hex',   // native RNArgon2.swift does Data(hexString:) → 32 bytes
  });

  const rawHash = result?.rawHash;
  if (typeof rawHash !== 'string' || rawHash.length !== ARGON2_HASH_BYTES * 2) {
    throw new Error('deriveAmk: unexpected Argon2 output');
  }

  // rawHash is a lowercase hex string from native. Convert to Uint8Array.
  const amk = new Uint8Array(ARGON2_HASH_BYTES);
  for (let i = 0; i < ARGON2_HASH_BYTES; i++) {
    amk[i] = parseInt(rawHash.slice(i * 2, i * 2 + 2), 16);
  }
  return amk;
}
