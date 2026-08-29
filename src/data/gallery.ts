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
  /** Which moment of the day the row belongs to; rows never span two. */
  moment?: number;
  /** Set on the first row of a new half-day, when capture times are known. */
  bucket?: string;
  /** Anchor for the contents rail. */
  bucketId?: string;
}

const BUDGET: Record<'major' | 'minor', number> = { major: 2.0, minor: 2.6 };
const MAX_PER_ROW = 4;

/* -------------------------------------------------------------------------
 * Editorial rhythm.
 *
 * A day already has a shape. Photographs come in bursts around the things
 * that happen — the arrival, the coffee, somebody standing up to speak — and
 * thin out to nothing while a session runs. The layout reads that shape off
 * the capture times instead of inventing one, so a longer journal becomes
 * better paced rather than merely longer.
 *
 * Everything below is measured against the journal's own median gap, so it
 * behaves the same whether the weekend produced thirty frames or three
 * hundred, and it does nothing at all where there are no capture times.
 * ---------------------------------------------------------------------- */

/** A row never spans a pause this much longer than the day's own rhythm. */
const MOMENT_GAP = 2.5;
/** Quiet on both sides, measured the same way, earns a photograph a plate. */
const QUIET_GAP = 3;
/** At most one earned plate per this many frames, so a plate still means one. */
const PLATE_RATIO = 9;
/** Below this the journal is short enough to read without any pacing at all. */
const RHYTHM_MIN = 12;
/**
 * A pause ends a line, but only once the line is worth ending. Without this a
 * burst of two frames becomes its own half-width row and the page turns into a
 * ragged staircase down the left margin.
 */
const MIN_ROW_FILL = 0.65;
/** Two frames a minute apart are one moment however the day is paced. */
const MOMENT_FLOOR = 60_000;

interface Beat {
  photo: ResolvedPhoto;
  /** Frames in the same moment were shot together and are laid out together. */
  moment: number;
}

/**
 * Groups the journal into moments and scores how much quiet surrounds each
 * frame — both in units of the journal's own median gap. Undated frames carry
 * no evidence either way and are never broken on or promoted.
 */
function readTheDay(items: ResolvedPhoto[]): { beats: Beat[]; solitude: number[] } {
  const at = items.map((photo) => (photo.takenAt ? new Date(photo.takenAt).valueOf() : null));
  const gap = (i: number): number | null => {
    const a = at[i - 1];
    const b = at[i];
    return a == null || b == null ? null : Math.max(0, b - a);
  };

  const known = items.map((_, i) => (i === 0 ? null : gap(i))).filter((g): g is number => g !== null);
  const sorted = [...known].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)]! : 0;
  const unit = Math.max(median, MOMENT_FLOOR);

  let moment = 0;
  const beats = items.map((photo, i) => {
    const before = i === 0 ? null : gap(i);
    if (before !== null && before > MOMENT_GAP * unit) moment += 1;
    return { photo, moment };
  });

  const solitude = items.map((_, i) => {
    const before = i === 0 ? 0 : (gap(i) ?? 0);
    const after = i === items.length - 1 ? 0 : (gap(i + 1) ?? 0);
    return Math.min(before, after) / unit;
  });

  return { beats, solitude };
}

/**
 * Decides which frames are given the page to themselves.
 *
 * Two things earn a plate. The first frame of a half-day gets one because it
 * opens a section, which is a claim about sequence and needs no judgement from
 * anyone. And a photograph with real quiet on both sides of it gets one
 * because it stood alone in the day — the frame taken walking back from a
 * session nobody photographed. Those stay rare on purpose: a plate that
 * happens every third row is not a plate, it is a column width.
 */
function editorialWeights(items: ResolvedPhoto[], solitude: number[]): ResolvedPhoto[] {
  const plate = new Set<number>();
  let bucket: string | null = null;
  items.forEach((photo, i) => {
    if (photo.weight === 'lead') plate.add(i);
    const here = captureBucket(photo.takenAt);
    if (here && here !== bucket) {
      bucket = here;
      plate.add(i);
    }
  });

  if (items.length >= RHYTHM_MIN) {
    let earned = Math.floor(items.length / PLATE_RATIO);
    const candidates = items
      .map((photo, i) => ({ i, weight: photo.weight, quiet: solitude[i]! }))
      .filter((c) => c.weight === 'minor' && !plate.has(c.i) && c.quiet >= QUIET_GAP)
      .sort((a, b) => b.quiet - a.quiet || a.i - b.i);

    for (const candidate of candidates) {
      if (earned <= 0) break;
      // Two plates in succession read as a layout that has lost its nerve.
      if (plate.has(candidate.i - 1) || plate.has(candidate.i + 1)) continue;
      plate.add(candidate.i);
      earned -= 1;
    }
  }

  return items.map((photo, i) => (plate.has(i) ? { ...photo, weight: 'lead' as const } : photo));
}

