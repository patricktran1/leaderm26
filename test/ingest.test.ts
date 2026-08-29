import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  photoId,
  hammingDistance,
  resolveDuplicates,
  validateOverrides,
} from '../scripts/ingest-photos.mjs';

const frame = (id: string, pixels: number, hash = '0'.repeat(64)) => ({
  id: photoId(id),
  source: `photos/${id}`,
  pixels,
  hash,
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
    expect(photoId('a photo/with spaces & symbols!.jpg')).toBe('with-spaces--symbols');
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
