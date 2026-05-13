/**
 * TransactionScreen — full-page transaction history.
 *
 * Reused by:
 *   - TabNavigator "Transaction" tab (direct mount)
 *   - DashboardScreen "View all" button (switches tab via context)
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../../shared/store/useFinanceStore';
import CurrencyDisplay from '../../../shared/components/CurrencyDisplay';
import type { Transaction } from '../../../shared/store/useFinanceStore';

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: 'Checking',
  saving: 'Savings',
  credit: 'Credit',
  crypto: 'Crypto',
  investment: 'Investment',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Food and Drink': '#F59E0B',
  'Transfer': '#3B82F6',
  'Travel': '#8B5CF6',
  'Income': '#10B981',
  'Shopping': '#EC4899',
  'Entertainment': '#F97316',
};

function txIcon(tx: Transaction): string {
  if (tx.type === 'deposit') return '💰';
  if (tx.type === 'transfer') return '🔄';
  const cat = (tx.category || '').toLowerCase();
  if (cat.includes('food') || cat.includes('restaurant')) return '🍽️';
  if (cat.includes('travel') || cat.includes('transport')) return '✈️';
  if (cat.includes('shop') || cat.includes('merchant')) return '🛍️';
  if (cat.includes('entertainment')) return '🎬';
  return '💳';
}

export default function TransactionScreen() {
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const isLoading = useFinanceStore((s) => s.isLoadingPlaidData);

  const [search, setSearch] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    let list = selectedAccountId === 'all'
      ? transactions
      : transactions.filter((t) => t.accountId === selectedAccountId);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.merchant || '').toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q) ||
          (t.date || '').includes(q),
      );
    }
    return list;
  }, [transactions, selectedAccountId, search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      {/* Header */}
      <View style={{ paddingTop: 56, paddingHorizontal: 24, paddingBottom: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 }}>
          Transactions
        </Text>

        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1A1A24',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
            marginBottom: 12,
          }}
        >
          <Ionicons name="search" size={16} color="#666666" style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search merchant, category..."
            placeholderTextColor="#555555"
            style={{ flex: 1, color: '#FFFFFF', fontSize: 14 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#666666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Account filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            {[{ id: 'all', name: 'All accounts' }, ...accounts].map((acc) => {
              const isActive = selectedAccountId === acc.id;
              return (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => setSelectedAccountId(acc.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: isActive ? '#8B5CF6' : '#1A1A24',
                    borderWidth: 1,
                    borderColor: isActive ? '#8B5CF6' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text
                    style={{
                      color: isActive ? '#FFFFFF' : '#AAAAAA',
                      fontSize: 12,
                      fontWeight: isActive ? '600' : '400',
                    }}
                  >
                    {(acc as any).name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Summary row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          marginBottom: 8,
        }}
      >
        <Text style={{ color: '#666666', fontSize: 12 }}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing || isLoading} onRefresh={handleRefresh} tintColor="#8B5CF6" />
        }
      >
        {filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 64 }}>
            <Ionicons name="receipt-outline" size={48} color="#333333" />
            <Text style={{ color: '#666666', fontSize: 14, marginTop: 16 }}>
              {search ? 'No results found' : 'No transactions yet'}
            </Text>
          </View>
        ) : (
          filtered.map((tx, idx) => {
            const isExpense = tx.type === 'credit' || tx.type === 'transfer';
            const categoryColor = CATEGORY_COLORS[tx.category || ''] ?? '#8B5CF6';

            return (
              <View
                key={`${tx.id}_${idx}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.04)',
                }}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: `${categoryColor}20`,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{txIcon(tx)}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text
                    style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500' }}
                    numberOfLines={1}
                  >
                    {tx.merchant || 'Unknown'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={{ color: '#666666', fontSize: 11 }}>{tx.date}</Text>
                    {tx.category ? (
                      <>
                        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#444' }} />
                        <Text style={{ color: '#666666', fontSize: 11 }} numberOfLines={1}>
                          {tx.category}
                        </Text>
                      </>
                    ) : null}
                    {tx.accountType ? (
                      <>
                        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#444' }} />
                        <Text style={{ color: '#555555', fontSize: 11 }}>
                          {ACCOUNT_TYPE_LABEL[tx.accountType] ?? tx.accountType}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>

                {/* Amount */}
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={{
                        color: isExpense ? '#FFFFFF' : '#4ADE80',
                        fontSize: 14,
                        fontWeight: '600',
                        fontFamily: 'monospace',
                        marginRight: 1,
                      }}
                    >
                      {isExpense ? '-' : '+'}
                    </Text>
                    <CurrencyDisplay
                      value={Number(tx.amount)}
                      fontSize={14}
                      color={isExpense ? '#FFFFFF' : '#4ADE80'}
                      style={{ fontFamily: 'monospace', fontWeight: '600' }}
                    />
                  </View>
                  {tx.isPending && (
                    <Text style={{ color: '#F59E0B', fontSize: 10, marginTop: 2 }}>Pending</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
