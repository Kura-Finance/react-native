/**
 * Plaid slice — hydrates the finance store from the Phase 3 encrypted
 * snapshot endpoint and projects the decrypted records onto the store-facing
 * `Account` / `Transaction` / `InvestmentAccount` / `Investment` shapes.
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
import {
  fetchPlaidFinanceSnapshot,
  fetchPlaidFromCache,
  type PlaidAccount,
  type PlaidInvestment,
  type PlaidInvestmentAccount,
  type PlaidTransaction,
} from '../../../lib/api/plaid';
import { KuraApiError } from '../../../lib/api/errors';
import { restoreWithBiometrics } from '../../../lib/security/biometricSession';
import { setCryptoSession } from '../../../lib/crypto/session';
import { base64ToBytes } from '../../../lib/crypto/encoding';
import Logger from '../../utils/Logger';

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

function isNoSessionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('No active crypto session');
}

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

function applySnapshot(
  set: Parameters<StateCreator<FinanceState, [], [], PlaidState>>[0],
  state: Parameters<StateCreator<FinanceState, [], [], PlaidState>>[1],
  snapshot: {
    accounts: PlaidAccount[];
    transactions: PlaidTransaction[];
    investmentAccounts: PlaidInvestmentAccount[];
    investments: PlaidInvestment[];
    lastSyncedAt?: string | null;
  },
  cacheLabel?: string,
): void {
  const nextAccounts = snapshot.accounts.map(toStoreAccount);
  const nextTransactions = snapshot.transactions.map(toStoreTransaction);
  const nextPlaidInvAccounts = snapshot.investmentAccounts.map(toStoreInvestmentAccount);
  const nextPlaidInvestments = snapshot.investments.map(toStoreInvestment);

  set((s) => {
    const nonPlaidAccounts = s.investmentAccounts.filter(
      (a) => a.type === 'Web3 Wallet' || a.type === 'Exchange',
    );
    const nonPlaidInvestments = s.investments.filter((i) =>
      nonPlaidAccounts.some((a) => a.id === i.accountId),
    );
    return {
      accounts: nextAccounts,
      transactions: nextTransactions,
      investmentAccounts: [...nextPlaidInvAccounts, ...nonPlaidAccounts],
      investments: [...nextPlaidInvestments, ...nonPlaidInvestments],
      isLoadingPlaidData: false,
      lastRefreshInfo: null,
      cacheSource: cacheLabel ?? snapshot.lastSyncedAt ?? null,
    };
  });

  void state;
}

export const createPlaidSlice: StateCreator<FinanceState, [], [], PlaidState> = (set, get) => ({
  isLoadingPlaidData: false,
  plaidError: null,
  lastRefreshInfo: null,
  cacheSource: null,

  hydratePlaidFinanceData: async (_token: string, _refresh: boolean = false) => {
    set({ isLoadingPlaidData: true, plaidError: null });
    try {
      const snapshot = await fetchPlaidFinanceSnapshot();
      applySnapshot(set, get, snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch Plaid finance data';
      const code = error instanceof KuraApiError ? error.code : undefined;

      // ── Session expired (AppLock cleared CryptoSession) ──────────────────
      if (isNoSessionError(error)) {
        Logger.warn('PlaidSlice', 'Session expired; attempting biometric restore');
        try {
          const keys = await restoreWithBiometrics();
          if (keys) {
            setCryptoSession({
              x25519PrivateKey: keys.x25519PrivateKey,
              x25519PublicKeyBase64: keys.x25519PublicKeyBase64,
              dekWrapKey: new Uint8Array(32),
              localCacheKey: new Uint8Array(32),
            });

            const cached = await fetchPlaidFromCache({
              privateKey: keys.x25519PrivateKey,
              publicKey: base64ToBytes(keys.x25519PublicKeyBase64),
            });
            if (cached) {
              Logger.warn('PlaidSlice', 'Serving Plaid data from biometric-restored cache');
              applySnapshot(set, get, cached, `Cached at ${new Date().toISOString()}`);
              return;
            }
          }
        } catch (biometricError) {
          Logger.warn('PlaidSlice', 'Biometric restore threw', {
            error: biometricError instanceof Error ? biometricError.message : String(biometricError),
          });
        }

        // Biometric not available, no stored key, or user cancelled → logout.
        Logger.warn('PlaidSlice', 'Biometric restore unavailable; forcing logout');
        set({ isLoadingPlaidData: false });
        // Dynamic import breaks the store circular dependency (useAppStore → useFinanceStore → here).
        const { useAppStore } = await import('../useAppStore');
        void useAppStore.getState().logout();
        return;
      }

      // ── Network / API error with valid session — show stale cache ────────
      try {
        const cached = await fetchPlaidFromCache();
        if (cached) {
          Logger.warn('PlaidSlice', 'Network error; serving Plaid data from local cache', {
            message,
          });
          applySnapshot(set, get, cached, `Cached (offline)`);
          return;
        }
      } catch {
        // cache miss — fall through to error state
      }

      Logger.warn('PlaidSlice', 'Failed to hydrate Plaid data', { message, code });
      set({ isLoadingPlaidData: false, plaidError: message });

      // KEY_PAIR_NOT_FOUND / 409 means the user hasn't bootstrapped E2EE yet.
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
