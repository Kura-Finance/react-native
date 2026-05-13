import Constants from 'expo-constants';

const DEFAULT_BACKEND_URL = 'https://kura-backend-642134687769.us-central1.run.app';

const IS_DEV = __DEV__;

function readExtra<T = string>(key: string): T | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const value = extra[key];
  return typeof value === 'string' && value.length > 0 ? (value as unknown as T) : undefined;
}

export function getApiBaseUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    undefined;

  const fromExtra = readExtra<string>('apiBaseUrl') ?? readExtra<string>('backendUrl');

  let url = fromEnv || fromExtra || DEFAULT_BACKEND_URL;

  if (IS_DEV && url.startsWith('https://')) {
    const devOverride = process.env.EXPO_PUBLIC_API_BASE_URL_DEV || process.env.EXPO_PUBLIC_BACKEND_URL_DEV;
    if (devOverride) {
      url = devOverride;
    }
  }

  return url.replace(/\/+$/, '');
}

export function isAbsoluteUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

export function resolveRequestUrl(path: string): string {
  if (isAbsoluteUrl(path)) return path;
  const base = getApiBaseUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
