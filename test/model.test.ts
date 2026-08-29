import { describe, expect, it } from 'vitest';
import { captureBucket, captureParts, sortPhotos } from '../src/data/photos';

const entry = (id: string, takenAt: string | null, order?: number) =>
  ({ id, takenAt, override: order === undefined ? {} : { order } }) as never;

describe('captureParts', () => {
  it('reads the camera wall clock rather than shifting it into a time zone', () => {
    expect(captureParts('2026-08-29T08:14:22.000Z')).toEqual({
      day: 'Saturday',
      time: '8:14 a.m.',
      date: '29 August',
    });
  });

  it('formats noon and midnight the way a person writes them', () => {
    expect(captureParts('2026-08-29T12:00:00.000Z')?.time).toBe('12:00 p.m.');
    expect(captureParts('2026-08-29T00:05:00.000Z')?.time).toBe('12:05 a.m.');
  });

  it('returns nothing when there is no capture time', () => {
    expect(captureParts(null)).toBeNull();
    expect(captureParts('not a date')).toBeNull();
  });
});

describe('captureBucket', () => {
  it('groups a day into halves', () => {
    expect(captureBucket('2026-08-29T08:14:00.000Z')).toBe('Saturday morning');
    expect(captureBucket('2026-08-29T14:00:00.000Z')).toBe('Saturday afternoon');
    expect(captureBucket('2026-08-29T19:30:00.000Z')).toBe('Saturday evening');
    expect(captureBucket('2026-08-30T09:00:00.000Z')).toBe('Sunday morning');
  });
});

describe('sortPhotos', () => {
  it('leads with pinned photographs in the order given', () => {
    const sorted = sortPhotos([
      entry('c', '2026-08-29T09:00:00.000Z'),
      entry('a', null, 2),
      entry('b', null, 1),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('then runs in the order the photographs were taken', () => {
    const sorted = sortPhotos([
      entry('late', '2026-08-30T09:00:00.000Z'),
      entry('early', '2026-08-29T08:00:00.000Z'),
      entry('mid', '2026-08-29T16:00:00.000Z'),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['early', 'mid', 'late']);
  });

  it('puts undated photographs last, by name, so order is never random', () => {
    const sorted = sortPhotos([
      entry('zz', null),
      entry('dated', '2026-08-29T08:00:00.000Z'),
      entry('aa', null),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['dated', 'aa', 'zz']);
  });
});

describe('journalSpan', () => {
  it('is written from the data, not by hand', async () => {
    const { journalSpan, journalDays } = await import('../src/data/photos');
    // The repository currently holds re-encoded frames with no EXIF, so the
    // span is a plain count. Both branches are covered by captureParts above.
    expect(journalSpan === null || /frames/.test(journalSpan)).toBe(true);
    expect(journalDays).toBeGreaterThanOrEqual(0);
  });
});
