import React from 'react';
import { View, Text } from 'react-native';
import CurrencyDisplay from '../../../shared/components/CurrencyDisplay';

interface NetWorthCardProps {
  totalBalance: number;
}

export default function NetWorthCard({ totalBalance }: NetWorthCardProps) {
  return (
    <View className="mt-1 mb-4">
      <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-[0.3em]">Net Worth</Text>
      <CurrencyDisplay 
        value={totalBalance} 
        fontSize={32}
        color="#FFFFFF"
        style={{ marginTop: 8, fontWeight: 'bold' }}
      />
    </View>
  );
}
