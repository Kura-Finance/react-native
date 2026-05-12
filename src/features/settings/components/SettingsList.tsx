import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';

interface SettingsListProps {
  onProfileSecurityPress?: () => void;
  onConnectedAccountsPress?: () => void;
}

export default function SettingsList({ onProfileSecurityPress, onConnectedAccountsPress }: SettingsListProps) {
  const { t } = useAppTranslation();

  return (
    <View style={{ flexDirection: 'column', gap: 8 }}>
      <TouchableOpacity 
        onPress={onProfileSecurityPress}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1A1A24', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>{t('settings.profileSecurity')}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={onConnectedAccountsPress}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1A1A24', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>{t('settings.connectedAccounts')}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}
