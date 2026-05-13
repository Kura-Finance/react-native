/**
 * High-level zero-knowledge auth orchestration (RN port of WebClient/zkAuth.ts).
 *
 * Public surface (split into phases so the auth store can persist the JWT into
 * SecureStore between SRP and any authenticated keypair work):
 *
 *   srpAuthenticate(email, pw)
 *     → { token, user, derivedKeys }            // no /keys/me yet
 *   bootstrapSessionAfterLogin({ derivedKeys })
 *     → CryptoSession (calls /keys/me → setup/rotate if needed)
 *
 *   srpRegister({ email, pw, code, referralCode })
 *     → { token, user, derivedKeys, keyPair }   // pre-computed for setup
 *   bootstrapSessionAfterRegistration({ derivedKeys, keyPair })
 *     → CryptoSession (calls /keys/setup)
 *
 *   zkResetPassword / zkChangePassword          // standalone, see below
 *
 * Side effects: bootstrap functions install the in-memory {@link CryptoSession}.
 * On any failure the supplied derivedKeys are zeroed by the caller chain.
 */

import {
  computeVerifier,
  getSrpSalts,
  srpFullLogin,
} from './srp';
import { requestRegistrationCode, verifyRegistration } from './register';
import { requestPasswordReset, verifyPasswordReset } from './reset';
import {
  getUserKeyPair,
  rotateUserKeyPair,
  setupUserKeyPair,
} from './keys';
import {
  generateDataKey,
  unwrapDataKey,
  wrapDataKey,
} from './dataKey';
import {
  deriveKeysFromPassword,
  generateSaltHex,
  generateWrappedReadyKeyPair,
  unwrapPrivateKey,
  wrapPrivateKey,
  type DerivedKeys,
  type WrappedKeyPair,
} from '../../crypto/keyDerivation';
import {
  clearCryptoSession,
  getCryptoSession,
  setCryptoSession,
  type CryptoSession,
} from '../../crypto/session';
import { UserKeyPairNotFoundError } from '../errors';
import Logger from '../../../shared/utils/Logger';
import type { UserProfileV1 } from './schemas';

export interface SrpAuthenticateResult {
  token: string;
  user: UserProfileV1;
  derivedKeys: DerivedKeys;
}

export async function srpAuthenticate(
  email: string,
  password: string,
): Promise<SrpAuthenticateResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const salts = await getSrpSalts(normalizedEmail);
  if (!salts.srpEnabled) {
    throw new Error('This account requires a security upgrade. Please reset your password.');
  }

  const derived = await deriveKeysFromPassword(password, salts.srpSalt, salts.kekSalt);
  try {
    const result = await srpFullLogin(normalizedEmail, derived.authKeyHex);
    return { token: result.token, user: result.user, derivedKeys: derived };
  } catch (error) {
    derived.dekWrapKey.fill(0);
    derived.localCacheKey.fill(0);
    throw error;
  }
}

export interface BootstrapAfterLoginArgs {
  derivedKeys: DerivedKeys;
}

/**
 * Ensure the session has a usable X25519 keypair, performing lazy recovery
 * (rotate or fresh setup) if the server-stored copy can't be unwrapped with
 * the current `dekWrapKey`.
 *
 * MUST only be called after the JWT issued by SRP /verify is visible via the
 * registered `authTokenProvider` (the auth store wires this).
 */
export async function bootstrapSessionAfterLogin(
  args: BootstrapAfterLoginArgs,
): Promise<CryptoSession> {
  const { derivedKeys } = args;
  try {
    const { privateKey, publicKeyBase64 } = await obtainOrRepairKeyPair(derivedKeys.dekWrapKey);
    return commitSession({
      privateKey,
      publicKeyBase64,
      dekWrapKey: derivedKeys.dekWrapKey,
      localCacheKey: derivedKeys.localCacheKey,
    });
  } catch (error) {
    derivedKeys.dekWrapKey.fill(0);
    derivedKeys.localCacheKey.fill(0);
    throw error;
  }
}

