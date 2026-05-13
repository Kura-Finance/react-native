import React, { useMemo, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import DashboardScreen from '../features/dashboard/screens/DashboardScreen';
import InvestmentScreen from '../features/investment/screens/InvestmentScreen';
import TransactionScreen from '../features/transactions/screens/TransactionScreen';
import ComingSoonScreen from '../features/investment/screens/ComingSoonScreen';
import { TabNavigatorProvider } from '../shared/context/TabNavigatorContext';

const Stack = createNativeStackNavigator();

export type InvestmentCategory = 'Transaction' | 'Stock' | 'Crypto' | 'DeFi';
export type TabName = 'Banking' | 'Transaction' | 'Stock' | 'Crypto' | 'DeFi';

interface TabOption {
  name: TabName;
  icon: string;
  label: string;
}

const TABS: TabOption[] = [
  { name: 'Banking',     icon: 'card',           label: 'Banking'     },
  { name: 'Transaction', icon: 'swap-horizontal', label: 'Txn'         },
  { name: 'Stock',       icon: 'bar-chart',       label: 'Stock'       },
  { name: 'Crypto',      icon: 'logo-bitcoin',    label: 'Crypto'      },
  { name: 'DeFi',        icon: 'analytics',       label: 'DeFi'        },
];

const CryptoComingSoon = () => (
  <ComingSoonScreen
    title="Crypto Wallet & Exchange"
    subtitle="View your spot holdings from connected exchanges and on-chain wallet balances from DeBank."
    icon="logo-bitcoin"
    accentColor="#F59E0B"
  />
);

const DeFiComingSoon = () => (
  <ComingSoonScreen
    title="DeFi Protocols"
    subtitle="Track your DeFi positions — lending, liquidity pools, staking and more — sourced from DeBank."
    icon="analytics"
    accentColor="#10B981"
  />
);

export default function TabNavigator() {
  const [activeTab, setActiveTab] = useState<TabName>('Banking');
  const insets = useSafeAreaInsets();

  const ScreenComponent = useMemo(() => {
    switch (activeTab) {
      case 'Banking':
        return DashboardScreen;
      case 'Transaction':
        return TransactionScreen;
      case 'Stock': {
        // Stock = Plaid broker-held assets (stocks, ETFs, and Plaid-side crypto).
        // The Crypto tab is for Exchange spot + DeBank wallet tokens.
        const Comp = () => <InvestmentScreen category="Stock" />;
        Comp.displayName = 'InvestmentScreen_Stock';
        return Comp;
      }
      case 'Crypto':
        return CryptoComingSoon;
      case 'DeFi':
        return DeFiComingSoon;
      default:
        return DashboardScreen;
    }
  }, [activeTab]);

  const renderTabItems = () => (
    <View style={styles.tabContainer}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => setActiveTab(tab.name)}
            style={[
              styles.tabButton,
              { backgroundColor: isActive ? 'rgba(139, 92, 246, 0.3)' : 'transparent' },
            ]}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={isActive ? '#8B5CF6' : '#FFFFFF'}
            />
            <Text
              style={[
                styles.tabText,
                { color: isActive ? '#8B5CF6' : '#FFFFFF', fontWeight: isActive ? '600' : '400' },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <TabNavigatorProvider switchToTab={setActiveTab}>
      <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name={activeTab} component={ScreenComponent} />
        </Stack.Navigator>

        <View
          style={[
            styles.wrapper,
            { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: 'transparent' },
          ]}
        >
          {isLiquidGlassSupported ? (
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              tintColor="rgba(139, 92, 246, 0.05)"
              style={styles.capsuleShape}
            >
              {renderTabItems()}
            </LiquidGlassView>
          ) : (
            <View style={[styles.capsuleShape, styles.fallbackCapsule]}>
              {renderTabItems()}
            </View>
          )}
        </View>
      </View>
    </TabNavigatorProvider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 8,
    alignItems: 'center',
  },
  capsuleShape: {
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  fallbackCapsule: {
    backgroundColor: '#1A1A24',
    borderWidth: 1,
    borderColor: 'rgba(139, 139, 149, 0.3)',
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 9,
    marginTop: 2,
  },
});
