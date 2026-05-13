/**
 * Account registration via SRP (`/api/auth/register/*`).
 *
 * Body schema for `/register/verify` is SRP-only — we never send a plaintext
 * password to the backend. The X25519 keypair is uploaded separately after
 * registration succeeds (see `/api/auth/keys/setup`).
 */

import { requestJson } from '../client';
import { userProfileV1Schema, type UserProfileV1 } from './schemas';

const apiName = 'AuthRegisterApi';

function assertHex(value: string, fieldName: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error(`${fieldName} must be an even-length hex string`);
  }
  return normalized;
}

export interface SendCodeResponse {
  message: string;
  expiresIn?: number;
}

export async function requestRegistrationCode(email: string): Promise<SendCodeResponse> {
  return requestJson<SendCodeResponse>('/api/auth/register/send-code', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
    apiName,
    skipAuth: true,
  });
}

export interface VerifyRegistrationPayload {
  email: string;
  verificationCode: string;
  srpSalt: string;
  srpVerifier: string;
  kekSalt: string;
  encryptedDataKey: string;
  referralCode?: string;
}

export interface VerifyRegistrationResult {
  message?: string;
  user: UserProfileV1;
  token: string;
}

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

export async function verifyRegistration(
  payload: VerifyRegistrationPayload,
): Promise<VerifyRegistrationResult> {
  const email = payload.email.trim().toLowerCase();
  const code = payload.verificationCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('verificationCode must be a 6-digit numeric string');
  }
  const body: Record<string, string> = {
    email,
    verificationCode: code,
    srpSalt: assertHex(payload.srpSalt, 'srpSalt'),
    srpVerifier: assertHex(payload.srpVerifier, 'srpVerifier'),
    kekSalt: assertHex(payload.kekSalt, 'kekSalt'),
    encryptedDataKey: assertHex(payload.encryptedDataKey, 'encryptedDataKey'),
  };
  if (payload.referralCode) {
    const normalized = payload.referralCode.trim().toUpperCase();
    if (!REFERRAL_CODE_PATTERN.test(normalized)) {
      throw new Error('referralCode must be 4-32 chars [A-Z0-9]');
    }
    body.referralCode = normalized;
  }

  const data = await requestJson<{ message?: string; user: unknown; token: string }>(
    '/api/auth/register/verify',
    {
      method: 'POST',
      body: JSON.stringify(body),
      apiName,
      skipAuth: true,
    },
  );

  return {
    message: data.message,
    user: userProfileV1Schema.parse(data.user),
    token: data.token,
  };
}
