import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { color } from '../theme';
import { ProceduralPhoto } from './ProceduralPhoto';

// ---------------------------------------------------------------------------
// The live viewfinder.
//
// Native gets a real expo-camera preview. Web gets the procedural stand-in so
// the dev preview keeps working, because expo-camera has no useful web path
// here and the browser is where most of this app gets reviewed.
//
// Loaded lazily on native for the same reason notify.ts is: keeping the native
// module out of the web bundle entirely is more reliable than importing it and
// then guarding every call site.
//
// PRD 4.4 [HARD CONSTRAINT]: live capture only. There is no gallery path in
// this component and no media permission is ever requested. If a future edit
// adds one, it breaks a promise the onboarding copy makes explicitly.
// ---------------------------------------------------------------------------

export const CAMERA_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

export interface Shot {
  /** Local file URI on native, or null when the stand-in produced it. */
  uri: string | null;
  /** Stable seed so the confirmation thumbnails match what was shot. */
  seed: number;
}

export interface CameraStageHandle {
  capture: () => Promise<Shot>;
}

interface Props {
  facing: 'back' | 'front';
  width: number;
  height: number;
  /** Seed for the web stand-in. Ignored on native. */
  seed: number;
  onReady?: () => void;
}

/** Resolved once, on native only. */
let cameraModule: typeof import('expo-camera') | null = null;

export async function loadCamera() {
  if (!CAMERA_SUPPORTED) return null;
  if (!cameraModule) cameraModule = await import('expo-camera');
  return cameraModule;
}

/**
 * Asks for camera permission at the moment it is needed, never at launch.
 * Returns false rather than throwing when refused: a refusal is a normal
 * answer and the caller shows the explainer.
 */
export async function ensureCameraPermission(): Promise<boolean> {
  const mod = await loadCamera();
  if (!mod) return false;
  try {
    const current = await mod.Camera.getCameraPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await mod.Camera.requestCameraPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export const CameraStage = forwardRef<CameraStageHandle, Props>(function CameraStage(
  { facing, width, height, seed, onReady },
  ref,
) {
  const nativeRef = useRef<any>(null);
  const [mod, setMod] = useState<typeof import('expo-camera') | null>(cameraModule);

  React.useEffect(() => {
    let live = true;
    loadCamera().then((m) => {
      if (live) setMod(m);
    });
    return () => {
      live = false;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    capture: async () => {
      if (!nativeRef.current) return { uri: null, seed };
      try {
        const photo = await nativeRef.current.takePictureAsync({
          quality: 0.6,
          // The frame is analysed and uploaded, never shown at full size, so
          // orientation processing is wasted work inside a 60 second window.
          skipProcessing: true,
          exif: true,
        });
        return { uri: photo?.uri ?? null, seed };
      } catch {
        return { uri: null, seed };
      }
    },
  }));

  if (!CAMERA_SUPPORTED || !mod) {
    return (
      <ProceduralPhoto
        seed={seed}
        width={width}
        height={height}
        variant={facing === 'back' ? 'back' : 'front'}
      />
    );
  }

  const { CameraView } = mod;
  return (
    <View style={{ width, height, backgroundColor: color.black }}>
      <CameraView
        ref={nativeRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mute
        onCameraReady={onReady}
      />
    </View>
  );
});
