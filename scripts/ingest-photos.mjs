/**
 * PHOTO INGESTION
 * ============================================================================
 * Reads whatever is in `photos/` and prepares it for the build. It runs before
 * `dev`, `build`, `check` and `test` (npm `pre` hooks), so nothing here is ever
 * something you have to remember to do.
 *
 * For every photograph it:
 *   1. decodes it — including HEIC from an iPhone — and bakes in EXIF rotation,
 *   2. caps the long edge at MAX_EDGE so a 5472px camera file does not turn
 *      into a twelve-megabyte build artefact,
 *   3. reads the capture time and camera out of EXIF,
 *   4. fingerprints it, so a full-resolution upload of a photograph that is
 *      already on the site replaces it instead of appearing twice,
 *   5. writes a normalised master to `src/generated/photos/` and one index file
 *      to `src/generated/photo-index.json`.
 *
 * Both generated locations are ignored by git: they are rebuilt from `photos/`
 * every single time, so they can never drift from the originals.
 *
 * One photograph must never take the site down: anything unreadable is
 * reported and skipped, and the build continues with whatever else is there.
 * A run that produces nothing at all is a different matter and does fail,
 * because a green deployment with an empty journal is the one outcome nobody
 * would notice.
 */
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import decodeHeic from 'heic-decode';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = path.join(ROOT, 'photos');
const OUT_DIR = path.join(ROOT, 'src/generated/photos');
const INDEX_FILE = path.join(ROOT, 'src/generated/photo-index.json');
const CAPTIONS_FILE = path.join(INBOX, 'captions.json');

/** Nothing on the page is ever displayed wider than ~1600 CSS px. */
const MAX_EDGE = 2560;
const JPEG_QUALITY = 88;
const READABLE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif', '.tif', '.tiff']);
/** Two photographs within this Hamming distance are treated as the same frame. */
const HASH_DISTANCE = 5;
/**
 * A hash of a nearly featureless frame — a blank projector screen, a wall —
 * carries almost no information and will collide with every other flat frame.
 * Below this many set bits (or above its mirror) the hash is not trusted and
 * only the filename can establish identity.
 */
const HASH_MIN_BITS = 8;
/**
 * Two frames the camera timestamped more than a minute apart are different
 * photographs, however alike they look. This is what keeps a burst from the
 * same seat from collapsing into one frame.
 */
const SAME_MOMENT_MS = 60 * 1000;
/**
 * Merging on the picture exists for one purpose: a photograph already on the
 * site arriving again at a higher resolution. Two frames of the same size are
 * two exposures — a burst from one seat — however alike they look, so a real
 * jump in pixel count is required before a filename is overruled.
 */
const RESOLUTION_JUMP = 1.5;
/**
 * A camera with a flat clock battery stamps its files 1980, and a corrupt EXIF
 * block rolls over into next decade. Either would rewrite the journal's dates
 * and its day count, so a capture time outside living memory is not believed.
 */
const EARLIEST_PLAUSIBLE = Date.UTC(2005, 0, 1);
/** Decoding four at a time keeps every core busy without holding four hundred. */
const CONCURRENCY = Math.max(1, Math.min(4, availableParallelism?.() ?? 4));

const log = (...args) => console.info('[photos]', ...args);
const warn = (...args) => console.warn('[photos]', ...args);

/* ------------------------------------------------------------------ utils */

const shortHash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 6);

/**
 * Camera files are numbered, and only they carry copy suffixes worth removing.
 * `Room full.jpg` is a photograph of a full room; `IMG_7885 copy.jpg` is a
 * duplicate. Telling them apart is the difference between a caption that
 * follows its photograph and one that lands on somebody else's.
 */
const CAMERA_STEM = /^(IMG|DSC|DSCF|DSCN|PXL|GOPR|MVIMG|_MG|_DSC|P)[-_ ]?\d{3,}/i;

/**
 * A stable identity for a photograph, independent of how the file was named on
 * the way in. `DSC01757.webp`, `DSC01757 copy 2.JPG`, `DSC01757 2.heic` and
 * `DSC01757 (1).jpg` are all the same frame, so they all reduce to `DSC01757`.
 */
