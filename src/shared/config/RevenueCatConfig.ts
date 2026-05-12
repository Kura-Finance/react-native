// // src/shared/config/RevenueCatConfig.ts
// /**
//  * RevenueCat configuration for in-app purchases
//  * Handles initialization of RevenueCat SDK for iOS and Android
//  * Reference: https://www.revenuecat.com/docs/getting-started/installation/reactnative
//  */
// import Purchases from 'react-native-purchases';
// import Logger from '../utils/Logger';

// const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

// if (!REVENUECAT_API_KEY) {
//   Logger.warn(
//     'RevenueCatConfig',
//     'REVENUECAT_API_KEY environment variable is not defined. In-app purchases will not work. ' +
//       'Please obtain it from https://www.revenuecat.com/ and set it in your environment variables.'
//   );
// }

// /**
//  * Initialize RevenueCat SDK
//  * This should be called once when the app starts (before making any purchases)
//  * Reference: https://www.revenuecat.com/docs/getting-started/configuring-sdk
//  */
// export const initializeRevenueCat = async () => {
//   try {
//     if (!REVENUECAT_API_KEY) {
//       Logger.warn(
//         'RevenueCatConfig',
//         'Skipping RevenueCat initialization - API key not configured'
//       );
//       return;
//     }

//     // Enable debug logs in development
//     if (__DEV__) {
//       await Purchases.setDebugLogsEnabled(true);
//       Logger.debug('RevenueCatConfig', 'RevenueCat debug logs enabled');
//     }

//     // Configure the SDK with API key
//     // Reference: https://www.revenuecat.com/docs/getting-started/configuring-sdk
//     await Purchases.configure({
//       apiKey: REVENUECAT_API_KEY,
//     });

//     Logger.info('RevenueCatConfig', 'RevenueCat SDK initialized successfully');
//   } catch (error) {
//     Logger.error(
//       'RevenueCatConfig',
//       'Failed to initialize RevenueCat',
//       error instanceof Error ? error.message : error
//     );
//   }
// };

// /**
//  * Fetch and debug offerings
//  * Call this to diagnose product configuration issues
//  */
// export const debugOfferings = async () => {
//   try {
//     const offerings = await Purchases.getOfferings();
//     const currentPackages =
//       offerings.current && offerings.current.availablePackages
//         ? offerings.current.availablePackages.map((pkg: any) => ({
//             identifier: pkg.identifier,
//             name: pkg.displayName,
//             price: pkg.product.priceString,
//           }))
//         : [];

//     const allOfferingsList = offerings.all
//       ? Object.values(offerings.all).map((off: any) => ({
//           identifier: off.identifier,
//           packages: off.availablePackages
//             ? off.availablePackages.map((pkg: any) => pkg.identifier)
//             : [],
//         }))
//       : [];

//     Logger.info('RevenueCatConfig', 'Offerings Debug Info', {
//       current: offerings.current?.identifier,
//       currentAvailablePackages: currentPackages,
//       allOfferings: allOfferingsList,
//     });
//     return offerings;
//   } catch (error) {
//     Logger.error('RevenueCatConfig', 'Failed to fetch offerings', error);
//     throw error;
//   }
// };

// /**
//  * Handle purchase errors with user-friendly messages
//  * Reference: https://www.revenuecat.com/docs/test-and-launch/errors
//  */
// export const getPurchaseErrorMessage = (error: unknown): string => {
//   const errorMessage = error instanceof Error ? error.message : String(error);

//   Logger.error('RevenueCatConfig', 'Purchase Error Details', {
//     message: errorMessage,
//     fullError: error,
//   });

//   // Check for common error messages
//   if (
//     errorMessage.includes('cancelled') ||
//     errorMessage.includes('Cancelled')
//   ) {
//     return 'Purchase was cancelled';
//   }
//   if (
//     errorMessage.includes('Network') ||
//     errorMessage.includes('network')
//   ) {
//     return 'Network error. Please check your connection and try again.';
//   }
//   if (
//     errorMessage.includes('Store') ||
//     errorMessage.includes('store')
//   ) {
//     return 'There was a problem with the store. Please try again.';
//   }
//   if (
//     errorMessage.includes('not found') ||
//     errorMessage.includes('Invalid') ||
//     errorMessage.includes('Package')
//   ) {
//     return 'Product not found. Ensure products are configured in RevenueCat dashboard and the correct API key is set.';
//   }

//   return errorMessage || 'An error occurred during the purchase';
// };

/**
 * Placeholder for RevenueCat initialization
 * RevenueCat functionality is currently disabled - all actual code is commented out above
 */
export const initializeRevenueCat = async () => {
  // RevenueCat initialization disabled - placeholder only
  return Promise.resolve();
};

export const debugOfferings = async () => {
  // Placeholder
  return Promise.resolve();
};

export const getPurchaseErrorMessage = (error: unknown): string => {
  return 'In-app purchases are currently unavailable';
};
