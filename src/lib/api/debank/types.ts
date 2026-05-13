/**
 * Plaintext (UI-friendly) DeBank types after normalisation.
 */

export interface DeBankToken {
  /** Stable id; falls back to `${chain}-${symbol}` if upstream omits one. */
  id: string;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  /** Logo URL or empty string. */
  logo: string;
  chain: string;
  /** UTC ISO timestamp the row was cached on the backend. */
  cachedAt: string;
}

export interface DeBankProtocolAsset {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  usdValue: number;
  logo: string;
}

export interface DeBankProtocol {
  /** Stable id; aligns with the backend `protocolId` row key. */
  id: string;
  name: string;
  usdValue: number;
  chain: string;
  logo: string;
  assets: DeBankProtocolAsset[];
  cachedAt: string;
}

export interface DeBankProtocolsResult {
  address: string;
  protocols: DeBankProtocol[];
  total: number;
  decryptionFailureCount: number;
}

export interface DeBankTokensResult {
  address: string;
  tokens: DeBankToken[];
  total: number;
  decryptionFailureCount: number;
}

export interface UnlinkDeBankAddressResult {
  address: string;
  unlinked: true;
  deletedProtocolCount: number;
  deletedTokenCount: number;
}
