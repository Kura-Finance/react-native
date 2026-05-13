/**
 * SRP-6a client (Secure Remote Password) — mirror of WebClient/srpClient.ts.
 *
 * Flow (mobile JWT):
 *   1. POST /api/auth/srp/salt        { email }
 *      → { srpSalt, kekSalt, srpEnabled }
 *   2. POST /api/auth/srp/challenge   { email }
 *      → { sessionId, srpSalt, serverB, kekSalt, encryptedDataKey? }
 *   3. client computes A, M1 from (email, authKey, srpSalt, serverB).
 *   4. POST /api/auth/srp/verify { sessionId, clientA, clientM1 }
 *      → { serverM2, token, user }
 *   5. client validates serverM2 (step3) — backend identity proof.
 */

import { SRPClientSession, SRPParameters, SRPRoutines } from 'tssrp6a';
import { requestJson } from '../client';
import type { UserProfileV1 } from './schemas';

const SRP_PARAMS = new SRPParameters();
const SRP_ROUTINES = new SRPRoutines(SRP_PARAMS);

function toCanonicalHex(value: bigint): string {
  const hex = value.toString(16).toLowerCase();
  return hex.length % 2 === 0 ? hex : `0${hex}`;
}

export interface SrpSaltResponse {
  srpSalt: string;
  kekSalt: string;
  srpEnabled: boolean;
}

export interface SrpChallengeResponse {
  sessionId: string;
  srpSalt: string;
  serverB: string;
  kekSalt: string;
  encryptedDataKey?: string;
}

export interface SrpVerifyResponse {
  serverM2: string;
  token: string;
  user: UserProfileV1;
}

export async function getSrpSalts(email: string): Promise<SrpSaltResponse> {
  return requestJson<SrpSaltResponse>('/api/auth/srp/salt', {
    method: 'POST',
    body: JSON.stringify({ email }),
    apiName: 'SrpApi',
    skipAuth: true,
  });
}

export async function getSrpChallenge(email: string): Promise<SrpChallengeResponse> {
  return requestJson<SrpChallengeResponse>('/api/auth/srp/challenge', {
    method: 'POST',
    body: JSON.stringify({ email }),
    apiName: 'SrpApi',
    skipAuth: true,
  });
}

async function postSrpVerify(body: {
  sessionId: string;
  clientA: string;
  clientM1: string;
}): Promise<SrpVerifyResponse> {
  return requestJson<SrpVerifyResponse>('/api/auth/srp/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName: 'SrpApi',
    skipAuth: true,
  });
}

/**
 * Compute the SRP verifier for the given (email, authKey, srpSalt) tuple.
 *
 * Used at registration / password reset / change-password time so the backend
 * stores the verifier instead of the password.
 */
export async function computeVerifier(
  email: string,
  authKeyHex: string,
  srpSaltHex: string,
): Promise<{ srpVerifier: string }> {
  const salt = BigInt(`0x${srpSaltHex}`);
  const x = await SRP_ROUTINES.computeX(email, salt, authKeyHex);
  const verifier = SRP_ROUTINES.computeVerifier(x);
  return { srpVerifier: toCanonicalHex(verifier) };
}

export interface SrpLoginResult {
  serverM2: string;
  token: string;
  user: UserProfileV1;
  kekSalt: string;
}

/**
 * End-to-end SRP login: challenge → step1/step2 → verify → step3.
 *
 * Returns the JWT token + user profile + kekSalt that the caller may use to
 * (re-)derive the local KEK for any cached encryptedDataKey.
 */
export async function srpFullLogin(email: string, authKeyHex: string): Promise<SrpLoginResult> {
  const challenge = await getSrpChallenge(email);

  const clientSession = new SRPClientSession(SRP_ROUTINES);
  const step1 = await clientSession.step1(email, authKeyHex);
  const step2 = await step1.step2(
    BigInt(`0x${challenge.srpSalt}`),
    BigInt(`0x${challenge.serverB}`),
  );

  const verifyResult = await postSrpVerify({
    sessionId: challenge.sessionId,
    clientA: toCanonicalHex(step2.A),
    clientM1: toCanonicalHex(step2.M1),
  });

  await step2.step3(BigInt(`0x${verifyResult.serverM2}`));

  return {
    serverM2: verifyResult.serverM2,
    token: verifyResult.token,
    user: verifyResult.user,
    kekSalt: challenge.kekSalt,
  };
}
