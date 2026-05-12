import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
// import Purchases from 'react-native-purchases';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useAppStore } from '../../../shared/store/useAppStore';
// import { getPurchaseErrorMessage } from '../../../shared/config/RevenueCatConfig';

type MembershipTier = 'basic' | 'pro' | 'ultimate' | 'vip';

interface TierFeature {
  icon: string;
  name: string;
  description: string;
}

interface TierData {
  name: string;
  price: string;
  features: TierFeature[];
  color: string;
  productId: string; // RevenueCat Product ID
}

const MEMBERSHIP_TIERS: Record<MembershipTier, TierData> = {
  basic: {
    name: 'Basic',
    price: 'membership.basic.name',
    color: '#10B981',
    productId: 'kura_basic', // Free tier, no purchase needed
    features: [
      {
        icon: 'link',
        name: 'membership.basic.unlimitedConnections',
        description: 'membership.basic.unlimitedConnectionsDesc',
      },
      {
        icon: 'trending-up',
        name: 'membership.basic.netWorth',
        description: 'membership.basic.netWorthDesc',
      },
      {
        icon: 'calendar',
        name: 'membership.basic.thirtyDayHistory',
        description: 'membership.basic.thirtyDayHistoryDesc',
      },
    ],
  },
  pro: {
    name: 'Pro',
    price: 'membership.pro.name',
    color: '#3B82F6',
    productId: 'kura_pro_annual', // RevenueCat Product ID
    features: [
      {
        icon: 'alert-circle',
        name: 'membership.pro.crossDomainAlerts',
        description: 'membership.pro.crossDomainAlertsDesc',
      },
      {
        icon: 'document-text',
        name: 'membership.pro.taxExport',
        description: 'membership.pro.taxExportDesc',
      },
      {
        icon: 'infinite',
        name: 'membership.pro.permanentHistory',
        description: 'membership.pro.permanentHistoryDesc',
      },
      {
        icon: 'sync',
        name: 'membership.pro.advancedSync',
        description: 'membership.pro.advancedSyncDesc',
      },
    ],
  },
  ultimate: {
    name: 'Ultimate',
    price: 'membership.ultimate.name',
    color: '#8B5CF6',
    productId: 'kura_ultimate_annual', // RevenueCat Product ID
    features: [
      {
        icon: 'layers',
        name: 'membership.ultimate.defiAnalytics',
        description: 'membership.ultimate.defiAnalyticsDesc',
      },
      {
        icon: 'notifications',
        name: 'membership.ultimate.realTimeAlerts',
        description: 'membership.ultimate.realTimeAlertsDesc',
      },
      {
        icon: 'flash',
        name: 'membership.ultimate.highFreqSync',
        description: 'membership.ultimate.highFreqSyncDesc',
      },
    ],
  },
  vip: {
    name: 'VIP',
    price: 'membership.vip.name',
    color: '#F59E0B',
    productId: 'kura_vip_annual', // RevenueCat Product ID
    features: [
      {
        icon: 'server',
        name: 'membership.vip.customNode',
        description: 'membership.vip.customNodeDesc',
      },
      {
        icon: 'code',
        name: 'membership.vip.developerApi',
        description: 'membership.vip.developerApiDesc',
      },
    ],
  },
};

interface MembershipScreenProps {
  navigation?: any;
}

