import type { ConfigContext, ExpoConfig } from "expo/config";

// Guest-ly for iOS and Android. One codebase, bundle and package
// com.zcventures.guestly. Public env only: the bundle carries the API base,
// the Supabase URL and the anon key. Nothing else.

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.guest-ly.com";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Guest-ly",
  slug: "guestly",
  owner: "nzamoras-team",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "guestly",
  userInterfaceStyle: "dark",
  icon: "./assets/brand/icon.png",
  primaryColor: "#0d1117",
  backgroundColor: "#0d1117",
  runtimeVersion: { policy: "appVersion" },
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
      NSCameraUsageDescription:
        "Guest-ly uses the camera to scan guest passes at the door.",
      NSFaceIDUsageDescription:
        "Guest-ly can use biometric unlock instead of asking you to sign in again.",
      NSLocationWhenInUseUsageDescription:
        "Guest-ly can remind you when the shuttle is about to leave from your hotel.",
      NSPhotoLibraryUsageDescription:
        "Guest-ly lets you add photos to the shared wedding album.",
      NSUserNotificationsUsageDescription:
        "Guest-ly sends schedule changes, replies from the couple and RSVP reminders.",
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: ["en", "es"],
      UIBackgroundModes: ["remote-notification"],
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
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/brand/adaptive-foreground.png",
      backgroundColor: "#0d1117",
    },
    permissions: ["CAMERA", "USE_BIOMETRIC", "POST_NOTIFICATIONS", "VIBRATE"],
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
      { cameraPermission: "Guest-ly uses the camera to scan guest passes at the door." },
    ],
    [
      "expo-local-authentication",
      { faceIDPermission: "Guest-ly can use biometric unlock instead of asking you to sign in again." },
    ],
    [
      "expo-splash-screen",
      { backgroundColor: "#0d1117", image: "./assets/brand/splash.png", imageWidth: 120 },
    ],
    [
      "expo-build-properties",
      { ios: { deploymentTarget: "16.4" }, android: { minSdkVersion: 26, compileSdkVersion: 36, targetSdkVersion: 36 } },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiBase: API_BASE,
    eas: { projectId: "1c6ed3fa-7393-40e1-be3d-6fd64f0e1056" },
  },
});
