/**
 * Asset history slice — Phase 3.
 *
 * Previously this slice produced snapshots client-side from live Plaid /
 * Exchange / Web3 state. With Zero-Access E2EE the backend records snapshots
 * **at sync time** (when it briefly holds the plaintext SEK) and we read
 * them back from `/api/assets/history/encrypted`, decrypt, then aggregate.
 *
 * Consumer interface (`assetHistory: AssetSnapshot[]` with `timestamp` ms +
 * `totalAssets`) is preserved so `WaveChart` / `PerformanceSummary` keep
 * working unchanged.
 *
 * Cache strategy:
 *   - On success: `fetchAssetHistory` internally writes the raw encrypted
 *     envelope to AsyncStorage (no re-encryption).
 *   - On failure (network error or CryptoSession cleared by AppLock):
 *     prompt biometric auth → restore X25519 private key → decrypt raw cache.
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

      // Try biometric restore → decrypt raw cache.
      Logger.warn('HistorySlice', 'Live fetch failed; attempting biometric cache restore', {
        message,
      });
      try {
        const keys = await restoreWithBiometrics();
        if (keys) {
          // Rebuild a partial CryptoSession so subsequent fresh fetches also work.
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
            set({
              assetHistory: snapshots,
              isLoadingAssetHistory: false,
            });
            return;
          }
        }
      } catch (biometricError) {
        Logger.warn('HistorySlice', 'Biometric cache restore failed', {
          error:
            biometricError instanceof Error ? biometricError.message : String(biometricError),
        });
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
