import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../../shared/store/useAppStore';
import Logger from '../../../shared/utils/Logger';

interface ResetPasswordWithTokenScreenProps {
  email: string;
  initialCode?: string;
  onNavigateToLogin?: () => void;
  onBack?: () => void;
}

export default function ResetPasswordWithTokenScreen({
  email,
  initialCode = '',
  onNavigateToLogin,
  onBack,
}: ResetPasswordWithTokenScreenProps) {
  const [resetCode, setResetCode] = useState(initialCode);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetPassword = useAppStore((state) => state.resetPassword);

  const handleResetPassword = async () => {
    try {
      if (!email.trim()) {
        setError('Email is required');
        return;
      }
      if (!/^\d{6}$/.test(resetCode.trim())) {
        setError('Verification code must be 6 digits');
        return;
      }
      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setIsLoading(true);
      setError(null);

      Logger.debug('ResetPasswordWithTokenScreen', 'Resetting password (SRP)', { email });
      await resetPassword(email, resetCode.trim(), newPassword);

      Logger.info('ResetPasswordWithTokenScreen', 'Password reset successfully');
      Alert.alert('Success', 'Your password has been reset. Please sign in.', [
        { text: 'OK', onPress: onNavigateToLogin },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      setError(message);
      Logger.warn('ResetPasswordWithTokenScreen', 'Password reset failed', { message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
            <View style={{ marginBottom: 40, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={onBack}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#1A1A24',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 24,
                  alignSelf: 'flex-start',
                }}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 }}>
                Reset Password
              </Text>
              <Text style={{ fontSize: 14, color: '#999999', textAlign: 'center' }}>
                Enter the 6-digit code we sent to {email}
              </Text>
            </View>

            {error && (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 12, color: '#FCA5A5' }}>{error}</Text>
              </View>
            )}

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, color: '#CCCCCC', fontWeight: '600', marginBottom: 8 }}>
                Verification Code
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: '#1A1A24',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="key-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="6-digit code"
                  placeholderTextColor="#666666"
                  value={resetCode}
                  onChangeText={setResetCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!isLoading}
                  style={{ flex: 1, color: '#FFFFFF', fontSize: 14 }}
                />
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, color: '#CCCCCC', fontWeight: '600', marginBottom: 8 }}>
                New Password
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: '#1A1A24',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Enter new password (8+ chars)"
                  placeholderTextColor="#666666"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  editable={!isLoading}
                  style={{ flex: 1, color: '#FFFFFF', fontSize: 14 }}
                />
              </View>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 12, color: '#CCCCCC', fontWeight: '600', marginBottom: 8 }}>
                Confirm Password
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: '#1A1A24',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Confirm new password"
                  placeholderTextColor="#666666"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!isLoading}
                  style={{ flex: 1, color: '#FFFFFF', fontSize: 14 }}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={isLoading}
              style={{
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: '#8B5CF6',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onBack} disabled={isLoading}>
              <Text style={{ fontSize: 14, color: '#8B5CF6', fontWeight: '600', textAlign: 'center' }}>
                Back
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