export function photoId(filename) {
  const base = path.basename(filename, path.extname(filename));
  let stem = base;
  if (CAMERA_STEM.test(base.trim())) {
    stem = stem
      // "(2)" is a copy; "IMG_7885" is a photograph. Only the bracketed form goes.
      .replace(/[ _-]*\(\d+\)$/, '')
      .replace(/[ _-]*(copy|edited|edit|original|large|small|full|hi ?res|export(ed)?)$/i, '')
      .replace(/[ _-]*copy[ _-]*\d*$/i, '')
      // "IMG_7885 2.jpg" is what a Mac names the second copy of a file.
      .replace(/ \d{1,2}$/, '');
  }
  const id = stem
    // "café" should stay legible as "cafe" rather than losing the letter.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');

  // A name written in a script this can't spell, or one long enough to be cut
  // in half, keeps a fingerprint of the original so it stays unique.
  if (!id) return `photo-${shortHash(base)}`;
  if (id.length > 60) return `${id.slice(0, 53).replace(/[-._]+$/, '')}-${shortHash(base)}`;
  return id;
}

/**
 * 64-bit difference hash. Resistant to resizing and re-encoding, which is
 * exactly the case we care about: the same photograph arriving at a higher
 * resolution than the copy already on the site.
 */
async function perceptualHash(image) {
  const { data } = await image()
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      bits += data[row * 9 + col] > data[row * 9 + col + 1] ? '1' : '0';
    }
  }
  return bits;
}

export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) distance += 1;
  return distance;
}

/** Whether a hash says enough about a picture to identify it. */
export function hashIsDistinctive(hash) {
  if (!hash) return false;
  const ones = [...hash].filter((bit) => bit === '1').length;
  return ones >= HASH_MIN_BITS && hash.length - ones >= HASH_MIN_BITS;
}

/**
 * Whether two frames are the same photograph, on the evidence available.
 *
 * The picture outranks the filename in both directions. Two files that share a
 * name but show different things — `saturday/IMG_001.jpg` and
 * `sunday/IMG_001.jpg`, which is what happens the moment anyone sorts a shoot
 * into folders — are two photographs, and merging them would silently lose one.
 */
export function looksLikeSameFrame(a, b) {
  const distinctive = hashIsDistinctive(a.hash) && hashIsDistinctive(b.hash);
  const alike = distinctive && hammingDistance(a.hash, b.hash) <= HASH_DISTANCE;

  if (a.id === b.id) {
    // The same name is strong evidence; only a plainly different picture
    // overrules it, which is what happens when a shoot is sorted into folders.
    return !distinctive || alike;
  }
  if (!alike) return false;

  // Different names, same picture. Only a real jump in resolution means this
  // is the higher-resolution upload of something already published.
  const larger = Math.max(a.pixels, b.pixels);
  const smaller = Math.max(1, Math.min(a.pixels, b.pixels));
  if (larger / smaller < RESOLUTION_JUMP) return false;

  // The camera clock is the last check: near-identical frames a minute apart
  // are two photographs, not one.
  if (a.takenAt && b.takenAt) {
    return Math.abs(new Date(a.takenAt).valueOf() - new Date(b.takenAt).valueOf()) <= SAME_MOMENT_MS;
  }
  return true;
}

/** How deeply a file sits under `photos/`, and where — used only for ordering. */
const depthOf = (source) => source.split('/').length;

/**
 * Two photographs can want the same id — `saturday/IMG_001.jpg` and
 * `sunday/IMG_001.jpg`. Whoever sits nearest the top of `photos/` keeps the
 * plain name and the ones in folders take the folder's, so that adding a
 * second `IMG_001` never renames the one already published — a published id
 * is a URL fragment and an anchor, and those should not move under people.
 */
