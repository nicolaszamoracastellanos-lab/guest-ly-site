import type { ConfigContext, ExpoConfig } from "expo/config";

// Guest-ly for iOS and Android. One codebase, bundle and package
// com.zcventures.guestly. Public env only: the bundle carries the API base,
// the Supabase URL and the anon key. Nothing else.

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.guest-ly.com";

// Purpose strings. The English text lives here and in locales/en.json, the
// Spanish twin in locales/es.json; keep the three in step. They describe what
// the app really does (Part 9 audit, D-028): the camera scans passes at the door
// and photographs a floor plan or a receipt; the photo library feeds the website
// builder, the floor plan and budget receipts. The app never records audio, but
// the camera library links the audio capture API, so a truthful microphone
// string stays (an upload without it can be refused, ITMS-90683).
const CAMERA_PURPOSE = "Guest-ly uses the camera to scan guest passes at the door and to photograph a floor plan or a receipt.";
const PHOTOS_PURPOSE = "Guest-ly lets you pick photos for the wedding website, the floor plan and budget receipts.";
const BIOMETRIC_PURPOSE = "Guest-ly can use biometric unlock instead of asking you to sign in again.";
const MICROPHONE_PURPOSE = "Guest-ly does not record audio. iOS shows this text only if a video with sound is ever captured, which the app does not do.";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Guest-ly",
  slug: "guestly",
  owner: "nzamoras-team",
  // 1.1.0: the portal serves self-serve signup and the pending-wedding
  // states only to builds at 1.1.0 or later (lib/mobile/auth isLegacyApp).
  // At 1.0.0 a new account was answered "unauthorized" after its code and
  // stayed on the verify screen.
  version: "1.1.0",
  orientation: "portrait",
  scheme: "guestly",
  userInterfaceStyle: "dark",
  icon: "./assets/brand/icon.png",
  primaryColor: "#0d1117",
  backgroundColor: "#0d1117",
  // Fingerprint: the runtime changes whenever native code or config changes
  // (a new native module, a font, a plugin), so an OTA update can never reach
  // a binary that lacks what the JS expects. "appVersion" only changed when
  // someone remembered to bump the version.
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    url: "https://u.expo.dev/1c6ed3fa-7393-40e1-be3d-6fd64f0e1056",
    fallbackToCacheTimeout: 0,
  },
  ios: {
    bundleIdentifier: "com.zcventures.guestly",
    supportsTablet: false,
    associatedDomains: ["applinks:app.guest-ly.com", "webcredentials:app.guest-ly.com"],
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: CAMERA_PURPOSE,
      NSFaceIDUsageDescription: BIOMETRIC_PURPOSE,
      // No location string: the app never reads location. Checked on the built
      // sim-dev app before removing it: zero CLLocationManager references in the
      // main binary and in all 17 frameworks (strings, Sep 19 2026).
      NSPhotoLibraryUsageDescription: PHOTOS_PURPOSE,
      NSMicrophoneUsageDescription: MICROPHONE_PURPOSE,
      NSUserNotificationsUsageDescription:
        "Guest-ly sends schedule changes, replies from the couple and RSVP reminders.",
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: ["en", "es"],
      // No UIBackgroundModes: every push the portal sends is a visible alert
      // (no content-available), and the app runs no background task.
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          // Couples and planners upload website images, a floor plan and receipts.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],
    },
  },
  android: {
    package: "com.zcventures.guestly",
    // eas.json sets "appVersionSource": "remote", so EAS owns the real
    // versionCode (confirmed 4 on 2026-09-20, `eas build:version:get -p
    // android`) and this local number is ignored for any EAS build; it is
    // read only if the project is ever built outside EAS.
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/brand/adaptive-foreground.png",
      backgroundColor: "#0d1117",
    },
    permissions: ["CAMERA", "USE_BIOMETRIC", "POST_NOTIFICATIONS", "VIBRATE"],
    // The app never records sound. expo-camera is told so below; expo-image-picker
    // (an automatic plugin) would still add RECORD_AUDIO, so it is blocked here,
    // which writes tools:node="remove" into the manifest whoever asks for it.
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "app.guest-ly.com", pathPrefix: "/i/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    predictiveBackGestureEnabled: true,
  },
  plugins: [
    "expo-router",
    [
      // Only the six faces the app uses, embedded in the binary: no runtime
      // font load gates first paint, and the 22 unused files of the two
      // families stay out of the bundle. Names in src/ui/tokens.ts (fonts).
      "expo-font",
      {
        fonts: [
          "./node_modules/@expo-google-fonts/cormorant-garamond/400Regular_Italic/CormorantGaramond_400Regular_Italic.ttf",
          "./node_modules/@expo-google-fonts/cormorant-garamond/500Medium/CormorantGaramond_500Medium.ttf",
          "./node_modules/@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf",
          "./node_modules/@expo-google-fonts/jost/400Regular/Jost_400Regular.ttf",
          "./node_modules/@expo-google-fonts/jost/500Medium/Jost_500Medium.ttf",
          "./node_modules/@expo-google-fonts/jost/600SemiBold/Jost_600SemiBold.ttf",
        ],
      },
    ],
    "expo-secure-store",
    "expo-localization",
    "expo-apple-authentication",
    [
      "expo-notifications",
      {
        icon: "./assets/brand/notification-icon.png",
        color: "#c9a96e",
        defaultChannel: "default",
      },
    ],
    [
      "expo-camera",
      // recordAudioAndroid false drops RECORD_AUDIO from the Android manifest: the app never records sound.
      { cameraPermission: CAMERA_PURPOSE, microphonePermission: MICROPHONE_PURPOSE, recordAudioAndroid: false },
    ],
    [
      "expo-local-authentication",
      { faceIDPermission: BIOMETRIC_PURPOSE },
    ],
    [
      "expo-splash-screen",
      { backgroundColor: "#0d1117", image: "./assets/brand/splash.png", imageWidth: 120 },
    ],
    // Native date and time pickers (task dates, runsheet times, budget due
    // dates). The plugin only themes the Android dialog; iOS needs nothing.
    "@react-native-community/datetimepicker",
    [
      "expo-build-properties",
      { ios: { deploymentTarget: "16.4" }, android: { minSdkVersion: 26, compileSdkVersion: 36, targetSdkVersion: 36 } },
    ],
  ],
  // Info.plist purpose strings in both languages (es.lproj and en.lproj InfoPlist.strings).
  locales: { en: "./locales/en.json", es: "./locales/es.json" },
  experiments: { typedRoutes: true },
  extra: {
    apiBase: API_BASE,
    eas: { projectId: "1c6ed3fa-7393-40e1-be3d-6fd64f0e1056" },
  },
});
