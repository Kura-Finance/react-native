import { describe, expect, test } from 'vitest';
import {
  normalizeDeBankProtocol,
  normalizeDeBankToken,
  normalizeEvmAddress,
} from '../normalize';

describe('normalizeEvmAddress', () => {
  test('lowercases and trims a valid 0x40-hex address', () => {
    expect(normalizeEvmAddress('  0xAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  ')).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  test('rejects non-hex characters', () => {
    expect(() => normalizeEvmAddress('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toThrow();
  });

  test('rejects wrong length', () => {
    expect(() => normalizeEvmAddress('0x1234')).toThrow();
    expect(() => normalizeEvmAddress('1234567890123456789012345678901234567890')).toThrow();
  });
});

describe('normalizeDeBankToken', () => {
  test('extracts symbol/amount/price/chain/logo from canonical fields', () => {
    const out = normalizeDeBankToken({
      rawData: {
        id: 'tok-1',
        symbol: 'eth',
        optimized_symbol: 'ETH',
        name: 'Ethereum',
        amount: 1.5,
        price: 3000,
        chain: 'eth',
        logo_url: 'https://logos.example/eth.png',
      },
      symbol: 'ETH',
      chain: 'eth',
      tokenId: 'tok-fallback',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out).toEqual({
      id: 'tok-1',
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 1.5,
      price: 3000,
      chain: 'eth',
      logo: 'https://logos.example/eth.png',
      cachedAt: '2026-05-12T00:00:00Z',
    });
  });

  test('falls back to tokenId / synthetic id when upstream omits id', () => {
    const out = normalizeDeBankToken({
      rawData: { symbol: 'USDC', amount: 100, price: 1 },
      symbol: 'USDC',
      chain: 'eth',
      tokenId: 'tok-fallback',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.id).toBe('tok-fallback');
  });

  test('uses string-number coercion for sloppy upstream values', () => {
    const out = normalizeDeBankToken({
      rawData: { symbol: 'USDC', amount: '12.34', price: '0.99' },
      symbol: 'USDC',
      chain: 'eth',
      tokenId: 'x',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.amount).toBe(12.34);
    expect(out?.price).toBe(0.99);
  });

  test('returns null for non-object payload', () => {
    expect(
      normalizeDeBankToken({
        rawData: 'oops',
        symbol: 'X',
        chain: 'eth',
        tokenId: 'x',
        cachedAt: '2026-05-12T00:00:00Z',
      }),
    ).toBeNull();
  });
});

describe('normalizeDeBankProtocol', () => {
  test('extracts assets from portfolio_item_list.token_list', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        id: 'uniswap',
        name: 'Uniswap V3',
        chain: 'eth',
        stats: { net_usd_value: 12500 },
        logo_url: 'https://logos.example/uniswap.png',
        portfolio_item_list: [
          {
            name: 'Liquidity',
            token_list: [
              { symbol: 'ETH', amount: 1, price: 3000 },
              { symbol: 'USDC', amount: 3000, price: 1 },
            ],
          },
        ],
      },
      protocolId: 'p1',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });

    expect(out?.name).toBe('Uniswap V3');
    expect(out?.usdValue).toBe(12500);
    expect(out?.chain).toBe('eth');
    expect(out?.assets).toHaveLength(2);
    expect(out?.assets.map((a) => a.symbol).sort()).toEqual(['ETH', 'USDC']);
  });

  test('falls back to portfolio_item.stats.asset_usd_value when no tokens listed', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        name: 'StakedETH',
        chain: 'eth',
        portfolio_item_list: [
          {
            name: 'Bond',
            stats: { asset_usd_value: 9999 },
          },
        ],
      },
      protocolId: 'p1',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.assets).toHaveLength(1);
    expect(out?.assets[0].usdValue).toBe(9999);
    expect(out?.assets[0].symbol).toBe('BOND');
  });

  test('falls back to top-level token_list when no portfolio items', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        name: 'Aave',
        chain: 'eth',
        stats: { net_usd_value: 200 },
        token_list: [{ symbol: 'WBTC', amount: 0.001, price: 70000 }],
      },
      protocolId: 'p1',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.assets).toHaveLength(1);
    expect(out?.assets[0].symbol).toBe('WBTC');
    expect(out?.assets[0].usdValue).toBeCloseTo(70);
  });

  test('returns null for non-object rawData', () => {
    expect(
      normalizeDeBankProtocol({
        rawData: null,
        protocolId: 'x',
        chain: 'eth',
        cachedAt: '2026-05-12T00:00:00Z',
      }),
    ).toBeNull();
  });

  test('derives a stable id when upstream omits one', () => {
    const out = normalizeDeBankProtocol({
      rawData: { name: 'My Protocol' },
      protocolId: '',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.id).toBe('my-protocol');
  });
});
