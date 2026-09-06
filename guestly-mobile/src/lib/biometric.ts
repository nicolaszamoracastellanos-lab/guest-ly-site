// Biometric unlock. The label in copy is always "Biometric unlock"; the OS
// decides whether that is a face or a fingerprint.

import * as LocalAuthentication from "expo-local-authentication";

export async function biometricAvailable(): Promise<boolean> {
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hardware && enrolled;
  } catch {
    return false;
  }
}

export async function biometricPrompt(reason: string, fallbackLabel: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: fallbackLabel,
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
