#!/usr/bin/env node
/**
 * `npm run demo:new` — start a practice concept from a conversation.
 *
 * Patrick meets a dermatologist, they say their practice name, and this is the
 * next step. It asks the handful of things worth asking standing in a corridor,
 * writes a valid concept and a research file, and prints the two URLs. Nothing
 * else in the source tree needs to be understood to add a prospect.
 *
 * Everything is optional except the name. A concept with three fields filled in
 * still renders — that is the point of the schema — so the honest answer to any
 * prompt here is to press return and come back to it.
 *
 * Non-interactive, for tests and for pasting from notes:
 *   npm run demo:new -- --name "Harbor Dermatology" --city Portland --state ME \
 *     --direction chapter --physician "Dr. Ruth Ellery, MD, FAAD" --yes
 */
import { createInterface } from 'node:readline/promises';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import path from 'node:path';

/* ------------------------------------------------------------------ args */

const args = new Map();
const flags = new Set();
for (let i = 2; i < argv.length; i += 1) {
  const token = argv[i];
  if (!token.startsWith('--')) continue;
  const key = token.slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) flags.add(key);
  else {
    // Repeatable flags collect, so --physician can be given more than once.
    const existing = args.get(key);
    args.set(key, existing ? [...[existing].flat(), next] : next);
    i += 1;
  }
}
const one = (key) => [args.get(key)].flat().filter(Boolean)[0];
const many = (key) => [args.get(key)].flat().filter(Boolean);
const quiet = flags.has('yes') || flags.has('y');

const DIRECTIONS = [
  {
    id: 'chapter',
    name: 'Chapter',
    fits: 'Medical/surgical, two or three physicians, depth is the selling point.',
  },
  {
    id: 'clinic',
    name: 'Clinic',
    fits: 'Several clinicians, same-week capacity, a scheduler already running.',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    fits: 'One physician, cosmetic, being dragged into a price war by medspas.',
  },
];

/* ----------------------------------------------------------------- asking */

const rl = quiet ? null : createInterface({ input: stdin, output: stdout });
const ask = async (question, fallback = '') => {
  if (!rl) return fallback;
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
};

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

/**
 * "Dr. Ruth Ellery, MD, FAAD" → name and credentials. Anything after the first
 * comma is taken verbatim as credentials; nothing is inferred from the name,
 * ever, because guessing a physician's letters is the fastest way to lose them.
 */
function parsePhysician(entry) {
  const [name, ...rest] = entry.split(',');
  const credentials = rest.join(',').trim();
  return { name: name.trim(), ...(credentials ? { credentials } : {}) };
}

