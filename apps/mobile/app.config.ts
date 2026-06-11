import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LifeSync',
  slug: 'lifesync',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F5F3F0',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.lifesync.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F5F3F0',
    },
    package: 'com.lifesync.app',
  },
  plugins: ['expo-router'],
  scheme: 'lifesync',
  experiments: {
    typedRoutes: true,
  },
});
