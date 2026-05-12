import i18n from 'i18next';
import { use } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as locales from './index';

use(initReactI18next).init({
  resources: locales.resources,
  lng: 'zh-TW',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  react: {
    useSuspense: false, // For React Native compatibility
  },
  interpolation: {
    escapeValue: false, // React already prevents XSS
  },
});

export default i18n;
