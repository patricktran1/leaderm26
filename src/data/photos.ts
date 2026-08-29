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
  /**
   * Places the photograph at this position in the journal, counting from 1.
   * Everything unpinned flows around it in the order it was taken.
   */
  order?: number;
  /**
   * The capture time, for a frame whose file has none — an old export, a
   * screenshot, anything that lost its EXIF. Written as `2026-08-29T14:20`
   * and read as the camera's own wall clock, never converted.
   */
  takenAt?: string;
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
  captions?: { error: string | null; repaired: boolean; strays?: string[]; problems: string[] };
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
  /** The seat this photograph was pinned to in captions.json, if any. */
  pinnedAt: number | null;
  /** Whether captions.json mentions this photograph at all — i.e. untouched. */
  hasOverride: boolean;
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

/**
 * Down a page of forty frames the day is said once by the standfirst and again
 * by every half-day heading; printing "Saturday," above each photograph as well
 * is repetition, not information. So a journal long enough to carry those
 * captions its frames with the time alone, and the viewer supplies the day for
 * anyone who arrives at a single photograph from a shared link.
 */
export function defaultCaption(entry: IndexEntry, dayIsUnderstood: boolean): string {
  const parts = captureParts(entry.takenAt);
  if (!parts) return entry.id;
  return dayIsUnderstood ? parts.time : `${parts.day}, ${parts.time}`;
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

function toPhoto(entry: IndexEntry, dayIsUnderstood = false): Photo {
  const override = entry.override ?? {};
  const caption = override.caption?.trim();
  const alt = override.alt?.trim();
  return {
    id: entry.id,
    file: entry.file,
    caption: caption || defaultCaption(entry, dayIsUnderstood),
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
    pinnedAt: pinnedAt(entry),
    hasOverride: Object.keys(override).length > 0,
    meta: viewerMeta(entry, Boolean(caption), dayIsUnderstood),
  };
}

/**
 * The line under the caption in the photograph viewer. When the caption is
 * already the capture time there is no point repeating it, so only the camera
 * is left; when someone has written a caption, both belong.
 */
function viewerMeta(entry: IndexEntry, hasWrittenCaption: boolean, dayIsUnderstood: boolean): string {
  const parts = captureParts(entry.takenAt);
  if (!parts) return entry.camera ?? '';
  // Where the caption is already the time, the viewer adds only what the
  // caption left out — the day, when the caption dropped it — never the time twice.
  const when = hasWrittenCaption
    ? `${parts.day}, ${parts.time}`
    : dayIsUnderstood
      ? parts.day
      : null;
  return [when, entry.camera].filter(Boolean).join(' · ');
}

/**
 * A capture time written by hand in captions.json. EXIF times are a camera's
 * wall clock and are printed as such, so a stated time is read the same way
 * rather than being shifted into whatever zone the build machine is in.
 */
export function statedTime(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, sec] = match;
  const at = new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +(sec ?? 0)));
  return Number.isNaN(at.valueOf()) ? null : at.toISOString();
}

/** The pinned position of a photograph, if it has a usable one. */
function pinnedAt(entry: IndexEntry): number | null {
  const order = entry.override?.order;
  return typeof order === 'number' && Number.isFinite(order) ? Math.max(1, Math.round(order)) : null;
}

/**
 * Reading order is the order the photographs were taken. `order` in
 * captions.json is a seat number, not a queue: a frame pinned to 3 sits third
 * and everything else flows around it, so a photograph uploaded at midnight
 * still lands where it belongs in the day rather than at the bottom of the
 * page. Anything with no capture time at all falls back to its filename, so
 * the sequence is always the same twice running.
 */
export function sortPhotos(entries: IndexEntry[]): IndexEntry[] {
  const byTime = (a: IndexEntry, b: IndexEntry) => {
    if (a.takenAt && b.takenAt && a.takenAt !== b.takenAt) return a.takenAt < b.takenAt ? -1 : 1;
    if (a.takenAt && !b.takenAt) return -1;
    if (!a.takenAt && b.takenAt) return 1;
    return a.id.localeCompare(b.id, 'en');
  };

  const free = entries.filter((entry) => pinnedAt(entry) === null).sort(byTime);
  const pinned = entries
    .filter((entry) => pinnedAt(entry) !== null)
    // Two frames pinned to the same seat would otherwise be ordered by whatever
    // the folder listing happened to be that morning.
    .sort((a, b) => pinnedAt(a)! - pinnedAt(b)! || a.id.localeCompare(b.id, 'en'));

  const ordered: IndexEntry[] = [];
  let next = 0;
  for (const entry of pinned) {
    while (ordered.length < pinnedAt(entry)! - 1 && next < free.length) ordered.push(free[next++]!);
    ordered.push(entry);
  }
  while (next < free.length) ordered.push(free[next++]!);
  return ordered;
}

/** A time written into captions.json stands in for a file that lost its EXIF. */
const entries: IndexEntry[] = index.photos.map((entry) => {
  const stated = statedTime(entry.override?.takenAt);
  return stated ? { ...entry, takenAt: stated } : entry;
});

const visible = sortPhotos(entries.filter((entry) => !entry.override?.hidden));

const dates = visible
  .map((entry) => entry.takenAt)
  .filter((takenAt): takenAt is string => Boolean(takenAt))
  .sort();

/** How many calendar days the journal covers, from capture times. */
export const journalDays = new Set(dates.map((iso) => iso.slice(0, 10))).size;

/**
 * Whether the page states the day for itself. Once there are enough frames
 * for a standfirst, it does — and again at every half-day heading the journal
 * grows — so the captions can stop repeating it. In a two-day journal that is
 * the difference between a column of "Saturday, 12:21 p.m." and a column of
 * times under a heading that already says which afternoon this is.
 */
const dayIsUnderstood = visible.length >= 6;

export const photos: Photo[] = visible.map((entry) => toPhoto(entry, dayIsUnderstood));

/**
 * A line the journal writes about itself: how many frames, and the hours they
 * span once the photographs carry capture times. Below a handful of frames
 * there is nothing worth stating.
 */
export const journalSpan = (() => {
  if (visible.length < 6) return null;
  const count = `${visible.length} frames`;
  if (dates.length < 2) return `${count}.`;
  const first = captureParts(dates[0]!);
  const last = captureParts(dates[dates.length - 1]!);
  if (!first || !last) return `${count}.`;
  // The times already end in "a.m." / "p.m.", so no full stop is added.
  return first.day === last.day
    ? `${count}, ${first.day} ${first.time} to ${last.time}`
    : `${count}, ${first.day} ${first.time} to ${last.day} ${last.time}`;
})();

/**
 * When the site was last rebuilt, in the time zone of the room it was
 * photographed in — which is to say when a photograph was last added. It is
 * the only honest signal that this is a journal still being published rather
 * than an archive, and it needs nobody to maintain it.
 */
export const publishedAt: string | null = (() => {
  const at = new Date(index.generatedAt);
  if (Number.isNaN(at.valueOf())) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(at)
    .replace(/\bAM\b/, 'a.m.')
    .replace(/\bPM\b/, 'p.m.');
})();

export const photoIndexMeta = {
  generatedAt: index.generatedAt,
  maxEdge: index.maxEdge,
  counts: index.counts,
  unreadable: index.unreadable,
  captions: index.captions ?? { error: null, repaired: false, strays: [], problems: [] },
  hidden: index.photos.filter((entry) => entry.override?.hidden).map((entry) => entry.id),
};
