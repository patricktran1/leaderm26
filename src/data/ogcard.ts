/**
 * Share cards, composed at build time.
 *
 * A plate in `assets/` carries the typography with its right-hand third left
 * transparent; a photograph is composited into that well. Change the
 * photograph and the card follows, with no design work and nothing to
 * re-export. If anything at all goes wrong the plate is served on its own, so
 * a share preview is never broken by a photograph.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { byPhotoId, gallery, type ResolvedPhoto } from './gallery';

const WIDTH = 1200;
const HEIGHT = 630;
/** Must match the transparent well in the plate. See tools/mk-og-plate.mjs. */
const WELL_X = Math.round(WIDTH * 0.6);

export async function ogCard(plateFile: string, photo: ResolvedPhoto | undefined): Promise<Response> {
  // Resolved from the project root: `import.meta.url` points into the build
  // output once this module is bundled.
  const root = process.cwd();
  const plate = await readFile(path.join(root, plateFile));
  const plateAtSize = await sharp(plate).resize(WIDTH, HEIGHT).png().toBuffer();

  let card = plateAtSize;
  try {
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
}

/**
 * The photograph in the practice card's well. It carries no identifiable
 * face on purpose: the card advertises my own work, and nobody photographed
 * at the meeting agreed to appear on it.
 */
export const practiceCardPhoto = (): ResolvedPhoto | undefined => {
  for (const id of ['IMG_7973', 'IMG_7977', 'IMG_7974']) {
    const found = byPhotoId(id);
    if (found) return found;
  }
  return gallery.at(-1);
};
