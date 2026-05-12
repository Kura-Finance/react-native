/**
 * RevenueCat Debugger - Quick diagnostic tools
 * Import and call testRevenueCatSetup() in your app to diagnose issues
 */

import Purchases from 'react-native-purchases';
import Logger from './Logger';

export const testRevenueCatSetup = async () => {
  try {
    Logger.info('RevenueCatDebugger', '=== Starting RevenueCat Diagnostics ===');

    // 1. Check if SDK is initialized
    try {
      const subscriber = await Purchases.getCustomerInfo();
      Logger.info('RevenueCatDebugger', '✅ RevenueCat SDK is initialized');
      Logger.info('RevenueCatDebugger', 'Customer Info:', {
        appUserId: subscriber.originalAppUserId,
        entitlements: Object.keys(subscriber.entitlements.active || {}),
      });
    } catch (error) {
      Logger.warn('RevenueCatDebugger', '⚠️ SDK may not be initialized', error);
    }

    // 2. Fetch offerings
    Logger.info('RevenueCatDebugger', 'Fetching offerings...');
    const offerings = await Purchases.getOfferings();

    Logger.info('RevenueCatDebugger', '=== Available Offerings ===');
    if (offerings.all && Object.keys(offerings.all).length > 0) {
      Object.values(offerings.all).forEach((offering: any) => {
        Logger.info('RevenueCatDebugger', `📦 Offering: ${offering.identifier}`);
        offering.availablePackages?.forEach((pkg: any) => {
          Logger.info('RevenueCatDebugger', `  └─ Package: ${pkg.identifier}`, {
            displayName: pkg.displayName,
            price: pkg.product.priceString,
            productId: pkg.product.identifier,
          });
        });
      });
    } else {
      Logger.warn(
        'RevenueCatDebugger',
        '⚠️ No offerings found! Check RevenueCat dashboard.'
      );
    }

    // 3. Current Offering
    Logger.info('RevenueCatDebugger', '=== Current Offering ===');
    if (offerings.current) {
      Logger.info(
        'RevenueCatDebugger',
        `Current: ${offerings.current.identifier}`
      );
      Logger.info(
        'RevenueCatDebugger',
        'Packages in Current Offering:',
        offerings.current.availablePackages?.map((pkg: any) => ({
          identifier: pkg.identifier,
          price: pkg.product.priceString,
        }))
      );
    } else {
      Logger.warn(
        'RevenueCatDebugger',
        '⚠️ No current offering! Set one in RevenueCat dashboard under "Offerings" tab'
      );
    }

    // 4. Expected vs Actual Product IDs
    const expectedProductIds = [
      'kura_pro_annual',
      'kura_ultimate_annual',
      'kura_vip_annual',
    ];

    Logger.info('RevenueCatDebugger', '=== Product ID Validation ===');
    Logger.info('RevenueCatDebugger', 'Expected Product IDs:', expectedProductIds);

    if (offerings.current?.availablePackages) {
      const actualIds = offerings.current.availablePackages.map(
        (pkg: any) => pkg.identifier
      );
      Logger.info('RevenueCatDebugger', 'Actual Product IDs:', actualIds);

      const missing = expectedProductIds.filter((id) => !actualIds.includes(id));
      if (missing.length > 0) {
        Logger.error(
          'RevenueCatDebugger',
          '❌ Missing Product IDs in RevenueCat:',
          missing
        );
      } else {
        Logger.info('RevenueCatDebugger', '✅ All expected products found!');
      }
    }

    Logger.info('RevenueCatDebugger', '=== Diagnostics Complete ===');
  } catch (error) {
    Logger.error('RevenueCatDebugger', 'Diagnostics failed:', error);
  }
};

/**
 * Format product info for display
 */
export const formatProductInfo = (offering: any) => {
  if (!offering?.availablePackages) return 'No packages available';

  return offering.availablePackages
    .map((pkg: any) => `${pkg.identifier}: ${pkg.product.priceString}`)
    .join('\n');
};
