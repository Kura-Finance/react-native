/**
 * Password → derived keys, X25519 keypair wrap/unwrap, and the Phase 3 hybrid
 * envelope decrypt routine.
 *
 * 1:1 port of WebClient/app/lib/crypto/keyDerivation.ts, adapted from Web
 * Crypto API to `@noble/*` + `react-native-argon2`. The constants are kept in
 * sync via shared modules (`./argon2`, `./hkdf`, `./aesgcm`).
 *
 * Memory hygiene: callers should `zeroize()` `privateKey` / derived `dekWrapKey`
 * material when their lifetime ends.
 */

import { deriveAmk } from './argon2';
import {
  HKDF_INFO_AUTH,
  HKDF_INFO_LOCAL_CACHE,
  HKDF_INFO_SESSION,
  HKDF_INFO_WRAP,
  hkdfSha256,
} from './hkdf';
import {
  AES_GCM_IV_BYTES,
  AES_GCM_TAG_BYTES,
  aesGcmDecrypt,
  aesGcmEncrypt,
} from './aesgcm';
import { deriveSharedSecret, generateX25519KeyPair, X25519_KEY_BYTES } from './x25519';
import {
  assertHexBytes,
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToBytes,
  isEvenHex,
} from './encoding';
import { randomBytes } from './random';

const SUBKEY_BYTES = 32;
const WRAPPED_PRIVATE_KEY_BYTES = AES_GCM_IV_BYTES + X25519_KEY_BYTES + AES_GCM_TAG_BYTES; // 60

export interface DerivedKeys {
  /** AES-256-GCM key used to wrap/unwrap the X25519 privateKey. 32 raw bytes. */
  dekWrapKey: Uint8Array;
  /** AES-256-GCM key used by the local encrypted cache. 32 raw bytes. */
  localCacheKey: Uint8Array;
  /** SRP authentication key, hex-encoded. */
  authKeyHex: string;
}

export async function deriveKeysFromPassword(
  password: string,
  srpSaltHex: string,
  kekSaltHex: string,
): Promise<DerivedKeys> {
  if (!isEvenHex(srpSaltHex) || !isEvenHex(kekSaltHex)) {
    throw new Error('deriveKeysFromPassword: srpSalt and kekSalt must be even-length hex');
  }

  const amk = await deriveAmk(password, srpSaltHex);
  const kekSalt = hexToBytes(kekSaltHex);
  try {
    const dekWrapKey = hkdfSha256(amk, kekSalt, HKDF_INFO_WRAP, SUBKEY_BYTES);
    const localCacheKey = hkdfSha256(amk, kekSalt, HKDF_INFO_LOCAL_CACHE, SUBKEY_BYTES);
    const authKey = hkdfSha256(amk, kekSalt, HKDF_INFO_AUTH, SUBKEY_BYTES);
    return {
      dekWrapKey,
      localCacheKey,
      authKeyHex: bytesToHex(authKey),
    };
  } finally {
    amk.fill(0);
  }
}

/** Generate a random 32-byte salt and return it as 64-char hex. */
export function generateSaltHex(): string {
  return bytesToHex(randomBytes(32));
}

// ─────────────────────────────────────────
// X25519 keypair wrap / unwrap
// ─────────────────────────────────────────

export interface WrappedKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyBase64: string;
}

export function generateWrappedReadyKeyPair(): WrappedKeyPair {
  const { privateKey, publicKey } = generateX25519KeyPair();
  return {
    privateKey,
    publicKey,
    publicKeyBase64: bytesToBase64(publicKey),
  };
}

/**
 * AES-GCM(dekWrapKey) → base64(iv(12) || ct(32) || tag(16)) = 60 bytes → 80 b64 chars.
 */
export function wrapPrivateKey(privateKey: Uint8Array, dekWrapKey: Uint8Array): string {
  if (privateKey.length !== X25519_KEY_BYTES) {
    throw new Error(`wrapPrivateKey: privateKey must be ${X25519_KEY_BYTES} bytes`);
  }
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const ctTag = aesGcmEncrypt(dekWrapKey, iv, privateKey);
  const combined = new Uint8Array(iv.length + ctTag.length);
  combined.set(iv, 0);
  combined.set(ctTag, iv.length);
  return bytesToBase64(combined);
}

/**
 * Reverse {@link wrapPrivateKey}. Throws on any decoding/auth failure; callers
 * may use that signal to fall back to keypair rotation (lazy recovery).
 */
export function unwrapPrivateKey(
  encryptedPrivateKeyBase64: string,
  dekWrapKey: Uint8Array,
): Uint8Array {
  const combined = base64ToBytes(encryptedPrivateKeyBase64);
  if (combined.length !== WRAPPED_PRIVATE_KEY_BYTES) {
    throw new Error(
      `encryptedPrivateKey must decode to ${WRAPPED_PRIVATE_KEY_BYTES} bytes (got ${combined.length})`,
    );
  }
  const iv = combined.slice(0, AES_GCM_IV_BYTES);
  const ctTag = combined.slice(AES_GCM_IV_BYTES);
  const plain = aesGcmDecrypt(dekWrapKey, iv, ctTag);
  if (plain.length !== X25519_KEY_BYTES) {
    throw new Error(`unwrapPrivateKey: unexpected output length ${plain.length}`);
  }
  return plain;
}

// ─────────────────────────────────────────
// Hybrid envelope (ECDH+HKDF+AES-GCM) — backend → client
// ─────────────────────────────────────────

/**
 * Hybrid envelope produced by the backend.
 *
 * Backend pipeline (must align):
 *   1. ephemeral X25519 keypair (eph_priv, eph_pub)
 *   2. sharedSecret = X25519(eph_priv, user_pub)
 *   3. sessionKey   = HKDF-SHA256(ikm=sharedSecret, salt=eph_pub,
 *                                  info="kura-finance-session-v1", L=32)
 *   4. ciphertext   = AES-256-GCM(sessionKey, iv, plaintext)   // includes 16B tag
 *   5. emit { ephemeralPublicKey, iv, ciphertext } in hex
 */
export interface EncryptedEnvelope {
  ephemeralPublicKey: string;
  iv: string;
  ciphertext: string;
}

const SESSION_KEY_BYTES = 32;

export function decryptServerEnvelope(
  envelope: EncryptedEnvelope,
  recipientPrivateKey: Uint8Array,
): Uint8Array {
  const ephPub = assertHexBytes(envelope.ephemeralPublicKey, X25519_KEY_BYTES, 'ephemeralPublicKey');
  const iv = assertHexBytes(envelope.iv, AES_GCM_IV_BYTES, 'iv');
  const ctHex = envelope.ciphertext.trim().toLowerCase();
  if (!isEvenHex(ctHex) || ctHex.length === 0) {
    throw new Error('ciphertext must be a non-empty even-length hex string');
  }
  const ciphertext = hexToBytes(ctHex);

  const sharedSecret = deriveSharedSecret(recipientPrivateKey, ephPub);
  try {
    const sessionKey = hkdfSha256(sharedSecret, ephPub, HKDF_INFO_SESSION, SESSION_KEY_BYTES);
    try {
      return aesGcmDecrypt(sessionKey, iv, ciphertext);
    } finally {
      sessionKey.fill(0);
    }
  } finally {
    sharedSecret.fill(0);
  }
}
