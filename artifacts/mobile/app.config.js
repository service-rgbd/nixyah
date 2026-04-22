const fs = require("node:fs");
const path = require("node:path");

const baseConfig = require("./app.json");

const resolvedEnvGoogleServicesFile = process.env.GOOGLE_SERVICES_JSON;
const localGoogleServicesFile = path.join(__dirname, "google-services.json");
const passkeyRpId = process.env.EXPO_PUBLIC_PASSKEY_RP_ID || process.env.PASSKEY_RP_ID || "";
const publicApiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_PUBLIC_URL || "https://api.nixyah.com/api";
const useLocalApi = process.env.EXPO_PUBLIC_USE_LOCAL_API || "0";

const expoConfig = {
  ...baseConfig.expo,
  android: {
    ...(baseConfig.expo.android ?? {}),
  },
  ios: {
    ...(baseConfig.expo.ios ?? {}),
  },
  extra: {
    ...(baseConfig.expo.extra ?? {}),
    EXPO_PUBLIC_API_URL: publicApiUrl,
    EXPO_PUBLIC_USE_LOCAL_API: useLocalApi,
    passkeys: {
      rpId: passkeyRpId || null,
      androidPackageName: process.env.PASSKEY_ANDROID_PACKAGE_NAME || baseConfig.expo.android?.package || null,
      iosBundleId: process.env.PASSKEY_IOS_BUNDLE_ID || baseConfig.expo.ios?.bundleIdentifier || null,
    },
  },
};

if (passkeyRpId) {
  expoConfig.ios.associatedDomains = Array.from(new Set([
    ...(baseConfig.expo.ios?.associatedDomains ?? []),
    `webcredentials:${passkeyRpId}`,
  ]));
}

if (resolvedEnvGoogleServicesFile) {
  expoConfig.android.googleServicesFile = resolvedEnvGoogleServicesFile;
} else if (fs.existsSync(localGoogleServicesFile)) {
  expoConfig.android.googleServicesFile = "./google-services.json";
}

module.exports = {
  expo: expoConfig,
};
