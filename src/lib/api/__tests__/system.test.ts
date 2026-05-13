import { describe, expect, test } from 'vitest';
import { billingStatusSchema, healthResponseSchema } from '../healthSchemas';

describe('healthResponseSchema', () => {
  test('parses healthy response', () => {
    const out = healthResponseSchema.parse({
      status: 'healthy',
      timestamp: '2026-05-13T00:00:00Z',
      uptime: 3600.5,
      environment: 'production',
    });
    expect(out.status).toBe('healthy');
    expect(out.uptime).toBe(3600.5);
  });

  test('rejects missing status', () => {
    expect(() =>
      healthResponseSchema.parse({
        timestamp: '2026-05-13T00:00:00Z',
        uptime: 1,
        environment: 'dev',
      }),
    ).toThrow();
  });

  test('rejects non-string status', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 1,
        timestamp: '2026-05-13T00:00:00Z',
        uptime: 1,
        environment: 'dev',
      }),
    ).toThrow();
  });
});

describe('billingStatusSchema', () => {
  test('parses a full billing-status payload', () => {
    const out = billingStatusSchema.parse({
      tier: 'Pro',
      hasActiveSubscription: true,
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_123',
      currentPeriodEnd: '2026-06-13T00:00:00Z',
      cancelAtPeriodEnd: false,
    });
    expect(out.tier).toBe('Pro');
    expect(out.hasActiveSubscription).toBe(true);
  });

  test('accepts nulls for unsubscribed users', () => {
    const out = billingStatusSchema.parse({
      tier: 'Basic',
      hasActiveSubscription: false,
      subscriptionStatus: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(out.subscriptionStatus).toBeNull();
  });
});
