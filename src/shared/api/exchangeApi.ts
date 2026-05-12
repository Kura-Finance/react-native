/**
 * Exchange API Service Layer
 * Handles crypto exchange connections via CCXT backend
 * Aligns with backend routes: /api/exchange/*
 */

import { getBackendBaseUrl } from './authApi';
import Logger from '../utils/Logger';

export type ExchangeName = 'binance' | 'kraken' | 'coinbase' | 'okx' | 'huobi' | 'bybit' | 'kucoin' | 'bitget' | 'gateio';

export interface ExchangeCredentials {
  exchange: ExchangeName;
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // Optional for some exchanges
}

export interface SupportedExchange {
  id: ExchangeName;
  displayName: string;
  requiresPassphrase: boolean;
  icon: string;
  website: string;
}

export interface ExchangeAccount {
  id: string;
  exchange: ExchangeName;
  exchangeDisplayName: string; // Display name e.g., "Binance"
  isVerified: boolean;
  isActive: boolean;
  lastVerifiedAt: string;
  icon: string; // URL to exchange icon
}

export interface ExchangeAccountResponse {
  accounts: ExchangeAccount[];
  metadata: {
    timestamp: string;
    count: number;
  };
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  limitReached: boolean;
  message?: string;
}

export interface ExchangeBalance {
  symbol: string;
  free: number;
  used: number;
  total: number;
  usdPrice: number;
  change24h: number; // 24小時價格變化百分比
  usdValue: number; // total * usdPrice
  logo?: string; // Optional logo URL from backend
}

export interface ExchangeSnapshotAccount {
  id: string;
  exchange: ExchangeName;
  displayName: string;
}

export interface ExchangePosition {
  symbol: string;
  contractType: string; // 'linear', 'inverse', etc.
  contracts: number;
  contractSize: number;
  currentPrice: number;
  markPrice: number;
  percentage: number;
  maintenanceMargin: number;
  collateral: number;
  initialMargin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  leverage: number;
  side: 'long' | 'short';
  change24h: number; // 24小時價格變化百分比
  usdValue: number; // 倉位USD價值
}

export interface ExchangeSnapshotAccount {
  id: string;
  exchange: ExchangeName;
  displayName: string;
  icon: string;
}

export interface ExchangeSnapshot {
  account: ExchangeSnapshotAccount;
  balances: ExchangeBalance[]; // 總持倉
  balancesUsdTotal: number; // 現貨持倉總USD價值
  assets: ExchangeBalance[]; // 自由余額（現貨）
  assetsUsdTotal: number; // 自由資產總USD價值
  positions: ExchangePosition[]; // 期貨合約倉位
  positionsUsdTotal: number; // 期貨倉位總USD價值
  totalUsdValue: number; // 總USD價值（balances + positions）
  timestamp: string;
  rateLimitInfo: RateLimitInfo; // Rate limit tracking
  fromCache?: boolean; // Whether this is cached data
  cacheNotice?: string; // Notice about cached data
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

export class ExchangeApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ExchangeApiError';
    this.status = status;
  }
}

