/**
 * X25519 keypair endpoints (`/api/auth/keys/*`).
 *
 * Payload schema (must match backend):
 *   - publicKey:           base64 of raw 32-byte X25519 public key  (44 chars)
 *   - encryptedPrivateKey: base64 of (iv || ct || tag), 16..2048 chars
 */

import { requestJson } from '../client';
import { KuraApiError, UserKeyPairNotFoundError } from '../errors';
import { userKeyPairRecordSchema, type UserKeyPairRecord } from './schemas';

const apiName = 'KeysApi';

const X25519_PUBLIC_KEY_B64_LEN = 44;
const ENCRYPTED_PRIVATE_KEY_MIN_B64 = 16;
const ENCRYPTED_PRIVATE_KEY_MAX_B64 = 2048;

function assertBase64Lengths(publicKey: string, encryptedPrivateKey: string): void {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey) || publicKey.length !== X25519_PUBLIC_KEY_B64_LEN) {
    throw new Error(`publicKey must be ${X25519_PUBLIC_KEY_B64_LEN}-char base64`);
  }
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encryptedPrivateKey) ||
    encryptedPrivateKey.length < ENCRYPTED_PRIVATE_KEY_MIN_B64 ||
    encryptedPrivateKey.length > ENCRYPTED_PRIVATE_KEY_MAX_B64
  ) {
    throw new Error(
      `encryptedPrivateKey must be ${ENCRYPTED_PRIVATE_KEY_MIN_B64}..${ENCRYPTED_PRIVATE_KEY_MAX_B64} base64 chars`,
    );
  }
}

export async function getUserKeyPair(): Promise<UserKeyPairRecord> {
  try {
    const data = await requestJson<unknown>('/api/auth/keys/me', {
      method: 'GET',
      apiName,
    });
    return userKeyPairRecordSchema.parse(data);
  } catch (error) {
    if (error instanceof KuraApiError && (error.status === 404 || error.code === 'KEY_PAIR_NOT_FOUND')) {
      throw new UserKeyPairNotFoundError();
    }
    throw error;
  }
}

export async function setupUserKeyPair(
  publicKey: string,
  encryptedPrivateKey: string,
): Promise<UserKeyPairRecord> {
  assertBase64Lengths(publicKey, encryptedPrivateKey);
  const data = await requestJson<unknown>('/api/auth/keys/setup', {
    method: 'POST',
    body: JSON.stringify({ publicKey, encryptedPrivateKey }),
    apiName,
  });
  return userKeyPairRecordSchema.parse(data);
}

export async function rotateUserKeyPair(
  publicKey: string,
  encryptedPrivateKey: string,
): Promise<UserKeyPairRecord> {
  assertBase64Lengths(publicKey, encryptedPrivateKey);
  const data = await requestJson<unknown>('/api/auth/keys/rotate', {
    method: 'POST',
    body: JSON.stringify({ publicKey, encryptedPrivateKey }),
    apiName,
  });
  return userKeyPairRecordSchema.parse(data);
}
