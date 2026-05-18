import { useEffect, useState } from 'react';
import { loadAllSlices } from './sliceQr';

/**
 * Loads the source QR image once and returns the three vertical slices as
 * data URLs. While loading, returns `null` and the consumer should render an
 * empty placeholder.
 */
export function useQrSlices(src: string): [string, string, string] | null {
  const [slices, setSlices] = useState<[string, string, string] | null>(null);

  useEffect(() => {
    let alive = true;
    loadAllSlices(src)
      .then((arr) => {
        if (alive) setSlices(arr);
      })
      .catch((err) => {
        console.warn('QR slice load failed', err);
      });
    return () => {
      alive = false;
    };
  }, [src]);

  return slices;
}
