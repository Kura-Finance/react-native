/**
 * Asset history slice — Phase 3.
 *
 * Error + cache strategy:
 *   ┌─ Live fetch fails
 *   │
 *   ├─ "No active crypto session" (AppLock fired)
 *   │     → Biometric restore (Face ID / Touch ID)
 *   │         → success : rebuild partial session → decrypt raw cache → show data
 *   │         → failure : no biometric key or cancelled → logout()
 *   │
 *   └─ Any other error (network, 5xx, …)
 *         → Decrypt raw cache with existing CryptoSession (stale-data UX)
 *         → No biometric prompt for non-session errors
 */

import { StateCreator } from 'zustand';
import { AssetSnapshot, FinanceState, HistoryState } from './types';
import { fetchAssetHistory, fetchAssetHistoryFromCache } from '../../../lib/api/asset';
import { restoreWithBiometrics } from '../../../lib/security/biometricSession';
import { setCryptoSession } from '../../../lib/crypto/session';
import { base64ToBytes } from '../../../lib/crypto/encoding';
import Logger from '../../utils/Logger';
import { isStablecoin } from '../../utils/stablecoinUtils';

const DEFAULT_DAYS = 365;

function isNoSessionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('No active crypto session');
}

function toAssetSnapshot(point: {
  date: string;
  cashFlow: number;
  plaidInvestment: number;
  cryptoSpot: number;
  defiProtocol: number;
  totalAssets: number;
}): AssetSnapshot {
  return {
    date: point.date,
    timestamp: Date.parse(`${point.date}T00:00:00.000Z`),
    cashFlow: point.cashFlow,
    plaidInvestment: point.plaidInvestment,
    cryptoSpot: point.cryptoSpot,
    defiProtocol: point.defiProtocol,
    totalAssets: point.totalAssets,
  };
}

export const createHistorySlice: StateCreator<FinanceState, [], [], HistoryState> = (set, get) => ({
  assetHistory: [],
  lastRecordedTime: null,
  lastFetchedDays: null,
  isLoadingAssetHistory: false,
  assetHistoryError: null,

  calculateTotalAssets: () => {
    const state = get();
    const investmentValue = state.investments.reduce((sum, investment) => {
      if (isStablecoin(investment.symbol)) return sum;
      return sum + investment.holdings * investment.currentPrice;
    }, 0);
    return investmentValue;
  },

  hydrateAssetHistory: async (days: number = DEFAULT_DAYS) => {
    set({ isLoadingAssetHistory: true, assetHistoryError: null });
    try {
      const points = await fetchAssetHistory(days);
      const snapshots = points.map(toAssetSnapshot);

      set({
        assetHistory: snapshots,
        lastRecordedTime: Date.now(),
        lastFetchedDays: days,
        isLoadingAssetHistory: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch asset history';

      // ── Session expired (AppLock cleared CryptoSession) ──────────────────
      if (isNoSessionError(error)) {
        Logger.warn('HistorySlice', 'Session expired; attempting biometric restore');
        try {
          const keys = await restoreWithBiometrics();
          if (keys) {
            setCryptoSession({
              x25519PrivateKey: keys.x25519PrivateKey,
              x25519PublicKeyBase64: keys.x25519PublicKeyBase64,
              dekWrapKey: new Uint8Array(32),
              localCacheKey: new Uint8Array(32),
            });

            const points = await fetchAssetHistoryFromCache(
              {},
              {
                privateKey: keys.x25519PrivateKey,
                publicKey: base64ToBytes(keys.x25519PublicKeyBase64),
              },
            );
            if (points) {
              const snapshots = points.map(toAssetSnapshot);
              Logger.warn('HistorySlice', 'Serving asset history from biometric-restored cache', {
                points: snapshots.length,
              });
              set({ assetHistory: snapshots, isLoadingAssetHistory: false });
              return;
            }
          }
        } catch (biometricError) {
          Logger.warn('HistorySlice', 'Biometric restore threw', {
            error: biometricError instanceof Error ? biometricError.message : String(biometricError),
          });
        }

        // Biometric not available, no stored key, or user cancelled → logout.
        Logger.warn('HistorySlice', 'Biometric restore unavailable; forcing logout');
        set({ isLoadingAssetHistory: false });
        const { useAppStore } = await import('../useAppStore');
        void useAppStore.getState().logout();
        return;
      }

      // ── Network / API error with valid session — show stale cache ────────
      try {
        const points = await fetchAssetHistoryFromCache();
        if (points) {
          const snapshots = points.map(toAssetSnapshot);
          Logger.warn('HistorySlice', 'Network error; serving asset history from local cache', {
            message,
            points: snapshots.length,
          });
          set({ assetHistory: snapshots, isLoadingAssetHistory: false });
          return;
        }
      } catch {
        // cache miss — fall through to error state
      }

      Logger.warn('HistorySlice', 'Asset history hydration failed', { message });
      set({ isLoadingAssetHistory: false, assetHistoryError: message });
    }
  },

  clearAssetHistory: () => {
    Logger.info('HistorySlice', 'Clearing asset history');
    set({
      assetHistory: [],
      lastRecordedTime: null,
      lastFetchedDays: null,
      assetHistoryError: null,
    });
  },
});