export function disambiguate(groups) {
  const wanted = new Map();
  for (const group of groups) {
    const key = group.winner.id.toLowerCase();
    if (!wanted.has(key)) wanted.set(key, []);
    wanted.get(key).push(group);
  }

  const taken = new Set();
  for (const [, claimants] of wanted) {
    if (claimants.length === 1) {
      taken.add(claimants[0].winner.id.toLowerCase());
      continue;
    }
    // Shallowest first, then alphabetical: a fixed order, so the same folder
    // full of files always produces the same ids.
    claimants.sort(
      (a, b) =>
        depthOf(a.winner.source) - depthOf(b.winner.source) ||
        a.winner.source.localeCompare(b.winner.source, 'en'),
    );
    for (const [rank, group] of claimants.entries()) {
      const original = group.winner.id;
      if (rank === 0) {
        taken.add(original.toLowerCase());
        continue;
      }
      const folder = path.basename(path.dirname(group.winner.source));
      const base = folder && folder !== 'photos' ? photoId(`${folder}-${original}`) : original;
      let id = base;
      let suffix = 2;
      while (taken.has(id.toLowerCase())) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      warn(
        `two photographs both wanted the id "${original}"; ${group.winner.source} is published as "${id}".`,
      );
      taken.add(id.toLowerCase());
      group.winner = { ...group.winner, id };
      // The contested name stays with whoever kept it. Leaving it in this
      // group's aliases too would apply one caption to two photographs.
      group.aliases = [id, ...group.aliases.filter((alias) => alias !== original)];
    }
  }

  return dropAmbiguousAliases(groups);
}

/**
 * A name that more than one photograph answers to cannot be used to caption
 * either of them, so it is retired from both and said out loud.
 */
function dropAmbiguousAliases(groups) {
  const owners = new Map();
  for (const group of groups) {
    for (const alias of group.aliases) {
      owners.set(alias, (owners.get(alias) ?? 0) + 1);
    }
  }
  for (const group of groups) {
    const ambiguous = group.aliases.filter(
      (alias) => owners.get(alias) > 1 && alias !== group.winner.id,
    );
    if (ambiguous.length === 0) continue;
    for (const alias of ambiguous) {
      warn(`"${alias}" is claimed by more than one photograph; captions.json cannot use it.`);
    }
    group.aliases = group.aliases.filter((alias) => !ambiguous.includes(alias));
  }
  return groups;
}

/** Camera makers shout their own names in EXIF. */
const MAKERS = { SONY: 'Sony', NIKON: 'Nikon', CANON: 'Canon', FUJIFILM: 'Fujifilm', OLYMPUS: 'Olympus', PANASONIC: 'Panasonic', LEICA: 'Leica', RICOH: 'Ricoh', APPLE: 'Apple', GOOGLE: 'Google', SAMSUNG: 'Samsung', DJI: 'DJI' };

export function tidyCamera(raw) {
  // Makers write their name into both Make and Model, sometimes with a legal
  // suffix: "NIKON CORPORATION NIKON Z 6" is one camera, not three words of one.
  let words = (raw ?? '')
    .replace(/\b(corporation|company|imaging|camera|ag|inc\.?|co\.?,? ?ltd\.?)\b/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;

  const maker = MAKERS[words[0].toUpperCase()];
  if (maker) {
    words = [maker, ...words.slice(1).filter((word) => word.toUpperCase() !== maker.toUpperCase())];
    // "Apple iPhone 16 Pro" reads better as "iPhone 16 Pro".
    if (maker === 'Apple' && /^iPh|^iPad/i.test(words[1] ?? '')) words.shift();
  } else if (words.length > 1 && words[0].toUpperCase() === words[1].toUpperCase()) {
    words.shift();
  }
  return words.join(' ') || null;
}

/** Whether a camera clock can be believed. */
export function plausibleCapture(date, now = Date.now()) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return false;
  const at = date.valueOf();
  return at >= EARLIEST_PLAUSIBLE && at <= now + 24 * 60 * 60 * 1000;
}

function readExif(metadata, source) {
  if (!metadata.exif) return {};
  try {
    const exif = exifReader(metadata.exif);
    const taken =
      exif?.Photo?.DateTimeOriginal ?? exif?.Photo?.DateTimeDigitized ?? exif?.Image?.DateTime;
    const believable = plausibleCapture(taken);
    if (taken instanceof Date && !Number.isNaN(taken.valueOf()) && !believable) {
      warn(
        `${source} says it was taken ${taken.toISOString().slice(0, 10)} — the camera clock is ` +
          'wrong, so it is placed by filename instead.',
      );
    }
    const make = exif?.Image?.Make?.trim();
    const model = exif?.Image?.Model?.trim();
    const camera = tidyCamera([make, model].filter(Boolean).join(' '));
    return {
      takenAt: believable ? taken.toISOString() : null,
      camera: camera || null,
      lens: exif?.Photo?.LensModel?.trim() || null,
      focalLength: exif?.Photo?.FocalLength ?? null,
      aperture: exif?.Photo?.FNumber ?? null,
      iso: exif?.Photo?.ISOSpeedRatings ?? null,
    };
  } catch {
    return {};
  }
}

