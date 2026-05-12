import { StateCreator } from 'zustand';
import { HistoryState, AssetSnapshot, FinanceState } from './types';
import Logger from '../../utils/Logger';
import { isStablecoin } from '../../utils/stablecoinUtils';

/**
 * History Slice - 處理資產快照與性能追蹤
 * 包括：記錄快照、計算總資產、查詢歷史數據
 */
export const createHistorySlice: StateCreator<FinanceState, [], [], HistoryState> = (set, get) => ({
  // Initial State
  assetHistory: [],
  lastRecordedTime: null,

  // ========================================================================
  // Asset Calculation
  // ========================================================================

  calculateTotalAssets: () => {
    const state = get();

    // 投资总价值 (仅计算 Investment 账户的投资，不包括银行账户)
    // 忽略稳定币（USDC, USDT 及其变体如 USDC.B, USDT.E）
    const investmentValue = state.investments.reduce((sum, investment) => {
      // Skip stablecoins
      if (isStablecoin(investment.symbol)) {
        Logger.debug('HistorySlice', 'Skipping stablecoin from calculation', {
          symbol: investment.symbol,
          holdings: investment.holdings,
        });
        return sum;
      }

      const value = investment.holdings * investment.currentPrice;
      return sum + value;
    }, 0);

    const totalAssets = investmentValue;

    Logger.debug('HistorySlice', 'Total assets calculated (Investment only, excluding USDC/USDT)', {
      investmentValue,
      totalAssets,
    });

    return totalAssets;
  },

  // ========================================================================
  // Asset Snapshot Recording
  // ========================================================================

  recordAssetSnapshot: () => {
    const state = get();
    const now = Date.now();

    // 检查是否距离上次记录已有足够的时间（至少 1 小时以避免过度记录）
    if (state.lastRecordedTime && now - state.lastRecordedTime < 3600000) {
      Logger.debug('HistorySlice', 'Skipping snapshot - recorded too recently', {
        lastRecordedTime: state.lastRecordedTime,
        now,
      });
      return;
    }

    const totalAssets = get().calculateTotalAssets();
    const bankingBalance = state.accounts.reduce((sum, account) => sum + account.balance, 0);
    const investmentValue = state.investments.reduce((sum, investment) => {
      // Skip stablecoins
      if (isStablecoin(investment.symbol)) {
        return sum;
      }
      return sum + investment.holdings * investment.currentPrice;
    }, 0);
    const cryptoValue = state.investmentAccounts
      .filter((account) => account.type === 'Web3 Wallet')
      .reduce((sum, account) => {
        const investments = state.investments.filter((inv) => inv.accountId === account.id);
        return sum + investments.reduce((invSum, inv) => {
          // Skip stablecoins
          if (isStablecoin(inv.symbol)) {
            return invSum;
          }
          return invSum + inv.holdings * inv.currentPrice;
        }, 0);
      }, 0);

    const snapshot: AssetSnapshot = {
      timestamp: now,
      totalAssets,
      bankingBalance,
      investmentValue,
      cryptoValue,
    };

    set((currentState) => {
      // 保持最多 365 天的数据
      const oneYearAgo = now - 365 * 24 * 3600 * 1000;
      const filteredHistory = currentState.assetHistory.filter(
        (snap) => snap.timestamp > oneYearAgo
      );

      return {
        assetHistory: [...filteredHistory, snapshot],
        lastRecordedTime: now,
      };
    });

    Logger.info('HistorySlice', 'Asset snapshot recorded', {
      timestamp: new Date(now).toISOString(),
      totalAssets,
      bankingBalance,
      investmentValue,
      cryptoValue,
    });
  },

  // ========================================================================
  // Asset History Query
  // ========================================================================

  getAssetSnapshotsByTimeRange: (days: number) => {
    const state = get();
    const cutoffTime = Date.now() - days * 24 * 3600 * 1000;

    const snapshots = state.assetHistory.filter((snap) => snap.timestamp >= cutoffTime);

    Logger.debug('HistorySlice', 'Retrieved asset snapshots', {
      requestedDays: days,
      snapshotCount: snapshots.length,
    });

    return snapshots;
  },

  clearAssetHistory: () => {
    Logger.info('HistorySlice', 'Clearing asset history');
    set({ assetHistory: [], lastRecordedTime: null });
  },
});
