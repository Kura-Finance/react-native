/**
 * HKDF-SHA-256 wrapper aligned with WebClient.
 *
 * The four info strings below MUST match `app/lib/crypto/keyDerivation.ts` on
 * the web side. Any drift breaks cross-client compatibility for the same user.
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from './encoding';

export const HKDF_INFO_WRAP = 'kura-finance-wrap-v1';
export const HKDF_INFO_LOCAL_CACHE = 'kura-finance-local-cache-v1';
export const HKDF_INFO_AUTH = 'kura-finance-auth-v1';
export const HKDF_INFO_SESSION = 'kura-finance-session-v1';

export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string,
  length: number,
): Uint8Array {
  return hkdf(sha256, ikm, salt, utf8ToBytes(info), length);
}
