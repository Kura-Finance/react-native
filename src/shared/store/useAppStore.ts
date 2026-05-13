/**
 * Top-level app store.
 *
 * Auth in Kura mobile is Phase 3 Zero-Access E2EE:
 *   - login uses SRP-6a (`tssrp6a`), password never leaves the device.
 *   - register / reset upload SRP salt + verifier + KEK salt + encryptedDataKey
 *     to the backend; no plaintext password is sent.
 *   - the user's X25519 keypair (encryptedPrivateKey wrapped under a Argon2id-
 *     derived KEK) lives at `/api/auth/keys/*`. On every successful login we
 *     bootstrap the in-memory {@link CryptoSession}, performing lazy recovery
 *     (rotate or fresh setup) when the wrap can't be opened.
 *   - the JWT token is stored in `expo-secure-store` (never AsyncStorage).
 *
 * Legacy paths (`POST /api/auth/login`, `/register/resend-code`,
 * `/api/auth/change-password`) are removed: the backend no longer serves them.
 */

import { create } from 'zustand';
import {
  bootstrapSessionAfterLogin,
  bootstrapSessionAfterRegistration,
  confirmEmailChange as confirmEmailChangeApi,
  deleteCurrentAccount,
  fetchCurrentUserProfile,
  logoutCurrentSession,
  requestEmailChange as requestEmailChangeApi,
  requestPasswordReset as requestPasswordResetApi,
  requestRegistrationCode,
  setReferralCode as setReferralCodeApi,
  srpAuthenticate,
  srpRegister,
  updateAvatar as updateAvatarApi,
  updateDisplayName as updateDisplayNameApi,
  zkResetPassword,
  type UserProfileV1,
} from '../../lib/api/auth';
import { setAuthTokenProvider } from '../../lib/api/client';
import { migrateLegacyTokenToSecureStore, secureAuthTokenStore } from '../../lib/secureStorage';
import { clearAllCache, deleteCache } from '../../lib/cache/dataCache';
import { deleteCacheKey } from '../../lib/cache/cacheKey';
import { clearCryptoSession } from '../../lib/crypto/session';
import {
  createPlaidLinkToken,
  disconnectPlaidItem,
  exchangePlaidPublicToken,
} from '../../lib/api/plaid';
import { disconnectExchange as disconnectExchangeAccountApi } from '../../lib/api/exchange';
import { fetchExchangeRates, isCacheValid, type ExchangeRates } from '../api/exchangeRateApi';
import { useFinanceStore } from './useFinanceStore';
import { type Currency } from '../utils/currencyFormatter';
import Logger from '../utils/Logger';
import { waitForWebhookCompletion } from '../utils/webhookWait';

export type BaseCurrency = Currency;
export type Language = 'en' | 'zh-TW';

/** Local view of the user profile. Mirrors a subset of UserProfileV1. */
export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  membershipLabel: string;
  referCode?: string;
  referredByCode?: string | null;
  referralCount?: number;
  cashbackBalance?: number;
}

export interface UserPreferences {
  baseCurrency: BaseCurrency;
  language: Language;
  weeklyAiSummary: boolean;
}

export interface AiInsight {
  id: 'spending-alert' | 'optimization';
  title: string;
  content: string;
}

export interface AppChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
}

interface AppState {
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  userProfile: UserProfile;
  preferences: UserPreferences;
  aiInsights: AiInsight[];
  chatMessages: AppChatMessage[];
  plaidLinkToken: string | null;
  plaidLinkTokenTimestamp: number | null;
  authToken: string | null;
  authError: string | null;
  exchangeRates: ExchangeRates | null;
  isLoadingExchangeRates: boolean;

  // Auth (SRP)
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;

  // Registration
  sendVerificationCode: (email: string) => Promise<void>;
  verifyEmailAndRegister: (
    email: string,
    password: string,
    verificationCode: string,
    referralCode?: string,
  ) => Promise<void>;

  // Password reset (forgot-password flow)
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, verificationCode: string, newPassword: string) => Promise<void>;

  // Bootstrap
  hydrateFromStorage: () => Promise<void>;
  hydrateUserProfile: () => Promise<void>;

  // Profile mutations
  setDisplayName: (displayName: string) => Promise<void>;
  setReferralCode: (referralCode: string) => Promise<void>;
  requestEmailChange: (newEmail: string) => Promise<{ message: string; expiresIn?: number }>;
  confirmEmailChange: (newEmail: string, verificationCode: string) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;

  // Preferences
  setBaseCurrency: (currency: BaseCurrency) => void;
  setLanguage: (language: Language) => void;
  toggleWeeklyAiSummary: () => void;
  addChatMessage: (message: AppChatMessage) => void;

  // Plaid
  setPlaidLinkToken: (token: string | null) => void;
  requestPlaidLinkToken: () => Promise<string | null>;
  confirmPlaidExchange: (publicToken: string, institutionName?: string) => Promise<void>;
  disconnectPlaidAccount: (accountId: string) => Promise<void>;

  // Exchange
  disconnectExchangeAccount: (exchangeAccountId: string) => Promise<void>;

  // Misc
  loadExchangeRates: () => Promise<void>;
  setAuthToken: (token: string | null) => void;
  clearAuthSession: () => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  baseCurrency: 'USD',
  language: 'en',
  weeklyAiSummary: false,
};