async function listInbox() {
  if (!existsSync(INBOX)) return [];
  const found = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (READABLE.has(path.extname(entry.name).toLowerCase())) found.push(full);
    }
  };
  await walk(INBOX);
  return found.sort((a, b) => a.localeCompare(b, 'en'));
}

/* ------------------------------------------------------------------ ingest */

/**
 * Opens a file as something sharp can work with.
 *
 * An iPhone photographs in HEIC by default, and the libvips shipped with sharp
 * reads HEIC headers but has no HEVC decoder, so `sharp(heic)` returns correct
 * dimensions and then fails on the pixels. libheif decodes them in WebAssembly
 * instead; sharp is still the one that reads the EXIF block. The result is
 * returned as a factory rather than a buffer, because holding a hundred
 * decoded camera originals at once is more than a build machine should carry.
 */
async function openImage(file) {
  const buffer = await readFile(file);
  if (/\.hei[cf]$/i.test(file)) {
    let exif = null;
    try {
      exif = (await sharp(buffer).metadata()).exif ?? null;
    } catch {
      // A HEIC whose header sharp cannot read still decodes below, or throws.
    }
    const { width, height, data } = await decodeHeic({ buffer });
    return {
      bytes: buffer.length,
      // libheif has already applied the rotation the EXIF asks for.
      metadata: { exif, width, height, autoOrient: { width, height } },
      image: () => sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }),
    };
  }
  return {
    bytes: buffer.length,
    metadata: await sharp(buffer).metadata(),
    image: () => sharp(buffer).rotate(),
  };
}

async function describe(file) {
  const source = path.relative(ROOT, file);
  const { bytes, metadata, image } = await openImage(file);
  const oriented = metadata.autoOrient ?? { width: metadata.width, height: metadata.height };
  const width = oriented.width ?? metadata.width;
  const height = oriented.height ?? metadata.height;
  if (!width || !height) throw new Error('no dimensions');

  return {
    id: photoId(file),
    file,
    source,
    bytes,
    sourceWidth: width,
    sourceHeight: height,
    pixels: width * height,
    hash: await perceptualHash(image),
    ...readExif(metadata, source),
  };
}

/** Groups files that are the same photograph, keeping the largest of each. */
export function resolveDuplicates(entries) {
  const groups = [];
  for (const entry of entries) {
    // Identity is decided by `looksLikeSameFrame`, which prefers the picture
    // and falls back to the filename. Matching on the id alone here would
    // re-merge the very collisions that rule exists to keep apart.
    const match = groups.find((group) =>
      group.members.some((member) => looksLikeSameFrame(member, entry)),
    );
    if (match) {
      match.members.push(entry);
      match.ids.add(entry.id);
    } else {
      groups.push({ ids: new Set([entry.id]), members: [entry] });
    }
  }

  return disambiguate(
    groups.map((group) => {
      // Resolution decides, because that is what supersession is for. Where
      // two copies are the same size, the one that still carries its EXIF is
      // the better original — an export or an AirDrop strips it.
      const ranked = [...group.members].sort(
        (a, b) =>
          b.pixels - a.pixels ||
          Number(Boolean(b.takenAt)) - Number(Boolean(a.takenAt)) ||
          (b.bytes ?? 0) - (a.bytes ?? 0) ||
          a.source.localeCompare(b.source, 'en'),
      );
      const winner = ranked[0];
      return {
        // A re-export loses the capture time and the camera; the copy it
        // replaced still knows them, so the group keeps the best of each.
        winner: {
          ...winner,
          takenAt: ranked.map((member) => member.takenAt).find(Boolean) ?? null,
          camera: ranked.map((member) => member.camera).find(Boolean) ?? null,
          lens: ranked.map((member) => member.lens).find(Boolean) ?? null,
        },
        // Every name this photograph has ever had, so a caption written against
        // the old low-resolution file survives the high-resolution upload.
        aliases: [...new Set(group.members.map((member) => member.id))],
        superseded: ranked
          .slice(1)
          .map((entry) => ({ id: entry.id, source: entry.source, pixels: entry.pixels })),
      };
    }),
  );
}

