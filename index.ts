// Must be first — patches Object.defineProperty so getter-only `default` exports
// don't throw "Cannot assign to property 'default' which has only a getter" in Hermes.
import './shims/defaultWritable';

// 💡 必须是第一个导入 - 为 React Native 设置 WalletConnect 所需的 polyfills
import '@walletconnect/react-native-compat';

// Polyfill global.crypto.subtle BEFORE any module that uses tssrp6a (SRP-6a)
// or other WebCrypto-dependent libraries.
// react-native-get-random-values only provides getRandomValues, not subtle.
import './src/lib/polyfills/cryptoSubtle';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
