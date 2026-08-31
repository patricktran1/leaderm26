import { describe, expect, it } from 'vitest';
import { photos, photoIndexMeta } from '../src/data/photos';
import {
  boundaries,
  diagnostic,
  evidence,
  figures,
  offers,
  proofs,
  startEmail,
} from '../src/data/practice';

describe('the numbers on the practice page', () => {
  it('counts the journal rather than quoting a figure someone typed', () => {
    expect(evidence.published).toBe(photos.length);
    expect(evidence.filesIngested).toBe(photoIndexMeta.counts.files);
    expect(evidence.heldBack).toBe(photoIndexMeta.hidden.length);
    expect(evidence.described).toBe(photos.filter((p) => !p.altIsGenerated).length);
  });

  it('never claims more photographs than are published', () => {
    expect(evidence.described).toBeLessThanOrEqual(evidence.published);
    expect(evidence.captioned).toBeLessThanOrEqual(evidence.published);
    expect(evidence.published).toBeLessThanOrEqual(evidence.filesIngested);
  });

  it('states megapixels that match the masters actually processed', () => {
    const pixels = photos.reduce((n, p) => n + p.sourceWidth * p.sourceHeight, 0);
    expect(evidence.megapixels).toBe(Math.round(pixels / 1_000_000));
    expect(evidence.megapixels).toBeGreaterThan(0);
  });

  it('prints four figures, each with a number and a unit', () => {
    expect(figures).toHaveLength(4);
    for (const f of figures) {
      expect(f.n).toMatch(/\d/);
      expect(f.k.trim().length).toBeGreaterThan(3);
    }
  });

  it('repeats no figure in the prose that the data does not support', () => {
    const prose = proofs.map((p) => p.means).join(' ');
    for (const n of [evidence.published, evidence.filesIngested, evidence.heldBack]) {
      expect(prose).toContain(String(n));
    }
    // A number the journal cannot back up would be a claim, not a measurement.
    const numbers = prose.match(/\b\d+\b/g)?.map(Number) ?? [];
    const known = new Set([
      evidence.published,
      evidence.filesIngested,
      evidence.heldBack,
      evidence.described,
      evidence.superseded,
      evidence.days,
      evidence.megapixels,
    ]);
    for (const n of numbers) expect(known.has(n)).toBe(true);
  });
});

describe('the offer', () => {
  it('is three named kinds of work, each with concrete items', () => {
    expect(offers).toHaveLength(3);
    for (const offer of offers) {
      expect(offer.name.trim().length).toBeGreaterThan(0);
      expect(offer.summary.trim().length).toBeGreaterThan(20);
      expect(offer.items.length).toBeGreaterThanOrEqual(4);
      for (const item of offer.items) expect(item.trim().length).toBeGreaterThan(10);
    }
  });

  it('says out loud where a language model does not belong', () => {
    const intelligence = offers.find((o) => o.id === 'intelligence');
    expect(intelligence?.items.join(' ')).toMatch(/never a clinical decision/i);
  });

  it('reads without the vocabulary of a landing page', () => {
    const all = [
      ...offers.flatMap((o) => [o.name, o.summary, ...o.items]),
      ...proofs.flatMap((p) => [p.does, p.means]),
      ...diagnostic,
      ...boundaries,
    ].join(' ');
    for (const word of [
      'cutting-edge',
      'best-in-class',
      'seamless',
      'synerg',
      'revolutioni',
      'game-chang',
      'AI-powered',
      'unlock',
      'leverage',
      'ROI',
      'turnkey',
      'world-class',
    ]) {
      expect(all.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

describe('the diagnostic', () => {
  it('asks questions rather than making assertions', () => {
    expect(diagnostic.length).toBeGreaterThanOrEqual(5);
    for (const q of diagnostic) expect(q.trim().endsWith('?')).toBe(true);
  });
});

describe('the conversion path', () => {
  it('is one prefilled email to the address on the rest of the site', () => {
    expect(startEmail.startsWith('mailto:patrick@trandermatology.com?')).toBe(true);
    const query = new URLSearchParams(startEmail.split('?')[1]);
    expect(query.get('subject')).toBeTruthy();
    const body = query.get('body') ?? '';
    for (const field of ['Practice:', 'City:', 'Current website:']) {
      expect(body).toContain(field);
    }
    expect(body).toContain('/for-practices');
  });

  it('encodes the body, so a mail client does not lose it at the first space', () => {
    expect(startEmail).not.toMatch(/body=[^&]*\s/);
  });
});
