import { describe, expect, test } from 'vitest';
import './shims/getRandomValues';
import { x25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes } from '../encoding';
import {
  decryptServerEnvelope,
  unwrapPrivateKey,
  wrapPrivateKey,
} from '../keyDerivation';
import { generateX25519KeyPair } from '../x25519';
import { hkdfSha256, HKDF_INFO_SESSION } from '../hkdf';
import { aesGcmEncrypt, AES_GCM_IV_BYTES } from '../aesgcm';

describe('X25519 keypair wrap/unwrap', () => {
  test('wrapPrivateKey produces 60 bytes / 80 base64 chars', () => {
    const dekWrapKey = new Uint8Array(32).fill(0xab);
    const priv = new Uint8Array(32).fill(0xcd);
    const wrapped = wrapPrivateKey(priv, dekWrapKey);
    expect(wrapped.length).toBe(80);
  });

  test('unwrap recovers the same 32 bytes', () => {
    const dekWrapKey = new Uint8Array(32).fill(0x33);
    const priv = new Uint8Array(32);
    for (let i = 0; i < 32; i++) priv[i] = i;
    const wrapped = wrapPrivateKey(priv, dekWrapKey);
    const recovered = unwrapPrivateKey(wrapped, dekWrapKey);
    expect(bytesToHex(recovered)).toBe(bytesToHex(priv));
  });

  test('unwrap fails on wrong key', () => {
    const k1 = new Uint8Array(32).fill(0xaa);
    const k2 = new Uint8Array(32).fill(0xbb);
    const priv = new Uint8Array(32).fill(0x42);
    const wrapped = wrapPrivateKey(priv, k1);
    expect(() => unwrapPrivateKey(wrapped, k2)).toThrow();
  });
});

describe('decryptServerEnvelope (ECDH + HKDF + AES-GCM)', () => {
  // Round-trip: simulate backend produce → client decrypt with the same code.
  test('round trip with random keypair + random plaintext', () => {
    const user = generateX25519KeyPair();
    const ephemeral = generateX25519KeyPair();

    const shared = x25519.getSharedSecret(ephemeral.privateKey, user.publicKey);
    const sessionKey = hkdfSha256(shared, ephemeral.publicKey, HKDF_INFO_SESSION, 32);
    const iv = new Uint8Array(AES_GCM_IV_BYTES).fill(0x07);
    const plaintext = new TextEncoder().encode(JSON.stringify({ secret: 42 }));
    const ctTag = aesGcmEncrypt(sessionKey, iv, plaintext);

    const envelope = {
      ephemeralPublicKey: bytesToHex(ephemeral.publicKey),
      iv: bytesToHex(iv),
      ciphertext: bytesToHex(ctTag),
    };

    const out = decryptServerEnvelope(envelope, user.privateKey);
    expect(new TextDecoder().decode(out)).toBe('{"secret":42}');
  });

  test('hex ciphertext can also be parsed from explicit bytes', () => {
    const hex =
      'ff' +
      '00112233445566778899aabb' +
      'aa'.repeat(40);
    const bytes = hexToBytes(hex);
    expect(bytes.length).toBe(53);
  });
});
