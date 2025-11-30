import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.esimediag05.app',
  appName: 'esi-media-g05',
  webDir: 'dist/EsiMediaFE/browser/',

  server: {
    androidScheme: 'http',
    allowNavigation: [
      "10.0.2.2",
      "192.168.0.10"
    ],
    cleartext: true
  }
};

export default config;
