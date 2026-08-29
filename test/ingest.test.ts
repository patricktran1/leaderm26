import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseCaptions,
  photoId,
  plausibleCapture,
  straightenQuotes,
  hammingDistance,
  hashIsDistinctive,
  resolveDuplicates,
  tidyCamera,
  validateOverrides,
} from '../scripts/ingest-photos.mjs';

const frame = (id: string, pixels: number, hash = '0'.repeat(64)) => ({
  id: photoId(id),
  source: `photos/${id}`,
  pixels,
  bytes: pixels,
  hash,
  takenAt: null as string | null,
});

type Group = { winner: ReturnType<typeof frame>; aliases: string[] };

describe('photoId', () => {
  it('reduces a filename to a stable identity', () => {
    expect(photoId('photos/DSC01757.webp')).toBe('DSC01757');
    expect(photoId('DSC01757.JPG')).toBe('DSC01757');
  });

  it('sees through the names a Mac gives a second copy', () => {
    for (const name of [
      'DSC01757 copy.jpg',
      'DSC01757 copy 2.jpg',
      'DSC01757-edited.heic',
      'DSC01757 (1).jpeg',
      'DSC01757_original.png',
    ]) {
      expect(photoId(name), name).toBe('DSC01757');
    }
  });

  it('keeps a camera counter that is part of the name', () => {
    expect(photoId('IMG_7885.jpg')).toBe('IMG_7885');
    expect(photoId('2026-08-29-141522.jpg')).toBe('2026-08-29-141522');
  });

  it('never returns an empty or unsafe id', () => {
    expect(photoId('a photo/with spaces & symbols!.jpg')).toBe('with-spaces-symbols');
    expect(photoId('x'.repeat(200) + '.jpg').length).toBeLessThanOrEqual(60);
  });

  it('gives a name it cannot spell a fingerprint rather than a shared fallback', () => {
    // Two files whose names survive none of the folding still need two ids,
    // or one photograph overwrites the other on the way to disk.
    const ids = ['....jpg', '\u65e5\u672c\u8a9e.jpg', '\ud55c\uad6d\uc5b4.jpg'].map(photoId);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^photo-[0-9a-f]{6}$/);
    // And the same name always folds to the same id.
    expect(photoId('\u65e5\u672c\u8a9e.jpg')).toBe(photoId('folder/\u65e5\u672c\u8a9e.jpg'));
  });

  it('two long names that share a prefix do not collide', () => {
    const a = photoId(`${'x'.repeat(70)}-arrival.jpg`);
    const b = photoId(`${'x'.repeat(70)}-lunch.jpg`);
    expect(a).not.toBe(b);
  });

  it('only strips copy words from files a camera numbered', () => {
    // "Room full" and "Room small" are two photographs of a room, not one
    // photograph and its export.
    expect(photoId('Room full.jpg')).toBe('Room-full');
    expect(photoId('Room small.jpg')).toBe('Room-small');
    expect(photoId('my original.jpg')).toBe('my-original');
    expect(photoId('the edit.jpg')).toBe('the-edit');
    // The camera-numbered forms still reduce.
    expect(photoId('IMG_7885 2.jpg')).toBe('IMG_7885');
    expect(photoId('DSC01757 original.jpg')).toBe('DSC01757');
  });

  it('keeps an accented name legible instead of dropping the letter', () => {
    expect(photoId('café & friends #1.jpg')).toBe('cafe-friends-1');
    expect(photoId('Ünïcodé Ñame.JPG')).toBe('Unicode-Name');
  });

  it('does not confuse two photographs with a number in the name', () => {
    expect(photoId('beach 1.jpg')).toBe('beach-1');
    expect(photoId('beach 2.jpg')).toBe('beach-2');
  });
});

describe('hashIsDistinctive', () => {
  it('rejects a hash with almost nothing in it', () => {
    expect(hashIsDistinctive('0'.repeat(64))).toBe(false);
    expect(hashIsDistinctive('1'.repeat(64))).toBe(false);
    expect(hashIsDistinctive(null)).toBe(false);
  });

  it('accepts a hash with real structure', () => {
    expect(hashIsDistinctive('10'.repeat(32))).toBe(true);
  });
});

