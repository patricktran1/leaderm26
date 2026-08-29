import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseCaptions,
  photoId,
  hammingDistance,
  hashIsDistinctive,
  resolveDuplicates,
  validateOverrides,
} from '../scripts/ingest-photos.mjs';

const frame = (id: string, pixels: number, hash = '0'.repeat(64)) => ({
  id: photoId(id),
  source: `photos/${id}`,
  pixels,
  hash,
  takenAt: null as string | null,
});

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
    expect(photoId('....jpg')).toBe('photo');
    expect(photoId('a photo/with spaces & symbols!.jpg')).toBe('with-spaces-symbols');
    expect(photoId('x'.repeat(200) + '.jpg')).toHaveLength(60);
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
    expect(groups[0]!.superseded.map((s) => s.source)).toEqual(['photos/DSC01757.webp']);
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
    expect(new Set(groups.map((g) => g.winner.id)).size).toBe(2);
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
      resolveDuplicates(list).map((g) => `${g.winner.id}:${g.winner.pixels}`);
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
