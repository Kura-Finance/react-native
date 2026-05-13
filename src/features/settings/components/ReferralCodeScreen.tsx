/**
 * Referral-code one-shot setup screen.
 *
 * The backend lets a user claim a referrer's code exactly once via
 * `POST /api/auth/me/referral-code`. After that the field becomes read-only
 * and the endpoint returns `VALIDATION_ERROR`.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../../shared/store/useAppStore';
import Logger from '../../../shared/utils/Logger';

interface ReferralCodeScreenProps {
  onClose: () => void;
}

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

export default function ReferralCodeScreen({ onClose }: ReferralCodeScreenProps) {
  const userProfile = useAppStore((state) => state.userProfile);
  const setReferralCode = useAppStore((state) => state.setReferralCode);

  const alreadyApplied = useMemo(
    () => Boolean(userProfile.referredByCode),
    [userProfile.referredByCode],
  );

  const [code, setCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalized = code.trim().toUpperCase();
    if (!REFERRAL_CODE_PATTERN.test(normalized)) {
      setError('Code must be 4–32 chars (A–Z, 0–9 only)');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await setReferralCode(normalized);
      Alert.alert('Applied', `Referral code ${normalized} applied to your account.`, [
        { text: 'OK', onPress: onClose },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply referral code';
      setError(message);
      Logger.warn('ReferralCodeScreen', 'apply failed', { message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <ScrollView
        style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>Referral Code</Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              backgroundColor: '#1A1A24',
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {alreadyApplied ? (
          <View
            style={{
              backgroundColor: '#1A1A24',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(34, 197, 94, 0.3)',
            }}
          >
            <Text style={{ color: '#A7F3D0', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
              ALREADY APPLIED
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', fontFamily: 'monospace' }}>
              {userProfile.referredByCode}
            </Text>
            <Text style={{ color: '#999999', fontSize: 12, marginTop: 8 }}>
              A referral code can only be applied once and cannot be changed.
            </Text>
          </View>
        ) : (
          <>
            <Text style={{ color: '#999999', fontSize: 13, marginBottom: 16 }}>
              Enter the referral code from a friend. This can only be applied once.
            </Text>

            <Text
              style={{
                color: '#999999',
                fontSize: 12,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
                marginBottom: 8,
              }}
            >
              Their code
            </Text>

            <TextInput
              value={code}
              onChangeText={(text) => {
                setCode(text.toUpperCase());
                setError(null);
              }}
              placeholder="ABCD1234"
              placeholderTextColor="#666666"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
              editable={!isSaving}
              style={{
                backgroundColor: '#1A1A24',
                borderWidth: 1,
                borderColor: 'rgba(139, 92, 246, 0.2)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: '#FFFFFF',
                fontSize: 16,
                fontFamily: 'monospace',
                marginBottom: 16,
                letterSpacing: 2,
              }}
            />

            {error && (
              <View
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: '#FCA5A5', fontSize: 13 }}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSaving || code.trim().length === 0}
              style={{
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: isSaving ? '#6B42B0' : '#8B5CF6',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isSaving || code.trim().length === 0 ? 0.6 : 1,
              }}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                  Apply Code
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {userProfile.referCode && (
          <View style={{ marginTop: 32 }}>
            <Text
              style={{
                color: '#999999',
                fontSize: 12,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
                marginBottom: 8,
              }}
            >
              Your code (share with friends)
            </Text>
            <View
              style={{
                backgroundColor: '#1A1A24',
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(139, 92, 246, 0.2)',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 22,
                  fontWeight: '700',
                  fontFamily: 'monospace',
                  letterSpacing: 2,
                  textAlign: 'center',
                }}
              >
                {userProfile.referCode}
              </Text>
              {typeof userProfile.referralCount === 'number' && (
                <Text style={{ color: '#999999', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                  {userProfile.referralCount} friend{userProfile.referralCount === 1 ? '' : 's'}{' '}
                  joined
                </Text>
              )}
            </View>
            {typeof userProfile.cashbackBalance === 'number' && (
              <View style={{ marginTop: 16 }}>
                <Text
                  style={{
                    color: '#999999',
                    fontSize: 12,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                    marginBottom: 8,
                  }}
                >
                  Cashback balance
                </Text>
                <Text style={{ color: '#A7F3D0', fontSize: 20, fontWeight: '700' }}>
                  ${userProfile.cashbackBalance.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
