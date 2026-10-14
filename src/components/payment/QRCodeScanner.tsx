import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { useAppTheme } from '@/theme';

export function QRCodeScanner({
  onScan,
  onCancel,
}: {
  onScan: (data: string) => void;
  onCancel: () => void;
}) {
  const { colors, space } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraInstance, setCameraInstance] = useState(0);
  const handledScan = useRef(false);

  const askForPermission = async () => {
    setPermissionError(null);
    try {
      await requestPermission();
    } catch (error) {
      setPermissionError(
        error instanceof Error ? error.message : 'Could not request camera access.',
      );
    }
  };

  if (!permission) {
    return (
      <View style={[styles.permission, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="bodySmall" color={colors.textSecondary}>
          Checking camera permission…
        </AppText>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permission, { backgroundColor: colors.background, padding: space.xl }]}>
        <AppText variant="title2" align="center">Camera access needed</AppText>
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          Allow Mori Pay to use the camera to scan a payment QR code.
        </AppText>
        {permissionError ? (
          <AppText variant="bodySmall" color={colors.error} align="center">
            {permissionError}
          </AppText>
        ) : null}
        {permission.canAskAgain ? (
          <PrimaryButton label="Allow camera" block onPress={() => void askForPermission()} />
        ) : (
          <AppText variant="caption" color={colors.textTertiary} align="center">
            Camera access is disabled for Mori Pay. Enable it in your device settings to scan a code.
          </AppText>
        )}
        <SecondaryButton label="Cancel" block onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.scanner}>
      <CameraView
        key={cameraInstance}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onCameraReady={() => {
          setCameraReady(true);
          setCameraError(null);
        }}
        onMountError={({ message }) => {
          setCameraReady(false);
          setCameraError(message);
        }}
        onBarcodeScanned={({ data }) => {
          if (handledScan.current) return;
          handledScan.current = true;
          onScan(data);
        }}
      />
      {!cameraReady && !cameraError ? (
        <View style={styles.cameraStatus}>
          <ActivityIndicator color="#FFFFFF" />
          <AppText variant="bodySmall" color="#FFFFFF" align="center">
            Starting camera…
          </AppText>
        </View>
      ) : null}
      {cameraError ? (
        <View style={[styles.cameraError, { padding: space.lg }]}>
          <AppText variant="bodyStrong" color="#FFFFFF" align="center">
            Camera preview could not start
          </AppText>
          <AppText variant="caption" color="#FFFFFF" align="center">
            {cameraError}
          </AppText>
          <PrimaryButton
            label="Try camera again"
            block
            onPress={() => {
              setCameraReady(false);
              setCameraError(null);
              setCameraInstance((value) => value + 1);
            }}
          />
        </View>
      ) : null}
      <View style={[styles.scanHeader, { padding: space.lg }]}>
        <AppText variant="bodyStrong" color="#FFFFFF" align="center">
          Point your camera at a Mori Pay QR code
        </AppText>
      </View>
      <View style={[styles.scanFooter, { padding: space.lg }]}>
        <SecondaryButton label="Cancel" block onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scanner: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#111111' },
  cameraStatus: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cameraError: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scanHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  scanFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
});
