/**
 * THE PHOTO MODEL
 * ----------------------------------------------------------------------------
 * Nothing in this file needs editing to publish a photograph. `photos/` is the
 * inbox; `scripts/ingest-photos.mjs` reads it before every build and writes
 * `src/generated/photo-index.json`. This module turns that index into the typed
 * records the page renders, applying whatever is in `photos/captions.json`.
 *
 * A photograph with no caption entry still appears — dated, ordered and with
 * honest alt text — so a new batch can never break the build.
 */
import rawIndex from '../generated/photo-index.json';

export const CATEGORIES = ['venue', 'room', 'people', 'artifact', 'unfiled'] as const;
export type Category = (typeof CATEGORIES)[number];

export const WEIGHTS = ['lead', 'major', 'minor'] as const;
export type Weight = (typeof WEIGHTS)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  venue: 'Venue',
  room: 'The room',
  people: 'People',
  artifact: 'From the floor',
  unfiled: 'From the conference',
};

/** What `photos/captions.json` may say about a photograph. Every key optional. */
export interface PhotoOverride {
  caption?: string;
  alt?: string;
  note?: string;
  category?: Category;
  weight?: Weight;
  /** Pins the photograph to a position; unpinned photographs sort by capture time. */
  order?: number;
  /** Keeps a frame in the repository but off the page. */
  hidden?: boolean;
  /** Offers the photograph to the opening spread. The first one wins. */
  featured?: boolean;
}

interface IndexEntry {
  id: string;
  aliases: string[];
  file: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  sourceBytes: number;
  source: string;
  takenAt: string | null;
  camera: string | null;
  lens: string | null;
  supersedes: string[];
  override?: PhotoOverride;
}

interface PhotoIndex {
  generatedAt: string;
  maxEdge: number;
  counts: { files: number; photos: number; superseded: number; unreadable: number };
  unreadable: { source: string; reason: string }[];
  captions?: { error: string | null; repaired: boolean; problems: string[] };
  photos: IndexEntry[];
}

export interface Photo {
  id: string;
  /** Filename inside `src/generated/photos/`. */
  file: string;
  caption: string;
  alt: string;
  note?: string;
  category: Category;
  weight: Weight;
  /** True when no one has written real alt text for this frame yet. */
  altIsGenerated: boolean;
  captionIsGenerated: boolean;
  takenAt: string | null;
  camera: string | null;
  source: string;
  sourceWidth: number;
  sourceHeight: number;
  supersedes: string[];
  featured: boolean;
  /** A quiet second line for the viewer: when it was taken, on what. */
  meta: string;
}

const index = rawIndex as PhotoIndex;

/* ------------------------------------------------------------------- time */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * EXIF capture times carry no time zone: they are the camera's wall clock,
 * which is the local time we want to print. So the ISO string is read back in
 * UTC deliberately — converting it would shift every caption by seven hours.
 */
export function captureParts(iso: string | null): { day: string; time: string; date: string } | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.valueOf())) return null;
  const hours = at.getUTCHours();
  const minutes = String(at.getUTCMinutes()).padStart(2, '0');
  const suffix = hours < 12 ? 'a.m.' : 'p.m.';
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return {
    day: DAYS[at.getUTCDay()]!,
    time: `${twelve}:${minutes} ${suffix}`,
    date: `${at.getUTCDate()} ${
      ['January','February','March','April','May','June','July','August','September','October','November','December'][at.getUTCMonth()]
    }`,
  };
}

/** A half-day bucket, used to break the journal into a legible timeline. */
export function captureBucket(iso: string | null): string | null {
  const parts = captureParts(iso);
  if (!parts) return null;
  const hour = new Date(iso!).getUTCHours();
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `${parts.day} ${period}`;
}

/* --------------------------------------------------------------- assembly */

function defaultCaption(entry: IndexEntry): string {
  const parts = captureParts(entry.takenAt);
  return parts ? `${parts.day}, ${parts.time}` : entry.id;
}

/**
 * Honest alt text: it states where the photograph came from rather than
 * pretending to describe a frame nobody has looked at. Replace it by writing
 * `alt` into captions.json — `/admin/photos` lists everything still on this.
 */
