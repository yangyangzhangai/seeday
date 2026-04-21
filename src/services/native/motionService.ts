export interface TiltVector {
  x: number;
  y: number;
}

type PermissionResult = 'granted' | 'denied';
type MotionPermissionRequest = () => Promise<PermissionResult>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPermissionRequesters(): MotionPermissionRequest[] {
  if (typeof window === 'undefined') return [];

  const requesters: MotionPermissionRequest[] = [];
  const orientationCtor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: MotionPermissionRequest;
  };
  const motionCtor = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
    requestPermission?: MotionPermissionRequest;
  };

  if (typeof orientationCtor.requestPermission === 'function') {
    requesters.push(orientationCtor.requestPermission.bind(orientationCtor));
  }
  if (typeof motionCtor.requestPermission === 'function') {
    requesters.push(motionCtor.requestPermission.bind(motionCtor));
  }
  return requesters;
}

export function supportsDeviceTilt(): boolean {
  if (typeof window === 'undefined') return false;
  return 'DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window;
}

export async function requestMotionPermissionIfNeeded(): Promise<boolean> {
  const requesters = getPermissionRequesters();
  if (requesters.length === 0) return true;

  for (const requestPermission of requesters) {
    try {
      const result = await requestPermission();
      if (result === 'granted') return true;
    } catch {
      // Ignore and continue trying other requesters.
    }
  }
  return false;
}

export function listenToDeviceTilt(onTilt: (vector: TiltVector) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOrientation = (event: DeviceOrientationEvent) => {
    const gamma = event.gamma ?? 0;
    const beta = event.beta ?? 0;
    onTilt({
      x: clamp(gamma / 45, -1, 1),
      y: clamp(beta / 45, -1, 1),
    });
  };

  window.addEventListener('deviceorientation', handleOrientation, { passive: true });
  return () => window.removeEventListener('deviceorientation', handleOrientation);
}
