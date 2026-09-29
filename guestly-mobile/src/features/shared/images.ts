// Photo uploads leave the phone as a JPEG no larger than 2048 px on its long
// side and about 1.5 MB, whatever the camera shot (12 to 48 MP on a current
// iPhone). A full-size photo as base64 JSON went past the host's 6 MB request
// limit and failed with a generic error, and held a huge string on the JS
// thread. Pick with base64 off and pass the asset here.

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const MAX_SIDE = 2048;
/** ~1.5 MB of JPEG is ~2 MB of base64. */
const MAX_B64 = 2_000_000;

export type PreparedImage = { base64: string; mime: "image/jpeg"; width: number; height: number };

type Source = { uri: string; width?: number | null; height?: number | null };

async function render(src: Source, side: number, compress: number): Promise<PreparedImage> {
  const ctx = ImageManipulator.manipulate(src.uri);
  const w = src.width ?? 0;
  const h = src.height ?? 0;
  // Resize only when the long side is over the cap, and by the long side, so
  // the aspect ratio is kept and a small image is never enlarged.
  if (!w || !h || Math.max(w, h) > side) {
    if (w && h && h > w) ctx.resize({ height: side });
    else ctx.resize({ width: side });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
  return { base64: out.base64 ?? "", mime: "image/jpeg", width: out.width, height: out.height };
}

/** Downscales and re-encodes a picked photo for upload. Steps down quality,
 *  then size, until it fits. */
export async function prepareImageForUpload(input: Source): Promise<PreparedImage> {
  let src = input;
  // A file picked from Files has no dimensions: read them first, so a small
  // image is never enlarged.
  if (!src.width || !src.height) {
    const probe = await ImageManipulator.manipulate(src.uri).renderAsync();
    src = { uri: src.uri, width: probe.width, height: probe.height };
  }
  const steps: [number, number][] = [
    [MAX_SIDE, 0.72],
    [MAX_SIDE, 0.55],
    [1600, 0.55],
    [1280, 0.5],
  ];
  let last: PreparedImage | null = null;
  for (const [side, q] of steps) {
    last = await render(src, side, q);
    if (last.base64 && last.base64.length <= MAX_B64) return last;
  }
  return last as PreparedImage;
}
