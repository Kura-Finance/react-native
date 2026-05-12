import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import Logger from '../../../shared/utils/Logger';
import VerifyEmailChangeScreen from './VerifyEmailChangeScreen';

interface EditEmailScreenProps {
  onClose: () => void;
}

export default function EditEmailScreen({ onClose }: EditEmailScreenProps) {
  const { t } = useAppTranslation();
  const userProfile = useAppStore((state) => state.userProfile);
  const requestEmailChange = useAppStore((state) => state.requestEmailChange);
  const [email, setEmailState] = useState(userProfile.email);
  const [isLoading, setIsLoading] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState<{ email: string; expiresIn: number } | null>(null);

  const handleSave = async () => {
    if (!email.trim()) {
      Alert.alert('Error', t('settings.emailEmpty'));
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', t('settings.invalidEmailFormat'));
      return;
    }

    if (email === userProfile.email) {
      Alert.alert('Info', 'Email is the same as current email');
      return;
    }

    try {
      setIsLoading(true);
      // Cast response to include expiresIn
      const result = await requestEmailChange(email) as any;
      Logger.info('EditEmailScreen', 'Email change request sent successfully');
      
      // Show verification code screen
      setVerifyingEmail({ 
        email, 
        expiresIn: result?.expiresIn || 600000 // default 10 minutes
      });
    } catch (error) {
      Logger.error('EditEmailScreen', 'Failed to request email change', error);
      Alert.alert('Error', error instanceof Error ? error.message : t('settings.failedRequestEmailChange'));
    } finally {
      setIsLoading(false);
    }
  };

  // If verifying email, show verification screen
  if (verifyingEmail) {
    return (
      <VerifyEmailChangeScreen
        newEmail={verifyingEmail.email}
        expiresIn={verifyingEmail.expiresIn}
        onClose={onClose}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <ScrollView style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>{t('settings.editEmail')}</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, backgroundColor: '#1A1A24', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Form */}
        <Text style={{ color: '#999999', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>{t('settings.emailAddress')}</Text>
        
        <TextInput
          value={email}
          onChangeText={setEmailState}
          placeholder={t('settings.enterNewEmail')}
          placeholderTextColor="#666666"
          keyboardType="email-address"
          autoCapitalize="none"
          style={{ backgroundColor: '#1A1A24', borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)', borderRadius: 12, color: '#FFFFFF', padding: 16, fontSize: 16, marginBottom: 32 }}
        />

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading}
          style={{ width: '100%', paddingVertical: 16, borderRadius: 12, backgroundColor: isLoading ? '#666666' : '#8B5CF6', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
        >
          {isLoading ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>{t('settings.sending')}</Text>
            </>
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>{t('settings.sendVerification')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
