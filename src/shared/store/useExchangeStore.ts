/**
 * Exchange store — Phase 3.
 *
 * Holds the user's connected exchange accounts + the latest decrypted
 * balance/asset snapshot per account. Projects assets onto `Investment[]`
 * for the unified investment screen.
 *
 * Encryption is invisible above this layer — `fetchExchangeSnapshot` from
 * `lib/api/exchange` handles sealed-box unwrap + AES-GCM row decrypt.
 */

import { create } from 'zustand';
import {
  disconnectExchange as disconnectExchangeApi,
  fetchExchangeSnapshot,
  getExchangeAccounts,
  type ExchangeAccount,
  type ExchangeAsset,
  type ExchangeBalance,
  type RateLimitInfo,
} from '../../lib/api/exchange';
import Logger from '../utils/Logger';
import { isStablecoin, normalizeInvestmentPrice } from '../utils/stablecoinUtils';
import type { Investment, InvestmentAccount } from './finance/types';

interface ExchangeStoreState {
  exchangeAccounts: ExchangeAccount[];
  exchangeInvestmentAccounts: InvestmentAccount[];
  exchangeInvestments: Investment[];
  /** Raw decrypted balances keyed by `exchangeAccountId`. */
  exchangeBalances: Record<string, ExchangeBalance[]>;
  /** Raw decrypted enriched assets keyed by `exchangeAccountId`. */
  exchangeAssets: Record<string, ExchangeAsset[]>;
  isLoading: Record<string, boolean>;
  error: string | null;
  lastSyncedTime: Record<string, number | null>;
  rateLimitInfo: Record<string, RateLimitInfo | null>;

