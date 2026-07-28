import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { REDUCED_MOTION } from '../theme';

/**
 * Device compass heading in degrees, 0 = north.
 *
 * Used to point the view cone on the player marker. Knowing which way you are
 * facing is most of the value of a map when you are standing in an alley
 * deciding which way to walk.
 *
 * Falls back to a slow drift where there is no magnetometer, which is every
 * browser and most simulators, so the behaviour is still visible in the demo.
 * On a real phone this is the actual compass.
 */
export function useHeading(): { heading: number; live: boolean } {
  const [heading, setHeading] = useState(0);
  const [live, setLive] = useState(false);
  const drift = useRef(0);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('no location permission');
        sub = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (deg >= 0) {
            setHeading(deg);
            setLive(true);
          }
        });
      } catch {
        if (cancelled || REDUCED_MOTION === undefined) return;
        // No compass available. Drift slowly so the cone reads as a live
        // instrument rather than a static decoration.
        timer = setInterval(() => {
          drift.current = (drift.current + 3) % 360;
          setHeading(drift.current);
        }, 400);
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      if (timer) clearInterval(timer);
    };
  }, []);

  return { heading, live };
}