/**
 * The file is opened a second time here rather than carried over from
 * `describe`, because holding a hundred decoded camera originals at once is
 * more than a build machine should be asked to carry. For HEIC that means
 * paying the WebAssembly decode twice — measured at a fraction of a second per
 * photograph, which is the cheaper of the two things to spend.
 */
async function writeMaster(entry, dir) {
  const longEdge = Math.max(entry.sourceWidth, entry.sourceHeight);
  const { image } = await openImage(entry.file);
  const pipeline = image(); // EXIF orientation is already baked in
  if (longEdge > MAX_EDGE) pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside' });

  const out = path.join(dir, `${entry.id}.jpg`);
  // No mozjpeg here: this master is an intermediate that Astro re-encodes into
  // every size the page actually serves, and the slower encoder buys nothing
  // but minutes on a build with a hundred photographs in it.
  const info = await pipeline.jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4' }).toFile(out);
  return { width: info.width, height: info.height, bytes: info.size };
}

/** Runs `worker` over `items` a few at a time, keeping the results in order. */
async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

const OVERRIDE_KEYS = new Set(['caption', 'alt', 'note', 'category', 'weight', 'order', 'takenAt', 'hidden', 'featured']);
/** `2026-08-29T14:20`, the camera's own wall clock. */
const STATED_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
const CATEGORY_VALUES = new Set(['venue', 'room', 'people', 'artifact', 'unfiled']);
const WEIGHT_VALUES = new Set(['lead', 'major', 'minor']);

/**
 * A typo in captions.json should say so out loud rather than silently doing
 * nothing. Nothing here is fatal: bad values are dropped, the rest applies.
 */
export function validateOverrides(captions) {
  const problems = [];
  const pins = new Map();
  for (const [id, value] of Object.entries(captions)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      problems.push(`${id}: expected an object`);
      continue;
    }
    for (const key of Object.keys(value)) {
      if (!OVERRIDE_KEYS.has(key)) {
        problems.push(`${id}.${key} is not a field (${[...OVERRIDE_KEYS].join(', ')})`);
      }
    }
    if (value.category !== undefined && !CATEGORY_VALUES.has(value.category)) {
      problems.push(`${id}.category "${value.category}" — use one of ${[...CATEGORY_VALUES].join(', ')}`);
    }
    if (value.weight !== undefined && !WEIGHT_VALUES.has(value.weight)) {
      problems.push(`${id}.weight "${value.weight}" — use lead, major or minor`);
    }
    if (value.order !== undefined) {
      // `1e999` parses as Infinity and passes `typeof x === 'number'`, then
      // makes the comparator inconsistent and scrambles the whole sequence.
      if (typeof value.order !== 'number' || !Number.isFinite(value.order)) {
        problems.push(`${id}.order must be a number`);
      } else {
        if (!pins.has(value.order)) pins.set(value.order, []);
        pins.get(value.order).push(id);
      }
    }
    if (value.takenAt !== undefined && (typeof value.takenAt !== 'string' || !STATED_TIME.test(value.takenAt.trim()))) {
      problems.push(`${id}.takenAt should read like 2026-08-29T14:20`);
    }
    for (const flag of ['hidden', 'featured']) {
      if (value[flag] !== undefined && typeof value[flag] !== 'boolean') {
        problems.push(`${id}.${flag} must be true or false`);
      }
    }
  }
  for (const [order, ids] of pins) {
    if (ids.length > 1) problems.push(`order ${order} is used by ${ids.join(', ')} — give each its own number`);
  }
  return problems;
}

/**
 * Straight quotes typed on a phone come out curly, and JSON only understands
 * the straight kind. Only quotes doing structural work are converted — the ones
 * that open a value after a brace, comma or colon, and the ones that close it
 * before the next — so a curly quote inside a caption survives untouched.
 */
