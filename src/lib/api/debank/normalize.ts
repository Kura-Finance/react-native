/**
 * Normalise the raw DeBank OpenAPI shapes (carried in each decrypted row's
 * `rawData`) to flat, predictable UI types.
 *
 * Ported from WebClient/app/lib/debankApi.ts. The upstream JSON is sprawling
 * (multiple list keys: `token_list / asset_list / supply_token_list /
 * borrow_token_list / reward_token_list / portfolio_item_list / detail`) and
 * field names vary (`logo_url` vs `logo`, `optimized_symbol` vs `symbol`,
 * `chain` vs `chain_id`, etc.). Single-source the normalisation here so the
 * store / UI never reaches into the raw shape directly.
 */

import type {
  DeBankProtocol,
  DeBankProtocolAsset,
  DeBankToken,
} from './types';

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Normalise + validate an EVM address. Throws if it can't be coerced into the
 * canonical `0x` + 40 lowercase hex form.
 */
export function normalizeEvmAddress(address: string): string {
  const trimmed = (address || '').trim().toLowerCase();
  if (!EVM_ADDRESS_RE.test(trimmed)) {
    throw new Error('Invalid EVM address (expected 0x + 40 hex chars)');
  }
  return trimmed;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeDeBankToken(opts: {
  rawData: unknown;
  symbol: string;
  chain: string;
  tokenId: string;
  cachedAt: string;
}): DeBankToken | null {
  const raw = toRecord(opts.rawData);
  if (!raw) return null;

  const symbol = toStringValue(
    raw.optimized_symbol ?? raw.symbol,
    opts.symbol || 'TOKEN',
  );
  const name = toStringValue(raw.name, symbol);
  const amount = toNumber(raw.amount ?? raw.balance ?? raw.raw_amount);
  const price = toNumber(raw.price ?? raw.price_usd ?? raw.usd_price);
  const chain = toStringValue(raw.chain ?? raw.chain_id, opts.chain);
  const id =
    toStringValue(raw.id) ||
    toStringValue(raw.token_id) ||
    opts.tokenId ||
    `${chain || 'evm'}-${symbol.toLowerCase()}`;
  const logo = toStringValue(raw.logo_url) || toStringValue(raw.logo);

  return { id, symbol, name, amount, price, logo, chain, cachedAt: opts.cachedAt };
}

function normalizeProtocolAsset(raw: unknown, fallbackId: string): DeBankProtocolAsset | null {
  const token = toRecord(raw);
  if (!token) return null;

  const symbol = toStringValue(token.optimized_symbol ?? token.symbol, 'ASSET');
  const name = toStringValue(token.name, symbol);
  const amount = toNumber(token.amount ?? token.balance ?? token.raw_amount);
  const price = toNumber(token.price ?? token.price_usd ?? token.usd_price);
  const explicitUsd = toNumber(token.usd_value ?? token.net_usd_value ?? token.value);
  const usdValue = explicitUsd > 0 ? explicitUsd : amount * price;
  const id = toStringValue(token.id) || toStringValue(token.token_id) || `${fallbackId}-${symbol.toLowerCase()}`;
  const logo = toStringValue(token.logo_url) || toStringValue(token.logo);

  return { id, symbol, name, amount, price, usdValue, logo };
}

function extractProtocolAssets(raw: Record<string, unknown>, protocolId: string): DeBankProtocolAsset[] {
  const detail = toRecord(raw.detail);
  const portfolioItems = [
    ...arrayOrEmpty<unknown>(raw.portfolio_item_list),
    ...arrayOrEmpty<unknown>(detail?.portfolio_item_list),
  ];

  const assetsFromPortfolio = portfolioItems.flatMap((item, itemIndex) => {
    const itemRecord = toRecord(item);
    if (!itemRecord) return [];
    const itemDetail = toRecord(itemRecord.detail);

    const tokenCandidates = [
      ...arrayOrEmpty<unknown>(itemRecord.token_list),
      ...arrayOrEmpty<unknown>(itemRecord.asset_list),
      ...arrayOrEmpty<unknown>(itemRecord.supply_token_list),
      ...arrayOrEmpty<unknown>(itemRecord.borrow_token_list),
      ...arrayOrEmpty<unknown>(itemRecord.reward_token_list),
      ...arrayOrEmpty<unknown>(itemDetail?.token_list),
      ...arrayOrEmpty<unknown>(itemDetail?.asset_list),
      ...arrayOrEmpty<unknown>(itemDetail?.supply_token_list),
      ...arrayOrEmpty<unknown>(itemDetail?.borrow_token_list),
      ...arrayOrEmpty<unknown>(itemDetail?.reward_token_list),
    ];

    const normalized = tokenCandidates
      .map((token, tokenIndex) =>
        normalizeProtocolAsset(token, `${protocolId}-item-${itemIndex}-asset-${tokenIndex}`),
      )
      .filter((asset): asset is DeBankProtocolAsset => Boolean(asset));

    if (normalized.length > 0) {
      return normalized;
    }

    const itemStats = toRecord(itemRecord.stats);
    const fallbackName = toStringValue(itemRecord.name, 'Position');
    const fallbackUsd = toNumber(
      itemStats?.asset_usd_value ?? itemStats?.net_usd_value ?? itemRecord.usd_value,
    );
    if (fallbackUsd <= 0) {
      return [];
    }

    return [
      {
        id: `${protocolId}-item-${itemIndex}`,
        symbol: fallbackName.toUpperCase(),
        name: fallbackName,
        amount: 0,
        price: 0,
        usdValue: fallbackUsd,
        logo: '',
      },
    ];
  });

  if (assetsFromPortfolio.length > 0) {
    return assetsFromPortfolio;
  }

  const directTokenCandidates = [
    ...arrayOrEmpty<unknown>(raw.token_list),
    ...arrayOrEmpty<unknown>(raw.asset_list),
    ...arrayOrEmpty<unknown>(raw.supply_token_list),
    ...arrayOrEmpty<unknown>(raw.borrow_token_list),
    ...arrayOrEmpty<unknown>(raw.reward_token_list),
  ];

  return directTokenCandidates
    .map((token, tokenIndex) => normalizeProtocolAsset(token, `${protocolId}-asset-${tokenIndex}`))
    .filter((asset): asset is DeBankProtocolAsset => Boolean(asset));
}

export function normalizeDeBankProtocol(opts: {
  rawData: unknown;
  protocolId: string;
  chain: string;
  cachedAt: string;
}): DeBankProtocol | null {
  const raw = toRecord(opts.rawData);
  if (!raw) return null;

  const stats = toRecord(raw.stats);
  const id =
    toStringValue(raw.id) ||
    toStringValue(raw.protocol_id) ||
    opts.protocolId ||
    toStringValue(raw.name, 'protocol').toLowerCase().replace(/\s+/g, '-');
  const name = toStringValue(raw.name, 'Protocol Position');
  const usdValue = toNumber(
    raw.usd_value ??
      raw.net_usd_value ??
      stats?.net_usd_value ??
      stats?.asset_usd_value ??
      raw.value,
  );
  const chain = toStringValue(raw.chain ?? raw.chain_id, opts.chain);
  const logo = toStringValue(raw.logo_url) || toStringValue(raw.logo);
  const assets = extractProtocolAssets(raw, id);

  return { id, name, usdValue, chain, logo, assets, cachedAt: opts.cachedAt };
}
