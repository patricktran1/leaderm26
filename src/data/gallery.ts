import type { ImageMetadata } from 'astro';
import { photos, type Photo } from './photos';

const files = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/photos/*.{webp,avif,jpg,jpeg,png}',
  { eager: true },
);

const byId = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(files)) {
  const id = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  byId.set(id, mod.default);
}

export interface ResolvedPhoto extends Photo {
  image: ImageMetadata;
  orientation: 'portrait' | 'landscape' | 'square';
  ratio: number;
}

function resolve(photo: Photo): ResolvedPhoto {
  const image = byId.get(photo.id);
  if (!image) {
    throw new Error(
      `Photo manifest references "${photo.id}" but src/assets/photos/${photo.id}.* does not exist.`,
    );
  }
  const ratio = image.width / image.height;
  return {
    ...photo,
    image,
    ratio,
    orientation: ratio > 1.05 ? 'landscape' : ratio < 0.95 ? 'portrait' : 'square',
  };
}

export const gallery: ResolvedPhoto[] = photos.map(resolve);

export const byPhotoId = (id: string): ResolvedPhoto => {
  const found = gallery.find((p) => p.id === id);
  if (!found) throw new Error(`No photo with id "${id}" in the manifest.`);
  return found;
};

/** Files present on disk but absent from the manifest — surfaced during build. */
export const unlistedFiles: string[] = [...byId.keys()].filter(
  (id) => !photos.some((p) => p.id === id),
);

/* -------------------------------------------------------------------------
 * Justified gallery rows.
 * Photographs keep their true aspect ratio; each row shares a common height,
 * so widths are distributed in proportion to ratio. Nothing is cropped to a
 * square, and adding a photograph simply re-flows the rhythm.
 * ---------------------------------------------------------------------- */

export interface GalleryRow {
  kind: 'lead' | 'run';
  items: ResolvedPhoto[];
  /** Sum of aspect ratios — the row's natural width at height 1. */
  span: number;
  /** 0–1 fill factor used to stop a short final row stretching full width. */
  fill: number;
}

const BUDGET: Record<'major' | 'minor', number> = { major: 2.0, minor: 2.6 };

export function buildRows(items: ResolvedPhoto[]): GalleryRow[] {
  const rows: GalleryRow[] = [];
  let buffer: ResolvedPhoto[] = [];
  let budget = BUDGET.minor;

  const flush = (): void => {
    if (buffer.length === 0) return;
    const span = buffer.reduce((sum, p) => sum + p.ratio, 0);
    rows.push({ kind: 'run', items: buffer, span, fill: Math.min(1, span / budget) });
    buffer = [];
    budget = BUDGET.minor;
  };

  for (const photo of items) {
    if (photo.weight === 'lead') {
      flush();
      rows.push({ kind: 'lead', items: [photo], span: photo.ratio, fill: 1 });
      continue;
    }
    if (buffer.length === 0) budget = photo.weight === 'major' ? BUDGET.major : BUDGET.minor;
    buffer.push(photo);
    if (buffer.reduce((sum, p) => sum + p.ratio, 0) >= budget) flush();
  }
  flush();

  return rows;
}
