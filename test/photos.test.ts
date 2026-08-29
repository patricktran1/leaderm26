import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { photos, CATEGORIES } from '../src/data/photos';

const files = readdirSync(new URL('../src/assets/photos', import.meta.url))
  .filter((f) => /\.(webp|avif|jpe?g|png)$/i.test(f))
  .map((f) => f.replace(/\.[^.]+$/, ''));

describe('photo manifest', () => {
  it('has at least one photograph', () => {
    expect(photos.length).toBeGreaterThan(0);
  });

  it('references only files that exist on disk', () => {
    const missing = photos.filter((p) => !files.includes(p.id)).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  it('publishes every file that exists on disk', () => {
    const unlisted = files.filter((f) => !photos.some((p) => p.id === f));
    expect(unlisted).toEqual([]);
  });

  it('uses unique ids', () => {
    const ids = photos.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every photograph a caption and meaningful alt text', () => {
    for (const photo of photos) {
      expect(photo.caption.trim().length, `${photo.id} caption`).toBeGreaterThan(2);
      expect(photo.alt.trim().length, `${photo.id} alt`).toBeGreaterThan(20);
      expect(/[.!?]["\u201d]?$/.test(photo.alt.trim()), `${photo.id} alt is a sentence`).toBe(true);
    }
  });

  it('uses known categories and weights', () => {
    for (const photo of photos) {
      expect(CATEGORIES).toContain(photo.category);
      expect(['lead', 'major', 'minor']).toContain(photo.weight);
    }
  });

  it('keeps lead photographs rare enough to stay special', () => {
    const leads = photos.filter((p) => p.weight === 'lead');
    expect(leads.length).toBeLessThanOrEqual(Math.max(1, Math.round(photos.length / 4)));
  });
});
