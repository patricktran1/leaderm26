# The practice demo factory

You met a dermatologist. They told you the name of their practice. This turns
that into a concept site you can send them, in about twenty minutes of work and
whatever research you choose to do.

It is internal tooling. Nothing in it is public, nothing in it is indexed, and
nothing in it is linked from the LEADderm journal.

---

## The one command

```
npm run demo:new
```

It asks for the practice name, the city, the current website, a physician, what
they mostly do, what bothers them, and which of the three directions to use.
Everything except the name can be left blank. It writes:

```
practices/<slug>/
  concept.json     the model — this is the file you edit
  research.md      working notes and provenance
  images/          photographs, once the practice supplies them
```

Then:

```
npm run dev
```

- `http://localhost:4321/demo/<slug>` — the concept
- `http://localhost:4321/demo/<slug>/pitch` — your notes, and the QR to send
- `http://localhost:4321/demo` — everything you have

Non-interactive, for pasting from notes:

```
npm run demo:new -- --name "Harbor Point Dermatology" --city Camden --state ME \
  --site https://harborpointderm.example --physician "Dr. Wendell Hoyt, MD, FAAD" \
  --direction chapter --yes
```

`--physician` repeats. Anything after the first comma is taken as credentials,
exactly as given — nothing is inferred from a name, ever.

---

## 1. Creating a prospect

`npm run demo:new`, as above. The concept is written with `status: "draft"`,
which puts a grey band on every page saying *do not share*. It stays a draft
until you change that line yourself, having gone through the pre-send list at
the bottom of this file.

Slugs are kebab-case and must match the folder name. Pass `--slug` if the
derived one is wrong.

## 2. Where the research goes

Two places, and the distinction is the point.

**`practices/<slug>/research.md`** — your working notes. Pages read, dates,
who said what on the phone. Free-form; nothing reads it but you.

**`concept.json` → `findings[]`** — the structured version, which the pitch page
renders. Every finding has a `kind`:

| kind | means | needs a source |
| --- | --- | --- |
| `fact` | Published by the practice or a public register | **yes** — the build fails without it |
| `observation` | What you saw looking at their site or their office | no |
| `hypothesis` | Your guess, to confirm in conversation | no |
| `copy` | Language you are proposing, not yet theirs | no |

```json
{ "kind": "fact", "text": "Two locations and a Saturday clinic.", "source": "https://…/locations" }
{ "kind": "observation", "text": "The booking link is in the footer only." }
{ "kind": "hypothesis", "text": "Same-week capacity is their strongest card — confirm." }
{ "kind": "copy", "text": "Proposed hero line: “Most people should book the skin check.”" }
```

The pitch page prints these with the kind spelled out beside each one, so the
physician can see exactly which sentences you checked and which you guessed.
That is the difference between a concept they trust and one they resent.

Separately, **`proof[]`** is for claims the *concept itself* makes about the
practice. Every entry needs a `source` URL; there is no way to write one
without. If you cannot source it, the concept does not say it.

## 3. Photographs

Drop files into `practices/<slug>/images/` and name them in `concept.json`:

```json
"physicians": [{ "name": "Dr. Ruth Ellery", "image": "ellery.jpg" }]
```

Anything not supplied renders as a flat tonal plate with a small label saying
what belongs there. That is deliberate and it is not a bug: a concept full of
stock photography of strangers is worse than one that shows its own gaps, and
a physician spots licensed stock instantly. **Never** put a stock photograph in
`images/`. If the practice has usable photography of their own, ask for it; if
they do not, the plates are the honest argument for a shoot.

There is no before-and-after surface in any direction. That is a consent and
regulatory question, not a design one, and the factory does not have an answer
to it.

## 4. Choosing a direction

Three compositions. Not one template with a colour variable — different
typefaces, palettes, navigation models, and different answers to the hardest
question on a dermatology site, which is how a patient finds their thing out of
forty services.

| | **Chapter** | **Clinic** | **Atelier** |
| --- | --- | --- | --- |
| Fits | Medical/surgical, two or three physicians, depth is the point | Several clinicians, same-week capacity, scheduler already running | One physician, cosmetic, being dragged into a price war |
| Type | Source Serif 4 throughout | Inter throughout | Cormorant Garamond, sans only for labels |
| Ground | Bone and ink, olive on hover | White, hairline borders, deep teal | Warm black, cream, stone |
| Navigation | Centred masthead on a rule; nothing sticky | Sticky header with phone and booking; fixed dock on a phone | One word opening a full-screen panel |
| Hero | Statement and a portrait; no button at all | Short: promise, two actions, three things people book | Full-bleed plate with the sentence on it |
| Services | A book's contents — grouped and ruled | Filterable cards, by text and category | One per row, alternating, each with a plate |

Change it any time by editing `"direction"` in `concept.json`. Nothing else has
to change: the same content model drives all three.

The internal index at `/demo` lists what each one is for.

## 5. Previewing

```
npm run dev
```

Every concept is at `/demo/<slug>` with four surfaces — home, physicians,
services, visit — plus `/demo/<slug>/pitch`.