async function main() {
  if (!quiet) {
    stdout.write('\n  A new practice concept.\n');
    stdout.write('  Everything except the name can be left blank and filled in later.\n\n');
  }

  const name = one('name') ?? (await ask('  Practice name:            '));
  if (!name) {
    stdout.write('\n  Nothing to do without a name.\n\n');
    rl?.close();
    exit(1);
  }

  const city = one('city') ?? (await ask('  City:                     '));
  const state = (one('state') ?? (await ask('  State (two letters):      '))).toUpperCase();
  const existingSite = one('site') ?? (await ask('  Current website:          '));
  const instagram = one('instagram') ?? (await ask('  Instagram:                '));
  const phone = one('phone') ?? (await ask('  Phone:                    '));

  const physicianInput = many('physician').length
    ? many('physician')
    : [await ask('  A physician (Name, MD):   ')].filter(Boolean);

  const focus = one('focus') ?? (await ask('  What they mostly do:      '));
  const gripe = one('gripe') ?? (await ask('  What bothers them:        '));

  let direction = one('direction');
  if (!direction) {
    if (!quiet) {
      stdout.write('\n  Direction:\n');
      for (const [i, d] of DIRECTIONS.entries()) {
        stdout.write(`    ${i + 1}. ${d.name.padEnd(9)} ${d.fits}\n`);
      }
    }
    const pick = await ask('\n  Which (1-3):              ', '1');
    direction = DIRECTIONS[Number(pick) - 1]?.id ?? DIRECTIONS[0].id;
  }
  if (!DIRECTIONS.some((d) => d.id === direction)) {
    stdout.write(`\n  "${direction}" is not a direction. Use one of: ${DIRECTIONS.map((d) => d.id).join(', ')}.\n\n`);
    rl?.close();
    exit(1);
  }

  const slug = one('slug') ?? slugify(name);
  rl?.close();

  /* ---------------------------------------------------------------- write */

  const dir = path.join(process.cwd(), 'practices', slug);
  try {
    await access(dir);
    stdout.write(`\n  practices/${slug} already exists. Pass --slug to use another name.\n\n`);
    exit(1);
  } catch {
    // Good: nothing there.
  }

  const concept = {
    slug,
    direction,
    // Never `ready`. A concept becomes ready by being checked against the
    // pre-send list in docs/practice-demo-factory.md, by a person.
    status: 'draft',
    practice: {
      name,
      ...(city ? { city } : {}),
      ...(state.length === 2 ? { state } : {}),
      ...(phone ? { phone } : {}),
      ...(/^https?:\/\//.test(existingSite) ? { existingSite } : {}),
      ...(instagram ? { instagram: instagram.startsWith('@') ? instagram : `@${instagram}` } : {}),
    },
    physicians: physicianInput.map(parsePhysician),
    services: focus
      ? [{ name: focus, category: 'Start here', shortDescription: '' }].map(({ name: n, category }) => ({
          name: n,
          category,
        }))
      : [],
    brand: {},
    proof: [],
    contact: {},
    concept: {
      ...(focus ? { positioning: '' } : {}),
      knownProblems: gripe ? [gripe] : [],
      proposedImprovements: [],
      outOfScope: [],
    },
    findings: gripe
      ? [{ kind: 'observation', text: gripe }]
      : [],
  };

  // Empty strings fail the schema's min(1); drop them rather than ship a file
  // that will not build.
  const prune = (value) => {
    if (Array.isArray(value)) return value.map(prune).filter((v) => v !== undefined);
    if (value && typeof value === 'object') {
      const out = Object.fromEntries(
        Object.entries(value)
          .map(([k, v]) => [k, prune(v)])
          .filter(([, v]) => v !== undefined),
      );
      return out;
    }
    return value === '' ? undefined : value;
  };

  await mkdir(dir, { recursive: true });
  await mkdir(path.join(dir, 'images'), { recursive: true });
  await writeFile(path.join(dir, 'concept.json'), `${JSON.stringify(prune(concept), null, 2)}\n`);
  await writeFile(
    path.join(dir, 'research.md'),
    `# ${name}

Everything that ends up on the concept comes from here first. Keep the four
kinds apart — the schema will not let a hypothesis become a fact by accident,
and neither should you.

| kind | means | needs a source |
| --- | --- | --- |
| \`fact\` | Published by the practice or a public register | **yes**, the URL |
| \`observation\` | What I saw looking at their site or their office | no |
| \`hypothesis\` | My guess, to confirm in conversation | no |
| \`copy\` | Language proposed for the concept, not yet theirs | no |

Structured findings live in \`concept.json\` under \`findings[]\`, which is what
the pitch page renders. This file is for the working notes behind them: pages
read, dates, screenshots taken, who said what on the phone.

## Pages read

${existingSite ? `- ${existingSite} — read ${new Date().toISOString().slice(0, 10)}\n` : '- \n'}
## Notes

-
`,
  );
  await writeFile(
    path.join(dir, 'images', '.gitkeep'),
    '# Drop practice photographs here and name them in concept.json.\n',
  );

  stdout.write(`\n  Written practices/${slug}/\n`);
  stdout.write('    concept.json    the model — edit this\n');
  stdout.write('    research.md     working notes and provenance\n');
  stdout.write('    images/         photographs, once the practice supplies them\n\n');
  stdout.write('  npm run dev, then:\n');
  stdout.write(`    http://localhost:4321/demo/${slug}         the concept\n`);
  stdout.write(`    http://localhost:4321/demo/${slug}/pitch   the notes, and the QR to send\n\n`);
  stdout.write('  It is marked "draft" and says so on every page until you check it\n');
  stdout.write('  against the pre-send list in docs/practice-demo-factory.md.\n\n');
}

await main();
