/**
 * Every practice concept in the repository, validated at build time.
 *
 * Concepts are discovered rather than registered: drop a folder into
 * `practices/` with a `concept.json` in it and it appears. That is the same
 * bargain the photo pipeline makes — the person doing the work never edits a
 * manifest — and it is why `npm run demo:new` only has to write files.
 *
 * A concept that fails validation fails the build, loudly, naming the field.
 * These pages are shown to the physician they describe; a half-valid one is
 * worse than no page at all.
 */
import { parseConcept, ConceptError, type Concept } from './schema';

const files = import.meta.glob<{ default: unknown }>('/practices/*/concept.json', { eager: true });

function load(): Concept[] {
  const out: Concept[] = [];
  const problems: string[] = [];

  for (const [path, module] of Object.entries(files)) {
    const folder = path.split('/').at(-2) ?? path;
    try {
      const concept = parseConcept(module.default, path);
      if (concept.slug !== folder) {
        problems.push(`${path}: slug "${concept.slug}" does not match its folder "${folder}"`);
        continue;
      }
      out.push(concept);
    } catch (error) {
      const problem = error instanceof ConceptError ? error.problems.join('\n    - ') : String(error);
      problems.push(`${path}:\n    - ${problem}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`\n[demo] ${problems.length} practice concept(s) will not build:\n\n${problems.join('\n\n')}\n`);
  }
  return out.sort((a, b) => a.practice.name.localeCompare(b.practice.name));
}

export const concepts: Concept[] = load();

export const conceptBySlug = (slug: string): Concept | undefined =>
  concepts.find((c) => c.slug === slug);

/** The surfaces every concept renders. Order is the pitch order. */
export const SURFACES = [
  { path: '', label: 'Home' },
  { path: 'physicians', label: 'Physicians' },
  { path: 'services', label: 'Services' },
  { path: 'contact', label: 'Visit' },
] as const;

export const surfaceHref = (slug: string, path: string): string =>
  path ? `/demo/${slug}/${path}` : `/demo/${slug}`;
