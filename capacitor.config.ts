import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',   // deja el tuyo
  appName: 'mell-app',         // deja el tuyo
  webDir: 'www',               // deja el tuyo
  android: {
    allowMixedContent: true,
  },
};

export default config;
