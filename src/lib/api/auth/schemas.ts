/**
 * Shared types for the auth domain.
 *
 * `UserProfileV1` mirrors the backend `UserProfile` shape (Phase 3) so that
 * downstream stores can rely on a single canonical type.
 */

import { z } from 'zod';

export const plaidCacheInfoSchema = z.object({
  accounts: z.number(),
  transactions: z.number(),
  investmentAccounts: z.number(),
  investments: z.number(),
  lastSynced: z.string().nullable(),
  accountsSynced: z.string().nullable(),
  transactionsSynced: z.string().nullable(),
  investmentsSynced: z.string().nullable(),
});
export type PlaidCacheInfo = z.infer<typeof plaidCacheInfoSchema>;

export const userProfileV1Schema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string(),
  membershipLabel: z.string(),
  referCode: z.string().optional(),
  referredByCode: z.string().nullable().optional(),
  referralCount: z.number().optional(),
  cashbackBalance: z.number().optional(),
  plaidCache: plaidCacheInfoSchema.optional(),
});
export type UserProfileV1 = z.infer<typeof userProfileV1Schema>;

export const userKeyPairRecordSchema = z.object({
  publicKey: z.string(),
  encryptedPrivateKey: z.string(),
  algorithm: z.string(),
  createdAt: z.string(),
});
export type UserKeyPairRecord = z.infer<typeof userKeyPairRecordSchema>;
