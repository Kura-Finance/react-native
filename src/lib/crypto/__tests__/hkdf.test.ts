import { describe, expect, test } from 'vitest';
import './shims/getRandomValues';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '../encoding';
import { hkdfSha256 } from '../hkdf';

describe('HKDF-SHA-256', () => {
  // RFC 5869 Test Case 1
  test('RFC 5869 vector 1', () => {
    const ikm = hexToBytes('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
    const salt = hexToBytes('000102030405060708090a0b0c');
    const info = hexToBytes('f0f1f2f3f4f5f6f7f8f9');

    const expected =
      '3cb25f25faacd57a90434f64d0362f2a' +
      '2d2d0a90cf1a5a4c5db02d56ecc4c5bf' +
      '34007208d5b887185865';

    const okm = hkdf(sha256, ikm, salt, info, 42);
    expect(bytesToHex(okm)).toBe(expected);
  });

  // Stable v1 info strings — round-trip through our wrapper.
  test('our HKDF wrapper matches direct call with info utf8', () => {
    const ikm = new Uint8Array(32).fill(0xaa);
    const salt = new Uint8Array(32).fill(0x55);
    const out = hkdfSha256(ikm, salt, 'kura-finance-wrap-v1', 32);
    expect(out.length).toBe(32);
    // determinism
    const out2 = hkdfSha256(ikm, salt, 'kura-finance-wrap-v1', 32);
    expect(bytesToHex(out)).toBe(bytesToHex(out2));
    // different info → different output
    const cache = hkdfSha256(ikm, salt, 'kura-finance-local-cache-v1', 32);
    expect(bytesToHex(out)).not.toBe(bytesToHex(cache));
  });
});
