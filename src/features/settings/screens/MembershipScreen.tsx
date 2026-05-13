import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../../shared/store/useAppStore';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type PlanId = 'basic' | 'pro' | 'ultimate';
type BillingCycle = 'monthly' | 'annual';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  color: string;
  monthlyPrice: string | null;
  annualPrice: string | null;
  annualNote: string | null;
  ctaLabel: string;
  ctaStyle: 'filled' | 'outline' | 'disabled';
  badge?: string;
  comingSoon?: boolean;
  inheritFrom?: string;
  features: Feature[];
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Kura Basic',
    tagline: 'Your private finance command center, free forever',
    color: '#10B981',
    monthlyPrice: null,
    annualPrice: null,
    annualNote: null,
    ctaLabel: 'Get Started Free',
    ctaStyle: 'outline',
    features: [
      {
        icon: 'lock-closed',
        title: 'Zero-Access Core',
        description: 'Encrypted account visibility without server-side raw data exposure.',
      },
      {
        icon: 'git-network',
        title: 'Multi-Source Sync',
        description: 'Connect fiat and on-chain sources with strict read-only permissions.',
      },
      {
        icon: 'bar-chart',
        title: 'Privacy Dashboard',
        description: '30-day private analytics with no ad tracking.',
      },
    ],
  },
  {
    id: 'pro',
    name: 'Kura Pro',
    tagline: 'Smarter market insights and everyday money control',
    color: '#8B5CF6',
    monthlyPrice: '$12.99',
    annualPrice: '$10.83',
    annualNote: '$129.99 billed annually',
    ctaLabel: 'Start Pro Trial',
    ctaStyle: 'filled',
    badge: 'Popular',
    inheritFrom: 'Everything in Basic',
    features: [
      {
        icon: 'analytics',
        title: 'Market Intelligence',
        description:
          'Research stocks and crypto with company/token profiles, key metrics, and timely market updates in one place.',
      },
      {
        icon: 'layers',
        title: 'DeFi Protocol Insights',
        description:
          'Monitor protocol health, ecosystem activity, and total value locked (TVL) across leading on-chain ecosystems.',
      },
      {
        icon: 'wallet',
        title: 'Budget Planner',
        description:
          'Track money in and money out, add manual transactions anytime, and tailor categories to fit your real-life spending.',
      },
      {
        icon: 'sync',
        title: 'Priority Sync',
        description:
          '5 manual syncs per day plus scheduled background sync every 6 hours.',
      },
    ],
  },
  {
    id: 'ultimate',
    name: 'Kura Ultimate',
    tagline: 'Institutional-grade analytics for serious operators',
    color: '#F59E0B',
    monthlyPrice: null,
    annualPrice: null,
    annualNote: null,
    ctaLabel: 'Coming Soon',
    ctaStyle: 'disabled',
    comingSoon: true,
    inheritFrom: 'Everything in Pro',
    features: [
      {
        icon: 'swap-horizontal',
        title: 'Impermanent Loss Tracking',
        description:
          'Calculate LP position impact with confidential processing inside a trusted execution environment (TEE).',
      },
      {
        icon: 'document-text',
        title: 'Transaction Support Tax Report',
        description:
          'Export transaction-level tax support reports powered by privacy-preserving calculations inside TEE.',
      },
      {
        icon: 'infinite',
        title: 'Unlimited History',
        description: 'Access your complete historical data and analytics with no retention limits.',
      },
      {
        icon: 'flash',
        title: 'High-Frequency Sync',
        description:
          'Near real-time visibility with 20 manual syncs per day and hourly background sync.',
      },
    ],
  },
];

const ACCENT = '#8B5CF6';

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface Props {
  navigation?: any;
}

