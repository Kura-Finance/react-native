/**
 * App background lock.
 *
 * Phase 3 keeps the user's X25519 private key + derived AES-GCM keys in the
 * in-memory `CryptoSession`. They survive screen-off because the JS thread
 * doesn't get torn down, which means a forgotten / lost device with a logged
 * in user could be re-opened and used to decrypt sensitive snapshots.
 *
 * This module watches `AppState` and clears the crypto session if the app
 * stayed in `background` longer than the configured threshold. Subsequent
 * encrypted reads will throw `No active crypto session` — the UI is expected
 * to prompt the user for their password (which re-derives the KEK and
 * re-bootstraps the keypair via `srpAuthenticate` + `bootstrapSessionAfterLogin`).
 *
 * Token in SecureStore is NOT cleared — that's fine, the auth session itself
 * is intact; only the decryption material is dropped.
 */

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { clearCryptoSession, getCryptoSession } from '../crypto/session';
import Logger from '../../shared/utils/Logger';
import {
  DEFAULT_BACKGROUND_LOCK_MS,
  handleAppStateChange,
} from './appLockReducer';

export { DEFAULT_BACKGROUND_LOCK_MS, handleAppStateChange };

interface AppLockState {
  thresholdMs: number;
  backgroundedAt: number | null;
  subscription: NativeEventSubscription | null;
  /** Override hook for tests. */
  now: () => number;
  /** Override hook for tests. */
  clearSession: () => void;
}

const state: AppLockState = {
  thresholdMs: DEFAULT_BACKGROUND_LOCK_MS,
  backgroundedAt: null,
  subscription: null,
  now: () => Date.now(),
  clearSession: () => clearCryptoSession(),
};

function onAppStateChange(currentStatus: AppStateStatus): void {
  const previousStatus = AppState.currentState;
  const { nextBackgroundedAt, shouldLock } = handleAppStateChange(
    previousStatus,
    currentStatus,
    {
      thresholdMs: state.thresholdMs,
      backgroundedAt: state.backgroundedAt,
      now: state.now,
    },
  );
  state.backgroundedAt = nextBackgroundedAt;

  if (shouldLock && getCryptoSession() !== null) {
    Logger.warn('AppLock', 'Background threshold exceeded; clearing crypto session', {
      thresholdMs: state.thresholdMs,
    });
    state.clearSession();
  }
}

export interface InstallAppLockOptions {
  thresholdMs?: number;
  now?: () => number;
  clearSession?: () => void;
}

/**
 * Subscribe to AppState. Returns a teardown function.
 *
 * Safe to call multiple times — repeated calls reinstall with the new
 * options and clean up the previous subscription.
 */
export function installAppLock(options: InstallAppLockOptions = {}): () => void {
  uninstallAppLock();

  if (typeof options.thresholdMs === 'number' && options.thresholdMs > 0) {
    state.thresholdMs = options.thresholdMs;
  }
  if (options.now) state.now = options.now;
  if (options.clearSession) state.clearSession = options.clearSession;

  state.subscription = AppState.addEventListener('change', onAppStateChange);
  Logger.debug('AppLock', 'AppLock installed', { thresholdMs: state.thresholdMs });
  return uninstallAppLock;
}

export function uninstallAppLock(): void {
  if (state.subscription) {
    state.subscription.remove();
    state.subscription = null;
  }
  state.backgroundedAt = null;
}

/** Test hook: reset to defaults. */
export function __resetAppLockForTesting(): void {
  uninstallAppLock();
  state.thresholdMs = DEFAULT_BACKGROUND_LOCK_MS;
  state.now = () => Date.now();
  state.clearSession = () => clearCryptoSession();
}
