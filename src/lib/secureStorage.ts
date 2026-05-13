/**
 * Secure storage for high-sensitivity material:
 *   - JWT auth token
 *   - locally cached kekSalt / encryptedDataKey (hex), if we ever need to
 *     pre-fill SRP salt without a network round-trip
 *
 * Anything that lives here MUST NOT be put in AsyncStorage, redux devtools,
 * or any log line.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../shared/utils/Logger';

export const STORAGE_KEYS = {
  authToken: 'kura.auth.token',
} as const;

const LEGACY_TOKEN_KEY = 'kura.auth.token';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

function isSecureStoreAvailable(): boolean {
  return typeof SecureStore.setItemAsync === 'function';
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (!value || typeof value !== 'string') {
    throw new Error('setSecureItem: value must be a non-empty string');
  }
  if (!isSecureStoreAvailable()) {
    throw new Error('SecureStore is not available on this platform');
  }
  await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (!isSecureStoreAvailable()) return null;
  try {
    return await SecureStore.getItemAsync(key, SECURE_OPTIONS);
  } catch (error) {
    Logger.warn('SecureStorage', 'getItemAsync failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (!isSecureStoreAvailable()) return;
  try {
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
  } catch (error) {
    Logger.warn('SecureStorage', 'deleteItemAsync failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const secureAuthTokenStore = {
  async get(): Promise<string | null> {
    return getSecureItem(STORAGE_KEYS.authToken);
  },
  async set(token: string): Promise<void> {
    await setSecureItem(STORAGE_KEYS.authToken, token);
  },
  async clear(): Promise<void> {
    await deleteSecureItem(STORAGE_KEYS.authToken);
  },
};

/**
 * Move an existing AsyncStorage-stored token (legacy) into SecureStore on the
 * first run. Idempotent and safe to call on every cold start.
 */
export async function migrateLegacyTokenToSecureStore(): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (!legacy) return;

    const existingSecure = await secureAuthTokenStore.get();
    if (!existingSecure) {
      await secureAuthTokenStore.set(legacy);
      Logger.info('SecureStorage', 'Migrated legacy auth token from AsyncStorage');
    }

    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch (error) {
    Logger.warn('SecureStorage', 'Token migration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
