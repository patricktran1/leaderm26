/**
 * The practice-concept data model.
 *
 * A redesign concept is a document about somebody else's business, shown to
 * them, so the schema's job is not really shape — it is provenance. Two rules
 * run through everything below:
 *
 *   1. Nothing is required because a website usually has one. Every field a
 *      prospect might not have told us is optional, and every composition has
 *      to look finished without it.
 *   2. A claim about a physician needs a source, in the file, next to it. The
 *      validator refuses the kind of sentence that quietly turns a guess into
 *      a credential — see `assertNoUnsourcedClaims`.
 *
 * Concepts live at practices/<slug>/concept.json and are read by
 * src/demo/registry.ts. `npm run demo:new` writes one.
 */
import { z } from 'astro/zod';

/* ----------------------------------------------------------------- pieces */

const url = z.string().regex(/^https?:\/\/[^\s]+$/i, 'must be an http(s) URL');
const text = (max: number) => z.string().trim().min(1).max(max);

export const DIRECTIONS = ['chapter', 'clinic', 'atelier'] as const;
export type DirectionId = (typeof DIRECTIONS)[number];

/**
 * `synthetic` is a made-up practice used to test layouts — it is never a real
 * business and every page says so out loud. `draft` is a real prospect still
 * being researched. `ready` has been checked against the operator guide's
 * pre-send list. Only `ready` is fit to send to anybody.
 */
export const STATUSES = ['synthetic', 'draft', 'ready'] as const;

const physician = z.strictObject({
  name: text(80),
  /** Exactly as published by the practice or the board — never inferred. */
  credentials: text(60).optional(),
  specialty: text(80).optional(),
  shortBio: text(400).optional(),
  /** A file in practices/<slug>/images/. Absent means a placeholder plate. */
  image: text(120).optional(),
});

const service = z.strictObject({
  name: text(80),
  shortDescription: text(240).optional(),
  category: text(40).optional(),
});

/**
 * Anything the concept asserts about the practice as fact. The source is not
 * optional and never will be: an unsourced proof point is the exact failure
 * this whole file exists to prevent.
 */
const proof = z.strictObject({
  claim: text(200),
  source: url,
  /** When it was checked, so a stale claim can be spotted. */
  checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Research provenance, kept apart by kind so a hypothesis can never be read as
 * a fact. `fact` is the only kind that may be shown as a statement about the
 * practice, and it must carry the page it came from.
 */
export const FINDING_KINDS = ['fact', 'observation', 'hypothesis', 'copy'] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const FINDING_LABEL: Record<FindingKind, string> = {
  fact: 'Verified',
  observation: 'Observed',
  hypothesis: 'Hypothesis',
  copy: 'Proposed copy',
};

const finding = z
  .strictObject({
    kind: z.enum(FINDING_KINDS),
    text: text(600),
    source: url.optional(),
    note: text(300).optional(),
  })
  .refine((f) => f.kind !== 'fact' || Boolean(f.source), {
    message: 'a finding of kind "fact" must carry the source URL it came from',
    path: ['source'],
  });

/* ------------------------------------------------------------- the concept */

export const conceptSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  direction: z.enum(DIRECTIONS),
  status: z.enum(STATUSES),

  practice: z.strictObject({
    name: text(80),
    shortName: text(40).optional(),
    city: text(60).optional(),
    state: z.string().trim().length(2).optional(),
    phone: text(30).optional(),
    email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'must be an email address').optional(),
    existingSite: url.optional(),
    instagram: z.string().regex(/^@?[A-Za-z0-9._]{1,30}$/).optional(),
    logo: text(120).optional(),
  }),

  physicians: z.array(physician).max(24).default([]),
  services: z.array(service).max(60).default([]),

  brand: z
    .strictObject({
      tone: text(200).optional(),
      colors: z
        .strictObject({
          ink: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
          paper: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
          accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        })
        .optional(),
      photography: text(300).optional(),
    })
    .default({}),

  proof: z.array(proof).max(12).default([]),

  contact: z
    .strictObject({
      address: text(160).optional(),
      phone: text(30).optional(),
      bookingUrl: url.optional(),
      hours: z.array(text(60)).max(7).optional(),
      mapUrl: url.optional(),
    })
    .default({}),

  concept: z
    .strictObject({
      /** The one sentence the home page is built around. */
      thesis: text(200).optional(),
      cta: text(40).optional(),
      ctaHref: text(300).optional(),
      positioning: text(400).optional(),
      knownProblems: z.array(text(300)).max(10).default([]),
      proposedImprovements: z.array(text(300)).max(10).default([]),
      /** What this concept deliberately does not attempt. Shown in the pitch. */
      outOfScope: z.array(text(300)).max(10).default([]),
    })
    .default({ knownProblems: [], proposedImprovements: [], outOfScope: [] }),

  findings: z.array(finding).max(60).default([]),
});

export type Concept = z.infer<typeof conceptSchema>;
export type Physician = z.infer<typeof physician>;
export type Service = z.infer<typeof service>;
export type Proof = z.infer<typeof proof>;
export type Finding = z.infer<typeof finding>;

/* ------------------------------------------------------- credibility guard */

/**
 * The sentences that get a physician in trouble.
 *
 * Every one of these is a claim a marketing page makes by habit and a state
 * board takes seriously. They are not banned outright — a practice that really
 * is board certified should be able to say so — but they may only appear
 * attached to a source, which in this model means a `proof` entry or a
 * `finding` of kind `fact`. Anywhere else they are a fabrication waiting to be
 * sent to the person who would know.
 */
