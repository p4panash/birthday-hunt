import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.useadonis.goodloot',
  appName: 'goodLoot',
  // Native shell loads the live web app. Same SW + same updates as the
  // browser. If a future store reviewer flags this as a "WebView wrapper"
  // (Apple guideline 4.2), we switch to bundled mode: drop server.url and
  // set webDir to 'dist' (npm run build && npx cap sync).
  server: {
    url: 'https://hunt.use-adonis.com',
    cleartext: false,
    // Tell the OS to allow the deep-link scheme to bounce back here.
    androidScheme: 'https',
  },
  // Fallback web dir when server.url is unset (bundled mode).
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#1F1430',
    // Disable the bouncy scroll past the page bounds — the SPA owns its
    // own scroll containers.
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#1F1430',
    // Allow mixed content during dev (mock GPS testing on localhost
    // tunnels); production loads HTTPS only.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#1F1430',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1F1430',
      overlaysWebView: false,
    },
    PushNotifications: {
      // No custom sound; rely on the OS default.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
