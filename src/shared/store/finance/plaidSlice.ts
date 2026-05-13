/**
 * Plaid slice — hydrates the finance store from the Phase 3 encrypted
 * snapshot endpoint and projects the decrypted records onto the store-facing
 * `Account` / `Transaction` / `InvestmentAccount` / `Investment` shapes.
 *
 * The actual fetch + decrypt is in `src/lib/api/plaid/client.ts`; this slice
 * only owns the projection + state wiring.
 */

import { StateCreator } from 'zustand';
import {
  fetchPlaidFinanceSnapshot,
  type PlaidAccount,
  type PlaidInvestment,
  type PlaidInvestmentAccount,
  type PlaidTransaction,
} from '../../../lib/api/plaid';
import { KuraApiError } from '../../../lib/api/errors';
import Logger from '../../utils/Logger';
import { readCache, writeCache } from '../../../lib/cache/dataCache';

const PLAID_CACHE_NS = 'plaid.snapshot';

interface PlaidCacheShape {
  accounts: PlaidAccount[];
  transactions: PlaidTransaction[];
  investmentAccounts: PlaidInvestmentAccount[];
  investments: PlaidInvestment[];
  lastSyncedAt: string | null;
}
import {
  Account,
  AccountBucket,
  BankingAccountType,
  FinanceState,
  Investment,
  InvestmentAccount,
  InvestmentHoldingType,
  PlaidState,
  Transaction,
} from './types';

function toStoreAccount(acc: PlaidAccount): Account {
  return {
    id: acc.accountId,
    name: acc.name,
    balance: acc.balance,
    type: acc.type as BankingAccountType,
    logo: acc.logo,
    bucket: acc.bucket as AccountBucket,
    plaidItemId: acc.plaidItemId,
    institutionName: acc.institutionName,
    plaidLogo: acc.plaidLogo,
    apy: acc.apy,
    mask: acc.mask,
    cachedAt: acc.cachedAt,
  };
}

function toStoreTransaction(tx: PlaidTransaction): Transaction {
  return {
    id: tx.transactionId,
    accountId: tx.accountId,
    accountName: tx.accountName ?? '',
    accountType: (tx.accountType as BankingAccountType) ?? 'checking',
    amount: tx.amount,
    date: tx.date,
    merchant: tx.merchant,
    category: tx.category,
    type: tx.type,
    month: tx.month,
    isPending: tx.isPending,
    isRecurring: tx.isRecurring,
    isSubscription: tx.isSubscription,
    personalFinanceCategory: tx.personalFinanceCategory,
    recurringFrequency: tx.recurringFrequency,
    enrichedMerchantName: tx.enrichedMerchantName,
    merchantLogo: tx.merchantLogo,
    plaidMerchantLogo: tx.plaidMerchantLogo,
    merchantCategory: tx.merchantCategory,
    plaidItemId: tx.plaidItemId,
    cachedAt: tx.cachedAt,
  };
}

function toStoreInvestmentAccount(acc: PlaidInvestmentAccount): InvestmentAccount {
  return {
    id: acc.accountId,
    name: acc.name,
    type: 'Broker',
    logo: acc.logo,
    institutionName: acc.institutionName,
    plaidLogo: acc.plaidLogo,
    cachedAt: acc.cachedAt,
  };
}

function toStoreInvestment(inv: PlaidInvestment): Investment {
  const usdValue = inv.holdings * inv.currentPrice;
  return {
    id: inv.investmentId,
    accountId: inv.accountId,
    symbol: inv.symbol,
    name: inv.name,
    holdings: inv.holdings,
    currentPrice: inv.currentPrice,
    change24h: inv.change24h ?? 0,
    usdValue,
    type: inv.type as InvestmentHoldingType,
    logo: inv.logo,
    cachedAt: inv.cachedAt,
  };
}

