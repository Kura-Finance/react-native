// 💡 必须是第一个导入 - 为 React Native 设置 WalletConnect 所需的 polyfills
import '@walletconnect/react-native-compat';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
