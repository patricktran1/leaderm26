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
 * This script must never fail the build. Anything it cannot read is reported
 * and skipped; the site builds with whatever else is there.
 */
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import exifReader from 'exif-reader';

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

const log = (...args) => console.info('[photos]', ...args);
const warn = (...args) => console.warn('[photos]', ...args);

/* ------------------------------------------------------------------ utils */

/**
 * A stable identity for a photograph, independent of how the file was named on
 * the way in. `DSC01757.webp`, `DSC01757 copy 2.JPG` and `DSC01757-edited.heic`
 * are all the same frame, so they all reduce to `DSC01757`.
 */
export function photoId(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[ _-]*\(?\d+\)?$/i, (match) => (/^[ _-]*\(\d+\)$/.test(match) ? '' : match))
    .replace(/[ _-]*(copy|edited|edit|original|large|small|full|hi ?res|export(ed)?)$/i, '')
    .replace(/[ _-]*copy[ _-]*\d*$/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60) || 'photo';
}

/**
 * 64-bit difference hash. Resistant to resizing and re-encoding, which is
 * exactly the case we care about: the same photograph arriving at a higher
 * resolution than the copy already on the site.
 */
async function perceptualHash(image) {
  const { data } = await sharp(image)
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

/** Whether two frames could be the same photograph, on the evidence available. */
export function looksLikeSameFrame(a, b) {
  if (a.id === b.id) return true;
  if (!hashIsDistinctive(a.hash) || !hashIsDistinctive(b.hash)) return false;
  if (hammingDistance(a.hash, b.hash) > HASH_DISTANCE) return false;
  // The camera clock is the tie-breaker: near-identical frames a minute apart
  // are two photographs, not one.
  if (a.takenAt && b.takenAt) {
    return Math.abs(new Date(a.takenAt).valueOf() - new Date(b.takenAt).valueOf()) <= SAME_MOMENT_MS;
  }
  return true;
}

function readExif(metadata) {
  if (!metadata.exif) return {};
  try {
    const exif = exifReader(metadata.exif);
    const taken =
      exif?.Photo?.DateTimeOriginal ?? exif?.Photo?.DateTimeDigitized ?? exif?.Image?.DateTime;
    const make = exif?.Image?.Make?.trim();
    const model = exif?.Image?.Model?.trim();
    const camera = [make, model]
      .filter(Boolean)
      .join(' ')
      .replace(/\b(\w+)\s+\1\b/i, '$1') // "Apple Apple iPhone" -> "Apple iPhone"
      .trim();
    return {
      takenAt: taken instanceof Date && !Number.isNaN(taken.valueOf()) ? taken.toISOString() : null,
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

async function describe(file) {
  const source = path.relative(ROOT, file);
  const buffer = await readFile(file);
  const metadata = await sharp(buffer).metadata();
  const oriented = metadata.autoOrient ?? { width: metadata.width, height: metadata.height };
  const width = oriented.width ?? metadata.width;
  const height = oriented.height ?? metadata.height;
  if (!width || !height) throw new Error('no dimensions');

  return {
    id: photoId(file),
    source,
    bytes: buffer.length,
    sourceWidth: width,
    sourceHeight: height,
    pixels: width * height,
    hash: await perceptualHash(buffer),
    ...readExif(metadata),
    buffer,
  };
}

/** Groups files that are the same photograph, keeping the largest of each. */
export function resolveDuplicates(entries) {
  const groups = [];
  for (const entry of entries) {
    const match = groups.find(
      (group) =>
        group.ids.has(entry.id) ||
        group.members.some((member) => looksLikeSameFrame(member, entry)),
    );
    if (match) {
      match.members.push(entry);
      match.ids.add(entry.id);
    } else {
      groups.push({ ids: new Set([entry.id]), members: [entry] });
    }
  }

  return groups.map((group) => {
    const ranked = [...group.members].sort((a, b) => b.pixels - a.pixels || a.id.localeCompare(b.id));
    const winner = ranked[0];
    return {
      winner,
      // Every name this photograph has ever had, so a caption written against
      // the old low-resolution file survives the high-resolution upload.
      aliases: [...new Set(group.members.map((member) => member.id))],
      superseded: ranked.slice(1).map((entry) => ({ id: entry.id, source: entry.source, pixels: entry.pixels })),
    };
  });
}

async function writeMaster(entry) {
  const longEdge = Math.max(entry.sourceWidth, entry.sourceHeight);
  const pipeline = sharp(entry.buffer).rotate(); // bakes in EXIF orientation
  if (longEdge > MAX_EDGE) pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside' });

  const out = path.join(OUT_DIR, `${entry.id}.jpg`);
  const info = await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(out);
  return { width: info.width, height: info.height, bytes: info.size };
}

const OVERRIDE_KEYS = new Set(['caption', 'alt', 'note', 'category', 'weight', 'order', 'hidden', 'featured']);
const CATEGORY_VALUES = new Set(['venue', 'room', 'people', 'artifact', 'unfiled']);
const WEIGHT_VALUES = new Set(['lead', 'major', 'minor']);

/**
 * A typo in captions.json should say so out loud rather than silently doing
 * nothing. Nothing here is fatal: bad values are dropped, the rest applies.
 */
export function validateOverrides(captions) {
  const problems = [];
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
    if (value.order !== undefined && typeof value.order !== 'number') {
      problems.push(`${id}.order must be a number`);
    }
    for (const flag of ['hidden', 'featured']) {
      if (value[flag] !== undefined && typeof value[flag] !== 'boolean') {
        problems.push(`${id}.${flag} must be true or false`);
      }
    }
  }
  return problems;
}

async function loadCaptions() {
  if (!existsSync(CAPTIONS_FILE)) return {};
  try {
    const parsed = JSON.parse(await readFile(CAPTIONS_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed.photos ?? parsed) : {};
  } catch (error) {
    warn(`captions.json could not be parsed and was ignored — ${error.message}`);
    return {};
  }
}

async function main() {
  const started = Date.now();
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const files = await listInbox();
  const unreadable = [];
  const entries = [];

  for (const file of files) {
    try {
      entries.push(await describe(file));
    } catch (error) {
      const relative = path.relative(ROOT, file);
      unreadable.push({ source: relative, reason: error.message });
      warn(`could not read ${relative} — ${error.message}`);
      if (/\.hei[cf]$/i.test(file)) {
        warn('  HEIC needs a build of libvips with an HEVC decoder. Re-export as JPEG.');
      }
    }
  }

  const groups = resolveDuplicates(entries);
  const captions = await loadCaptions();
  for (const problem of validateOverrides(captions)) warn(`captions.json — ${problem}`);

  const known = new Set(groups.flatMap((group) => group.aliases));
  for (const id of Object.keys(captions)) {
    if (!known.has(id)) warn(`captions.json mentions "${id}", which is not in the photos folder.`);
  }
  const photos = [];
  let superseded = 0;

  for (const group of groups) {
    const { winner } = group;
    let master;
    try {
      master = await writeMaster(winner);
    } catch (error) {
      unreadable.push({ source: winner.source, reason: error.message });
      warn(`could not normalise ${winner.source} — ${error.message}`);
      continue;
    }
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
    photos,
  };

  await mkdir(path.dirname(INDEX_FILE), { recursive: true });
  await writeFile(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`);

  const inboxSize = (await Promise.all(files.map((file) => stat(file).then((s) => s.size).catch(() => 0)))).reduce(
    (sum, size) => sum + size,
    0,
  );
  if (inboxSize > 500 * 1024 * 1024) {
    warn(`the photos folder is ${(inboxSize / 1024 / 1024).toFixed(0)} MB — large for a git repository.`);
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
  main().catch((error) => {
    warn('ingestion failed, continuing with whatever is already generated —', error.message);
    process.exit(0);
  });
}

export { MAX_EDGE, HASH_DISTANCE, HASH_MIN_BITS, SAME_MOMENT_MS };