export const createPlaidSlice: StateCreator<FinanceState, [], [], PlaidState> = (set) => ({
  isLoadingPlaidData: false,
  plaidError: null,
  lastRefreshInfo: null,
  cacheSource: null,

  hydratePlaidFinanceData: async (_token: string, _refresh: boolean = false) => {
    try {
      set({ isLoadingPlaidData: true, plaidError: null });

      const snapshot = await fetchPlaidFinanceSnapshot();

      // Persist plaintext to local encrypted cache so data survives a JS reload
      // even when the CryptoSession is not available.
      void writeCache<PlaidCacheShape>(PLAID_CACHE_NS, {
        accounts: snapshot.accounts,
        transactions: snapshot.transactions,
        investmentAccounts: snapshot.investmentAccounts,
        investments: snapshot.investments,
        lastSyncedAt: snapshot.lastSyncedAt,
      });

      const nextAccounts = snapshot.accounts.map(toStoreAccount);
      const nextTransactions = snapshot.transactions.map(toStoreTransaction);
      const nextPlaidInvAccounts = snapshot.investmentAccounts.map(toStoreInvestmentAccount);
      const nextPlaidInvestments = snapshot.investments.map(toStoreInvestment);

      set((state) => {
        // Preserve Web3 Wallet / Exchange entries — those are managed by other
        // slices and the encrypted Plaid endpoint never owns them.
        const nonPlaidAccounts = state.investmentAccounts.filter(
          (account) => account.type === 'Web3 Wallet' || account.type === 'Exchange',
        );
        const nonPlaidInvestments = state.investments.filter((investment) =>
          nonPlaidAccounts.some((account) => account.id === investment.accountId),
        );

        return {
          accounts: nextAccounts,
          transactions: nextTransactions,
          investmentAccounts: [...nextPlaidInvAccounts, ...nonPlaidAccounts],
          investments: [...nextPlaidInvestments, ...nonPlaidInvestments],
          isLoadingPlaidData: false,
          lastRefreshInfo: null,
          cacheSource: snapshot.lastSyncedAt ?? null,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch Plaid finance data';
      const code = error instanceof KuraApiError ? error.code : undefined;

      // Try to load from local encrypted cache (survives CryptoSession loss after JS reload).
      const cached = await readCache<PlaidCacheShape>(PLAID_CACHE_NS).catch(() => null);
      if (cached) {
        Logger.warn('PlaidSlice', 'Using cached Plaid data (CryptoSession unavailable)', {
          cachedAt: cached.cachedAt,
        });
        const nextAccounts = cached.data.accounts.map(toStoreAccount);
        const nextTransactions = cached.data.transactions.map(toStoreTransaction);
        const nextPlaidInvAccounts = cached.data.investmentAccounts.map(toStoreInvestmentAccount);
        const nextPlaidInvestments = cached.data.investments.map(toStoreInvestment);
        set((state) => {
          const nonPlaidAccounts = state.investmentAccounts.filter(
            (a) => a.type === 'Web3 Wallet' || a.type === 'Exchange',
          );
          const nonPlaidInvestments = state.investments.filter((i) =>
            nonPlaidAccounts.some((a) => a.id === i.accountId),
          );
          return {
            accounts: nextAccounts,
            transactions: nextTransactions,
            investmentAccounts: [...nextPlaidInvAccounts, ...nonPlaidAccounts],
            investments: [...nextPlaidInvestments, ...nonPlaidInvestments],
            isLoadingPlaidData: false,
            cacheSource: `Cached at ${cached.cachedAt}`,
          };
        });
        return; // served from cache — don't throw
      }

      Logger.warn('PlaidSlice', 'Failed to hydrate Plaid data', { message, code });
      set({ isLoadingPlaidData: false, plaidError: message });

      // KEY_PAIR_NOT_FOUND / 409 means the user hasn't bootstrapped E2EE yet.
      // Surface that error to the UI without crashing the screen.
      throw error;
    }
  },

  clearPlaidFinanceData: () => {
    Logger.info('PlaidSlice', 'Clearing Plaid finance data');

    set((state) => {
      const nonPlaidAccounts = state.investmentAccounts.filter(
        (account) => account.type === 'Web3 Wallet' || account.type === 'Exchange',
      );
      const nonPlaidInvestments = state.investments.filter((investment) =>
        nonPlaidAccounts.some((account) => account.id === investment.accountId),
      );

      return {
        accounts: [],
        transactions: [],
        investmentAccounts: nonPlaidAccounts,
        investments: nonPlaidInvestments,
        plaidError: null,
      };
    });
  },

  hydrateExchangeAccounts: async (token: string) => {
    try {
      const { useExchangeStore } = await import('../useExchangeStore');
      await useExchangeStore.getState().hydrateExchangeAccounts(token);
    } catch (error) {
      Logger.warn('PlaidSlice', 'Failed to hydrate exchange accounts', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
