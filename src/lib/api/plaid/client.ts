/**
 * Plaid HTTP client + decryption pipeline.
 *
 * Endpoints (all envelope-wrapped `{success,data,error}`):
 *   POST /api/plaid/create-link-token
 *   POST /api/plaid/exchange-public-token
 *   GET  /api/plaid/finance-snapshot/encrypted   ← main read path
 *   POST /api/plaid/disconnect-item
 *   GET  /api/plaid/cache/info
 *
 * `GET /finance-snapshot` (legacy plaintext + refresh-limit) is intentionally
 * NOT wired here — mobile is read-only off the encrypted endpoint; refresh is
 * driven by Plaid webhooks server-side.
 */

import { requestJson } from '../client';
import { decryptEnvelopeRows } from '../../crypto/envelope';
import {
  encryptedFinanceSnapshotSchema,
  type AccountSensitive,
  type EncryptedAccountRow,
  type EncryptedInvestmentAccountRow,
  type EncryptedInvestmentRow,
  type EncryptedTransactionRow,
  type InvestmentAccountSensitive,
  type InvestmentSensitive,
  type TransactionSensitive,
} from './schemas';
import type {
  PlaidAccount,
  PlaidAccountBucket,
  PlaidAccountType,
  PlaidFinanceSnapshot,
  PlaidInvestment,
  PlaidInvestmentAccount,
  PlaidInvestmentType,
  PlaidTransaction,
} from './types';
import Logger from '../../../shared/utils/Logger';

const apiName = 'PlaidApi';

// ─────────────────────────────────────────────────────────────
// Link token / exchange / disconnect / cache info
// ─────────────────────────────────────────────────────────────

export interface CreateLinkTokenResponse {
  link_token: string;
}

export async function createPlaidLinkToken(): Promise<CreateLinkTokenResponse> {
  return requestJson<CreateLinkTokenResponse>('/api/plaid/create-link-token', {
    method: 'POST',
    apiName,
  });
}

export interface ExchangePublicTokenResult {
  message: string;
  snapshot?: unknown;
}

export async function exchangePlaidPublicToken(
  payload: { public_token: string; institution_name?: string },
): Promise<ExchangePublicTokenResult> {
  return requestJson<ExchangePublicTokenResult>('/api/plaid/exchange-public-token', {
    method: 'POST',
    body: JSON.stringify(payload),
    apiName,
  });
}

export interface DisconnectPlaidItemResult {
  message: string;
  data: {
    matchedAccountId?: string;
    disconnectedItemId?: string;
    institution?: string;
    plaidRequestId?: string;
  };
}

export async function disconnectPlaidItem(accountId: string): Promise<DisconnectPlaidItemResult> {
  if (!accountId) {
    throw new Error('disconnectPlaidItem: accountId is required');
  }
  return requestJson<DisconnectPlaidItemResult>('/api/plaid/disconnect-item', {
    method: 'POST',
    body: JSON.stringify({ accountId }),
    apiName,
  });
}

export interface PlaidCacheInfoResponse {
  cacheStats: {
    cachedAccounts: number;
    cachedTransactions: number;
    cachedInvestmentAccounts: number;
    cachedInvestments: number;
    lastFullSync: string | null;
    accountsLastSync: string | null;
    transactionsLastSync: string | null;
    investmentsLastSync: string | null;
  };
}

export async function getPlaidCacheInfo(): Promise<PlaidCacheInfoResponse> {
  return requestJson<PlaidCacheInfoResponse>('/api/plaid/cache/info', {
    method: 'GET',
    apiName,
  });
}

// ─────────────────────────────────────────────────────────────
// Encrypted snapshot — fetch + decrypt
// ─────────────────────────────────────────────────────────────

const ACCOUNT_TYPES: Set<PlaidAccountType> = new Set(['checking', 'saving', 'credit', 'investment']);
const ACCOUNT_BUCKETS: Set<PlaidAccountBucket> = new Set(['banking', 'investment']);
const INVESTMENT_TYPES: Set<PlaidInvestmentType> = new Set(['stock', 'crypto', 'etf', 'other']);

