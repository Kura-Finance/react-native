/**
 * Local encrypted data cache.
 *
 * Serialises arbitrary data as JSON → encrypts with AES-256-GCM (cacheKey) →
 * stores in AsyncStorage. On reload (CryptoSession gone), reads cached plaintext
 * so the UI doesn't show empty screens.
 *
 * Cache entry format in AsyncStorage:
 *   { v: 1, iv: base64(12B), ct: base64(iv|tag|ciphertext), ts: ISO }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCacheKey } from './cacheKey';
import { aesGcmEncrypt, aesGcmDecrypt, AES_GCM_IV_BYTES, AES_GCM_TAG_BYTES } from '../crypto/aesgcm';
import { randomBytes } from '../crypto/random';
import { bytesToBase64, base64ToBytes, bytesToUtf8, utf8ToBytes } from '../crypto/encoding';
import Logger from '../../shared/utils/Logger';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'kura.datacache.';

interface CacheEntry {
  v: number;
  /** base64 of: iv(12) | tag(16) | ciphertext */
  ct: string;
  /** ISO timestamp of when the entry was written */
  ts: string;
}

// ─────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────

export async function writeCache<T>(namespace: string, data: T): Promise<void> {
  try {
    const cacheKey = await getCacheKey();
    const plaintext = utf8ToBytes(JSON.stringify(data));
    const iv = randomBytes(AES_GCM_IV_BYTES);
    const ctTag = aesGcmEncrypt(cacheKey, iv, plaintext);

    // Pack: iv | tag | ct  (iv=12, tag=16, ct=rest)
    // ctTag from noble = ct || tag, so re-order to match our unpackIvTagCt convention
    const ct = ctTag.slice(0, ctTag.length - AES_GCM_TAG_BYTES);
    const tag = ctTag.slice(ctTag.length - AES_GCM_TAG_BYTES);
    const packed = new Uint8Array(iv.length + tag.length + ct.length);
    packed.set(iv, 0);
    packed.set(tag, iv.length);
    packed.set(ct, iv.length + tag.length);

    const entry: CacheEntry = {
      v: CACHE_VERSION,
      ct: bytesToBase64(packed),
      ts: new Date().toISOString(),
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${namespace}`, JSON.stringify(entry));
  } catch (error) {
    Logger.warn('DataCache', `Write failed for ${namespace}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────

export interface CacheResult<T> {
  data: T;
  /** ISO timestamp the cache was last written */
  cachedAt: string;
}

export async function readCache<T>(namespace: string): Promise<CacheResult<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${namespace}`);
    if (!raw) return null;

    const entry: CacheEntry = JSON.parse(raw);
    if (entry.v !== CACHE_VERSION) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${namespace}`);
      return null;
    }

    const cacheKey = await getCacheKey();
    const packed = base64ToBytes(entry.ct);
    if (packed.length < AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES) return null;

    const iv  = packed.slice(0, AES_GCM_IV_BYTES);
    const tag = packed.slice(AES_GCM_IV_BYTES, AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES);
    const ct  = packed.slice(AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES);

    // noble gcm.decrypt expects ct || tag
    const ctWithTag = new Uint8Array(ct.length + tag.length);
    ctWithTag.set(ct, 0);
    ctWithTag.set(tag, ct.length);

    const plain = aesGcmDecrypt(cacheKey, iv, ctWithTag);
    const data: T = JSON.parse(bytesToUtf8(plain));
    return { data, cachedAt: entry.ts };
  } catch (error) {
    Logger.warn('DataCache', `Read failed for ${namespace}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${namespace}`).catch(() => {});
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Delete / Clear
// ─────────────────────────────────────────────────────────────

export async function deleteCache(namespace: string): Promise<void> {
  await AsyncStorage.removeItem(`${CACHE_PREFIX}${namespace}`).catch(() => {});
}

export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // best-effort
  }
}
