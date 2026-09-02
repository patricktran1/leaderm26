import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  conceptSchema,
  parseConcept,
  findUnsourcedClaims,
  ConceptError,
  DIRECTIONS,
  servicesByCategory,
  primaryAction,
  shortName,
  placeName,
  type Concept,
} from '../src/demo/schema';

const dir = path.join(process.cwd(), 'practices');
const slugs = readdirSync(dir).filter((d) => existsSync(path.join(dir, d, 'concept.json')));
const raw = (slug: string): unknown =>
  JSON.parse(readFileSync(path.join(dir, slug, 'concept.json'), 'utf8'));
const fixtures: Concept[] = slugs.map((slug) => parseConcept(raw(slug), slug));

/* ------------------------------------------------------------ the schema */

describe('the concept schema', () => {
  it('accepts every concept in the repository', () => {
    expect(slugs.length).toBeGreaterThanOrEqual(3);
    for (const slug of slugs) expect(() => parseConcept(raw(slug), slug)).not.toThrow();
  });

  it('needs nothing but a name, a slug, a direction and a status', () => {
    const bare = conceptSchema.parse({
      slug: 'a-practice',
      direction: 'chapter',
      status: 'draft',
      practice: { name: 'A Practice' },
    });
    expect(bare.physicians).toEqual([]);
    expect(bare.services).toEqual([]);
    expect(bare.concept.knownProblems).toEqual([]);
    // The accessors have to survive that too — this is what the pages call.
    expect(shortName(bare)).toBe('A Practice');
    expect(placeName(bare)).toBeNull();
    expect(primaryAction(bare)).toBeNull();
    expect(servicesByCategory(bare)).toEqual([]);
  });

  it('refuses a slug that does not match its folder name shape', () => {
    for (const slug of ['Not Kebab', 'trailing-', 'UPPER']) {
      expect(
        conceptSchema.safeParse({
          slug,
          direction: 'chapter',
          status: 'draft',
          practice: { name: 'X' },
        }).success,
      ).toBe(false);
    }
  });

  it('refuses a direction that has no composition behind it', () => {
    expect(
      conceptSchema.safeParse({
        slug: 'x',
        direction: 'brutalist',
        status: 'draft',
        practice: { name: 'X' },
      }).success,
    ).toBe(false);
  });

  it('falls back through booking, then phone, then nothing at all', () => {
    const base = { slug: 'x', direction: 'chapter', status: 'draft', practice: { name: 'X' } };
    const booking = conceptSchema.parse({
      ...base,
      contact: { bookingUrl: 'https://example.com/book' },
    });
    expect(primaryAction(booking)?.href).toBe('https://example.com/book');
    const phone = conceptSchema.parse({ ...base, contact: { phone: '(207) 555-0142' } });
    expect(primaryAction(phone)?.href).toBe('tel:2075550142');
    expect(primaryAction(conceptSchema.parse(base))).toBeNull();
  });
});

/* -------------------------------------------------------------- provenance */

describe('provenance', () => {
  it('will not let a finding claim to be a fact without its source', () => {
    const withFact = (source?: string) => ({
      slug: 'x',
      direction: 'chapter',
      status: 'draft',
      practice: { name: 'X' },
      findings: [{ kind: 'fact', text: 'They publish two locations.', ...(source ? { source } : {}) }],
    });
    expect(conceptSchema.safeParse(withFact()).success).toBe(false);
    expect(conceptSchema.safeParse(withFact('https://example.com/x')).success).toBe(true);
  });

  it('lets an observation, a hypothesis and proposed copy stand without one', () => {
    for (const kind of ['observation', 'hypothesis', 'copy']) {
      expect(
        conceptSchema.safeParse({
          slug: 'x',
          direction: 'chapter',
          status: 'draft',
          practice: { name: 'X' },
          findings: [{ kind, text: 'Something I noticed.' }],
        }).success,
      ).toBe(true);
    }
  });

  it('always requires a source on a proof point', () => {
    expect(
      conceptSchema.safeParse({
        slug: 'x',
        direction: 'chapter',
        status: 'draft',
        practice: { name: 'X' },
        proof: [{ claim: 'They have been open since 1998.' }],
      }).success,
    ).toBe(false);
  });
});

/* -------------------------------------------------------- credibility guard */

describe('the credibility guard', () => {
  const claims: [string, string][] = [
    ['board certification', 'Board certified in dermatology.'],
    ['fellowship training', 'Fellowship trained in Mohs surgery.'],
    ['an award or ranking', 'Award-winning care since 2004.'],
    ['a patient or review count', 'Over 4,000 patients treated.'],
    ['years of experience', '25 years of experience in the field.'],
    ['insurance participation', 'We accept most insurance plans.'],
    ['before-and-after imagery', 'See our before and after gallery.'],
    ['press coverage', 'As seen in the local paper.'],
    ['a rating', 'Rated 4.9 by our patients.'],
  ];

  it.each(claims)('catches %s written where nothing sources it', (what, text) => {
    const problems = findUnsourcedClaims({
      slug: 'x',
      direction: 'chapter',
      status: 'draft',
      practice: { name: 'X' },
      concept: { thesis: text },
    });
    expect(problems.map((p) => p.what)).toContain(what);
  });

  it('refuses the whole document rather than quietly publishing it', () => {
    expect(() =>
      parseConcept({
        slug: 'x',
        direction: 'chapter',
        status: 'draft',
        practice: { name: 'X' },
        physicians: [{ name: 'Dr A', shortBio: 'Board certified and fellowship trained.' }],
      }),
    ).toThrow(ConceptError);
  });

  it('allows the same words inside a sourced proof point', () => {
    expect(() =>
      parseConcept({
        slug: 'x',
        direction: 'chapter',
        status: 'draft',
        practice: { name: 'X' },
        proof: [
          { claim: 'Both physicians are board certified.', source: 'https://example.com/team' },
        ],
      }),
    ).not.toThrow();
  });

  it('allows them inside a finding of kind fact, which carries its source', () => {
    expect(() =>
      parseConcept({
        slug: 'x',
        direction: 'chapter',
        status: 'draft',
        practice: { name: 'X' },
        findings: [
          {
            kind: 'fact',
            text: 'The site states the physician is board certified.',
            source: 'https://example.com/about',
          },
        ],
      }),
    ).not.toThrow();
  });
});

