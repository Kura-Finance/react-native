/**
 * Local encrypted cache key (cacheKey).
 *
 * This is a random 32-byte AES-256 key stored in SecureStore (Keychain).
 * It is completely independent from the E2EE CryptoSession:
 *   - CryptoSession   = derived from password (Argon2 + HKDF) — NOT persistent
 *   - cacheKey        = random, stored in SecureStore — persists across JS reloads
 *
 * The cacheKey encrypts the locally-cached plaintext financial data so that
 * even if the JS CryptoSession is lost (e.g. after a Metro hot-reload in dev or
 * after the app background-lock clears the session), the UI can still render
 * last-known data while prompting the user to refresh/re-auth for fresh data.
 *
 * Security model:
 *   - Data at rest: AES-256-GCM with a key in the OS Keychain.
 *     Equivalent to how most banking apps protect cached data.
 *   - An attacker with physical unlocked device access could extract the key
 *     from Keychain and decrypt cached data — same threat model as any banking app.
 *   - The backend never sees plaintext (zero-access is preserved).
 */

import * as SecureStore from 'expo-secure-store';
import { randomBytes } from '../crypto/random';
import { bytesToBase64, base64ToBytes } from '../crypto/encoding';

const CACHE_KEY_STORAGE_KEY = 'kura.cache.aes256.key';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

let _cacheKey: Uint8Array | null = null;

/**
 * Load or generate the local cache AES key.
 *
 * - On first call after install: generates 32 random bytes, stores in Keychain.
 * - On subsequent calls: reads from Keychain.
 * - The key is held in a module-level variable to avoid repeated Keychain reads.
 */
export async function getCacheKey(): Promise<Uint8Array> {
  if (_cacheKey) return _cacheKey;

  let stored = await SecureStore.getItemAsync(CACHE_KEY_STORAGE_KEY, SECURE_OPTIONS);
  if (!stored) {
    const key = randomBytes(32);
    stored = bytesToBase64(key);
    await SecureStore.setItemAsync(CACHE_KEY_STORAGE_KEY, stored, SECURE_OPTIONS);
    _cacheKey = key;
  } else {
    _cacheKey = base64ToBytes(stored);
  }
  return _cacheKey;
}

/** Clear the in-memory cache key reference (e.g. on logout). */
export function clearCacheKeyMemory(): void {
  if (_cacheKey) _cacheKey.fill(0);
  _cacheKey = null;
}

/** Permanently delete the cache key (e.g. on account deletion). */
export async function deleteCacheKey(): Promise<void> {
  clearCacheKeyMemory();
  await SecureStore.deleteItemAsync(CACHE_KEY_STORAGE_KEY, SECURE_OPTIONS);
}
