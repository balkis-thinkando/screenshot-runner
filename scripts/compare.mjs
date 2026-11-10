// Side-by-side image for SHOT tickets: the current lesson image (left) next to the new branded capture
// (right), each with a label. Built on the runner and sent to Jira only; never stored elsewhere.

import { createRequire } from "node:module";

const sharp = createRequire(import.meta.url)("sharp");

const LABEL_H = 70;
const GAP = 40;

const label = (text, width) =>
  Buffer.from(
    `<svg width="${width}" height="${LABEL_H}"><text x="${width / 2}" y="45" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="30" font-weight="600" fill="#172B4D" text-anchor="middle">${text}</text></svg>`,
  );

/**
 * @param {string} lessonImage URL or path of the image currently in the lesson
 * @param {string} newImage path of the new (branded) capture
 * @param {string} outPath where to write the side-by-side PNG
 */
export async function sideBySide(lessonImage, newImage, outPath) {
  const lessonBuf = /^https?:/.test(lessonImage)
    ? Buffer.from(await (await fetch(lessonImage)).arrayBuffer())
    : lessonImage;
  // Same height for both so they line up; lesson images vary slightly in size
  const height = (await sharp(newImage).metadata()).height;
  const left = await sharp(lessonBuf).resize({ height }).png().toBuffer();
  const right = await sharp(newImage).png().toBuffer();
  const lw = (await sharp(left).metadata()).width;
  const rw = (await sharp(right).metadata()).width;
  await sharp({ create: { width: lw + GAP + rw, height: height + LABEL_H, channels: 4, background: "#ffffff" } })
    .composite([
      { input: label("Current lesson image", lw), left: 0, top: 0 },
      { input: label("New capture (today)", rw), left: lw + GAP, top: 0 },
      { input: left, left: 0, top: LABEL_H },
      { input: right, left: lw + GAP, top: LABEL_H },
    ])
    .png()
    .toFile(outPath);
}
