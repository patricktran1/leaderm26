/**
 * The share card, composed at build time.
 *
 * `assets/og-plate.png` carries the typography with the right-hand third left
 * transparent; whichever photograph currently opens the journal is composited
 * into that well. Change the opening photograph and the card follows, with no
 * design work and nothing to re-export.
 *
 * If anything at all goes wrong the plate is served on its own, so a share
 * preview is never broken by a photograph.
 */
import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { heroPhoto } from '../data/gallery';

const WIDTH = 1200;
const HEIGHT = 630;
/** Must match the transparent well in the plate. */
const WELL_X = Math.round(WIDTH * 0.6);

export const GET: APIRoute = async () => {
  // Resolved from the project root: `import.meta.url` points into the build
  // output once this module is bundled.
  const root = process.cwd();
  const plate = await readFile(path.join(root, 'assets/og-plate.png'));
  const plateAtSize = await sharp(plate).resize(WIDTH, HEIGHT).png().toBuffer();

  let card = plateAtSize;
  try {
    const photo = heroPhoto('IMG_7885', 'DSC01757');
    if (photo) {
      const file = path.join(root, 'src/generated/photos', photo.file);
      const well = await sharp(await readFile(file))
        .resize(WIDTH - WELL_X, HEIGHT, { fit: 'cover', position: 'attention' })
        .toBuffer();
      card = await sharp(plateAtSize)
        .composite([{ input: well, left: WELL_X, top: 0 }])
        .png()
        .toBuffer();
    }
  } catch {
    // Keep the typographic plate rather than failing the build.
  }

  const jpeg = await sharp(card)
    .flatten({ background: '#f4f2ed' })
    .jpeg({ quality: 88, mozjpeg: true, progressive: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=0, must-revalidate' },
  });
};