function defaultAlt(entry: IndexEntry): string {
  const parts = captureParts(entry.takenAt);
  return parts
    ? `Undescribed photograph from LEADderm 2026, taken on ${parts.day} ${parts.date} at ${parts.time}.`
    : 'Undescribed photograph from LEADderm 2026.';
}

function toPhoto(entry: IndexEntry): Photo {
  const override = entry.override ?? {};
  const caption = override.caption?.trim();
  const alt = override.alt?.trim();
  return {
    id: entry.id,
    file: entry.file,
    caption: caption || defaultCaption(entry),
    alt: alt || defaultAlt(entry),
    note: override.note?.trim() || undefined,
    category: CATEGORIES.includes(override.category as Category)
      ? (override.category as Category)
      : 'unfiled',
    weight: WEIGHTS.includes(override.weight as Weight) ? (override.weight as Weight) : 'minor',
    altIsGenerated: !alt,
    captionIsGenerated: !caption,
    takenAt: entry.takenAt,
    camera: entry.camera,
    source: entry.source,
    sourceWidth: entry.sourceWidth,
    sourceHeight: entry.sourceHeight,
    supersedes: entry.supersedes,
    featured: override.featured === true,
    meta: viewerMeta(entry, Boolean(caption)),
  };
}

/**
 * The line under the caption in the photograph viewer. When the caption is
 * already the capture time there is no point repeating it, so only the camera
 * is left; when someone has written a caption, both belong.
 */
function viewerMeta(entry: IndexEntry, hasWrittenCaption: boolean): string {
  const parts = captureParts(entry.takenAt);
  const when = parts && hasWrittenCaption ? `${parts.day}, ${parts.time}` : null;
  return [when, entry.camera].filter(Boolean).join(' · ');
}

/**
 * Reading order: photographs pinned with `order` lead, in that order; the rest
 * follow in the order they were taken; anything with neither falls back to its
 * filename, so the sequence is always deterministic.
 */
export function sortPhotos(entries: IndexEntry[]): IndexEntry[] {
  return [...entries].sort((a, b) => {
    const pinA = a.override?.order;
    const pinB = b.override?.order;
    if (pinA !== undefined && pinB !== undefined) return pinA - pinB;
    if (pinA !== undefined) return -1;
    if (pinB !== undefined) return 1;
    if (a.takenAt && b.takenAt && a.takenAt !== b.takenAt) return a.takenAt < b.takenAt ? -1 : 1;
    if (a.takenAt && !b.takenAt) return -1;
    if (!a.takenAt && b.takenAt) return 1;
    return a.id.localeCompare(b.id, 'en');
  });
}

export const photos: Photo[] = sortPhotos(index.photos.filter((entry) => !entry.override?.hidden)).map(
  toPhoto,
);

const dates = photos
  .map((photo) => photo.takenAt)
  .filter((takenAt): takenAt is string => Boolean(takenAt))
  .sort();

/** How many calendar days the journal covers, from capture times. */
export const journalDays = new Set(dates.map((iso) => iso.slice(0, 10))).size;

/**
 * A line the journal writes about itself: how many frames, and the hours they
 * span once the photographs carry capture times. Below a handful of frames
 * there is nothing worth stating.
 */
export const journalSpan = (() => {
  if (photos.length < 6) return null;
  const count = `${photos.length} frames`;
  if (dates.length < 2) return `${count}.`;
  const first = captureParts(dates[0]!);
  const last = captureParts(dates[dates.length - 1]!);
  if (!first || !last) return `${count}.`;
  // The times already end in "a.m." / "p.m.", so no full stop is added.
  return first.day === last.day
    ? `${count}, ${first.day} ${first.time} to ${last.time}`
    : `${count}, ${first.day} ${first.time} to ${last.day} ${last.time}`;
})();

export const photoIndexMeta = {
  generatedAt: index.generatedAt,
  maxEdge: index.maxEdge,
  counts: index.counts,
  unreadable: index.unreadable,
  captions: index.captions ?? { error: null, repaired: false, problems: [] },
  hidden: index.photos.filter((entry) => entry.override?.hidden).map((entry) => entry.id),
};
