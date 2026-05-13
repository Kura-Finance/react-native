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
 */

import { StateCreator } from 'zustand';
import { AssetSnapshot, FinanceState, HistoryState } from './types';
import { fetchAssetHistory } from '../../../lib/api/asset';
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
      Logger.debug('HistorySlice', 'Fetching encrypted asset history', { days });
      const points = await fetchAssetHistory(days);
      const snapshots = points.map(toAssetSnapshot);

      set({
        assetHistory: snapshots,
        lastRecordedTime: Date.now(),
        lastFetchedDays: days,
        isLoadingAssetHistory: false,
      });

      Logger.info('HistorySlice', 'Asset history hydrated', {
        points: snapshots.length,
        firstDate: snapshots[0]?.date,
        lastDate: snapshots[snapshots.length - 1]?.date,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch asset history';
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
