/**
 * Wrapped DataKey helpers.
 *
 * `dataKey` is a random 32-byte secret generated on the client at registration
 * time. It is wrapped under the user's KEK (`dekWrapKey`) and uploaded to the
 * backend as a hex string in the `encryptedDataKey` field.
 *
 * Packed layout (matches Web's `wrapPrivateKey` shape):
 *   iv (12) || ct (32) || tag (16)   = 60 bytes  → 120 hex chars
 *
 * The server treats this as an opaque blob; only the client can recover the
 * original `dataKey` on subsequent logins via `unwrapDataKey`.
 */

import {
  AES_GCM_IV_BYTES,
  AES_GCM_TAG_BYTES,
  aesGcmDecrypt,
  aesGcmEncrypt,
} from '../../crypto/aesgcm';
import { bytesToHex, hexToBytes } from '../../crypto/encoding';
import { randomBytes } from '../../crypto/random';

const DATA_KEY_BYTES = 32;
const WRAPPED_DATA_KEY_BYTES = AES_GCM_IV_BYTES + DATA_KEY_BYTES + AES_GCM_TAG_BYTES; // 60

export function generateDataKey(): Uint8Array {
  return randomBytes(DATA_KEY_BYTES);
}

export function wrapDataKey(dataKey: Uint8Array, dekWrapKey: Uint8Array): string {
  if (dataKey.length !== DATA_KEY_BYTES) {
    throw new Error(`dataKey must be ${DATA_KEY_BYTES} bytes`);
  }
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const ctTag = aesGcmEncrypt(dekWrapKey, iv, dataKey);
  const combined = new Uint8Array(iv.length + ctTag.length);
  combined.set(iv, 0);
  combined.set(ctTag, iv.length);
  return bytesToHex(combined);
}

export function unwrapDataKey(
  encryptedDataKeyHex: string,
  dekWrapKey: Uint8Array,
): Uint8Array {
  const combined = hexToBytes(encryptedDataKeyHex);
  if (combined.length !== WRAPPED_DATA_KEY_BYTES) {
    throw new Error(
      `encryptedDataKey must decode to ${WRAPPED_DATA_KEY_BYTES} bytes (got ${combined.length})`,
    );
  }
  const iv = combined.slice(0, AES_GCM_IV_BYTES);
  const ctTag = combined.slice(AES_GCM_IV_BYTES);
  const plain = aesGcmDecrypt(dekWrapKey, iv, ctTag);
  if (plain.length !== DATA_KEY_BYTES) {
    throw new Error(`unwrapDataKey: unexpected output length ${plain.length}`);
  }
  return plain;
}