/* ---------------------------------------------------------- the fixtures */

describe('the synthetic fixtures', () => {
  it('cover all three directions, so layout diversity is actually exercised', () => {
    expect(new Set(fixtures.map((f) => f.direction))).toEqual(new Set(DIRECTIONS));
  });

  it('say out loud that they are not real practices', () => {
    for (const f of fixtures) expect(f.status).toBe('synthetic');
  });

  it('carry no proof point without a source and no unsourced claim anywhere', () => {
    for (const f of fixtures) {
      for (const p of f.proof) expect(p.source).toMatch(/^https?:\/\//);
      expect(findUnsourcedClaims(f)).toEqual([]);
    }
  });

  it('use reserved telephone numbers and example.com, so nothing dials a stranger', () => {
    for (const f of fixtures) {
      for (const phone of [f.practice.phone, f.contact.phone].filter(Boolean) as string[]) {
        expect(phone).toMatch(/555-01\d\d/);
      }
      const urls = [
        f.practice.existingSite,
        f.contact.bookingUrl,
        f.concept.ctaHref,
        ...f.proof.map((p) => p.source),
        ...f.findings.map((x) => x.source),
      ].filter(Boolean) as string[];
      for (const url of urls) expect(url).toMatch(/^https?:\/\/example\.com\//);
    }
  });

  it('differ in shape, not only in wording, so the compositions are tested under load', () => {
    const services = fixtures.map((f) => f.services.length).sort((a, b) => a - b);
    const physicians = fixtures.map((f) => f.physicians.length).sort((a, b) => a - b);
    expect(services.at(-1)! - services[0]!).toBeGreaterThanOrEqual(8);
    expect(physicians.at(-1)! - physicians[0]!).toBeGreaterThanOrEqual(2);
    // At least one is deliberately sparse: no address, no hours, no proof.
    expect(fixtures.some((f) => !f.contact.address && !f.contact.hours && f.proof.length === 0)).toBe(true);
  });

  it('record research as findings, with every fact sourced', () => {
    for (const f of fixtures) {
      expect(f.findings.length).toBeGreaterThan(0);
      for (const finding of f.findings) {
        if (finding.kind === 'fact') expect(finding.source).toBeTruthy();
      }
    }
  });

  it('keep a research file beside every concept', () => {
    for (const slug of slugs) {
      expect(existsSync(path.join(dir, slug, 'research.md'))).toBe(true);
    }
  });
});

/* ---------------------------------------------------------------- the CLI */

describe('npm run demo:new', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'demo-cli-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  const run = (args: string[]) =>
    execFileSync('node', [path.join(process.cwd(), 'scripts/new-practice.mjs'), ...args, '--yes'], {
      cwd: work,
      encoding: 'utf8',
    });

  it('writes a concept that the schema accepts', () => {
    run([
      '--name',
      'Harbor Point Dermatology',
      '--city',
      'Camden',
      '--state',
      'me',
      '--site',
      'https://example.com/harbor',
      '--physician',
      'Dr. Wendell Hoyt, MD, FAAD',
      '--direction',
      'chapter',
    ]);
    const file = path.join(work, 'practices/harbor-point-dermatology/concept.json');
    expect(existsSync(file)).toBe(true);
    const concept = parseConcept(JSON.parse(readFileSync(file, 'utf8')));
    expect(concept.slug).toBe('harbor-point-dermatology');
    expect(concept.practice.state).toBe('ME');
    expect(concept.physicians[0]).toEqual({ name: 'Dr. Wendell Hoyt', credentials: 'MD, FAAD' });
  });

  it('never marks a new concept ready to send', () => {
    run(['--name', 'Second Practice', '--direction', 'clinic']);
    const concept = parseConcept(
      JSON.parse(readFileSync(path.join(work, 'practices/second-practice/concept.json'), 'utf8')),
    );
    expect(concept.status).toBe('draft');
  });

  it('drops blank answers rather than writing fields the schema will reject', () => {
    const concept = JSON.parse(
      readFileSync(path.join(work, 'practices/second-practice/concept.json'), 'utf8'),
    );
    expect(concept.practice.city).toBeUndefined();
    expect(concept.practice.existingSite).toBeUndefined();
  });

  it('starts a research file with the four kinds spelled out', () => {
    const notes = readFileSync(path.join(work, 'practices/second-practice/research.md'), 'utf8');
    for (const kind of ['fact', 'observation', 'hypothesis', 'copy']) {
      expect(notes).toContain(`\`${kind}\``);
    }
  });

  it('refuses a direction with no composition behind it', () => {
    expect(() => run(['--name', 'Third', '--direction', 'brutalist'])).toThrow();
  });

  it('refuses to overwrite a concept that already exists', () => {
    expect(() => run(['--name', 'Second Practice', '--direction', 'clinic'])).toThrow();
  });
});