export default function MembershipScreen({ navigation }: Props) {
  const userProfile = useAppStore((s) => s.userProfile);
  const [selectedId, setSelectedId] = useState<PlanId>('pro');
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  const currentLabel = (userProfile.membershipLabel || 'basic').toLowerCase();
  const currentPlanId: PlanId = currentLabel.includes('pro')
    ? 'pro'
    : currentLabel.includes('ultimate')
    ? 'ultimate'
    : 'basic';

  const selected = PLANS.find((p) => p.id === selectedId)!;

  const displayPrice = (): { main: string; sub: string } => {
    if (selected.id === 'basic') return { main: 'Free', sub: 'forever' };
    if (selected.comingSoon) return { main: 'Coming', sub: 'Soon' };
    if (billing === 'annual' && selected.annualPrice) {
      return { main: selected.annualPrice, sub: '/mo · ' + selected.annualNote };
    }
    return { main: selected.monthlyPrice ?? '—', sub: '/month' };
  };

  const price = displayPrice();

  const handleCta = () => {
    if (selected.comingSoon) {
      Alert.alert('Coming Soon', 'Kura Ultimate is under active development. Stay tuned!');
      return;
    }
    if (selected.id === 'basic') {
      if (currentPlanId === 'basic') {
        Alert.alert('Current Plan', 'You are already on the Basic plan.');
      }
      return;
    }
    // Pro — future: RevenueCat / Stripe
    Alert.alert(
      'Start Pro Trial',
      'Paid plans are coming soon. A 15-day free trial will be available at launch.',
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.07)',
        }}
      >
        <TouchableOpacity onPress={() => navigation?.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>Plans & Pricing</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
      >
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: ACCENT,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: 8,
            }}
          >
            Simple, Privacy-First Pricing
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 30,
            }}
          >
            Choose the privacy layer{'\n'}that fits your operation
          </Text>
        </View>

        {/* Plan selector pills */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#1A1A24',
            borderRadius: 14,
            padding: 4,
            marginBottom: 24,
          }}
        >
          {PLANS.map((plan) => {
            const isActive = selectedId === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelectedId(plan.id)}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: 11,
                  alignItems: 'center',
                  backgroundColor: isActive ? plan.color : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isActive ? '#FFFFFF' : '#888888',
                  }}
                >
                  {plan.id === 'ultimate' ? 'Ultimate' : plan.id === 'pro' ? 'Pro' : 'Basic'}
                </Text>
                {plan.badge && (
                  <Text style={{ fontSize: 9, color: isActive ? '#FFFFFFCC' : '#555', marginTop: 1 }}>
                    {plan.badge}
                  </Text>
                )}
                {plan.comingSoon && (
                  <Text style={{ fontSize: 9, color: isActive ? '#FFFFFFCC' : '#555', marginTop: 1 }}>
                    Soon
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Plan card */}
        <View
          style={{
            backgroundColor: `${selected.color}10`,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: `${selected.color}50`,
            padding: 22,
            marginBottom: 24,
          }}
        >
          {/* Badge row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            {selected.badge && (
              <View
                style={{
                  backgroundColor: selected.color,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                  {selected.badge}
                </Text>
              </View>
            )}
            {selected.comingSoon && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: selected.color,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: selected.color, fontSize: 11, fontWeight: '700' }}>
                  Coming Soon
                </Text>
              </View>
            )}
            {currentPlanId === selected.id && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#555',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: '#AAA', fontSize: 11, fontWeight: '600' }}>
                  Current Plan
                </Text>
              </View>
            )}
          </View>

          {/* Plan name + tagline */}
          <Text style={{ fontSize: 20, fontWeight: '800', color: selected.color, marginBottom: 4 }}>
            {selected.name}
          </Text>
          <Text style={{ fontSize: 13, color: '#999999', marginBottom: 20, lineHeight: 18 }}>
            {selected.tagline}
          </Text>

          {/* Price */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: '#FFFFFF' }}>
              {price.main}
            </Text>
            <Text style={{ fontSize: 13, color: '#888', marginLeft: 6 }}>{price.sub}</Text>
          </View>

          {/* Billing toggle (Pro only) */}
          {selected.id === 'pro' && !selected.comingSoon && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => (
                <TouchableOpacity
                  key={cycle}
                  onPress={() => setBilling(cycle)}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    backgroundColor:
                      billing === cycle ? selected.color : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: billing === cycle ? 'transparent' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: billing === cycle ? '#FFF' : '#888',
                    }}
                  >
                    {cycle === 'monthly' ? 'Monthly' : 'Annual · Save 17%'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!selected.id && <View style={{ marginBottom: 20 }} />}

          {/* CTA button */}
          <TouchableOpacity
            onPress={handleCta}
            disabled={selected.ctaStyle === 'disabled' || currentPlanId === selected.id}
            style={{
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor:
                selected.ctaStyle === 'filled' && currentPlanId !== selected.id
                  ? selected.color
                  : 'transparent',
              borderWidth:
                selected.ctaStyle === 'outline' && currentPlanId !== selected.id ? 2 : 0,
              borderColor:
                selected.ctaStyle === 'outline' ? selected.color : 'transparent',
              opacity: selected.ctaStyle === 'disabled' || currentPlanId === selected.id ? 0.4 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color:
                  selected.ctaStyle === 'outline' ? selected.color : '#FFFFFF',
              }}
            >
              {currentPlanId === selected.id ? 'Current Plan' : selected.ctaLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={{ marginBottom: 32 }}>
          {selected.inheritFrom && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
              }}
            >
              <Ionicons name="checkmark-circle" size={16} color={selected.color} />
              <Text style={{ fontSize: 13, color: '#CCCCCC', fontWeight: '500' }}>
                {selected.inheritFrom}
              </Text>
            </View>
          )}

          {selected.features.map((feat, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                gap: 14,
                marginBottom: 18,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  backgroundColor: `${selected.color}18`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ionicons name={feat.icon as any} size={20} color={selected.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 }}
                >
                  {feat.title}
                </Text>
                <Text style={{ fontSize: 12, color: '#888888', lineHeight: 18 }}>
                  {feat.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* FAQ teaser */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.07)',
            paddingTop: 24,
            gap: 14,
          }}
        >
          {[
            { q: 'Is my data secure?', a: 'Zero-access design — our servers cannot read your raw financial records.' },
            { q: 'Can I switch plans anytime?', a: 'Yes. Upgrade or downgrade at any time with no lock-in.' },
            { q: 'Is there a free trial?', a: 'Pro includes a 15-day free trial at launch.' },
          ].map((item, i) => (
            <View key={i}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#DDDDDD', marginBottom: 3 }}>
                {item.q}
              </Text>
              <Text style={{ fontSize: 12, color: '#777777', lineHeight: 18 }}>{item.a}</Text>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => Linking.openURL('https://kura-finance.com/pricing')}
            style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{ fontSize: 13, color: ACCENT, fontWeight: '600' }}>Full pricing details</Text>
            <Ionicons name="arrow-forward" size={13} color={ACCENT} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
