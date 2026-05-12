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

interface LoginScreenProps {
  onNavigateToSignup?: () => void;
  onNavigateToForgotPassword?: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginScreen({
  onNavigateToSignup,
  onNavigateToForgotPassword,
  onLoginSuccess,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useAppStore((state) => state.login);

  const handleLogin = async () => {
    try {
      // Validate form
      if (!email.trim()) {
        setError('Email is required');
        return;
      }

      if (!password) {
        setError('Password is required');
        return;
      }

      if (!email.includes('@')) {
        setError('Please enter a valid email');
        return;
      }

      setIsLoading(true);
      setError(null);

      Logger.debug('LoginScreen', 'Attempting login', { email });
      await login(email, password);

      Logger.info('LoginScreen', 'Login successful');
      onLoginSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(errorMessage);
      Logger.error('LoginScreen', 'Login failed', { error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' }}>
            {/* ===== TOP SECTION: Title and Form ===== */}
            <View>
              {/* Title: Sign In */}
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  marginTop: 24,
                  marginBottom: 32,
                }}
              >
                Sign In
              </Text>

              {/* Error Message */}
              {error && (
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    marginBottom: 20,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#FCA5A5' }}>{error}</Text>
                </View>
              )}

              {/* Email Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: '#CCCCCC', fontWeight: '600', marginBottom: 8 }}>
                  Email
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
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color="#9CA3AF"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder="your@email.com"
                    placeholderTextColor="#666666"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    autoCapitalize="none"
                    editable={!isLoading}
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      fontSize: 14,
                    }}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, color: '#CCCCCC', fontWeight: '600', marginBottom: 8 }}>
                  Password
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
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#9CA3AF"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder="••••••••"
                    placeholderTextColor="#666666"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                    autoCapitalize="none"
                    editable={!isLoading}
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      fontSize: 14,
                    }}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={isLoading}>
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Privacy/Legal Text */}
              <Text
                style={{
                  fontSize: 11,
                  color: '#999999',
                  textAlign: 'center',
                  lineHeight: 16,
                }}
              >
                By signing in, you agree to our{' '}
                <Text style={{ color: '#8B5CF6', fontWeight: '600' }}>Terms of Service</Text> and{' '}
                <Text style={{ color: '#8B5CF6', fontWeight: '600' }}>Privacy Policy</Text>
              </Text>
            </View>

            {/* ===== MIDDLE: Spacer (flex grows) ===== */}
            <View style={{ flex: 1 }} />

            {/* ===== BOTTOM SECTION: Action Buttons ===== */}
            <View style={{ marginBottom: 24 }}>
              {/* Forgot Password Link - Centered */}
              <TouchableOpacity
                onPress={onNavigateToForgotPassword}
                disabled={isLoading}
                style={{ marginBottom: 24 }}
              >
                <Text style={{ fontSize: 12, color: '#8B5CF6', fontWeight: '600', textAlign: 'center' }}>
                  Forgot password or username?
                </Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                style={{
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#8B5CF6',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 24,
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#CCCCCC' }}>Don&apos;t have an account? </Text>
                <TouchableOpacity onPress={onNavigateToSignup} disabled={isLoading}>
                  <Text style={{ fontSize: 13, color: '#8B5CF6', fontWeight: '600' }}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