  addExchangeAccount: (account: ExchangeAccount) => void;
  removeExchangeAccount: (exchangeAccountId: string) => void;
  hydrateExchangeAccounts: (token: string) => Promise<void>;
  fetchExchangeBalances: (exchangeAccountId: string, token: string) => Promise<void>;
  setRateLimitInfo: (exchangeAccountId: string, rateLimitInfo: RateLimitInfo | null) => void;
  setLoading: (exchangeAccountId: string, loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAll: () => void;

  getTotalExchangeValue: () => number;
  getExchangeAccountIds: () => string[];
}

function assetToInvestment(
  asset: ExchangeAsset,
  accountId: string,
  exchangeName: string,
): Investment {
  const normalizedPrice = normalizeInvestmentPrice(asset.symbol, asset.price);
  const usdValue = asset.value || asset.holdings * normalizedPrice;

  if (asset.price === 0 && !isStablecoin(asset.symbol)) {
    Logger.warn('ExchangeStore', 'Zero USD price for non-stablecoin asset', {
      symbol: asset.symbol,
      total: asset.holdings,
      exchange: exchangeName,
    });
  }

  return {
    id: `${accountId}-${asset.symbol}`,
    accountId,
    symbol: asset.symbol,
    name: asset.symbol,
    holdings: asset.holdings,
    currentPrice: normalizedPrice,
    change24h: 0,
    usdValue,
    type: 'crypto',
    logo: '',
  };
}

export const useExchangeStore = create<ExchangeStoreState>((set, get) => ({
  exchangeAccounts: [],
  exchangeInvestmentAccounts: [],
  exchangeInvestments: [],
  exchangeBalances: {},
  exchangeAssets: {},
  isLoading: {},
  error: null,
  lastSyncedTime: {},
  rateLimitInfo: {},

  addExchangeAccount: (account) => {
    set((state) => {
      if (state.exchangeAccounts.some((existing) => existing.id === account.id)) {
        return state;
      }
      Logger.info('ExchangeStore', 'Added exchange account', {
        exchange: account.exchange,
        accountId: account.id,
      });
      return { exchangeAccounts: [...state.exchangeAccounts, account] };
    });
  },

  removeExchangeAccount: (exchangeAccountId) => {
    Logger.info('ExchangeStore', 'Removing exchange account', { exchangeAccountId });
    set((state) => ({
      exchangeAccounts: state.exchangeAccounts.filter((acc) => acc.id !== exchangeAccountId),
      exchangeInvestmentAccounts: state.exchangeInvestmentAccounts.filter(
        (inv) => inv.id !== exchangeAccountId,
      ),
      exchangeInvestments: state.exchangeInvestments.filter(
        (inv) => inv.accountId !== exchangeAccountId,
      ),
      exchangeBalances: { ...state.exchangeBalances, [exchangeAccountId]: [] },
      exchangeAssets: { ...state.exchangeAssets, [exchangeAccountId]: [] },
      lastSyncedTime: { ...state.lastSyncedTime, [exchangeAccountId]: null },
      rateLimitInfo: { ...state.rateLimitInfo, [exchangeAccountId]: null },
    }));
  },

  hydrateExchangeAccounts: async (_token: string) => {
    try {
      const accounts = await getExchangeAccounts();
      Logger.info('ExchangeStore', 'Exchange accounts hydrated', { count: accounts.length });
      set({ exchangeAccounts: accounts });

      // Mirror into useFinanceStore.exchangeAccounts for the dashboard.
      const { useFinanceStore } = await import('./useFinanceStore');
      accounts.forEach((account) => {
        useFinanceStore.getState().addExchangeAccount({
          id: account.id,
          exchange: account.exchange,
          exchangeDisplayName: account.exchangeDisplayName,
          icon: account.icon,
          isVerified: account.isVerified,
          isActive: account.isActive ?? true,
          lastVerifiedAt: account.lastVerifiedAt ?? '',
        });
      });
    } catch (error) {
      Logger.warn('ExchangeStore', 'Failed to hydrate exchange accounts', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  fetchExchangeBalances: async (exchangeAccountId, _token) => {
    set((state) => ({
      isLoading: { ...state.isLoading, [exchangeAccountId]: true },
      error: null,
    }));

    try {
      const account = get().exchangeAccounts.find((acc) => acc.id === exchangeAccountId);
      if (!account) {
        throw new Error(`Exchange account ${exchangeAccountId} not found in store`);
      }

      const snapshot = await fetchExchangeSnapshot(exchangeAccountId);

      Logger.info('ExchangeStore', 'Exchange snapshot decrypted', {
        exchangeAccountId,
        balanceCount: snapshot.balances.length,
        assetCount: snapshot.assets.length,
        assetsUsdTotal: snapshot.assetsUsdTotal,
        decryptionFailures: snapshot.decryptionFailureCount,
      });

      const investmentAccount: InvestmentAccount = {
        id: exchangeAccountId,
        name: snapshot.account.displayName,
        type: 'Exchange',
        logo: snapshot.account.icon,
      };

      const investments = snapshot.assets.map((asset) =>
        assetToInvestment(asset, exchangeAccountId, snapshot.account.exchange),
      );

      set((state) => ({
        exchangeAccounts: state.exchangeAccounts.map((acc) =>
          acc.id === exchangeAccountId ? { ...acc, lastVerifiedAt: new Date().toISOString() } : acc,
        ),
        exchangeBalances: {
          ...state.exchangeBalances,
          [exchangeAccountId]: snapshot.balances,
        },
        exchangeAssets: {
          ...state.exchangeAssets,
          [exchangeAccountId]: snapshot.assets,
        },
        exchangeInvestmentAccounts: [
          ...state.exchangeInvestmentAccounts.filter((inv) => inv.id !== exchangeAccountId),
          investmentAccount,
        ],
        exchangeInvestments: [
          ...state.exchangeInvestments.filter((inv) => inv.accountId !== exchangeAccountId),
          ...investments,
        ],
        lastSyncedTime: { ...state.lastSyncedTime, [exchangeAccountId]: Date.now() },
        rateLimitInfo: {
          ...state.rateLimitInfo,
          [exchangeAccountId]: snapshot.rateLimitInfo ?? null,
        },
        isLoading: { ...state.isLoading, [exchangeAccountId]: false },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch exchange balances';
      Logger.warn('ExchangeStore', 'Failed to fetch exchange balances', {
        exchangeAccountId,
        message,
      });
      set((state) => ({
        isLoading: { ...state.isLoading, [exchangeAccountId]: false },
        error: message,
      }));
      throw error;
    }
  },

  setRateLimitInfo: (exchangeAccountId, rateLimitInfo) => {
    set((state) => ({
      rateLimitInfo: { ...state.rateLimitInfo, [exchangeAccountId]: rateLimitInfo },
    }));
  },

  setLoading: (exchangeAccountId, loading) => {
    set((state) => ({
      isLoading: { ...state.isLoading, [exchangeAccountId]: loading },
    }));
  },

  setError: (error) => set({ error }),

  clearAll: () => {
    Logger.warn('ExchangeStore', 'Clearing all exchange data');
    set({
      exchangeAccounts: [],
      exchangeInvestmentAccounts: [],
      exchangeInvestments: [],
      exchangeBalances: {},
      exchangeAssets: {},
      isLoading: {},
      error: null,
      lastSyncedTime: {},
      rateLimitInfo: {},
    });
  },

  getTotalExchangeValue: () => {
    const { exchangeAssets } = get();
    let total = 0;
    for (const list of Object.values(exchangeAssets)) {
      for (const asset of list) total += asset.value;
    }
    return total;
  },

  getExchangeAccountIds: () => get().exchangeAccounts.map((acc) => acc.id),
}));

export { disconnectExchangeApi };
