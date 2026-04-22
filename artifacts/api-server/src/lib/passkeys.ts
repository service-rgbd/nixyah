const DEFAULT_PASSKEY_RP_NAME = "Nixyah";
const DEFAULT_ANDROID_PACKAGE_NAME = "com.vini2427.nixyah";
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function normalizeCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fingerprintHexToAndroidOrigin(fingerprint: string): string | null {
  const compactFingerprint = fingerprint.replace(/:/g, "").trim();
  if (!compactFingerprint || compactFingerprint.length % 2 !== 0) {
    return null;
  }

  try {
    const encoded = toBase64Url(Buffer.from(compactFingerprint, "hex"));
    return encoded ? `android:apk-key-hash:${encoded}` : null;
  } catch {
    return null;
  }
}

function deriveOriginFromRpId(rpId: string): string {
  return `https://${rpId}`;
}

export function getPasskeyConfig() {
  const explicitRpId = process.env.PASSKEY_RP_ID?.trim();
  const explicitOrigin = process.env.PASSKEY_ORIGIN?.trim();
  const apiPublicUrl = process.env.API_PUBLIC_URL?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim() || "";

  let derivedRpId = explicitRpId ?? "";
  if (!derivedRpId && apiPublicUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(apiPublicUrl) ? apiPublicUrl : `https://${apiPublicUrl}`);
      derivedRpId = url.hostname;
    } catch {
      derivedRpId = "";
    }
  }

  const rpId = derivedRpId || "api.nixyah.com";
  const rpOrigin = explicitOrigin || deriveOriginFromRpId(rpId);
  const allowedOrigins = Array.from(new Set([
    rpOrigin,
    ...normalizeCsvEnv(process.env.PASSKEY_ALLOWED_ORIGINS),
    ...normalizeCsvEnv(process.env.PASSKEY_ANDROID_SHA256_CERT_FINGERPRINTS)
      .map(fingerprintHexToAndroidOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  ]));

  return {
    rpId,
    rpName: process.env.PASSKEY_RP_NAME?.trim() || DEFAULT_PASSKEY_RP_NAME,
    rpOrigin,
    allowedOrigins,
    androidPackageName: process.env.PASSKEY_ANDROID_PACKAGE_NAME?.trim() || DEFAULT_ANDROID_PACKAGE_NAME,
    androidSha256CertFingerprints: normalizeCsvEnv(process.env.PASSKEY_ANDROID_SHA256_CERT_FINGERPRINTS),
    iosTeamId: process.env.PASSKEY_IOS_TEAM_ID?.trim() || "",
    iosBundleId: process.env.PASSKEY_IOS_BUNDLE_ID?.trim() || "",
  };
}

export function buildAppleAppSiteAssociation() {
  const config = getPasskeyConfig();
  const apps = config.iosTeamId && config.iosBundleId
    ? [`${config.iosTeamId}.${config.iosBundleId}`]
    : [];

  return {
    applinks: {},
    webcredentials: {
      apps,
    },
    appclips: {},
  };
}

export function buildAndroidAssetLinks() {
  const config = getPasskeyConfig();
  if (!config.androidSha256CertFingerprints.length) {
    return [];
  }

  return [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: config.androidPackageName,
        sha256_cert_fingerprints: config.androidSha256CertFingerprints,
      },
    },
  ];
}