const CLAIM_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /board[\s-]?certifi/i, what: 'board certification' },
  { re: /fellowship[\s-]?trained|fellowship in\b/i, what: 'fellowship training' },
  { re: /award[\s-]?winning|voted|top ?doc|best of\b|#\s?1\b|number one\b/i, what: 'an award or ranking' },
  { re: /\b\d[\d,]*\+?\s*(patients|procedures|reviews|five[\s-]star|5[\s-]star)/i, what: 'a patient or review count' },
  { re: /\b\d[\d,]*\+?\s*years? of experience/i, what: 'years of experience' },
  { re: /\b(we|they)?\s?accept[s]? (most )?insurance|in[\s-]network/i, what: 'insurance participation' },
  { re: /before\s*(&|and|\/)\s*after/i, what: 'before-and-after imagery' },
  { re: /as seen (in|on)\b|featured in\b/i, what: 'press coverage' },
  { re: /\b(rated|ranked)\b.{0,20}\b(\d(\.\d)?|top)\b/i, what: 'a rating' },
];

export interface ClaimProblem {
  path: string;
  what: string;
  text: string;
}

/** Every string in the document except the ones that are allowed to source. */
function* walk(value: unknown, path: string): Generator<{ path: string; text: string }> {
  if (typeof value === 'string') {
    yield { path, text: value };
  } else if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) yield* walk(item, `${path}[${i}]`);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      yield* walk(item, path ? `${path}.${key}` : key);
    }
  }
}

/**
 * Flags a regulated claim written anywhere the concept cannot back it up.
 *
 * `proof[]` entries always carry a source, and a `finding` of kind `fact` is
 * refused above without one, so both are exempt: the claim is standing next to
 * the page it came from. Everywhere else — a hero thesis, a physician bio, a
 * service description — the same words are an invention, because nothing in
 * the file says where they came from.
 */
export function findUnsourcedClaims(concept: unknown): ClaimProblem[] {
  const problems: ClaimProblem[] = [];
  const doc = concept as Record<string, unknown>;

  const sourced = new Set<string>();
  for (const [i] of (Array.isArray(doc.proof) ? doc.proof : []).entries()) sourced.add(`proof[${i}]`);
  for (const [i, f] of (Array.isArray(doc.findings) ? doc.findings : []).entries()) {
    if ((f as Finding)?.kind === 'fact') sourced.add(`findings[${i}]`);
  }

  for (const { path, text: value } of walk(doc, '')) {
    if ([...sourced].some((prefix) => path.startsWith(prefix))) continue;
    for (const { re, what } of CLAIM_PATTERNS) {
      if (re.test(value)) problems.push({ path, what, text: value });
    }
  }
  return problems;
}

/* ----------------------------------------------------------------- parsing */

export class ConceptError extends Error {
  constructor(readonly slug: string, readonly problems: string[]) {
    super(`${slug}: ${problems.join('; ')}`);
    this.name = 'ConceptError';
  }
}

/**
 * Validates one concept file. Shape first, then the credibility guard, so a
 * malformed document does not produce a confusing claim error on top of it.
 */
export function parseConcept(raw: unknown, where = 'concept.json'): Concept {
  const shape = conceptSchema.safeParse(raw);
  if (!shape.success) {
    throw new ConceptError(
      (raw as { slug?: string })?.slug ?? where,
      shape.error.issues.map((i) => `${i.path.join('.') || '(root)'} — ${i.message}`),
    );
  }
  const claims = findUnsourcedClaims(shape.data);
  if (claims.length > 0) {
    throw new ConceptError(
      shape.data.slug,
      claims.map(
        (c) =>
          `${c.path} states ${c.what} with nothing to back it — move it to proof[] with a source, ` +
          `record it as a finding of kind "fact", or cut it: “${c.text.slice(0, 80)}”`,
      ),
    );
  }
  return shape.data;
}

/* -------------------------------------------------------------- accessors */

/** The name to use in running text, falling back to the full one. */
export const shortName = (c: Concept): string => c.practice.shortName ?? c.practice.name;

export const placeName = (c: Concept): string | null =>
  [c.practice.city, c.practice.state].filter(Boolean).join(', ') || null;

/** Services grouped by their category, in first-seen order, uncategorised last. */
export function servicesByCategory(c: Concept): { category: string | null; items: Service[] }[] {
  const groups = new Map<string | null, Service[]>();
  for (const s of c.services) {
    const key = s.category ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] === null ? 1 : b[0] === null ? -1 : 0))
    .map(([category, items]) => ({ category, items }));
}

/**
 * The one action every composition points at. A booking URL if the practice
 * published one, otherwise the phone, otherwise nothing — never a fabricated
 * form endpoint that would drop a patient's message on the floor.
 */
export function primaryAction(c: Concept): { label: string; href: string } | null {
  if (c.concept.ctaHref) return { label: c.concept.cta ?? 'Book an appointment', href: c.concept.ctaHref };
  if (c.contact.bookingUrl) return { label: c.concept.cta ?? 'Request an appointment', href: c.contact.bookingUrl };
  const phone = c.contact.phone ?? c.practice.phone;
  if (phone) return { label: c.concept.cta ?? `Call ${phone}`, href: `tel:${phone.replace(/[^\d+]/g, '')}` };
  return null;
}

export const instagramUrl = (c: Concept): string | null =>
  c.practice.instagram ? `https://instagram.com/${c.practice.instagram.replace(/^@/, '')}` : null;
