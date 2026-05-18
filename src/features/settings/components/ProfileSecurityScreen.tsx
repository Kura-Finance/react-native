import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { getCryptoSession } from '../../../lib/crypto/session';
import {
  hasBiometricKey,
  saveBiometricPrivateKey,
  deleteBiometricKey,
} from '../../../lib/security/biometricSession';
import EditDisplayNameScreen from './EditDisplayNameScreen';
import EditEmailScreen from './EditEmailScreen';
import ResetPasswordScreen from './ResetPasswordScreen';
import { DeleteAccountConfirmModal } from '../../../components/DeleteAccountConfirmModal';

interface ProfileSecurityScreenProps {
  onClose: () => void;
}

export default function ProfileSecurityScreen({ onClose }: ProfileSecurityScreenProps) {
  const [showEditDisplay, setShowEditDisplay] = useState(false);
  const [showEditEmail, setShowEditEmail] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricActive, setIsBiometricActive] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const { t } = useAppTranslation();
  const userProfile = useAppStore((state) => state.userProfile);
  const logout = useAppStore((state) => state.logout);

  useEffect(() => {
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const LA = require('expo-local-authentication') as typeof import('expo-local-authentication');
      const [hasHardware, supportedTypes, isEnrolled, keyExists] = await Promise.all([
        LA.hasHardwareAsync(),
        LA.supportedAuthenticationTypesAsync(),
        LA.isEnrolledAsync(),
        hasBiometricKey(),
      ]);
      console.log('[BiometricDebug] hasHardware:', hasHardware);
      console.log('[BiometricDebug] supportedTypes:', supportedTypes);
      console.log('[BiometricDebug] isEnrolled:', isEnrolled);
      console.log('[BiometricDebug] hasBiometricKey:', keyExists);
      console.log('[BiometricDebug] SecurityLevel:', await LA.getEnrolledLevelAsync());
      setIsBiometricSupported(hasHardware);
      setIsBiometricActive(keyExists);
    })();
  }, []);

  const handleBiometricToggle = useCallback(async () => {
    if (isBiometricLoading) return;

    if (!isBiometricSupported) {
      Alert.alert('', t('settings.biometricNotSupported'));
      return;
    }

    // --- Disable ---
    if (isBiometricActive) {
      Alert.alert(
        t('settings.biometricUnlock'),
        t('settings.biometricUnlockDisabled') + '?',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.disable'),
            style: 'destructive',
            onPress: async () => {
              setIsBiometricLoading(true);
              try {
                await deleteBiometricKey();
                setIsBiometricActive(false);
              } finally {
                setIsBiometricLoading(false);
              }
            },
          },
        ],
      );
      return;
    }

    // --- Enable ---
    setIsBiometricLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const LA = require('expo-local-authentication') as typeof import('expo-local-authentication');

      const isEnrolled = await LA.isEnrolledAsync();
      console.log('[BiometricDebug] Toggle → isEnrolled:', isEnrolled);
      if (!isEnrolled) {
        console.log('[BiometricDebug] Aborting: not enrolled');
        Alert.alert('', t('settings.biometricNotEnrolled'));
        return;
      }

      const session = getCryptoSession();
      console.log('[BiometricDebug] CryptoSession present:', !!session);
      console.log('[BiometricDebug] CryptoSession pubKey:', session?.x25519PublicKeyBase64?.slice(0, 8) ?? 'null');
      if (!session) {
        Alert.alert('', t('settings.biometricNoCryptoSession'));
        return;
      }

      console.log('[BiometricDebug] Calling LA.authenticateAsync...');
      const result = await LA.authenticateAsync({
        promptMessage: t('settings.biometricConfirmPrompt'),
        fallbackLabel: '',
        disableDeviceFallback: false,
      });
      console.log('[BiometricDebug] authenticateAsync result:', JSON.stringify(result));

      if (!result.success) {
        console.log('[BiometricDebug] Auth not successful, aborting');
        return;
      }

      console.log('[BiometricDebug] Calling saveBiometricPrivateKey...');
      try {
        await saveBiometricPrivateKey(session.x25519PrivateKey, session.x25519PublicKeyBase64);
        console.log('[BiometricDebug] saveBiometricPrivateKey succeeded');
      } catch (saveErr) {
        console.error('[BiometricDebug] saveBiometricPrivateKey FAILED:', saveErr);
        throw saveErr;
      }

      const verifyKey = await hasBiometricKey();
      console.log('[BiometricDebug] hasBiometricKey after save:', verifyKey);

      setIsBiometricActive(true);
      Alert.alert('', t('settings.biometricUnlockSuccess'));
    } finally {
      setIsBiometricLoading(false);
    }
  }, [isBiometricActive, isBiometricLoading, isBiometricSupported, t]);

  if (showEditDisplay) {
    return <EditDisplayNameScreen onClose={() => setShowEditDisplay(false)} />;
  }

  if (showEditEmail) {
    return <EditEmailScreen onClose={() => setShowEditEmail(false)} />;
  }

  if (showResetPassword) {
    return <ResetPasswordScreen onClose={() => setShowResetPassword(false)} />;
  }

  const handleDeleteSuccess = async () => {
    try {
      await logout();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to logout after account deletion');
    }
  };

  const ROW_STYLE = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 16,
    backgroundColor: '#1A1A24',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <ScrollView
        style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>
            {t('settings.profileSecurity')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 32, height: 32, backgroundColor: '#1A1A24', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Personal Information */}
        <Text style={{ color: '#999999', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>
          {t('settings.personalInformation')}
        </Text>

        <TouchableOpacity onPress={() => setShowEditDisplay(true)} style={ROW_STYLE}>
          <View>
            <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>{t('settings.displayName')}</Text>
            <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>
              {userProfile.displayName || t('settings.notSet')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowEditEmail(true)}
          style={{ ...ROW_STYLE, marginBottom: 32 }}
        >
          <View>
            <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>{t('settings.emailAddress')}</Text>
            <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>
              {userProfile.email || t('settings.notSet')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Security Settings */}
        <Text style={{ color: '#999999', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>
          {t('settings.securitySettings')}
        </Text>

        <TouchableOpacity onPress={() => setShowResetPassword(true)} style={ROW_STYLE}>
          <View>
            <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>{t('settings.resetPassword')}</Text>
            <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>
              {t('settings.resetPasswordDesc')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Biometric Unlock */}
        <TouchableOpacity
          onPress={handleBiometricToggle}
          disabled={isBiometricLoading}
          style={{
            ...ROW_STYLE,
            borderColor: isBiometricActive
              ? 'rgba(52, 211, 153, 0.3)'
              : 'rgba(139, 92, 246, 0.2)',
            opacity: isBiometricLoading ? 0.6 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isBiometricActive
                  ? 'rgba(52, 211, 153, 0.15)'
                  : 'rgba(139, 92, 246, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="finger-print"
                size={20}
                color={isBiometricActive ? '#34D399' : '#8B5CF6'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>
                {t('settings.biometricUnlock')}
              </Text>
              <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>
                {t('settings.biometricUnlockDesc')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isBiometricLoading ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: isBiometricActive
                      ? 'rgba(52, 211, 153, 0.15)'
                      : 'rgba(156, 163, 175, 0.15)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: isBiometricActive ? '#34D399' : '#9CA3AF',
                    }}
                  >
                    {isBiometricActive
                      ? t('settings.biometricUnlockActive')
                      : t('settings.biometricUnlockInactive')}
                  </Text>
                </View>
                <Ionicons
                  name={isBiometricActive ? 'checkmark-circle' : 'chevron-forward'}
                  size={20}
                  color={isBiometricActive ? '#34D399' : '#9CA3AF'}
                />
              </>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={{ ...ROW_STYLE, marginBottom: 32 }}>
          <View>
            <Text style={{ color: '#FFFFFF', fontWeight: '500' }}>{t('settings.activeSessions')}</Text>
            <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>
              {t('settings.manageDevices')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Danger Zone */}
        <Text style={{ color: '#999999', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>
          {t('settings.dangerZone')}
        </Text>

        <TouchableOpacity
          onPress={() => setShowDeleteConfirm(true)}
          style={{ ...ROW_STYLE, marginBottom: 0, borderColor: 'rgba(239, 68, 68, 0.2)' }}
        >
          <View>
            <Text style={{ color: '#EF4444', fontWeight: '500' }}>{t('settings.deleteAccount')}</Text>
            <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>
              {t('settings.permanentlyDelete')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#EF4444" />
        </TouchableOpacity>
      </ScrollView>

      <DeleteAccountConfirmModal
        visible={showDeleteConfirm}
        onDismiss={() => setShowDeleteConfirm(false)}
        onSuccess={handleDeleteSuccess}
      />
    </View>
  );
}
