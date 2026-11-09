// Copied from Screenshotter (frame.js, 12 Oct 2026 version) so the runner can brand ticket images in CI.
// brand() below applies the lesson settings: Screenshotter's toolbar, scale 1, 20px margin, radius 15, grey stroke, soft shadow.
/**
 * frame.js
 *
 * Wraps a raw screenshot in the Atlassian-style browser chrome used for ILT
 * slides, matching the Figma post-edit look:
 *   - composites the supplied toolbar PNG (blue address bar) on top
 *   - composites the supplied container PNG (rounded white card) behind/over
 *   - rounds the outer corners
 *   - adds a soft drop shadow on a transparent canvas
 *   - exports a high-resolution PNG (2x by default) ready to drop into PPT
 *
 * Uses your exact ref-images so the result is a pixel-faithful match to Figma.
 *
 * Export: frameScreenshot(inputPath, outputPath, opts)
 */

import sharp from 'sharp';
import { existsSync } from 'node:fs';

/**
 * Fit the toolbar PNG to `width` without distorting it. The left cap (window
 * dots, start of the address bar) and right cap (end of the address bar, icon)
 * keep their pixel size; only the horizontally uniform middle run of the
 * address bar is stretched or squeezed. Falls back to a plain resize if the
 * image has no uniform middle or the target is narrower than the two caps.
 */
