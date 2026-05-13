/**
 * Stripe endpoints — read-only on mobile (RevenueCat handles IAP).
 *
 * Mobile only exposes `GET /api/stripe/billing-status` so the user can see
 * the tier the backend has recorded for them. Checkout / billing-portal are
 * deliberately NOT wired here.
 */

import { requestJson } from './client';
import { billingStatusSchema, type BillingStatus } from './healthSchemas';

export { billingStatusSchema };
export type { BillingStatus };

export async function fetchBillingStatus(): Promise<BillingStatus> {
  const raw = await requestJson<unknown>('/api/stripe/billing-status', {
    method: 'GET',
    apiName: 'StripeApi',
  });
  return billingStatusSchema.parse(raw);
}