const EMPTY_USER_PROFILE: UserProfile = {
  id: '',
  displayName: '',
  email: '',
  avatarUrl: '',
  membershipLabel: '',
};

function toLocalProfile(remote: UserProfileV1): UserProfile {
  return {
    id: remote.id,
    displayName: remote.displayName,
    email: remote.email,
    avatarUrl: remote.avatarUrl,
    membershipLabel: remote.membershipLabel,
    referCode: remote.referCode,
    referredByCode: remote.referredByCode ?? null,
    referralCount: remote.referralCount,
    cashbackBalance: remote.cashbackBalance,
  };
}

export const useAppStore = create<AppState>((set, get) => {
  // Wire the API client to read the current authToken from this store. Done
  // once at store creation; the closure captures `get` from zustand.
  setAuthTokenProvider(() => get().authToken);

  return {
    authStatus: 'loading',
    userProfile: EMPTY_USER_PROFILE,
    preferences: DEFAULT_PREFERENCES,
    aiInsights: [],
    chatMessages: [],
    plaidLinkToken: null,
    plaidLinkTokenTimestamp: null,
    authToken: null,
    authError: null,
    exchangeRates: null,
    isLoadingExchangeRates: false,

    // ─────────────────────────────────────────────────────────────────
    // Auth (SRP)
    // ─────────────────────────────────────────────────────────────────

    login: async (email, password) => {
      const normalizedEmail = email.toLowerCase().trim();
      Logger.info('AppStore', 'SRP login starting', { email: normalizedEmail });
      set({ authStatus: 'loading', authError: null });

      try {
        const { token, user, derivedKeys } = await srpAuthenticate(normalizedEmail, password);

        // Persist token first so the next authenticated /keys/me call works.
        await secureAuthTokenStore.set(token);
        set({ authToken: token });

        try {
          await bootstrapSessionAfterLogin({ derivedKeys });
        } catch (error) {
          derivedKeys.dekWrapKey.fill(0);
          derivedKeys.localCacheKey.fill(0);
          throw error;
        }

        set({
          authStatus: 'authenticated',
          userProfile: toLocalProfile(user),
          authError: null,
          preferences: DEFAULT_PREFERENCES,
          aiInsights: [],
        });

        Logger.info('AppStore', 'SRP login successful', { email: normalizedEmail });

        // Optional post-login hydrations — failures here do not unwind auth.
        void get().loadExchangeRates();

        // Plaid data is now Phase 3 encrypted; until PR-B switches to the
        // encrypted snapshot endpoint, leave hydration to user-driven refresh.
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        Logger.warn('AppStore', 'SRP login failed', { message });
        await secureAuthTokenStore.clear().catch(() => undefined);
        clearCryptoSession();
        set({ authStatus: 'unauthenticated', authToken: null, authError: message });
        throw error;
      }
    },

    logout: async () => {
      Logger.info('AppStore', 'Logging out');
      try {
        await logoutCurrentSession();
      } catch {
        // best-effort
      }
      clearCryptoSession();
      await secureAuthTokenStore.clear();
      // Clear local data cache so the next user doesn't see stale data
      void clearAllCache();

      useFinanceStore.getState().clearPlaidFinanceData();
      useFinanceStore.getState().clearAssetHistory();

      set({
        authToken: null,
        authStatus: 'unauthenticated',
        userProfile: EMPTY_USER_PROFILE,
        plaidLinkToken: null,
        plaidLinkTokenTimestamp: null,
        authError: null,
      });
      Logger.info('AppStore', 'Logout complete');
    },

    deleteAccount: async () => {
      if (!get().authToken) {
        throw new Error('Not authenticated');
      }
      Logger.info('AppStore', 'Deleting account');
      await deleteCurrentAccount();
      clearCryptoSession();
      await secureAuthTokenStore.clear();
      void clearAllCache();
      void deleteCacheKey();

      const finance = useFinanceStore.getState();
      finance.setAccounts([]);
      finance.setTransactions([]);
      finance.setInvestmentAccounts([]);
      finance.setInvestments([]);
      finance.clearAssetHistory();

      set({
        authToken: null,
        authStatus: 'unauthenticated',
        userProfile: EMPTY_USER_PROFILE,
        plaidLinkToken: null,
        plaidLinkTokenTimestamp: null,
        authError: null,
      });
    },

    // ─────────────────────────────────────────────────────────────────
    // Registration
    // ─────────────────────────────────────────────────────────────────

    sendVerificationCode: async (email) => {
      const normalizedEmail = email.toLowerCase().trim();
      await requestRegistrationCode(normalizedEmail);
      Logger.info('AppStore', 'Verification code sent', { email: normalizedEmail });
    },

    verifyEmailAndRegister: async (email, password, verificationCode, referralCode) => {
      const normalizedEmail = email.toLowerCase().trim();
      Logger.info('AppStore', 'SRP register starting', { email: normalizedEmail });
      set({ authStatus: 'loading', authError: null });

      try {
        const result = await srpRegister({
          email: normalizedEmail,
          password,
          verificationCode,
          referralCode,
        });

        await secureAuthTokenStore.set(result.token);
        set({ authToken: result.token });

        try {
          await bootstrapSessionAfterRegistration({
            derivedKeys: result.derivedKeys,
            keyPair: result.keyPair,
            encryptedPrivateKey: result.encryptedPrivateKey,
          });
        } catch (error) {
          result.derivedKeys.dekWrapKey.fill(0);
          result.derivedKeys.localCacheKey.fill(0);
          throw error;
        }

        set({
          authStatus: 'authenticated',
          userProfile: toLocalProfile(result.user),
          authError: null,
          preferences: DEFAULT_PREFERENCES,
          aiInsights: [],
        });

        Logger.info('AppStore', 'SRP register successful');
        void get().loadExchangeRates();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        Logger.warn('AppStore', 'SRP register failed', { message });
        await secureAuthTokenStore.clear().catch(() => undefined);
        clearCryptoSession();
        set({ authStatus: 'unauthenticated', authToken: null, authError: message });
        throw error;
      }
    },

    // ─────────────────────────────────────────────────────────────────
    // Password reset (forgot-password flow)
    // ─────────────────────────────────────────────────────────────────

    requestPasswordReset: async (email) => {
      await requestPasswordResetApi(email);
      Logger.info('AppStore', 'Password reset code sent');
    },

    resetPassword: async (email, verificationCode, newPassword) => {
      await zkResetPassword({
        email,
        resetCode: verificationCode,
        newPassword,
      });
      Logger.info('AppStore', 'Password reset completed (keypair will rebuild on next login)');
    },

    // ─────────────────────────────────────────────────────────────────
    // Bootstrap
    // ─────────────────────────────────────────────────────────────────

    hydrateFromStorage: async () => {
      Logger.debug('AppStore', 'Hydrating from storage');
      set({ authStatus: 'loading' });

      await migrateLegacyTokenToSecureStore();

      const token = await secureAuthTokenStore.get();
      if (!token) {
        set({ authStatus: 'unauthenticated', authToken: null, authError: null });
        return;
      }

      set({ authToken: token });

      try {
        const profilePromise = fetchCurrentUserProfile();
        const timeoutPromise = new Promise<UserProfileV1>((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), 10000),
        );
        const profile = await Promise.race([profilePromise, timeoutPromise]);

        set({
          authStatus: 'authenticated',
          userProfile: toLocalProfile(profile),
          authError: null,
          preferences: DEFAULT_PREFERENCES,
          aiInsights: [],
        });

        Logger.info('AppStore', 'Hydrated authenticated session', {
          email: profile.email,
          hasKeypairBootstrap: false,
        });

        void get().loadExchangeRates();
        try {
          await useFinanceStore.getState().hydrateExchangeAccounts(token);
        } catch (error) {
          Logger.warn('AppStore', 'Exchange accounts hydration failed', { error: String(error) });
        }
      } catch (error) {
        Logger.warn('AppStore', 'Failed to hydrate from storage; clearing token', {
          error: error instanceof Error ? error.message : String(error),
        });
        await secureAuthTokenStore.clear();
        set({ authStatus: 'unauthenticated', authToken: null, authError: null });
      }
    },

    hydrateUserProfile: async () => {
      if (!get().authToken) {
        set({ authStatus: 'unauthenticated' });
        return;
      }
      try {
        const profile = await fetchCurrentUserProfile();
        set({
          authStatus: 'authenticated',
          userProfile: toLocalProfile(profile),
        });
      } catch (error) {
        Logger.warn('AppStore', 'hydrateUserProfile failed', { error: String(error) });
        set({ authStatus: 'unauthenticated' });
      }
    },

    // ─────────────────────────────────────────────────────────────────
    // Profile mutations
    // ─────────────────────────────────────────────────────────────────

    setDisplayName: async (displayName) => {
      const profile = await updateDisplayNameApi(displayName);
      set((state) => ({
        userProfile: { ...state.userProfile, displayName: profile.displayName },
      }));
    },

    setReferralCode: async (referralCode) => {
      const profile = await setReferralCodeApi(referralCode);
      set({ userProfile: toLocalProfile(profile) });
    },

    requestEmailChange: async (newEmail) => {
      return requestEmailChangeApi(newEmail);
    },

    confirmEmailChange: async (newEmail, verificationCode) => {
      const profile = await confirmEmailChangeApi(newEmail, verificationCode);
      set((state) => ({
        userProfile: { ...state.userProfile, email: profile.email },
      }));
    },

    updateAvatar: async (avatarUrl) => {
      const profile = await updateAvatarApi(avatarUrl);
      set((state) => ({
        userProfile: { ...state.userProfile, avatarUrl: profile.avatarUrl },
      }));
    },

    // ─────────────────────────────────────────────────────────────────
    // Preferences
    // ─────────────────────────────────────────────────────────────────

    setBaseCurrency: (baseCurrency) =>
      set((state) => ({ preferences: { ...state.preferences, baseCurrency } })),

    setLanguage: (language) =>
      set((state) => ({ preferences: { ...state.preferences, language } })),

    toggleWeeklyAiSummary: () =>
      set((state) => ({
        preferences: {
          ...state.preferences,
          weeklyAiSummary: !state.preferences.weeklyAiSummary,
        },
      })),

    addChatMessage: (message) =>
      set((state) => ({ chatMessages: [...state.chatMessages, message] })),

    // ─────────────────────────────────────────────────────────────────
    // Plaid (untouched until PR-B switches to encrypted endpoints)
    // ─────────────────────────────────────────────────────────────────

    setPlaidLinkToken: (plaidLinkToken) => set({ plaidLinkToken }),

    setAuthToken: (token) => {
      if (token) {
        set({ authToken: token, authStatus: 'authenticated' });
      } else {
        set({ authToken: null, authStatus: 'unauthenticated' });
      }
    },

    clearAuthSession: () => {
      clearCryptoSession();
      set({
        authToken: null,
        authStatus: 'unauthenticated',
        plaidLinkToken: null,
        userProfile: EMPTY_USER_PROFILE,
        authError: null,
      });
    },

    requestPlaidLinkToken: async () => {
      if (!get().authToken) return null;
      const result = await createPlaidLinkToken();
      const linkToken = result.link_token;
      if (!linkToken) {
        throw new Error('No link token returned from backend');
      }
      const now = Date.now();
      set({ plaidLinkToken: linkToken, plaidLinkTokenTimestamp: now });
      return linkToken;
    },

    confirmPlaidExchange: async (publicToken, institutionName) => {
      const token = get().authToken;
      if (!token) throw new Error('Not authenticated');
      await exchangePlaidPublicToken({
        public_token: publicToken,
        institution_name: institutionName,
      });
      await waitForWebhookCompletion('connect');
      await useFinanceStore.getState().hydratePlaidFinanceData(token);
      // Backend records the snapshot during sync; we just pull the new rows.
      void useFinanceStore.getState().hydrateAssetHistory();
      set({ plaidLinkToken: null, plaidLinkTokenTimestamp: null });
    },

    disconnectPlaidAccount: async (accountId) => {
      const token = get().authToken;
      if (!token) throw new Error('Not authenticated');
      await disconnectPlaidItem(accountId);
      await useFinanceStore.getState().disconnectBankingAccount(accountId);
      await waitForWebhookCompletion('disconnect');
      await useFinanceStore.getState().hydratePlaidFinanceData(token);
    },

    disconnectExchangeAccount: async (exchangeAccountId) => {
      if (!get().authToken) throw new Error('Not authenticated');
      await disconnectExchangeAccountApi(exchangeAccountId);

      const { useExchangeStore } = await import('./useExchangeStore');
      useExchangeStore.getState().removeExchangeAccount(exchangeAccountId);

      const { exchangeAccounts } = useFinanceStore.getState();
      useFinanceStore.setState({
        exchangeAccounts: exchangeAccounts.filter((acc) => acc.id !== exchangeAccountId),
      });

      void useFinanceStore.getState().hydrateAssetHistory();
    },

    loadExchangeRates: async () => {
      const state = get();
      if (state.isLoadingExchangeRates) return;
      if (state.exchangeRates && isCacheValid(state.exchangeRates.lastUpdated)) return;
      set({ isLoadingExchangeRates: true });
      try {
        const rates = await fetchExchangeRates();
        set({ exchangeRates: rates, isLoadingExchangeRates: false });
      } catch (error) {
        Logger.warn('AppStore', 'Failed to load exchange rates', { error: String(error) });
        set({ isLoadingExchangeRates: false });
      }
    },
  };
});