describe('hammingDistance', () => {
  it('counts differing bits', () => {
    expect(hammingDistance('0000', '0000')).toBe(0);
    expect(hammingDistance('0000', '1010')).toBe(2);
  });

  it('treats a missing or mismatched hash as unrelated', () => {
    expect(hammingDistance('0000', '')).toBe(Number.POSITIVE_INFINITY);
    expect(hammingDistance(null, '0000')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('resolveDuplicates', () => {
  it('keeps one photograph when the same frame arrives twice', () => {
    const groups = resolveDuplicates([
      frame('DSC01757.webp', 345_600),
      frame('DSC01757 copy.jpg', 8_640_000),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.winner.source).toBe('photos/DSC01757 copy.jpg');
    expect(groups[0]!.superseded.map((s: { source: string }) => s.source)).toEqual(['photos/DSC01757.webp']);
  });

  it('matches on the picture when the filename changed', () => {
    const hash = '1100'.repeat(16);
    const near = `${hash.slice(0, 60)}0000`;
    const groups = resolveDuplicates([
      frame('DSC01757.webp', 345_600, hash),
      frame('newport-arrival.jpg', 8_640_000, near),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.winner.source).toBe('photos/newport-arrival.jpg');
    // The old name survives, so a caption written against it still applies.
    expect(groups[0]!.aliases).toContain('DSC01757');
  });

  it('keeps genuinely different photographs apart', () => {
    const groups = resolveDuplicates([
      frame('a.jpg', 100, '0'.repeat(64)),
      frame('b.jpg', 100, '1'.repeat(64)),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('handles an empty inbox', () => {
    expect(resolveDuplicates([])).toEqual([]);
  });
});

describe('captions.json', () => {
  const raw = JSON.parse(readFileSync(new URL('../photos/captions.json', import.meta.url), 'utf8'));

  it('parses and uses the documented shape', () => {
    expect(raw.photos).toBeTypeOf('object');
  });

  it('contains no unknown fields or values', () => {
    expect(validateOverrides(raw.photos)).toEqual([]);
  });

  it('gives every pinned photograph a distinct position', () => {
    const orders = Object.values(raw.photos as Record<string, { order?: number }>)
      .map((entry) => entry.order)
      .filter((order): order is number => order !== undefined);
    expect(new Set(orders).size).toBe(orders.length);
  });
});

describe('telling similar photographs apart', () => {
  const flat = '0'.repeat(64);
  const busy = '1010110010110100101101001011010010110100101101001011010010110101';

  it('does not merge featureless frames on their hash alone', () => {
    // A blank projector screen and a blank wall hash almost identically. Only
    // the filename may claim they are the same photograph.
    const groups = resolveDuplicates([
      { ...frame('DSC01900.JPG', 1000, flat) },
      { ...frame('DSC01901.JPG', 1000, flat) },
    ]);
    expect(groups).toHaveLength(2);
  });

  it('does not merge near-identical frames the camera timed a minute apart', () => {
    const groups = resolveDuplicates([
      { ...frame('DSC01900.JPG', 1000, busy), takenAt: '2026-08-29T13:00:00.000Z' },
      { ...frame('DSC01901.JPG', 1000, busy), takenAt: '2026-08-29T13:05:00.000Z' },
    ]);
    expect(groups).toHaveLength(2);
  });

  it('still merges the same frame re-exported at the same moment', () => {
    const groups = resolveDuplicates([
      { ...frame('DSC01900.JPG', 1000, busy), takenAt: '2026-08-29T13:00:00.000Z' },
      { ...frame('arrival-hires.jpg', 9000, busy), takenAt: '2026-08-29T13:00:00.000Z' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.winner.source).toBe('photos/arrival-hires.jpg');
  });

  it('falls back to the filename when neither hash says anything', () => {
    const groups = resolveDuplicates([
      { ...frame('DSC01900.webp', 1000, flat) },
      { ...frame('DSC01900.JPG', 9000, flat) },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.winner.pixels).toBe(9000);
  });

  it('keeps two different photographs that happen to share a filename', () => {
    // What happens the moment a shoot is sorted into folders.
    const other = '0101001101001011010010110100101101001011010010110100101101001010';
    const groups = resolveDuplicates([
      { ...frame('IMG_001.jpg', 9000, busy), source: 'photos/saturday/IMG_001.jpg' },
      { ...frame('IMG_001.jpg', 9000, other), source: 'photos/sunday/IMG_001.jpg' },
    ]);
    expect(groups).toHaveLength(2);
    // Distinct ids, or one would overwrite the other's master on disk.
    expect(new Set(groups.map((g: Group) => g.winner.id)).size).toBe(2);
    expect(groups[1]!.winner.id).toBe('sunday-IMG_001');
  });

  it('produces the same result whatever order the files are read in', () => {
    const other = '0101001101001011010010110100101101001011010010110100101101001010';
    const input = [
      { ...frame('b.jpg', 400, busy) },
      { ...frame('a.jpg', 900, other) },
      { ...frame('b-copy.jpg', 100, busy) },
    ];
    const ids = (list: typeof input) =>
      resolveDuplicates(list).map((g: Group) => `${g.winner.id}:${g.winner.pixels}`);
    expect(ids([...input].reverse()).sort()).toEqual(ids(input).sort());
  });
});


describe('parseCaptions', () => {
  it('reads a clean file', () => {
    const result = parseCaptions('{"photos":{"A":{"caption":"x"}}}');
    expect(result.photos).toEqual({ A: { caption: 'x' } });
    expect(result.error).toBeUndefined();
  });

  it('accepts a bare map without the photos wrapper', () => {
    expect(parseCaptions('{"A":{"caption":"x"}}').photos).toEqual({ A: { caption: 'x' } });
  });

  it('repairs the mistakes a person actually makes', () => {
    for (const text of [
      '{"photos":{"A":{"caption":"x"}},}',
      '\uFEFF{"photos":{"A":{"caption":"x"}}}',
      '{\n// a note\n"photos":{"A":{"caption":"x"}}}',
    ]) {
      const result = parseCaptions(text);
      expect(Object.keys(result.photos), text).toEqual(['A']);
      expect(result.error, text).toBeUndefined();
    }
  });

  it('keeps a curly quote inside a caption intact', () => {
    const result = parseCaptions('{"photos":{"A":{"caption":"\u201cquiet\u201d"}}}');
    expect((result.photos as Record<string, { caption: string }>).A!.caption).toBe('\u201cquiet\u201d');
  });

  it('names the line when it truly cannot be read', () => {
    const result = parseCaptions('{\n"photos":{\n"A":{"caption":"x"}\n');
    expect(result.photos).toEqual({});
    expect(result.error).toMatch(/line \d/);
  });

  it('refuses something that is not a map of photographs', () => {
    expect(parseCaptions('[1,2,3]').error).toMatch(/object of photo ids/);
  });
});

describe('tidyCamera', () => {
  it('stops EXIF shouting the maker twice', () => {
    expect(tidyCamera('SONY ZV-1M2')).toBe('Sony ZV-1M2');
    expect(tidyCamera('Canon Canon EOS R6')).toBe('Canon EOS R6');
    expect(tidyCamera('NIKON CORPORATION NIKON Z 6')).toBe('Nikon Z 6');
    expect(tidyCamera('Leica Camera AG Leica Q3')).toBe('Leica Q3');
  });

  it('lets an iPhone be an iPhone', () => {
    expect(tidyCamera('Apple Apple iPhone 16 Pro')).toBe('iPhone 16 Pro');
  });

  it('returns nothing rather than an empty string', () => {
    expect(tidyCamera('')).toBeNull();
    expect(tidyCamera(null)).toBeNull();
  });
});


describe('supersession', () => {
  const busy = '1100101001011010010110100101101001011010010110100101101001011010';
  const near = `${busy.slice(0, 62)}11`;

  it('does not merge two exposures of the same scene at the same size', () => {
    // A burst from one seat: near-identical frames, no jump in resolution.
    const groups = resolveDuplicates([
      { ...frame('DSC01801.JPG', 20_000_000, busy) },
      { ...frame('DSC01802.JPG', 20_000_000, near) },
    ]);
    expect(groups).toHaveLength(2);
  });

  it('still merges the same frame arriving at a real jump in resolution', () => {
    const groups = resolveDuplicates([
      { ...frame('web-export.jpg', 345_600, busy) },
      { ...frame('DSC01801.JPG', 20_000_000, near) },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.winner.source).toBe('photos/DSC01801.JPG');
  });

  it('the high-resolution re-export inherits the capture time it lost', () => {
    // Exporting, AirDropping or messaging a photograph strips its EXIF. The
    // copy it replaces still knows when it was taken.
    const groups = resolveDuplicates([
      { ...frame('IMG_9100.jpg', 1_080_000, busy), takenAt: '2026-08-29T09:15:00.000Z', camera: 'iPhone 16 Pro' },
      { ...frame('IMG_9100 hires.jpg', 7_680_000, near), takenAt: null },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.winner.takenAt).toBe('2026-08-29T09:15:00.000Z');
    expect(groups[0]!.winner.camera).toBe('iPhone 16 Pro');
  });

  it('prefers the copy that still carries EXIF when the sizes tie', () => {
    const groups = resolveDuplicates([
      { ...frame('EX_stripped.jpg', 345_600, busy), takenAt: null },
      { ...frame('IMG_7878.jpg', 345_600, near), takenAt: '2026-08-29T13:00:00.000Z' },
    ]);
    // Different sizes are required to merge on the picture alone, so these
    // stay apart — which is the point; neither silently replaces the other.
    expect(groups).toHaveLength(2);
  });
});

describe('disambiguate', () => {
  const a = '1100101001011010010110100101101001011010010110100101101001011010';
  const b = '0011010110100101101001011010010110100101101001011010010110100101';
  const c = '1010101010101010101010101010101010101010101010101010101010101010';

  it('a file added in a folder never renames the one already published', () => {
    const root = { ...frame('IMG_0001.jpg', 9000, a), source: 'photos/IMG_0001.jpg' };
    const sat = { ...frame('IMG_0001.jpg', 9000, b), source: 'photos/saturday/IMG_0001.jpg' };
    const sun = { ...frame('IMG_0001.jpg', 9000, c), source: 'photos/sunday/IMG_0001.jpg' };

    const two = resolveDuplicates([root, sat]).map((g: Group) => g.winner.id);
    const three = resolveDuplicates([root, sat, sun]).map((g: Group) => g.winner.id);
    expect(two).toContain('IMG_0001');
    expect(three).toContain('IMG_0001');
    expect(new Set(three).size).toBe(3);
    // The id a published photograph already had is an anchor; it must not move
    // because somebody uploaded another file with the same camera number.
    expect(three).toEqual(expect.arrayContaining(two));
  });

  it('retires a name two photographs answer to, so one caption cannot land on both', () => {
    const groups: Group[] = resolveDuplicates([
      { ...frame('IMG_0001.jpg', 9000, a), source: 'photos/IMG_0001.jpg' },
      { ...frame('IMG_0001.jpg', 9000, b), source: 'photos/sunday/IMG_0001.jpg' },
    ]);
    const claiming = groups.filter((group) => group.aliases.includes('IMG_0001'));
    expect(claiming).toHaveLength(1);
    expect(claiming[0]!.winner.id).toBe('IMG_0001');
  });
});

describe('plausibleCapture', () => {
  const now = Date.UTC(2026, 7, 29, 12);

  it('believes a conference weekend', () => {
    expect(plausibleCapture(new Date('2026-08-29T14:20:00Z'), now)).toBe(true);
  });

  it('rejects a camera whose clock reset and one whose EXIF rolled over', () => {
    expect(plausibleCapture(new Date('1999-12-31T23:59:59Z'), now)).toBe(false);
    expect(plausibleCapture(new Date('2027-02-18T04:40:39Z'), now)).toBe(false);
    expect(plausibleCapture(new Date('nonsense'), now)).toBe(false);
  });
});

describe('captions.json read the way a person writes it', () => {
  it('straightens the curly quotes an iPhone substitutes, and keeps the ones inside a caption', () => {
    const typed = '{\n  \u201cphotos\u201d: {\n    \u201cIMG_1\u201d: { \u201ccaption\u201d: \u201cThe \u201cgood\u201d room\u201d }\n  }\n}';
    const result = parseCaptions(typed);
    expect(result.error).toBeUndefined();
    expect(result.repaired).toBe(true);
    expect(Object.keys(result.photos)).toEqual(['IMG_1']);
  });

  it('leaves a straight-quoted file alone', () => {
    expect(straightenQuotes('{"a": "b"}')).toBe('{"a": "b"}');
  });

  it('adopts a caption pasted one level too high instead of discarding it', () => {
    const result = parseCaptions(
      '{"photos":{"IMG_1":{"caption":"x"}},"IMG_2":{"caption":"pasted too high"}}',
    );
    expect(result.strays).toEqual(['IMG_2']);
    expect(result.photos.IMG_2.caption).toBe('pasted too high');
  });

  it('does not mistake the readme block for a caption', () => {
    const result = parseCaptions('{"_readme":["a note"],"photos":{"IMG_1":{"caption":"x"}}}');
    expect(result.strays).toEqual([]);
    expect(Object.keys(result.photos)).toEqual(['IMG_1']);
  });
});

describe('validateOverrides', () => {
  it('names two photographs pinned to the same seat', () => {
    const problems = validateOverrides({ A: { order: 3 }, B: { order: 3 } });
    expect(problems.join(' ')).toContain('order 3 is used by A, B');
  });

  it('rejects an order that is not a real number', () => {
    // `1e999` is valid JSON, parses to Infinity, and passes `typeof === number`.
    expect(JSON.parse('{"order":1e999}').order).toBe(Number.POSITIVE_INFINITY);
    expect(validateOverrides({ A: { order: Number.POSITIVE_INFINITY } }).join(' ')).toContain('order must be a number');
    expect(validateOverrides({ A: { order: 4 } })).toEqual([]);
  });

  it('checks a hand-written capture time', () => {
    expect(validateOverrides({ A: { takenAt: '2026-08-29T14:20' } })).toEqual([]);
    expect(validateOverrides({ A: { takenAt: 'Saturday afternoon' } }).join(' ')).toContain('takenAt');
  });
});