export function straightenQuotes(text) {
  return text
    .replace(/^(\s*)[\u201C\u201D]/, '$1"')
    .replace(/([{,[:]\s*)[\u201C\u201D]/g, '$1"')
    .replace(/[\u201C\u201D](\s*[},\]:])/g, '"$1');
}

/**
 * Reads captions.json the way a person writes it. A byte-order mark, a
 * comment, the trailing comma every editor tempts you into, and the curly
 * quotes an iPhone substitutes for straight ones are repaired rather than
 * costing every caption on the site; anything else is reported with the
 * offending line, because losing all the captions to one typo, in a hotel
 * lobby, is the worst outcome available.
 */
export function parseCaptions(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const decommented = clean
    .replace(/(^|[^:])\/\/[^\n"]*$/gm, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');
  const attempts = [clean, decommented, straightenQuotes(decommented)];
  let lastError;
  for (const [index, attempt] of attempts.entries()) {
    let parsed;
    try {
      parsed = JSON.parse(attempt);
    } catch (error) {
      lastError = error;
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { photos: {}, error: 'expected an object of photo ids, or a { "photos": { … } } wrapper' };
    }
    const wrapped = parsed.photos && typeof parsed.photos === 'object' && !Array.isArray(parsed.photos);
    const photos = wrapped ? parsed.photos : parsed;
    if (!photos || typeof photos !== 'object' || Array.isArray(photos)) {
      return { photos: {}, error: 'expected an object of photo ids, or a { "photos": { … } } wrapper' };
    }
    // Pasting one line too high is the likeliest mistake there is, and it
    // produces perfectly valid JSON. Rather than drop it, adopt it and say so.
    const strays = wrapped
      ? Object.entries(parsed).filter(
          ([key, value]) =>
            key !== 'photos' &&
            !key.startsWith('_') &&
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            Object.keys(value).every((field) => OVERRIDE_KEYS.has(field)),
        )
      : [];
    for (const [key, value] of strays) if (!(key in photos)) photos[key] = value;
    return {
      photos,
      repaired: index > 0,
      strays: strays.map(([key]) => key),
    };
  }

  // Point at the line, not the byte offset.
  const at = /position (\d+)/.exec(lastError?.message ?? '');
  let where = '';
  if (at) {
    const upto = clean.slice(0, Number(at[1]));
    const line = upto.split('\n').length;
    where = ` (line ${line}: ${(clean.split('\n')[line - 1] ?? '').trim().slice(0, 60)})`;
  }
  return { photos: {}, error: `${lastError?.message ?? 'could not be parsed'}${where}` };
}

async function loadCaptions() {
  if (!existsSync(CAPTIONS_FILE)) return { photos: {} };
  return parseCaptions(await readFile(CAPTIONS_FILE, 'utf8'));
}

async function main() {
  const started = Date.now();
  // Everything is built beside the live directory and swapped in at the end,
  // so a run that dies halfway leaves the previous set of masters intact
  // instead of an empty folder and a build that cannot explain itself.
  const staging = `${OUT_DIR}.staging`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  const files = await listInbox();
  const unreadable = [];
  const described = await mapPool(files, CONCURRENCY, async (file) => {
    try {
      return await describe(file);
    } catch (error) {
      const relative = path.relative(ROOT, file);
      return { failed: { source: relative, reason: error.message } };
    }
  });

  const entries = [];
  for (const result of described) {
    if (result?.failed) {
      unreadable.push(result.failed);
      warn(`could not read ${result.failed.source} — ${result.failed.reason}`);
    } else {
      entries.push(result);
    }
  }

  const groups = resolveDuplicates(entries);
  const { photos: captions, error: captionsError, repaired, strays = [] } = await loadCaptions();
  if (captionsError) {
    warn(`captions.json was ignored — ${captionsError}`);
    warn('  every photograph keeps its automatic caption until this is fixed.');
  }
  if (repaired) warn('captions.json needed tidying — a comma, a comment or a curly quote — but it was read.');
  for (const key of strays) {
    warn(`captions.json — "${key}" was written outside the "photos" block; it was used anyway.`);
  }
  const captionProblems = validateOverrides(captions);
  for (const problem of captionProblems) warn(`captions.json — ${problem}`);

  const known = new Set(groups.flatMap((group) => group.aliases));
  for (const id of Object.keys(captions)) {
    if (!known.has(id)) warn(`captions.json mentions "${id}", which is not in the photos folder.`);
  }

  let superseded = 0;
  const written = await mapPool(groups, CONCURRENCY, async (group) => {
    try {
      return { group, master: await writeMaster(group.winner, staging) };
    } catch (error) {
      return { group, failed: { source: group.winner.source, reason: error.message } };
    }
  });

  const photos = [];
  for (const { group, master, failed } of written) {
    if (failed) {
      unreadable.push(failed);
      warn(`could not normalise ${failed.source} — ${failed.reason}`);
      continue;
    }
    const { winner } = group;
    superseded += group.superseded.length;
    for (const loser of group.superseded) {
      log(`${loser.source} is superseded by ${winner.source} (${winner.pixels} > ${loser.pixels} px)`);
    }

    // The first alias with an entry in captions.json wins, so a caption written
    // against any earlier filename follows the photograph forward.
    const override = group.aliases.map((alias) => captions[alias]).find(Boolean) ?? {};

    photos.push({
      id: winner.id,
      aliases: group.aliases,
      file: `${winner.id}.jpg`,
      width: master.width,
      height: master.height,
      bytes: master.bytes,
      sourceWidth: winner.sourceWidth,
      sourceHeight: winner.sourceHeight,
      sourceBytes: winner.bytes,
      source: winner.source,
      takenAt: winner.takenAt ?? null,
      camera: winner.camera ?? null,
      lens: winner.lens ?? null,
      hash: winner.hash,
      supersedes: group.superseded.map((item) => item.source),
      override,
    });
  }

  // A folder with photographs in it that yields none of them is not a bad
  // photograph, it is a broken toolchain, and it must not deploy quietly.
  if (files.length > 0 && photos.length === 0) {
    throw new Error(
      `${files.length} file${files.length === 1 ? '' : 's'} in photos/ and not one could be read`,
    );
  }

  const index = {
    generatedAt: new Date().toISOString(),
    maxEdge: MAX_EDGE,
    counts: {
      files: files.length,
      photos: photos.length,
      superseded,
      unreadable: unreadable.length,
    },
    unreadable,
    captions: {
      error: captionsError ?? null,
      repaired: repaired ?? false,
      strays,
      problems: captionProblems,
    },
    photos,
  };

  await rm(OUT_DIR, { recursive: true, force: true });
  await rename(staging, OUT_DIR);
  await mkdir(path.dirname(INDEX_FILE), { recursive: true });
  await writeFile(`${INDEX_FILE}.tmp`, `${JSON.stringify(index, null, 2)}\n`);
  await rename(`${INDEX_FILE}.tmp`, INDEX_FILE);

  const megabytes = entries.reduce((sum, entry) => sum + entry.bytes, 0) / 1024 / 1024;
  if (megabytes > 500) {
    warn(
      `the photos folder is ${megabytes.toFixed(0)} MB. Past a gigabyte every push clones a lot ` +
        'of data; replacing the originals with 3000px exports would fix it without changing the site.',
    );
  }

  log(
    `${photos.length} photograph${photos.length === 1 ? '' : 's'} ready` +
      (superseded ? `, ${superseded} superseded` : '') +
      (unreadable.length ? `, ${unreadable.length} unreadable` : '') +
      ` (${Date.now() - started}ms)`,
  );
}

// Only run when invoked directly, so the helpers stay unit-testable.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch(async (error) => {
    warn('ingestion failed —', error.message);
    warn('  the photographs already generated are left in place; nothing was deleted.');
    await rm(`${OUT_DIR}.staging`, { recursive: true, force: true }).catch(() => {});
    // A build that cannot read the photo folder should stop, not publish an
    // empty journal behind a green tick.
    process.exit(existsSync(INDEX_FILE) ? 0 : 1);
  });
}

export { MAX_EDGE, HASH_DISTANCE, HASH_MIN_BITS, SAME_MOMENT_MS, RESOLUTION_JUMP, EARLIEST_PLAUSIBLE };
