import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, View, ActivityIndicator, Text, TouchableOpacity, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { create, open, destroy } from 'react-native-plaid-link-sdk';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAppStore } from '../store/useAppStore';
import Logger from '../utils/Logger';

interface PlaidLinkModalProps {
  isVisible: boolean;
  linkToken: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (errorMessage: string) => void;
}

const LINK_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

type PlaidResult = 
  | { type: 'success'; publicToken: string; institution?: string }
  | { type: 'exit'; error?: string; cancelled?: boolean }
  | { type: 'timeout' }
  | null;

export default function PlaidLinkModal({ 
  isVisible, 
  linkToken: initialLinkToken,
  onClose, 
  onSuccess,
  onError
}: PlaidLinkModalProps) {
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Plaid States
  const [sessionState, setSessionState] = useState<'idle' | 'creating' | 'active' | 'destroying'>('idle');
  const [plaidResult, setPlaidResult] = useState<PlaidResult>(null);

  // Refs
  const sessionRef = useRef<boolean>(false);
  const tokenRefreshingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Network monitoring
  const { isConnected } = useNetInfo();

  // Store functions
  const confirmPlaidExchange = useAppStore((state: any) => state.confirmPlaidExchange);
  const requestPlaidLinkToken = useAppStore((state: any) => state.requestPlaidLinkToken);
  const plaidLinkTokenTimestamp = useAppStore((state: any) => state.plaidLinkTokenTimestamp);
  const plaidLinkToken = useAppStore((state: any) => state.plaidLinkToken);

  const linkToken = plaidLinkToken || initialLinkToken;

  const isTokenExpired = useCallback(() => {
    if (!plaidLinkTokenTimestamp) return true;
    const ageMs = Date.now() - plaidLinkTokenTimestamp;
    return ageMs > LINK_TOKEN_EXPIRY_MS;
  }, [plaidLinkTokenTimestamp]);

  /**
   * 销毁 Plaid session - 提前定义便于在各个地方使用
   */
  const cleanupSession = useCallback(() => {
    try {
      if (sessionRef.current) {
        destroy();
        sessionRef.current = false;
        Logger.info('PlaidLinkModal', 'Plaid session destroyed');
      }
    } catch (err) {
      Logger.warn('PlaidLinkModal', 'Error destroying session', { error: String(err) });
    }
    setSessionState('idle');
    setPlaidResult(null);
  }, []);

  // ============================================================================
  // SECTION 1: Token 管理（独立 useEffect）
  // ============================================================================
  
  /**
   * 自动请求没有的 token
   */
  useEffect(() => {
    if (!isVisible || linkToken || isInitializing || isLoading) return;

    Logger.debug('PlaidLinkModal', 'Auto-requesting token', { linkToken, isInitializing });
    setIsLoading(true);

    requestPlaidLinkToken()
      .then(() => {
        if (isMountedRef.current) {
          Logger.info('PlaidLinkModal', 'Token auto-requested successfully');
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Failed to get token';
          setError(msg);
          setIsLoading(false);
          Logger.error('PlaidLinkModal', 'Auto-request failed', { error: msg });
        }
      });
  }, [isVisible, linkToken, isInitializing, isLoading, requestPlaidLinkToken]);

  /**
   * 处理 token 过期 - 自动刷新
   */
  useEffect(() => {
    if (!isVisible || !linkToken || !isTokenExpired() || tokenRefreshingRef.current) return;

    Logger.info('PlaidLinkModal', 'Token expired, auto-refreshing');
    tokenRefreshingRef.current = true;
    setError('Token expired. Requesting new one...');

    requestPlaidLinkToken()
      .then(() => {
        if (isMountedRef.current) {
          Logger.info('PlaidLinkModal', 'Token refreshed successfully');
          setError(null);
        }
      })
      .catch((err: any) => {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Failed to refresh token';
          setError(msg);
          Logger.error('PlaidLinkModal', 'Token refresh failed', { error: msg });
        }
      })
      .finally(() => {
        tokenRefreshingRef.current = false;
      });
  }, [isVisible, linkToken, isTokenExpired, requestPlaidLinkToken]);

  // ============================================================================
  // SECTION 2: 网络监听
  // ============================================================================

  useEffect(() => {
    if (isVisible && !isConnected) {
      setNetworkError('Network connection lost. Please check your connection and try again.');
      Logger.warn('PlaidLinkModal', 'Network disconnected');
    } else if (isConnected) {
      setNetworkError(null);
    }
  }, [isConnected, isVisible]);

  // ============================================================================
  // SECTION 3: Session 创建（独立 useEffect）
  // ============================================================================

  useEffect(() => {
    if (!isVisible || !linkToken || isTokenExpired() || sessionState !== 'idle') {
      return;
    }

    if (sessionRef.current) {
      Logger.debug('PlaidLinkModal', 'Session already exists, skipping creation');
      return;
    }

    let isMounted = true;

    const createSession = async () => {
      try {
        setSessionState('creating');
        setIsInitializing(true);
        setIsLoading(true);
        setError(null);

        Logger.debug('PlaidLinkModal', 'Creating Plaid session', {
          token: linkToken.substring(0, 20) + '...',
        });

        // create() is synchronous, no need for crash guard
        create({ token: linkToken });
        
        if (isMounted) {
          sessionRef.current = true;
          setSessionState('active');
          Logger.info('PlaidLinkModal', 'Plaid session created');
        }
      } catch (err: any) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to create session';
          Logger.error('PlaidLinkModal', 'Session creation failed', { error: msg });
          setError(msg);
          setSessionState('idle');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsInitializing(false);
        }
      }
    };

    createSession();

    return () => {
      isMounted = false;
    };
  }, [isVisible, linkToken, isTokenExpired, sessionState]);

  // ============================================================================
  // SECTION 4: 打开 Plaid UI（独立 useEffect）
  // ============================================================================

  useEffect(() => {
    if (sessionState !== 'active' || !isMountedRef.current) return;

    let isMounted = true;
    let plaidExitTimeoutRef: NodeJS.Timeout | null = null;

    const openPlaidUI = () => {
      try {
        Logger.debug('PlaidLinkModal', 'Opening Plaid UI');

        // 设置 5 分钟超时保护
        plaidExitTimeoutRef = setTimeout(() => {
          if (isMounted && sessionRef.current) {
            Logger.warn('PlaidLinkModal', 'Plaid timeout after 5 minutes');
            setPlaidResult({ type: 'timeout' });
          }
        }, 5 * 60 * 1000);

        open({
          onSuccess: (linkSuccess: any) => {
            if (!isMounted) return;
            Logger.info('PlaidLinkModal', 'Plaid onSuccess', {
              institution: linkSuccess?.metadata?.institution?.name,
            });
            setPlaidResult({
              type: 'success',
              publicToken: linkSuccess?.publicToken,
              institution: linkSuccess?.metadata?.institution?.name,
            });
          },
          onExit: (linkExit: any) => {
            if (!isMounted) return;
            Logger.info('PlaidLinkModal', 'Plaid onExit', {
              hasError: !!linkExit?.error,
              errorCode: linkExit?.error?.errorCode,
            });
            setPlaidResult({
              type: 'exit',
              error: linkExit?.error?.displayMessage || linkExit?.error?.errorMessage,
              cancelled: !linkExit?.error || !linkExit.error.errorCode,
            });
          },
        });

        Logger.debug('PlaidLinkModal', 'Plaid UI opened successfully');
      } catch (err: any) {
        if (isMounted) {
          Logger.error('PlaidLinkModal', 'Failed to open Plaid UI', {
            error: err instanceof Error ? err.message : String(err),
          });
          setError(err instanceof Error ? err.message : 'Failed to open Plaid');
          setSessionState('destroying');
        }
      }
    };

    openPlaidUI();

    return () => {
      isMounted = false;
      if (plaidExitTimeoutRef) clearTimeout(plaidExitTimeoutRef);
    };
  }, [sessionState]);

  // ============================================================================
  // SECTION 5: 处理 Plaid 结果（独立 useEffect）
  // ============================================================================

  useEffect(() => {
    if (!plaidResult || !isMountedRef.current) return;

    const handleResult = async () => {
      if (plaidResult.type === 'success') {
        try {
          setIsLoading(true);
          Logger.debug('PlaidLinkModal', 'Exchanging public token');

          await confirmPlaidExchange(
            plaidResult.publicToken,
            plaidResult.institution,
          );

          if (isMountedRef.current) {
            Logger.info('PlaidLinkModal', 'Token exchange and data sync complete');
            // 销毁 session
            cleanupSession();
            onSuccess?.();
            onClose();
          }
        } catch (err: any) {
          if (isMountedRef.current) {
            const msg = err instanceof Error ? err.message : 'Failed to exchange token';
            Logger.error('PlaidLinkModal', 'Token exchange failed', { error: msg });
            setError(msg);
            setPlaidResult(null);
          }
        } finally {
          setIsLoading(false);
        }
      } else if (plaidResult.type === 'exit') {
        // 处理用户退出或错误
        if (plaidResult.cancelled) {
          // 用户主动取消
          Logger.info('PlaidLinkModal', 'User cancelled Plaid');
          cleanupSession();
          onClose();
        } else if (plaidResult.error) {
          // 发生错误：记录日志、调用外部 onError、然后直接关闭 Modal
          Logger.warn('PlaidLinkModal', 'Plaid error', { error: plaidResult.error });
          cleanupSession();
          if (onError) {
            onError(plaidResult.error);
          }
          onClose(); // 直接关闭，不再卡在 Try Again/Cancel 画面
        }
      } else if (plaidResult.type === 'timeout') {
        Logger.warn('PlaidLinkModal', 'Plaid operation timeout');
        cleanupSession();
        const timeoutMsg = 'Connection timeout. Please try again.';
        if (onError) {
          onError(timeoutMsg);
        }
        onClose();
      }
    };

    handleResult();
  }, [plaidResult, confirmPlaidExchange, onClose, onSuccess, onError, cleanupSession]);

  // ============================================================================
  // SECTION 6: 清理和重置
  // ============================================================================

  /**
   * Modal 关闭时重置状态
   */
  useEffect(() => {
    if (!isVisible) {
      const resetTimer = setTimeout(() => {
        if (isMountedRef.current) {
          Logger.debug('PlaidLinkModal', 'Modal closed - resetting state');
          cleanupSession();
          setIsLoading(false);
          setError(null);
          setIsInitializing(false);
          setNetworkError(null);
          Logger.info('PlaidLinkModal', 'State reset complete');
        }
      }, 500);

      return () => clearTimeout(resetTimer);
    }
  }, [isVisible, cleanupSession]);

  /**
   * 组件挂载/卸载
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cleanupSession();
    };
  }, [cleanupSession]);

  /**
   * 重试处理
   */
  const handleRetry = async () => {
    setError(null);
    setNetworkError(null);
    setPlaidResult(null);

    try {
      Logger.debug('PlaidLinkModal', 'User clicked retry');
      await requestPlaidLinkToken();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to retry';
      setError(msg);
      Logger.error('PlaidLinkModal', 'Retry failed', { error: msg });
    }
  };

  return (
    <Modal 
      visible={isVisible} 
      transparent 
      statusBarTranslucent 
      onRequestClose={() => {
        Logger.debug('PlaidLinkModal', 'onRequestClose triggered');
        onClose();
      }}
      onDismiss={() => {
        Logger.info('PlaidLinkModal', 'Modal dismissed');
        cleanupSession();
        Keyboard.dismiss();
      }}
    >
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <View className="bg-[#0B0B0F] border border-white/10 rounded-3xl overflow-hidden w-full">
          {/* Header */}
          <View className="border-b border-white/5 p-6 flex-row justify-between items-center">
            <View>
              <Text className="text-xl font-bold text-white">Connect Bank Account</Text>
              <Text className="text-sm text-gray-400 mt-1">via Plaid</Text>
            </View>
            {!isLoading && !isInitializing && (
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-white/10 justify-center items-center"
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <View className="p-6">
            {isLoading || isInitializing ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text className="text-white mt-4 text-center">
                  {isInitializing ? 'Initializing Plaid Link...' : 'Processing...'}
                </Text>
                <Text className="text-gray-400 text-xs mt-2 text-center">
                  {isInitializing ? 'Setting up secure connection' : 'Please wait'}
                </Text>
              </View>
            ) : networkError || error ? (
              <View>
                <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                  <View className="flex-row items-start">
                    <Ionicons name="alert-circle" size={16} color="#FCA5A5" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text className="text-red-300 text-sm flex-1">{networkError || error}</Text>
                  </View>
                </View>
                {!networkError && (
                  <TouchableOpacity
                    onPress={handleRetry}
                    className="bg-[#8B5CF6] rounded-xl py-3 items-center mb-2"
                  >
                    <Text className="text-white font-semibold">Try Again</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  className="border border-white/10 rounded-xl py-3 items-center"
                >
                  <Text className="text-white font-semibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-gray-300 text-sm text-center">
                  {sessionState === 'active' ? 'Waiting for Plaid Link to open...' : 'Preparing Plaid...'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
