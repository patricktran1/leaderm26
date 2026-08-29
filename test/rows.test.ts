import { describe, expect, it } from 'vitest';
import { buildRows } from '../src/data/gallery';
import type { ResolvedPhoto } from '../src/data/gallery';
import type { Weight } from '../src/data/photos';

const make = (id: string, ratio: number, weight: Weight): ResolvedPhoto =>
  ({
    id,
    caption: id,
    alt: `${id} alt text long enough to pass.`,
    category: 'room',
    weight,
    ratio,
    orientation: ratio > 1 ? 'landscape' : 'portrait',
    image: { src: '', width: Math.round(600 * ratio), height: 600, format: 'webp' },
  }) as unknown as ResolvedPhoto;

describe('buildRows', () => {
  it('returns no rows for no photographs', () => {
    expect(buildRows([])).toEqual([]);
  });

  it('gives every lead photograph a row of its own', () => {
    const rows = buildRows([
      make('a', 0.75, 'minor'),
      make('lead', 0.75, 'lead'),
      make('b', 0.75, 'minor'),
    ]);
    const lead = rows.find((r) => r.kind === 'lead');
    expect(lead?.items).toHaveLength(1);
    expect(lead?.items[0]?.id).toBe('lead');
  });

  it('never drops or duplicates a photograph', () => {
    const input = Array.from({ length: 17 }, (_, i) =>
      make(`p${i}`, i % 3 === 0 ? 1.5 : 0.75, i % 5 === 0 ? 'major' : 'minor'),
    );
    const flat = buildRows(input).flatMap((r) => r.items.map((p) => p.id));
    expect(flat).toEqual(input.map((p) => p.id));
  });

  it('folds an orphaned frame back into the previous row', () => {
    const rows = buildRows([
      make('a', 0.75, 'minor'),
      make('b', 0.75, 'minor'),
      make('c', 0.75, 'minor'),
      make('orphan', 0.75, 'minor'),
      make('lead', 0.75, 'lead'),
    ]);
    const runs = rows.filter((r) => r.kind === 'run');
    expect(runs).toHaveLength(1);
    expect(runs[0]?.items.map((p) => p.id)).toEqual(['a', 'b', 'c', 'orphan']);
  });

  it('leaves a genuinely wide final row alone', () => {
    const rows = buildRows([make('lead', 0.75, 'lead'), make('wide', 1.5, 'major')]);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.items).toHaveLength(1);
  });

  it('keeps run rows from growing unusably wide', () => {
    const input = Array.from({ length: 12 }, (_, i) => make(`p${i}`, 0.667, 'minor'));
    for (const row of buildRows(input)) {
      expect(row.items.length).toBeLessThanOrEqual(4);
    }
  });

  it('reports a fill factor no greater than one', () => {
    const input = Array.from({ length: 7 }, (_, i) => make(`p${i}`, 1.5, 'minor'));
    for (const row of buildRows(input)) {
      expect(row.fill).toBeGreaterThan(0);
      expect(row.fill).toBeLessThanOrEqual(1);
    }
  });
});
