/**
 * Slice the source QR PNG into thirds via <canvas>.
 *
 * `index` 0 / 1 / 2 returns the left / middle / right vertical third as a
 * data URL. Used by ProgressScaffold (display) and the Reveal animation
 * (the slice that flies into the grid).
 */
export function sliceThird(img: HTMLImageElement, index: 0 | 1 | 2): string {
  const w = img.width;
  const h = img.height;
  const slicePxW = Math.ceil(w / 3);

  const c = document.createElement('canvas');
  c.width = slicePxW;
  c.height = h;

  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  // Negative x offset crops the image so only the desired slice is visible.
  ctx.drawImage(img, -index * (w / 3), 0);
  return c.toDataURL('image/png');
}

/** Load an image and resolve once decoded (good for canvas use). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/** Convenience: load + slice + return all three data URLs in order. */
export async function loadAllSlices(src: string): Promise<[string, string, string]> {
  const img = await loadImage(src);
  return [sliceThird(img, 0), sliceThird(img, 1), sliceThird(img, 2)];
}