async function exchangeRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  // Validate path to prevent undefined/null URLs
  if (!path || typeof path !== 'string') {
    throw new ExchangeApiError('Invalid path: path must be a non-empty string', 400);
  }
  
  if (path.includes('undefined') || path.includes('null')) {
    throw new ExchangeApiError(`Invalid path: path contains invalid values (${path})`, 400);
  }

  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/api/exchange${path}`;

  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    Logger.debug('ExchangeAPI', 'Fetching:', {
      method: options.method || 'GET',
      url,
      hasAuth: !!token,
    });

    const response = await fetch(url, {
      ...options,
      headers,
    });

    let body: T & ApiErrorBody;
    try {
      body = (await response.json()) as T & ApiErrorBody;
    } catch (jsonError) {
      // If JSON parsing fails, it might be HTML error page from 5xx error
      const parseError = jsonError instanceof Error ? jsonError.message : 'Failed to parse response';
      Logger.error('ExchangeAPI', 'Failed to parse response JSON', {
        url,
        status: response.status,
        parseError,
      });
      throw new ExchangeApiError(
        `Server error (${response.status}): ${parseError}`,
        response.status
      );
    }

    if (!response.ok) {
      const errorMessage = body?.message || body?.error || `HTTP ${response.status}`;
      Logger.error('ExchangeAPI', 'Request failed:', {
        status: response.status,
        message: errorMessage,
        url,
      });
      throw new ExchangeApiError(errorMessage, response.status);
    }

    Logger.debug('ExchangeAPI', 'Request succeeded:', { url });
    return body;
  } catch (error) {
    if (error instanceof ExchangeApiError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    Logger.error('ExchangeAPI', 'Request error:', {
      error: errorMessage,
      url,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
    throw new ExchangeApiError(errorMessage, 0);
  }
}

/**
 * Get list of supported exchanges
 * Optional: can be called without authentication, but if token provided will be used
 */
export async function getSupportedExchanges(token?: string): Promise<SupportedExchange[]> {
  try {
    const baseUrl = getBackendBaseUrl();
    const url = `${baseUrl}/api/exchange/supported`;

    Logger.debug('ExchangeAPI', 'Fetching supported exchanges:', { url, hasAuth: !!token });

    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, { headers });
    const data = (await response.json()) as { exchanges?: SupportedExchange[] } & ApiErrorBody;

    if (!response.ok) {
      throw new ExchangeApiError(
        data?.error || data?.message || `HTTP ${response.status}`,
        response.status
      );
    }

    Logger.info('ExchangeAPI', 'Supported exchanges fetched', {
      count: data.exchanges?.length ?? 0,
    });

    return data.exchanges || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch supported exchanges';
    Logger.error('ExchangeAPI', 'Failed to fetch supported exchanges:', { error: errorMessage });
    throw error;
  }
}

/**
 * Connect a crypto exchange account
 * Backend will use CCXT to validate and store credentials
 */
export async function connectExchangeAccount(
  credentials: ExchangeCredentials,
  token: string
): Promise<ExchangeAccount> {
  // Response might be wrapped in { success, account } or direct ExchangeAccount
  const response = await exchangeRequest<{ success?: boolean; account?: ExchangeAccount } | ExchangeAccount>(
    '/connect',
    {
      method: 'POST',
      body: JSON.stringify({
        exchange: credentials.exchange,
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        passphrase: credentials.passphrase,
      }),
    },
    token
  );

  // Handle both wrapped and direct response formats
  if (response && 'account' in response && (response as any).account) {
    return (response as any).account as ExchangeAccount;
  }

  return response as ExchangeAccount;
}

/**
 * Fetch balances from a connected exchange account
 */
export async function fetchExchangeBalances(
  exchangeAccountId: string,
  token: string
): Promise<ExchangeSnapshot> {
  if (!exchangeAccountId) {
    throw new ExchangeApiError('exchangeAccountId is required', 400);
  }
  const response = await exchangeRequest<ExchangeSnapshot>(
    `/${exchangeAccountId}/balances`,
    { method: 'GET' },
    token
  );

  // Log raw response for debugging
  Logger.debug('ExchangeAPI', 'Raw balance response', {
    hasAccount: !!response.account,
    balancesCount: response.balances?.length,
    assetsCount: response.assets?.length,
    timestamp: response.timestamp,
  });

  // Validate response structure before returning
  if (!response) {
    throw new ExchangeApiError('Invalid balance response: response is empty', 400);
  }

  if (!response.account) {
    throw new ExchangeApiError('Invalid balance response: missing account information', 400);
  }

  if (!Array.isArray(response.balances)) {
    Logger.warn('ExchangeAPI', 'Balance response missing balances array', {
      exchangeAccountId,
      hasBalances: !!response.balances,
      balancesType: typeof response.balances,
    });
    // Return with empty balances array to prevent crashes
    return {
      ...response,
      balances: [],
    };
  }

  if (!Array.isArray(response.assets)) {
    Logger.warn('ExchangeAPI', 'Balance response missing assets array', {
      exchangeAccountId,
      hasAssets: !!response.assets,
      assetsType: typeof response.assets,
    });
    // Return with empty assets array to prevent crashes
    return {
      ...response,
      assets: [],
    };
  }

  if (!Array.isArray(response.positions)) {
    Logger.warn('ExchangeAPI', 'Balance response missing positions array', {
      exchangeAccountId,
      hasPositions: !!response.positions,
      positionsType: typeof response.positions,
    });
    // Return with empty positions array to prevent crashes
    return {
      ...response,
      positions: [],
    };
  }

  return response;
}

/**
 * List all connected exchange accounts for the user
 */
export async function getConnectedExchangeAccounts(
  token: string
): Promise<ExchangeAccount[]> {
  const response = await exchangeRequest<{ accounts?: ExchangeAccount[] } | ExchangeAccount[]>(
    '/accounts',
    { method: 'GET' },
    token
  );

  // Handle both wrapped and direct response formats
  if (response && 'accounts' in response && Array.isArray((response as any).accounts)) {
    return (response as any).accounts as ExchangeAccount[];
  }

  // If it's already an array, return it
  if (Array.isArray(response)) {
    return response as ExchangeAccount[];
  }

  // Fallback to empty array if response is invalid
  Logger.warn('ExchangeAPI', 'Invalid exchange accounts response format', {
    response: JSON.stringify(response).substring(0, 200),
  });
  return [];
}

/**
 * Disconnect an exchange account
 */
export async function disconnectExchangeAccount(
  exchangeAccountId: string,
  token: string
): Promise<void> {
  if (!exchangeAccountId) {
    throw new ExchangeApiError('exchangeAccountId is required', 400);
  }
  await exchangeRequest<void>(
    `/${exchangeAccountId}`,
    { method: 'DELETE' },
    token
  );
}
