/**
 * Turns an ordinary product photo into a rail-ready cut-out, in the browser:
 *  1. removes a plain (studio / wall / white) background by flood-filling from the edges,
 *  2. crops to the garment,
 *  3. fits it onto the 200:310 portrait canvas the clothing rail expects.
 *
 * Works best on a garment photographed against a plain, evenly lit background.
 * For busy backgrounds the original is only fitted to the canvas (`removed: false`).
 */

const CANVAS_W = 400;
const CANVAS_H = 620;
const WORK_MAX = 900;
const TOP_PAD = 0.04;
const SIDE_PAD = 0.04;
const BOTTOM_PAD = 0.03;

export interface CutoutResult {
  file: File;
  /** False when the background was too busy to remove automatically. */
  removed: boolean;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Could not export the image"));
      const base = name.replace(/\.[^.]+$/, "") || "garment";
      resolve(new File([blob], `${base}-cutout.png`, { type: "image/png" }));
    }, "image/png");
  });
}

function removeBackground(data: ImageData): boolean {
  const { width: w, height: h } = data;
  const px = data.data;

  // Estimate the background colour from the image border.
  const border: number[] = [];
  const push = (x: number, y: number) => border.push((y * w + x) * 4);
  for (let x = 0; x < w; x += 2) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += 2) { push(0, y); push(w - 1, y); }
  // Median per channel: robust against the garment touching the border.
  const median = (offset: number) => {
    const values = border.map((i) => px[i + offset] ?? 0).sort((a, c) => a - c);
    return values[Math.floor(values.length / 2)] ?? 0;
  };
  const r = median(0), g = median(1), b = median(2);

  const dist = (i: number) => {
    const dr = (px[i] ?? 0) - r, dg = (px[i + 1] ?? 0) - g, db = (px[i + 2] ?? 0) - b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  // Kept tight on purpose: pale garments (pink, cream, light blue) are only ~40 colour
  // units from a pale backdrop, and a wider band makes them see-through.
  const HARD = 18;
  const SOFT = 30;

  // Most of the border must resemble the background, otherwise it is not a plain backdrop.
  const close = border.filter((i) => dist(i) < SOFT).length / border.length;
  if (close < 0.6) return false;

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const p = y * w + x;
    if (!seen[p] && dist(p * 4) < SOFT) { seen[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }

  while (stack.length) {
    const p = stack.pop() as number;
    const x = p % w, y = (p - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }

  for (let p = 0; p < seen.length; p++) {
    if (!seen[p]) continue;
    const i = p * 4;
    const d = dist(i);
    // Fully transparent inside HARD, feathered up to SOFT for smooth edges.
    px[i + 3] = d <= HARD ? 0 : Math.round(((d - HARD) / (SOFT - HARD)) * 255);
  }
  return true;
}

function boundsOf(data: ImageData) {
  const { width: w, height: h } = data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data.data[(y * w + x) * 4 + 3] ?? 0) > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export async function makeGarmentCutout(file: File, strip = true): Promise<CutoutResult> {
  const img = await loadImage(file);
  const scale = Math.min(1, WORK_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  if (!wctx) throw new Error("Canvas is not available in this browser");
  wctx.drawImage(img, 0, 0, w, h);

  let removed = false;
  let box = { x: 0, y: 0, w, h };
  if (strip) {
    const data = wctx.getImageData(0, 0, w, h);
    removed = removeBackground(data);
    if (removed) {
      wctx.putImageData(data, 0, 0);
      box = boundsOf(data) ?? box;
    }
  }

  // Fit onto the portrait canvas, top-aligned so the garment hangs from the hanger.
  const out = document.createElement("canvas");
  out.width = CANVAS_W;
  out.height = CANVAS_H;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas is not available in this browser");
  const availW = CANVAS_W * (1 - SIDE_PAD * 2);
  const availH = CANVAS_H * (1 - TOP_PAD - BOTTOM_PAD);
  const fit = Math.min(availW / box.w, availH / box.h);
  const dw = box.w * fit, dh = box.h * fit;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(work, box.x, box.y, box.w, box.h, (CANVAS_W - dw) / 2, CANVAS_H * TOP_PAD, dw, dh);

  return { file: await canvasToFile(out, file.name), removed };
}
