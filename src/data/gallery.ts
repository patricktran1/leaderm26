import type { ImageMetadata } from 'astro';
import { photos, captureBucket, type Photo } from './photos';

/**
 * Every normalised master, keyed by id. These files are written by
 * `scripts/ingest-photos.mjs` before the build; the folder is generated, so it
 * always matches whatever is in `photos/`.
 */
const files = import.meta.glob<{ default: ImageMetadata }>('../generated/photos/*.jpg', {
  eager: true,
});

const byId = new Map<string, ImageMetadata>();
for (const [filePath, module] of Object.entries(files)) {
  byId.set(filePath.split('/').pop()!.replace(/\.[^.]+$/, ''), module.default);
}

export interface ResolvedPhoto extends Photo {
  image: ImageMetadata;
  orientation: 'portrait' | 'landscape' | 'square';
  ratio: number;
}

/**
 * A photograph in the index with no file on disk means an interrupted build,
 * not a mistake worth stopping for — it is skipped and reported.
 */
export const missingFiles: string[] = [];

export const gallery: ResolvedPhoto[] = photos.flatMap((photo) => {
  const image = byId.get(photo.id);
  if (!image) {
    missingFiles.push(photo.id);
    return [];
  }
  const ratio = image.width / image.height;
  return [
    {
      ...photo,
      image,
      ratio,
      orientation: ratio > 1.05 ? 'landscape' : ratio < 0.95 ? 'portrait' : 'square',
    },
  ];
});

export const byPhotoId = (id: string): ResolvedPhoto | undefined => gallery.find((p) => p.id === id);

/**
 * The first photograph matching any of the given ids, so an editorial slot on
 * the page keeps working when the frame it wanted has been superseded, renamed
 * or removed.
 */
export const pick = (...ids: string[]): ResolvedPhoto | undefined => {
  for (const id of ids) {
    const found = byPhotoId(id);
    if (found) return found;
  }
  return gallery[0];
};

/**
 * The opening photograph. Marking any frame `"featured": true` in
 * captions.json takes it over; otherwise the named fallbacks apply, and
 * failing those the journal's first frame. The hero is never a broken slot.
 */
export const heroPhoto = (...fallbackIds: string[]): ResolvedPhoto | undefined =>
  gallery.find((photo) => photo.featured) ?? pick(...fallbackIds);

/* -------------------------------------------------------------------------
 * Justified gallery rows.
 * Photographs keep their true aspect ratio; each row shares a common height,
 * so widths are distributed in proportion to ratio. Nothing is cropped, and
 * adding a photograph simply re-flows the rhythm.
 * ---------------------------------------------------------------------- */

export interface GalleryRow {
  kind: 'lead' | 'run';
  items: ResolvedPhoto[];
  /** Sum of aspect ratios — the row's natural width at height 1. */
  span: number;
  /** 0–1 fill factor used to stop a short final row stretching full width. */
  fill: number;
  /** Set on the first row of a new half-day, when capture times are known. */
  bucket?: string;
  /** Anchor for the contents rail. */
  bucketId?: string;
}

const BUDGET: Record<'major' | 'minor', number> = { major: 2.0, minor: 2.6 };
const MAX_PER_ROW = 4;

/**
 * The frame that opens a new half-day gets more of the measure, the way a
 * section opener does in print. It is a claim about sequence, not about
 * importance, so it needs no judgement from anyone.
 */
function openSections(items: ResolvedPhoto[]): ResolvedPhoto[] {
  let current: string | null = null;
  return items.map((photo) => {
    const bucket = captureBucket(photo.takenAt);
    if (!bucket || bucket === current) return photo;
    current = bucket;
    return photo.weight === 'minor' ? { ...photo, weight: 'major' as const } : photo;
  });
}

export function buildRows(input: ResolvedPhoto[]): GalleryRow[] {
  const items = openSections(input);
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

  return markBuckets(settle(rows));
}

/**
 * A row left holding a single frame — because a lead photograph forced an early
 * flush, or because the journal ended — renders as a lonely sliver. Fold it back
 * into the previous run row when there is space; the order is preserved because
 * the orphan always directly follows that row.
 */
function settle(rows: GalleryRow[]): GalleryRow[] {
  const settled: GalleryRow[] = [];

  for (const row of rows) {
    const previous = settled[settled.length - 1];
    const isOrphan = row.kind === 'run' && row.items.length === 1 && row.fill < 0.6;
    if (!isOrphan) {
      settled.push(row);
      continue;
    }
    if (previous?.kind === 'run' && previous.items.length < MAX_PER_ROW && row.items[0]) {
      previous.items.push(row.items[0]);
      previous.span += row.span;
      previous.fill = 1;
      continue;
    }
    // Nowhere to fold it: give it the full plate treatment so it reads as a
    // decision rather than a leftover.
    settled.push({ ...row, kind: 'lead', fill: 1 });
  }

  return settled;
}

/**
 * Where capture times exist, the journal breaks itself into half-days. A single
 * bucket across the whole gallery is not a timeline, so it stays unmarked.
 */
function markBuckets(rows: GalleryRow[]): GalleryRow[] {
  const seen: string[] = [];
  const marked = rows.map((row) => {
    const bucket = captureBucket(row.items[0]?.takenAt ?? null);
    if (!bucket || seen.includes(bucket)) return row;
    seen.push(bucket);
    return { ...row, bucket, bucketId: bucketAnchor(bucket) };
  });
  return seen.length > 1 ? marked : rows;
}

export const bucketAnchor = (bucket: string): string =>
  `journal-${bucket.toLowerCase().replace(/\s+/g, '-')}`;

/** The half-days the journal covers, for the contents rail. */
export const buckets = (rows: GalleryRow[]): { label: string; id: string }[] =>
  rows
    .filter((row): row is GalleryRow & { bucket: string; bucketId: string } => Boolean(row.bucket))
    .map((row) => ({ label: row.bucket, id: row.bucketId }));
