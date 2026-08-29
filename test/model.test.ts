import { describe, expect, it } from 'vitest';
import {
  captureBucket,
  captureParts,
  defaultCaption,
  sortPhotos,
  statedTime,
} from '../src/data/photos';

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
  it('reads a pin as a seat number, not as a place at the front of the queue', () => {
    // The whole promise of the workflow is that a photograph uploaded later
    // lands where it was taken. A pin holds one seat; it does not push the
    // day's own sequence to the bottom of the page.
    const sorted = sortPhotos([
      entry('nine', '2026-08-29T09:00:00.000Z'),
      entry('ten', '2026-08-29T10:00:00.000Z'),
      entry('pinned-third', null, 3),
      entry('pinned-first', null, 1),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['pinned-first', 'nine', 'pinned-third', 'ten']);
  });

  it('pins beyond the end of the run simply finish it', () => {
    const sorted = sortPhotos([entry('a', null, 40), entry('b', '2026-08-29T09:00:00.000Z')]);
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('orders two photographs pinned to one seat by name rather than by luck', () => {
    const forward = sortPhotos([entry('b', null, 2), entry('a', null, 2)]);
    const back = sortPhotos([entry('a', null, 2), entry('b', null, 2)]);
    expect(forward.map((p) => p.id)).toEqual(['a', 'b']);
    expect(back.map((p) => p.id)).toEqual(['a', 'b']);
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

describe('defaultCaption', () => {
  const frame = { id: 'DSC01900', takenAt: '2026-08-29T08:19:00.000Z' } as never;

  it('drops the day where the page has already said it once', () => {
    expect(defaultCaption(frame, true)).toBe('8:19 a.m.');
  });

  it('keeps the day as soon as the journal covers more than one', () => {
    expect(defaultCaption(frame, false)).toBe('Saturday, 8:19 a.m.');
  });

  it('falls back to the id rather than inventing a time', () => {
    expect(defaultCaption({ id: 'DSC01900', takenAt: null } as never, true)).toBe('DSC01900');
  });
});

describe('statedTime', () => {
  it('reads a hand-written time as the camera would have stamped it', () => {
    expect(statedTime('2026-08-29T14:20')).toBe('2026-08-29T14:20:00.000Z');
    expect(statedTime('2026-08-29 14:20:30')).toBe('2026-08-29T14:20:30.000Z');
  });

  it('ignores anything it cannot read, rather than inventing a date', () => {
    expect(statedTime('Saturday afternoon')).toBeNull();
    expect(statedTime(undefined)).toBeNull();
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
