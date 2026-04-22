# Android Play Store Release

This project is prepared for Android publishing only. iOS remains separate.

## Current Android identifiers

- Expo project: `8d45b27c-1dd3-47b7-b34c-46c7eb7d0303`
- Android package: `com.vini2427.nixyah`
- Owner: `vini2427`

## Config already in place

- Preview Android build profile: `android-preview`
- Production Android build profile: `android-production`
- Internal Play submit profile: `android-internal`
- Production Play submit profile: `android-production`
- Remote app versioning enabled in EAS
- Production Android build outputs an AAB

## Required before submit

1. Create a Google Play service account in Play Console.
2. Grant it at least app release permissions for the Nixyah app.
3. Download the JSON key.
4. Put the key at `artifacts/mobile/keys/google-play-service-account.json`.
5. In Play Console, create the app once if it does not exist yet.
6. Complete the mandatory Play Console forms:
   - App access
   - Data safety
   - Content rating
   - Ads declaration
   - Target audience
   - Privacy policy URL

## Suggested release flow

1. Build a preview APK for internal testing:

```bash
pnpm -C artifacts/mobile build:android:preview
```

2. Build the production AAB:

```bash
pnpm -C artifacts/mobile build:android:production
```

3. Submit the latest Android build to the internal track:

```bash
pnpm -C artifacts/mobile submit:android:internal
```

4. When the store listing and policy forms are complete, submit the latest Android build to production as a draft:

```bash
pnpm -C artifacts/mobile submit:android:production
```

The production submit profile is intentionally set to `draft` so the release is not published automatically.

## Store assets to prepare

Google Play usually expects these assets:

- App icon: 512 x 512 PNG
- Feature graphic: 1024 x 500 PNG or JPG
- Phone screenshots: at least 2
- Short description
- Full description
- Privacy policy URL

Current repo assets already include the app icon and splash sources, but store-specific graphics and screenshots still need to be prepared manually.

## Notes

- Do not keep the service account key in git.
- EAS remote versioning manages Android version increments.
- Use the deployed API for release builds:
  - `EXPO_PUBLIC_USE_LOCAL_API=0`
  - `EXPO_PUBLIC_API_URL=https://api.nixyah.com/api`