Four surfaces is on purpose. It is the smallest architecture that demonstrates
an architecture. Generating thirty thin treatment pages would be the exact SEO
filler habit the whole thing argues against, and it implies the engagement is
already finished.

## 6. Building

```
npm run build
```

A concept that fails validation **fails the build**, naming the field. These
pages get sent to the physician they describe; a half-valid one is worse than
none. The most common failures:

- a `fact` finding with no `source`
- a `proof` entry with no `source`
- a regulated claim written somewhere nothing can back it (see below)
- a slug that does not match its folder
- a misspelled field. The schema is strict, so `bookingURL` is an error rather
  than a setting that quietly does nothing.

## 7. Sharing

`/demo/<slug>/pitch` has the URL and a QR code, drawn at build time from the
URL itself. No shortener, no image service, nothing that logs who opened it.

The concept carries `noindex, nofollow, noarchive, nosnippet` on every surface,
with no way to switch it off. `/demo/` is disallowed in `robots.txt` and
excluded from the sitemap. It will not turn up in a search beside the practice's
real website.

To send it somewhere they can open, deploy the branch to a preview URL and send
that. **Do not promote a prospect's concept to production** — the LEADderm site
is public, and a concept is a private document about somebody's business.

## 8. Before you send it

The concept says `Draft concept — do not share` on every page until you change
`"status"` to `"ready"`. Change it only when all of this is true:

- [ ] Every physician name and every credential matches what the practice
      publishes, character for character. No letters inferred from a name.
- [ ] Every `proof[]` claim has a source you have actually opened, and a
      `checked` date.
- [ ] Every `fact` finding is genuinely a fact, from that URL, today.
- [ ] Nothing in the concept claims board certification, fellowship training, an
      award, a rating, a patient count, insurance participation or press
      coverage unless it is sourced. *(The build enforces this, but read it
      anyway — the guard catches phrasings, not intent.)*
- [ ] No sentence has been copied from their existing site. Proposed copy is
      yours, marked as `copy` in the findings, and theirs to reject.
- [ ] Every service listed is one they actually offer.
- [ ] No photograph in `images/` is stock, and none shows a patient.
- [ ] The primary action points at *their* booking route or *their* telephone
      number — never a form this concept invented.
- [ ] You have opened it on a phone.
- [ ] The city, address and hours are theirs, not placeholders.

Then set `"status": "ready"`, and the banner goes.

---

## What the guard blocks, and why

`src/demo/schema.ts` refuses to build a concept where any of these appear
outside a sourced `proof[]` entry or a `fact` finding:

board certification · fellowship training · awards and rankings · patient,
procedure or review counts · years of experience · insurance participation ·
before-and-after imagery · press coverage · ratings

They are not banned — a practice that really is board certified should be able
to say so. They may only appear attached to the page they came from. Every one
of them is a claim a marketing site makes by habit and a state board takes
seriously, and the person who will read this concept is the one who would know
instantly if it were wrong.

## How this sits next to the journal

`src/demo/base.css` duplicates a handful of primitives from
`src/styles/global.css` — the reset, the container, the focus ring, the
screen-reader utilities — rather than extracting them.

That is a deliberate choice, not an oversight. The journal's stylesheet is
production, and its tokens carry a specific editorial opinion: warm paper, one
pine accent, a serif display scale. Inheriting it is precisely what would make
three "different" directions look like three LEADderm reskins. The demo base
holds only what has no taste in it. When the two drift, that is fine — they are
answering to different designs.

Nothing in `src/demo/` imports from the journal, and nothing in the journal
imports from `src/demo/`. The only shared surfaces are `astro.config.mjs`
(sitemap exclusion), `public/robots.txt` and `package.json`.

## Files

```
practices/<slug>/concept.json   the model, validated at build
practices/<slug>/research.md    working notes
practices/<slug>/images/        supplied photography

src/demo/schema.ts              the model and the credibility guard
src/demo/registry.ts            discovery — drop a folder in, it appears
src/demo/DemoShell.astro        the document: noindex, the status flag
src/demo/Plate.astro            a photograph, or an honest placeholder
src/demo/base.css               mechanics only, no aesthetics
src/demo/directions/            the three compositions
src/demo/directions/meta.ts     what each one is for (no components)
src/pages/demo/                 the routes

scripts/new-practice.mjs        npm run demo:new
tools/demo.mjs                  the audit, including template-sameness
test/demo.test.ts               schema, provenance, guard, CLI
```

## Checks

```
npm test                # schema, provenance, the guard, the CLI
node tools/demo.mjs     # every surface: noindex, mobile, axe, sameness
```

Each concept page is about 28 kB built and downloads exactly one webfont —
all three direction stylesheets are inlined on every page (about 10 kB) so the
routing stays in one file, but a browser only fetches the face it uses.

`tools/demo.mjs` needs `npm run dev` running. It fails if the three directions
stop being three directions — same display typeface, same ground, same section
rhythm, same navigation model. That check exists because template sameness is
invisible in a diff and fatal in a meeting.
