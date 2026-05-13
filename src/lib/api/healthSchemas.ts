/**
 * Standalone schemas for `/health` and `/api/stripe/billing-status`.
 *
 * Pulled out of `system.ts` / `stripe.ts` so unit tests can import them
 * without triggering the RN-specific `Logger` / `client` import graph.
 */

import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
  environment: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const billingStatusSchema = z.object({
  tier: z.string(),
  hasActiveSubscription: z.boolean(),
  subscriptionStatus: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  stripePriceId: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
});
export type BillingStatus = z.infer<typeof billingStatusSchema>;