function normalizeAccountType(value: string): PlaidAccountType {
  return ACCOUNT_TYPES.has(value as PlaidAccountType) ? (value as PlaidAccountType) : 'checking';
}

function normalizeAccountBucket(value: string): PlaidAccountBucket {
  return ACCOUNT_BUCKETS.has(value as PlaidAccountBucket) ? (value as PlaidAccountBucket) : 'banking';
}

function normalizeInvestmentType(value: string): PlaidInvestmentType {
  return INVESTMENT_TYPES.has(value as PlaidInvestmentType) ? (value as PlaidInvestmentType) : 'other';
}

/**
 * One-shot read path: GET → zod parse → decrypt every row → return plaintext.
 *
 * If a row fails to decrypt (e.g. the matching payloadKey was rotated since
 * the row was written), we drop it and log a warning; the rest of the
 * snapshot still renders.
 */
export async function fetchPlaidFinanceSnapshot(): Promise<PlaidFinanceSnapshot> {
  const raw = await requestJson<unknown>('/api/plaid/finance-snapshot/encrypted', {
    method: 'GET',
    apiName,
  });
  const envelope = encryptedFinanceSnapshotSchema.parse(raw);

  const [accountsResult, transactionsResult, investmentAccountsResult, investmentsResult] =
    await Promise.all([
      decryptEnvelopeRows<AccountSensitive, EncryptedAccountRow>(
        envelope.payloadKeys,
        envelope.accounts,
      ),
      decryptEnvelopeRows<TransactionSensitive, EncryptedTransactionRow>(
        envelope.payloadKeys,
        envelope.transactions,
      ),
      decryptEnvelopeRows<InvestmentAccountSensitive, EncryptedInvestmentAccountRow>(
        envelope.payloadKeys,
        envelope.investmentAccounts,
      ),
      decryptEnvelopeRows<InvestmentSensitive, EncryptedInvestmentRow>(
        envelope.payloadKeys,
        envelope.investments,
      ),
    ]);

  const decryptionFailureCount =
    accountsResult.failed.length +
    transactionsResult.failed.length +
    investmentAccountsResult.failed.length +
    investmentsResult.failed.length;

  if (decryptionFailureCount > 0) {
    Logger.warn(apiName, 'Some encrypted plaid rows failed to decrypt', {
      accounts: accountsResult.failed.length,
      transactions: transactionsResult.failed.length,
      investmentAccounts: investmentAccountsResult.failed.length,
      investments: investmentsResult.failed.length,
    });
  }

  const accounts: PlaidAccount[] = accountsResult.decrypted.map(({ row, payload }) => ({
    ...payload,
    accountId: row.accountId,
    plaidItemId: row.plaidItemId,
    type: normalizeAccountType(row.type),
    bucket: normalizeAccountBucket(row.bucket),
    cachedAt: row.cachedAt,
  }));

  const transactions: PlaidTransaction[] = transactionsResult.decrypted.map(({ row, payload }) => ({
    ...payload,
    transactionId: row.transactionId,
    accountId: row.accountId,
    plaidItemId: row.plaidItemId,
    date: row.date,
    month: row.month,
    isPending: row.isPending,
    isRecurring: row.isRecurring,
    isSubscription: row.isSubscription,
    cachedAt: row.cachedAt,
  }));

  const investmentAccounts: PlaidInvestmentAccount[] = investmentAccountsResult.decrypted.map(
    ({ row, payload }) => ({
      ...payload,
      accountId: row.accountId,
      cachedAt: row.cachedAt,
    }),
  );

  const investments: PlaidInvestment[] = investmentsResult.decrypted.map(({ row, payload }) => ({
    ...payload,
    investmentId: row.investmentId,
    accountId: row.accountId,
    type: normalizeInvestmentType(row.type),
    cachedAt: row.cachedAt,
  }));

  return {
    accounts,
    transactions,
    investmentAccounts,
    investments,
    lastSyncedAt: envelope.lastSyncedAt,
    decryptionFailureCount,
  };
}