async function obtainOrRepairKeyPair(dekWrapKey: Uint8Array): Promise<{
  privateKey: Uint8Array;
  publicKeyBase64: string;
}> {
  let serverRecordExists = true;
  try {
    const record = await getUserKeyPair();
    try {
      const priv = unwrapPrivateKey(record.encryptedPrivateKey, dekWrapKey);
      return { privateKey: priv, publicKeyBase64: record.publicKey };
    } catch (error) {
      Logger.warn('zkAuth', 'Stored encryptedPrivateKey failed to unwrap; will rotate', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    if (error instanceof UserKeyPairNotFoundError) {
      serverRecordExists = false;
    } else {
      throw error;
    }
  }

  const fresh = generateWrappedReadyKeyPair();
  const encryptedPrivateKey = wrapPrivateKey(fresh.privateKey, dekWrapKey);
  if (serverRecordExists) {
    await rotateUserKeyPair(fresh.publicKeyBase64, encryptedPrivateKey);
  } else {
    await setupUserKeyPair(fresh.publicKeyBase64, encryptedPrivateKey);
  }
  return { privateKey: fresh.privateKey, publicKeyBase64: fresh.publicKeyBase64 };
}

function commitSession(args: {
  privateKey: Uint8Array;
  publicKeyBase64: string;
  dekWrapKey: Uint8Array;
  localCacheKey: Uint8Array;
}): CryptoSession {
  const session: CryptoSession = {
    x25519PrivateKey: args.privateKey,
    x25519PublicKeyBase64: args.publicKeyBase64,
    dekWrapKey: args.dekWrapKey,
    localCacheKey: args.localCacheKey,
  };
  setCryptoSession(session);
  return session;
}

// ─────────────────────────────────────────
// Registration
// ─────────────────────────────────────────

export interface SrpRegisterArgs {
  email: string;
  password: string;
  verificationCode: string;
  referralCode?: string;
}

export interface SrpRegisterResult {
  token: string;
  user: UserProfileV1;
  derivedKeys: DerivedKeys;
  keyPair: WrappedKeyPair;
  encryptedPrivateKey: string;
}

export async function srpRegister(args: SrpRegisterArgs): Promise<SrpRegisterResult> {
  const normalizedEmail = args.email.toLowerCase().trim();
  const srpSalt = generateSaltHex();
  const kekSalt = generateSaltHex();

  const derived = await deriveKeysFromPassword(args.password, srpSalt, kekSalt);
  try {
    const { srpVerifier } = await computeVerifier(normalizedEmail, derived.authKeyHex, srpSalt);

    const dataKey = generateDataKey();
    let encryptedDataKey: string;
    try {
      encryptedDataKey = wrapDataKey(dataKey, derived.dekWrapKey);
    } finally {
      dataKey.fill(0);
    }

    const result = await verifyRegistration({
      email: normalizedEmail,
      verificationCode: args.verificationCode,
      srpSalt,
      srpVerifier,
      kekSalt,
      encryptedDataKey,
      referralCode: args.referralCode,
    });

    const keyPair = generateWrappedReadyKeyPair();
    const encryptedPrivateKey = wrapPrivateKey(keyPair.privateKey, derived.dekWrapKey);

    return {
      token: result.token,
      user: result.user,
      derivedKeys: derived,
      keyPair,
      encryptedPrivateKey,
    };
  } catch (error) {
    derived.dekWrapKey.fill(0);
    derived.localCacheKey.fill(0);
    throw error;
  }
}

export interface BootstrapAfterRegistrationArgs {
  derivedKeys: DerivedKeys;
  keyPair: WrappedKeyPair;
  encryptedPrivateKey: string;
}

export async function bootstrapSessionAfterRegistration(
  args: BootstrapAfterRegistrationArgs,
): Promise<CryptoSession> {
  const { derivedKeys, keyPair, encryptedPrivateKey } = args;
  try {
    await setupUserKeyPair(keyPair.publicKeyBase64, encryptedPrivateKey);
    return commitSession({
      privateKey: keyPair.privateKey,
      publicKeyBase64: keyPair.publicKeyBase64,
      dekWrapKey: derivedKeys.dekWrapKey,
      localCacheKey: derivedKeys.localCacheKey,
    });
  } catch (error) {
    derivedKeys.dekWrapKey.fill(0);
    derivedKeys.localCacheKey.fill(0);
    throw error;
  }
}

// ─────────────────────────────────────────
// Password reset / change (standalone)
// ─────────────────────────────────────────

export interface ZkResetPasswordArgs {
  email: string;
  resetCode: string;
  newPassword: string;
}

export async function zkResetPassword(args: ZkResetPasswordArgs): Promise<void> {
  const normalizedEmail = args.email.toLowerCase().trim();
  const srpSalt = generateSaltHex();
  const kekSalt = generateSaltHex();

  const derived = await deriveKeysFromPassword(args.newPassword, srpSalt, kekSalt);
  try {
    const { srpVerifier } = await computeVerifier(normalizedEmail, derived.authKeyHex, srpSalt);
    const dataKey = generateDataKey();
    let encryptedDataKey: string;
    try {
      encryptedDataKey = wrapDataKey(dataKey, derived.dekWrapKey);
    } finally {
      dataKey.fill(0);
    }

    await verifyPasswordReset({
      email: normalizedEmail,
      resetCode: args.resetCode,
      srpSalt,
      srpVerifier,
      kekSalt,
      encryptedDataKey,
      preserveData: false,
    });

    clearCryptoSession();
  } finally {
    derived.dekWrapKey.fill(0);
    derived.localCacheKey.fill(0);
  }
}

export interface ZkChangePasswordArgs {
  email: string;
  resetCode: string;
  newPassword: string;
}

export async function zkChangePassword(args: ZkChangePasswordArgs): Promise<void> {
  const session = getCryptoSession();
  if (!session) {
    throw new Error('No active crypto session. Please sign in again.');
  }
  const normalizedEmail = args.email.toLowerCase().trim();
  const srpSalt = generateSaltHex();
  const kekSalt = generateSaltHex();

  const derived = await deriveKeysFromPassword(args.newPassword, srpSalt, kekSalt);
  try {
    const { srpVerifier } = await computeVerifier(normalizedEmail, derived.authKeyHex, srpSalt);
    const dataKey = generateDataKey();
    let encryptedDataKey: string;
    try {
      encryptedDataKey = wrapDataKey(dataKey, derived.dekWrapKey);
    } finally {
      dataKey.fill(0);
    }

    await verifyPasswordReset({
      email: normalizedEmail,
      resetCode: args.resetCode,
      srpSalt,
      srpVerifier,
      kekSalt,
      encryptedDataKey,
      preserveData: true,
    });

    const newEncryptedPrivateKey = wrapPrivateKey(session.x25519PrivateKey, derived.dekWrapKey);
    await rotateUserKeyPair(session.x25519PublicKeyBase64, newEncryptedPrivateKey);

    commitSession({
      privateKey: session.x25519PrivateKey,
      publicKeyBase64: session.x25519PublicKeyBase64,
      dekWrapKey: derived.dekWrapKey,
      localCacheKey: derived.localCacheKey,
    });
  } catch (error) {
    derived.dekWrapKey.fill(0);
    derived.localCacheKey.fill(0);
    throw error;
  }
}