export function buildRows(input: ResolvedPhoto[]): GalleryRow[] {
  const { beats, solitude } = readTheDay(input);
  const items = editorialWeights(input, solitude).map((photo, i) => ({
    photo,
    moment: beats[i]!.moment,
  }));

  const rows: GalleryRow[] = [];
  let buffer: Beat[] = [];
  let budget = BUDGET.minor;

  const flush = (): void => {
    if (buffer.length === 0) return;
    const span = buffer.reduce((sum, b) => sum + b.photo.ratio, 0);
    rows.push({
      kind: 'run',
      items: buffer.map((b) => b.photo),
      span,
      fill: Math.min(1, span / budget),
      moment: buffer[0]!.moment,
    });
    buffer = [];
    budget = BUDGET.minor;
  };

  for (const beat of items) {
    if (beat.photo.weight === 'lead') {
      flush();
      rows.push({
        kind: 'lead',
        items: [beat.photo],
        span: beat.photo.ratio,
        fill: 1,
        moment: beat.moment,
      });
      continue;
    }
    // A row breaks at a pause — a burst at the coffee table is one line, and
    // what happened forty minutes later starts the next — but only once the
    // line has enough in it to be worth breaking.
    if (buffer.length > 0 && buffer[0]!.moment !== beat.moment) {
      const held = buffer.reduce((sum, b) => sum + b.photo.ratio, 0);
      if (held >= MIN_ROW_FILL * budget) flush();
    }
    if (buffer.length === 0) budget = beat.photo.weight === 'major' ? BUDGET.major : BUDGET.minor;
    buffer.push(beat);
    if (buffer.length >= MAX_PER_ROW) flush();
    else if (buffer.reduce((sum, b) => sum + b.photo.ratio, 0) >= budget) flush();
  }
  flush();

  return markBuckets(settle(rows));
}

/**
 * A row left holding a single frame — because a plate forced an early flush,
 * or because a moment happened to contain one photograph — renders as a lonely
 * sliver. It is folded back into the line before it, or forward into the line
 * after; either keeps the sequence, because the orphan sits directly between
 * them. Only when there is nowhere to put it does it become a plate, and never
 * where that would leave two plates in succession — a page that gives every
 * other frame the full measure has stopped choosing.
 */
function settle(rows: GalleryRow[]): GalleryRow[] {
  const settled: GalleryRow[] = [];
  const queue = rows.map((row) => ({ ...row, items: [...row.items] }));

  for (let i = 0; i < queue.length; i += 1) {
    const row = queue[i]!;
    const previous = settled[settled.length - 1];
    const isOrphan = row.kind === 'run' && row.items.length === 1;
    if (!isOrphan || !row.items[0]) {
      settled.push(row);
      continue;
    }

    if (previous?.kind === 'run' && previous.items.length < MAX_PER_ROW) {
      previous.items.push(row.items[0]);
      previous.span += row.span;
      previous.fill = 1;
      continue;
    }

    const next = queue[i + 1];
    if (next?.kind === 'run' && next.items.length < MAX_PER_ROW) {
      next.items.unshift(row.items[0]);
      next.span += row.span;
      next.fill = 1;
      // The orphan carried the half-day heading if it opened one.
      if (row.bucket && !next.bucket) {
        next.bucket = row.bucket;
        next.bucketId = row.bucketId;
      }
      continue;
    }

    const crowded = previous?.kind === 'lead' || next?.kind === 'lead';
    settled.push(crowded ? row : { ...row, kind: 'lead', fill: 1 });
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

/** The journal as the page actually lays it out. Built once, read everywhere. */
export const journalRows: GalleryRow[] = buildRows(gallery);

export interface JournalDay {
  day: string;
  parts: { label: string; id: string }[];
}

/**
 * The journal's own table of contents, grouped by day. "Saturday morning,
 * Saturday afternoon, Saturday evening, Sunday morning" is four links that
 * repeat themselves; a day and its halves is a line of type.
 */
export const journalContents: JournalDay[] = (() => {
  const days: JournalDay[] = [];
  for (const entry of buckets(journalRows)) {
    const [day, ...rest] = entry.label.split(' ');
    const part = rest.join(' ') || entry.label;
    const last = days[days.length - 1];
    if (last?.day === day) last.parts.push({ label: part, id: entry.id });
    else days.push({ day: day ?? entry.label, parts: [{ label: part, id: entry.id }] });
  }
  return days;
})();

/** How many entries the contents rail would carry, flattened. */
export const contentsDepth = journalContents.reduce((sum, day) => sum + day.parts.length, 0);
