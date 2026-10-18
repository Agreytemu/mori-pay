import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Thin, defensive wrapper around `expo-local-authentication`.
 *
 * The raw module reports device capability and enrolment inconsistently across
 * runtimes (notably Face ID is unavailable inside Expo Go on iOS). Callers
 * should always treat this as a best-effort capability probe and fall back to
 * the Mori Pay PIN rather than blocking the user.
 */

export type BiometricMethod = 'face' | 'fingerprint' | 'iris';

export type BiometricCapability = {
  /** A face/fingerprint/iris sensor exists on the device. */
  hasHardware: boolean;
  /** The user has enrolled at least one biometric on the device. */
  isEnrolled: boolean;
  /** The modalities the device advertises. */
  methods: BiometricMethod[];
  /** True when authentication can be attempted right now. */
  canAuthenticate: boolean;
  /** Human-friendly name for the available modality, e.g. "Face ID". */
  label: string;
  /** Populated only when `canAuthenticate` is false, explaining why. */
  unavailableReason: string | null;
};

const UNKNOWN_MESSAGE = 'Biometric authentication is not available right now.';

/** Expo Go cannot perform Face ID on iOS, so probe capability accordingly. */
export function isRunningInExpoGo(): boolean {
  try {
    return Constants.expoGoConfig != null;
  } catch {
    return false;
  }
}

function toMethod(type: LocalAuthentication.AuthenticationType): BiometricMethod | null {
  switch (type) {
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return 'face';
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return 'fingerprint';
    case LocalAuthentication.AuthenticationType.IRIS:
      return 'iris';
    default:
      return null;
  }
}

function labelFor(methods: BiometricMethod[]): string {
  if (methods.includes('face')) return Platform.OS === 'ios' ? 'Face ID' : 'face unlock';
  if (methods.includes('fingerprint')) return 'fingerprint';
  if (methods.includes('iris')) return 'iris scan';
  return 'biometrics';
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') {
    return {
      hasHardware: false,
      isEnrolled: false,
      methods: [],
      canAuthenticate: false,
      label: 'biometrics',
      unavailableReason: 'Biometric authentication is available in the iOS and Android apps only.',
    };
  }

  let hasHardware = false;
  let isEnrolled = false;
  let methods: BiometricMethod[] = [];

  try {
    hasHardware = await LocalAuthentication.hasHardwareAsync();
  } catch {
    hasHardware = false;
  }

  try {
    isEnrolled = await LocalAuthentication.isEnrolledAsync();
  } catch {
    isEnrolled = false;
  }

  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    methods = types.map(toMethod).filter((method): method is BiometricMethod => method !== null);
  } catch {
    methods = [];
  }

  const label = labelFor(methods);

  let unavailableReason: string | null = null;
  if (!hasHardware) {
    unavailableReason = 'This device does not have a face or fingerprint sensor.';
  } else if (!isEnrolled) {
    unavailableReason =
      Platform.OS === 'ios'
        ? 'Set up Face ID (or Touch ID) in your device settings first.'
        : 'Enroll a fingerprint or face in your device settings first.';
  } else if (isRunningInExpoGo() && Platform.OS === 'ios' && methods.includes('face')) {
    unavailableReason =
      'Face ID cannot be tested inside Expo Go. Install a development build of Mori Pay to use Face ID.';
  }

  return {
    hasHardware,
    isEnrolled,
    methods,
    canAuthenticate: hasHardware && isEnrolled && unavailableReason === null,
    label,
    unavailableReason,
  };
}

export type BiometricAuthOutcome = {
  ok: boolean;
  cancelled: boolean;
  message: string | null;
};

function messageForError(error: LocalAuthentication.LocalAuthenticationError | undefined): string {
  switch (error) {
    case 'not_enrolled':
      return 'No biometrics are enrolled on this device.';
    case 'not_available':
      return 'Biometric authentication is not available on this device right now.';
    case 'lockout':
      return 'Biometric authentication is locked. Unlock your device, then try again.';
    case 'passcode_not_set':
      return 'Set a device passcode before using biometrics.';
    case 'authentication_failed':
      return 'Your biometric was not recognized. Try again.';
    case 'timeout':
      return 'Biometric authentication timed out. Try again.';
    case 'unable_to_process':
    case 'invalid_context':
    case 'unknown':
      return UNKNOWN_MESSAGE;
    default:
      return UNKNOWN_MESSAGE;
  }
}

/** Attempts biometric authentication, normalising the many error shapes. */
export async function authenticateWithBiometrics(options: {
  promptMessage: string;
  promptDescription?: string;
  cancelLabel?: string;
}): Promise<BiometricAuthOutcome> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: options.promptMessage,
      promptDescription: options.promptDescription,
      cancelLabel: options.cancelLabel ?? 'Cancel',
      disableDeviceFallback: true,
    });

    if (result.success) {
      return { ok: true, cancelled: false, message: null };
    }

    const error = result.error as LocalAuthentication.LocalAuthenticationError | undefined;
    if (error === 'user_cancel' || error === 'system_cancel' || error === 'app_cancel' || error === 'user_fallback') {
      return { ok: false, cancelled: true, message: null };
    }
    return { ok: false, cancelled: false, message: messageForError(error) };
  } catch (thrown) {
    return {
      ok: false,
      cancelled: false,
      message: thrown instanceof Error ? thrown.message : UNKNOWN_MESSAGE,
    };
  }
}

/** Cancels an in-progress Android biometric prompt when the app backgrounds. */
export async function cancelBiometricAuthentication(): Promise<void> {
  if (Platform.OS === 'android') {
    await LocalAuthentication.cancelAuthenticate();
  }
}