export default function MembershipScreen({ navigation }: MembershipScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const userProfile = useAppStore((state) => state.userProfile);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Get current membership tier from Store and normalize it
  const getMembershipTierFromLabel = (label: string): MembershipTier => {
    if (!label) return 'basic';
    
    const normalizedLabel = label.toLowerCase();
    
    // Handle different label formats
    if (normalizedLabel.includes('basic')) return 'basic';
    if (normalizedLabel.includes('pro')) return 'pro';
    if (normalizedLabel.includes('ultimate')) return 'ultimate';
    if (normalizedLabel.includes('vip')) return 'vip';
    
    return 'basic'; // fallback
  };

  const currentMembershipTier = getMembershipTierFromLabel(userProfile.membershipLabel);

  // Initialize selected tier to current membership tier
  const [selectedTier, setSelectedTier] = useState<MembershipTier>(currentMembershipTier);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const currentTier = MEMBERSHIP_TIERS[selectedTier];

  const handleUpgrade = async () => {
    try {
      setIsPurchasing(true);

      // Special handling for VIP - KEEP THIS PART UNCHANGED
      if (selectedTier === 'vip') {
        Alert.alert(
          'Contact Sales',
          'Please contact our sales team for VIP pricing',
          [
            { text: 'Cancel', onPress: () => setIsPurchasing(false) },
            { 
              text: 'Email Us',
              onPress: () => {
                // Open email client
                setIsPurchasing(false);
                // TODO: Implement email link
              }
            },
          ]
        );
        return;
      }

      // Basic tier - no purchase needed
      if (selectedTier === 'basic') {
        Alert.alert(
          'Already on Basic',
          'You are already on the Basic plan',
          [{ text: 'OK', onPress: () => setIsPurchasing(false) }]
        );
        return;
      }

      // COMING SOON - Show notification for Pro and Ultimate tiers
      Alert.alert(
        'Coming Soon',
        'This feature is coming soon, please stay tuned!',
        [{ text: 'OK', onPress: () => setIsPurchasing(false) }]
      );
      return;

      /* ===== PURCHASE LOGIC COMMENTED OUT - COMING SOON ===== */
      // // Get the product ID for selected tier
      // const productId = currentTier.productId;
      // const tierName = currentTier.name;

      // // Get available offerings from RevenueCat
      // // Reference: https://www.revenuecat.com/docs/getting-started/displaying-products
      // const offerings = await Purchases.getOfferings();

      // if (!offerings.current) {
      //   // Debug: Log all available offerings
      //   const allOfferingIds = offerings.all
      //     ? Object.values(offerings.all).map((o: any) => o.identifier)
      //     : [];
      //   console.log('DEBUG: All offerings:', allOfferingIds);
      //   throw new Error(
      //     'No subscription plans available. Please try again later.'
      //   );
      // }

      // const offering = offerings.current;

      // if (
      //   !offering.availablePackages ||
      //   offering.availablePackages.length === 0
      // ) {
      //   throw new Error('No packages available for purchase');
      // }

      // // Debug logging
      // console.log('DEBUG: Looking for productId:', productId);
      // const packageList = (offering.availablePackages || []).map(
      //   (pkg: any) => ({
      //     identifier: pkg.identifier,
      //     displayName: pkg.displayName,
      //   })
      // );
      // console.log('DEBUG: Available packages:', packageList);

      // // Find the package matching our product ID
      // const selectedPackage = offering.availablePackages.find(
      //   (pkg: any) => pkg.identifier === productId
      // );

      // if (!selectedPackage) {
      //   const availableIds = (offering.availablePackages || [])
      //     .map((pkg: any) => pkg.identifier)
      //     .join(', ');
      //   throw new Error(
      //     `Package ${productId} not found. Available packages: ${availableIds}. Please ensure the product is configured in RevenueCat dashboard.`
      //   );
      // }

      // // Show purchase confirmation with pricing
      // // Reference: https://www.revenuecat.com/docs/getting-started/making-purchases
      // const priceString = selectedPackage.product.priceString || 'Check AppStore';
      // Alert.alert(`Subscribe to ${tierName}`, `Price: ${priceString}`, [
      //   {
      //     text: 'Cancel',
      //     onPress: () => setIsPurchasing(false),
      //     style: 'cancel',
      //   },
      //   {
      //     text: 'Subscribe',
      //     onPress: async () => {
      //       try {
      //         // Perform the purchase
      //         const purchaseResult = await Purchases.purchasePackage(
      //           selectedPackage
      //         );

      //         // Check if purchase was successful by verifying entitlements
      //         const { customerInfo } = purchaseResult;
      //         const entitlements = customerInfo.entitlements.active;

      //         // Check if any entitlement is active (indicating successful purchase)
      //         if (Object.keys(entitlements).length > 0) {
      //           Alert.alert(
      //             'Success',
      //             `Welcome to ${tierName}! Your subscription is now active.`,
      //             [
      //               {
      //                 text: 'OK',
      //                 onPress: () => {
      //                   setIsPurchasing(false);
      //                   navigation?.goBack();
      //                 },
      //               },
      //             ]
      //           );
      //         } else {
      //           throw new Error(
      //             'Purchase completed but subscription was not activated'
      //           );
      //         }
      //       } catch (purchaseError) {
      //         // Handle purchase errors
      //         const errorMsg =
      //           purchaseError instanceof Error
      //             ? purchaseError.message
      //             : String(purchaseError);

      //         // Check if user cancelled
      //         if (
      //           errorMsg.includes('cancelled') ||
      //           errorMsg.includes('Cancelled')
      //         ) {
      //           setIsPurchasing(false);
      //           return;
      //         }

      //         throw purchaseError;
      //       }
      //     },
      //   },
      // ]);
      /* ===== END OF COMMENTED PURCHASE LOGIC ===== */
    } catch (error) {
      // const errorMessage = getPurchaseErrorMessage(error);
      
      // Alert.alert(
      //   'Purchase Failed',
      //   errorMessage,
      //   [{ text: 'OK', onPress: () => setIsPurchasing(false) }]
      // );
    }
  };

  // Get button text based on user's current tier vs selected tier
  const getButtonText = () => {
    // VIP tier - show custom text
    if (selectedTier === 'vip') {
      return t('membership.contactSales') || 'Contact Sales';
    }

    // Pro and Ultimate tiers - show "Coming Soon" (尚未推出)
    if (selectedTier === 'pro' || selectedTier === 'ultimate') {
      return 'Coming Soon';
    }

    // Basic tier
    const tierHierarchy = ['basic', 'pro', 'ultimate', 'vip'];
    const selectedTierIndex = tierHierarchy.indexOf(selectedTier);
    const currentTierIndex = tierHierarchy.indexOf(currentMembershipTier);

    if (selectedTierIndex === currentTierIndex) {
      return t('membership.currentPlan') || 'Current Plan';
    } else if (selectedTierIndex > currentTierIndex) {
      return `${t('membership.upgradeTo')} ${currentTier.name}`;
    } else {
      return `${t('membership.downgradeTo')} ${currentTier.name}`;
    }
  };

  const getPriceDisplay = () => {
    if (selectedTier === 'basic') {
      return {
        price: t('membership.basic.price') || '免費',
        period: '',
        note: '',
        isBasic: true,
      };
    }

    if (selectedTier === 'vip') {
      return {
        price: t('membership.vip.price'),
        period: t('membership.vip.priceNote'),
        note: t('membership.contactSalesDesc'),
        isVIP: true,
      };
    }

    if (selectedTier === 'pro') {
      const price = billingCycle === 'monthly' 
        ? t('membership.pro.monthlyPrice')
        : t('membership.pro.annualPrice');
      const period = billingCycle === 'monthly'
        ? t('membership.perMonth')
        : t('membership.perYear');
      const note = billingCycle === 'annual'
        ? t('membership.pro.annualPriceNote')
        : '';
      return { price, period, note, isVIP: false };
    }

    // Ultimate
    const price = billingCycle === 'monthly'
      ? t('membership.ultimate.monthlyPrice')
      : t('membership.ultimate.annualPrice');
    const period = billingCycle === 'monthly'
      ? t('membership.perMonth')
      : t('membership.perYear');
    const note = billingCycle === 'annual'
      ? t('membership.ultimate.annualPriceNote')
      : '';
    return { price, period, note, isVIP: false };
  };

  const priceDisplay = getPriceDisplay();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#333333',
        }}
      >
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: '600',
            color: '#FFFFFF',
            marginLeft: 12,
          }}
        >
          {t('membership.title')}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tier Selection */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          {(['basic', 'pro', 'ultimate', 'vip'] as MembershipTier[]).map((tier) => {
            const tierData = MEMBERSHIP_TIERS[tier];
            const isSelected = selectedTier === tier;

            return (
              <TouchableOpacity
                key={tier}
                onPress={() => setSelectedTier(tier)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 12,
                  backgroundColor: isSelected
                    ? `${tierData.color}20`
                    : 'rgba(255, 255, 255, 0.05)',
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? tierData.color : '#333333',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isSelected ? tierData.color : '#999999',
                    textAlign: 'center',
                  }}
                >
                  {tierData.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Price Section */}
        <View
          style={{
            backgroundColor: priceDisplay.isBasic 
              ? 'rgba(16, 185, 129, 0.1)' 
              : priceDisplay.isVIP 
              ? 'rgba(245, 158, 11, 0.1)' 
              : 'rgba(139, 92, 246, 0.1)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: currentTier.color,
          }}
        >
          {/* Price Header with Billing Cycle Toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            {/* Price Display */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: '700',
                    color: currentTier.color,
                  }}
                >
                  {priceDisplay.price}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#999999',
                  }}
                >
                  {priceDisplay.period}
                </Text>
              </View>
              
              {priceDisplay.note && (
                <Text
                  style={{
                    fontSize: 12,
                    color: '#999999',
                  }}
                >
                  {priceDisplay.note}
                </Text>
              )}
            </View>

            {/* Billing Cycle Toggle - Right Side (only for Pro and Ultimate) */}
            {selectedTier !== 'basic' && selectedTier !== 'vip' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setBillingCycle('monthly')}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: billingCycle === 'monthly' ? currentTier.color : 'rgba(255, 255, 255, 0.05)',
                    borderWidth: billingCycle === 'monthly' ? 0 : 1,
                    borderColor: '#333333',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: billingCycle === 'monthly' ? '#FFFFFF' : '#999999',
                    }}
                  >
                    {t('membership.monthly')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setBillingCycle('annual')}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: billingCycle === 'annual' ? currentTier.color : 'rgba(255, 255, 255, 0.05)',
                    borderWidth: billingCycle === 'annual' ? 0 : 1,
                    borderColor: '#333333',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: billingCycle === 'annual' ? '#FFFFFF' : '#999999',
                    }}
                  >
                    {t('membership.annual')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={handleUpgrade}
            disabled={isPurchasing || selectedTier === currentMembershipTier || selectedTier === 'pro' || selectedTier === 'ultimate'}
            style={{
              backgroundColor: isPurchasing || selectedTier === currentMembershipTier || selectedTier === 'pro' || selectedTier === 'ultimate' ? '#999999' : currentTier.color,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isPurchasing && <ActivityIndicator color="#FFFFFF" />}
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#FFFFFF',
              }}
            >
              {isPurchasing ? 'Processing...' : getButtonText()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features Section */}
        <View style={{ marginBottom: 32 }}>
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 4,
              }}
            >
              {t('membership.features')}
            </Text>
            {selectedTier !== 'basic' && (
              <Text
                style={{
                  fontSize: 12,
                  color: '#999999',
                }}
              >
                {selectedTier === 'pro' && t('membership.includesAllBasic')}
                {selectedTier === 'ultimate' && t('membership.includesAllPro')}
                {selectedTier === 'vip' && t('membership.includesAllUltimate')}
              </Text>
            )}
          </View>

          {currentTier.features.map((feature, index) => (
            <View key={index} style={{ marginBottom: 16, flexDirection: 'row', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: `rgba(139, 92, 246, 0.1)`,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name={feature.icon as any} size={20} color={currentTier.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#FFFFFF',
                    marginBottom: 4,
                  }}
                >
                  {t(feature.name)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#999999',
                  }}
                >
                  {t(feature.description)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
