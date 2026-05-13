/**
 * Password reset via SRP (`/api/auth/password-reset/*`).
 *
 * The Web client used the same `password-reset/verify` endpoint for both
 * forgot-password and authenticated change-password (with `preserveData: true`).
 * Mobile follows the same convention; there is no `/api/auth/change-password`
 * endpoint to call.
 */

import { requestJson } from '../client';

const apiName = 'PasswordResetApi';

function assertHex(value: string, fieldName: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error(`${fieldName} must be an even-length hex string`);
  }
  return normalized;
}

export interface RequestResetResponse {
  message: string;
  expiresIn?: number;
}

export async function requestPasswordReset(email: string): Promise<RequestResetResponse> {
  return requestJson<RequestResetResponse>('/api/auth/password-reset/send-code', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
    apiName,
    skipAuth: true,
  });
}

export interface VerifyPasswordResetPayload {
  email: string;
  resetCode: string;
  srpSalt: string;
  srpVerifier: string;
  kekSalt: string;
  encryptedDataKey: string;
  preserveData?: boolean;
}

export interface VerifyPasswordResetResult {
  message?: string;
}

export async function verifyPasswordReset(
  payload: VerifyPasswordResetPayload,
): Promise<VerifyPasswordResetResult> {
  const code = payload.resetCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('resetCode must be a 6-digit numeric string');
  }
  const body: Record<string, unknown> = {
    email: payload.email.trim().toLowerCase(),
    resetCode: code,
    srpSalt: assertHex(payload.srpSalt, 'srpSalt'),
    srpVerifier: assertHex(payload.srpVerifier, 'srpVerifier'),
    kekSalt: assertHex(payload.kekSalt, 'kekSalt'),
    encryptedDataKey: assertHex(payload.encryptedDataKey, 'encryptedDataKey'),
  };
  if (payload.preserveData !== undefined) {
    body.preserveData = payload.preserveData;
  }

  return requestJson<VerifyPasswordResetResult>('/api/auth/password-reset/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
    skipAuth: true,
  });
}
