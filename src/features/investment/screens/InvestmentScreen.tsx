import React, { useMemo, useState, useEffect } from 'react';
import { View, ScrollView, Text, RefreshControl } from 'react-native';
import type { InvestmentCategory } from '../../../components/TabNavigator';
import { useTranslation } from 'react-i18next';
import { useFinanceStore } from '../../../shared/store/useFinanceStore';
import { useExchangeStore } from '../../../shared/store/useExchangeStore';
import { useAppStore } from '../../../shared/store/useAppStore';
import PerformanceSummary from '../components/PerformanceSummary';
import WaveChart from '../components/WaveChart';
import AccountCapsules from '../components/AccountCapsules';
import HoldingsList from '../components/HoldingsList';
import ConnectAccountModal from '../../../shared/components/ConnectAccountModal';
import PlaidLinkModal from '../../../shared/components/PlaidLinkModal';
import ExchangeLinkModal from '../../../shared/components/ExchangeLinkModal';
import { useInitializePlaidData } from '../../../shared/hooks/useInitializePlaidData';
import { useRefreshInvestmentData } from '../hooks/useRefreshInvestmentData';

interface InvestmentScreenProps {
  category?: InvestmentCategory;
}

/**
 * Category filter for InvestmentScreen:
 *
 *   Stock = broker-held assets via Plaid (stocks, ETFs, and crypto held in a brokerage account).
 *           Comes from financeInvestments (Plaid). Exchange spot is NOT shown here.
 *
 *   Note: TabNav "Crypto" (exchange spot + DeBank tokens) and "DeFi" (DeBank protocols)
 *   are handled by their own Coming-Soon screens; InvestmentScreen is only used for "Stock".
 */
function categoryFilter(type: string, category: InvestmentCategory | undefined): boolean {
  if (!category || category === 'Transaction') return true;
  switch (category) {
    // Stock tab: all Plaid broker-held assets including crypto-in-brokerage
    case 'Stock':  return type === 'stock' || type === 'etf' || type === 'crypto';
    // These cases are kept for completeness but currently rendered by ComingSoonScreen
    case 'Crypto': return type === 'crypto';
    case 'DeFi':   return type === 'other';
    default:       return true;
  }
}

export default function InvestmentScreen({ category }: InvestmentScreenProps) {
  const { t } = useTranslation();
  // State Management - UI control
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);

  // Data Management - Finance (Plaid/Broker/Web3)
  const financeInvestmentAccounts = useFinanceStore((state) => state.investmentAccounts);
  const financeInvestments = useFinanceStore((state) => state.investments);
  const selectedTimeRange = useFinanceStore((state) => state.selectedTimeRange);
  const setSelectedTimeRange = useFinanceStore((state) => state.setSelectedTimeRange);

  // Data Management - Exchange (交易所)
  const exchangeAccounts = useExchangeStore((state) => state.exchangeAccounts);
  const exchangeInvestmentAccounts = useExchangeStore((state) => state.exchangeInvestmentAccounts);
  const exchangeInvestments = useExchangeStore((state) => state.exchangeInvestments);
  const exchangeError = useExchangeStore((state) => state.error);

  // App Store - auth info
  const plaidLinkToken = useAppStore((state: any) => state.plaidLinkToken);

  // Data Refresh - custom hooks handling all logic
  useInitializePlaidData(); // Load Plaid data on first mount
  const { refreshing, handleRefresh } = useRefreshInvestmentData(); // Pull-to-refresh for both Plaid + Exchange



  // Combine data from all sources - Plaid + Exchange accounts
  const investmentAccounts = useMemo(() => {
    return [
      ...financeInvestmentAccounts.map((acc) => ({
        ...acc,
        type: (acc.type || 'Broker') as 'Broker' | 'Exchange' | 'Web3 Wallet',
      })),
      ...exchangeInvestmentAccounts.map((acc) => ({
        ...acc,
        type: 'Exchange' as const,
      })),
    ];
  }, [financeInvestmentAccounts, exchangeInvestmentAccounts]);

  // Combine investments depending on category.
  // Stock tab = Plaid only (broker-held assets); skip exchange spot.
  // All others = both sources.
  const investments = useMemo(() => {
    const sources = category === 'Stock'
      ? financeInvestments
      : [...financeInvestments, ...exchangeInvestments];
    return sources.filter((inv) => categoryFilter(inv.type, category));
  }, [financeInvestments, exchangeInvestments, category]);

  // Auto-fetch exchange balances on first load (single-fetch pattern)
  useEffect(() => {
    const initializeExchangeData = async () => {
      if (exchangeAccounts.length === 0 || exchangeInvestments.length > 0) {
        return;
      }

      const authToken = useAppStore.getState().authToken;
      if (!authToken) return;

      const fetchExchangeBalances = useExchangeStore.getState().fetchExchangeBalances;
      for (const account of exchangeAccounts) {
        try {
          await fetchExchangeBalances(account.id, authToken);
        } catch {
          // Silently handle errors on initial load
        }
      }
    };

    initializeExchangeData();
  }, [exchangeAccounts, exchangeInvestments.length]);

  // Clear selected account if it no longer exists
  useEffect(() => {
    if (selectedAccountId && !investmentAccounts.find((acc) => acc.id === selectedAccountId)) {
      setSelectedAccountId(null);
    }
  }, [investmentAccounts, selectedAccountId]);

  // Filter further by selected account capsule
  const displayedInvestments = useMemo(() => {
    if (selectedAccountId) {
      return investments.filter((inv) => inv.accountId === selectedAccountId);
    }
    return investments;
  }, [investments, selectedAccountId]);

  // Only show accounts that actually have holdings in the current category
  const filteredAccounts = useMemo(() => {
    if (!category || category === 'Transaction') return investmentAccounts;
    const accountIds = new Set(investments.map((inv) => inv.accountId));
    return investmentAccounts.filter((acc) => accountIds.has(acc.id));
  }, [investmentAccounts, investments, category]);

  // Event handlers
  const handleAddAccount = () => {
    setShowConnectModal(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8B5CF6"
          />
        }
      >
        <PerformanceSummary timeRange={selectedTimeRange} />
        <WaveChart selectedTimeRange={selectedTimeRange} onTimeRangeChange={setSelectedTimeRange} />
        
        {/* 顯示交易所錯誤 */}
        {exchangeError && (
          <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '500' }}>
                ⚠️ {exchangeError}
              </Text>
            </View>
          </View>
        )}

        <AccountCapsules 
          accounts={filteredAccounts} 
          selectedAccountId={selectedAccountId} 
          onSelectAccount={setSelectedAccountId}
          onAddAccount={handleAddAccount}
        />
        <HoldingsList 
          investments={displayedInvestments} 
          selectedAccountId={selectedAccountId}
        />

        {/* 為 TabNavigator 留空白 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Connect Account Modal */}
      <ConnectAccountModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onPlaidPress={() => setShowPlaidModal(true)}
        onWeb3Press={() => {
          // Web3 wallet connection is handled directly by AppKit modal
          // No additional modal needed
        }}
        onExchangePress={() => setShowExchangeModal(true)}
      />

      {/* Plaid Link Modal */}
      <PlaidLinkModal
        isVisible={showPlaidModal}
        linkToken={plaidLinkToken}
        onClose={() => setShowPlaidModal(false)}
        onSuccess={() => setShowPlaidModal(false)}
      />

      {/* Exchange Link Modal */}
      <ExchangeLinkModal
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        onSuccess={() => {
          // Exchange account connected successfully
          // You can add additional logic here if needed
        }}
      />
    </View>
  );
}