async function fitToolbarWidth(toolbarPath, width) {
  const { data, info } = await sharp(toolbarPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const plain = () =>
    sharp(toolbarPath).resize({ width, height: H, fit: 'fill' }).png().toBuffer();
  if (W === width) return sharp(toolbarPath).png().toBuffer();

  // Find the run of identical columns around the centre.
  const mid = Math.floor(W / 2);
  const sameAsMid = (x) => {
    for (let y = 0; y < H; y++) {
      for (let c = 0; c < C; c++) {
        if (Math.abs(data[(y * W + x) * C + c] - data[(y * W + mid) * C + c]) > 2) return false;
      }
    }
    return true;
  };
  let left = mid;
  while (left > 0 && sameAsMid(left - 1)) left--;
  let right = mid;
  while (right < W - 1 && sameAsMid(right + 1)) right++;
  const rightCapW = W - right - 1;
  const middleW = width - left - rightCapW;
  if (right - left < 2 || middleW < 1) return plain();

  const leftCap = await sharp(toolbarPath).extract({ left: 0, top: 0, width: left, height: H }).png().toBuffer();
  const rightCap = await sharp(toolbarPath).extract({ left: right + 1, top: 0, width: rightCapW, height: H }).png().toBuffer();
  const middle = await sharp(toolbarPath)
    .extract({ left, top: 0, width: 1, height: H })
    .resize({ width: middleW, height: H, fit: 'fill', kernel: 'nearest' })
    .png()
    .toBuffer();
  return sharp({ create: { width, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: leftCap, top: 0, left: 0 },
      { input: middle, top: 0, left },
      { input: rightCap, top: 0, left: left + middleW },
    ])
    .png()
    .toBuffer();
}

/**
 * @param {string} inputPath  Raw screenshot PNG (content only, no chrome).
 * @param {string} outputPath Where to write the framed PNG.
 * @param {object} opts
 *   toolbarPath   {string}  PNG for the blue address bar (content-width).
 *   containerPath {string}  PNG for the rounded white card (content-size). Optional.
 *   scale         {number}  Output scale multiplier (default 2).
 *   radius        {number}  Outer corner radius in *content* px (default 12).
 *   shadow        {object}  { blur, opacity, dx, dy, color } drop-shadow spec.
 *   pad           {number}  Transparent margin around card in *content* px
 *                           (default: auto from shadow blur).
 */
export async function frameScreenshot(inputPath, outputPath, opts = {}) {
  const scale = opts.scale || 2;
  const radius = (opts.radius ?? 15);
  // Figma drop shadow: { blur, opacity, dx (X), dy (Y), color }.
  // Figma's "Blur" value ≈ 2× a Gaussian sigma, so divide by 2 for sharp.blur().
  const shadow = Object.assign(
    { blur: 20, opacity: 0.30, dx: 0, dy: 10, color: '#000000' },
    opts.shadow || {}
  );
  // Outside stroke (Figma): { color, width, opacity }.
  const stroke = Object.assign(
    { color: '#9E9E9E', width: 0.5, opacity: 1 },
    opts.stroke || {}
  );

  const toolbarPath = opts.toolbarPath;
  const containerPath = opts.containerPath;

  // --- load + measure the screenshot ---
  const shotMeta = await sharp(inputPath).metadata();
  const contentW = shotMeta.width;
  const contentH = shotMeta.height;

  // --- measure toolbar (optional but expected) ---
  let toolbarH = 0;
  let toolbarBuf = null;
  if (toolbarPath && existsSync(toolbarPath)) {
    const tbMeta = await sharp(toolbarPath).metadata();
    toolbarH = tbMeta.height;
    toolbarBuf = await fitToolbarWidth(toolbarPath, contentW);
  }

  let cardW = contentW;
  let cardH = contentH + toolbarH;

  // --- assemble the card (toolbar on top, screenshot below) at 1x ---
  const layers = [];
  if (toolbarBuf) layers.push({ input: toolbarBuf, top: 0, left: 0 });
  layers.push({ input: inputPath, top: toolbarH, left: 0 });

  let card = sharp({
    create: {
      width: cardW,
      height: cardH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).composite(layers);

  let cardBuf = await card.png().toBuffer();

  // --- round the outer corners of the whole card ---
  const r = radius;
  const roundMask = Buffer.from(
    `<svg width="${cardW}" height="${cardH}"><rect x="0" y="0" width="${cardW}" height="${cardH}" rx="${r}" ry="${r}"/></svg>`
  );
  cardBuf = await sharp(cardBuf)
    .composite([{ input: roundMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // --- draw the outside hairline stroke (Figma: #9E9E9E, 0.5px, Outside) ---
  // Outside stroke grows the silhouette by `width`, so we pad the card by the
  // stroke width on every side and paint a stroked rounded-rect over it.
  if (stroke && stroke.width > 0) {
    const sw = stroke.width;
    // sharp composite offsets must be integers, so pad by a whole pixel and
    // keep the (possibly fractional) stroke crisp inside the SVG.
    const off = Math.max(1, Math.ceil(sw));
    const strokedW = cardW + off * 2;
    const strokedH = cardH + off * 2;
    // The stroke rect: an SVG rounded-rect outline drawn at the card's outer
    // edge. SVG strokes straddle the path, so the path sits at the card boundary
    // (inset by off) and the outer half of the stroke extends just beyond it.
    const strokeSvg = Buffer.from(
      `<svg width="${strokedW}" height="${strokedH}">
         <rect x="${off - sw / 2}" y="${off - sw / 2}"
               width="${cardW + sw}" height="${cardH + sw}"
               rx="${radius + sw / 2}" ry="${radius + sw / 2}"
               fill="none" stroke="${stroke.color}"
               stroke-opacity="${stroke.opacity}" stroke-width="${sw}"/>
       </svg>`
    );
    cardBuf = await sharp({
      create: {
        width: strokedW,
        height: strokedH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: cardBuf, top: off, left: off },
        { input: strokeSvg, top: 0, left: 0 },
      ])
      .png()
      .toBuffer();
    // Card now includes the stroke ring; update dimensions for shadow + layout.
    cardW = strokedW;
    cardH = strokedH;
  }

  // --- build a drop shadow from the card silhouette ---
  const sh = shadow;
  // Figma's "Blur" is ~2× a Gaussian sigma; sharp.blur() takes sigma.
  const sigma = Math.max(0.3, sh.blur / 2);
  // Outer corner radius now includes the stroke ring (if any).
  const outerR = r + (stroke && stroke.width > 0 ? stroke.width : 0);
  const pad = opts.pad ?? Math.ceil(sigma * 3 + Math.max(Math.abs(sh.dx), Math.abs(sh.dy)));
  const canvasW = cardW + pad * 2;
  const canvasH = cardH + pad * 2;

  // Shadow = a rounded rect filled with shadow color, blurred, at given opacity.
  const shadowRect = Buffer.from(
    `<svg width="${canvasW}" height="${canvasH}">
       <rect x="${pad + sh.dx}" y="${pad + sh.dy}" width="${cardW}" height="${cardH}"
             rx="${outerR}" ry="${outerR}" fill="${sh.color}" fill-opacity="${sh.opacity}"/>
     </svg>`
  );
  const shadowLayer = await sharp(shadowRect)
    .blur(sigma)
    .png()
    .toBuffer();

  // --- compose: transparent canvas -> shadow -> card ---
  let framed = sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    { input: shadowLayer, top: 0, left: 0 },
    { input: cardBuf, top: pad, left: pad },
  ]);

  let framedBuf = await framed.png().toBuffer();

  // --- scale up to high-res for PPT ---
  if (scale !== 1) {
    framedBuf = await sharp(framedBuf)
      .resize({
        width: Math.round(canvasW * scale),
        height: Math.round(canvasH * scale),
        fit: 'fill',
        kernel: 'lanczos3',
      })
      .png()
      .toBuffer();
  }

  await sharp(framedBuf).png({ compressionLevel: 9 }).toFile(outputPath);
  return { width: Math.round(canvasW * scale), height: Math.round(canvasH * scale) };
}

const here = new URL(".", import.meta.url).pathname;

/** Frames a capture the way lesson images are framed (at 1x, so a 1280x800 capture comes out at 1322x892). */
export function brand(inputPath, outputPath) {
  return frameScreenshot(inputPath, outputPath, {
    toolbarPath: `${here}../assets/frame/toolbar.png`,
    scale: 1,
    pad: 20, // lesson images keep a 20px margin around the frame (Screenshotter's default is wider)
    radius: 15,
    stroke: { color: "#9E9E9E", width: 0.5, opacity: 1 },
    shadow: { blur: 20, opacity: 0.3, dx: 0, dy: 10, color: "#000000" },
  });
}
