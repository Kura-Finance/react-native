import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_CURRENCIES, getCurrencyName } from '../../../shared/utils/currencyFormatter';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';

interface BaseCurrencySelectorProps {
  selectedCurrency: 'USD' | 'EUR' | 'TWD';
  onSelectCurrency: (currency: 'USD' | 'EUR' | 'TWD') => void;
}

export default function BaseCurrencySelector({ selectedCurrency, onSelectCurrency }: BaseCurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useAppTranslation();

  const handleSelectCurrency = (currency: 'USD' | 'EUR' | 'TWD') => {
    onSelectCurrency(currency);
    setIsOpen(false);
  };

  return (
    <View style={{ marginBottom: 12, position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1A1A24', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' }}
      >
        <View>
          <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>{t('settings.baseCurrency')}</Text>
          <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>{t('settings.currencyDescription')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#8B5CF6' }}>{selectedCurrency}</Text>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#8B5CF6" />
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, backgroundColor: '#1A1A24', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)', zIndex: 1000, overflow: 'hidden' }}>
          {(SUPPORTED_CURRENCIES as Array<'USD' | 'EUR' | 'TWD'>).map((currency, index) => (
            <TouchableOpacity
              key={currency}
              onPress={() => handleSelectCurrency(currency)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: selectedCurrency === currency ? 'rgba(139, 92, 246, 0.2)' : '#1A1A24',
                borderBottomWidth: index < (SUPPORTED_CURRENCIES as Array<'USD' | 'EUR' | 'TWD'>).length - 1 ? 1 : 0,
                borderBottomColor: 'rgba(139, 92, 246, 0.1)',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ color: '#FFFFFF', fontWeight: '500', fontSize: 14 }}>{currency}</Text>
                <Text style={{ color: '#999999', fontSize: 12, marginTop: 2 }}>{getCurrencyName(currency)}</Text>
              </View>
              {selectedCurrency === currency && (
                <Ionicons name="checkmark" size={18} color="#8B5CF6" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
