# LEADderm 2026 — Field Notes

An independent visual journal from LEADderm 2026, photographed and built on site by
Patrick Tran, MD, FAAD. Not affiliated with or endorsed by LEADderm or the LEADmed
Foundation; the official meeting is at [leadderm.org](https://www.leadderm.org/).

Static Astro site, no client framework, one small vanilla script. Deploys on Vercel.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve the built output
```

Checks:

```bash
npm run check      # astro check — TypeScript across .ts and .astro
npm run lint       # eslint
npm test           # vitest — ingestion, ordering and gallery layout
```

Browser harnesses (start `npm run preview` first — they drive :4321):

```bash
node tools/shot.mjs        # screenshots at 4 viewports into /tmp/shots
node tools/interact.mjs    # viewer, mobile index, no-JS and keyboard behaviour
node tools/a11y.mjs        # axe-core, focus traps, inert, tap targets
node tools/perf.mjs        # page weight, LCP, CLS
```

`FORCE_VISIBLE=1 node tools/shot.mjs` disables the reveal animations so
full-page screenshots are deterministic. `tools/interact.mjs` and
`tools/a11y.mjs` exit non-zero on failure, so they work in CI.

---

## ADD PHOTOS IN 30 SECONDS

**On a Mac, at the conference, with no developer tools open.**

1. Open **https://github.com/patricktran1/leaderm26/upload/main/photos** — that link
   is a drop zone for the `photos` folder. (Or: repo → `photos` → *Add file* →
   *Upload files*.)
2. Drag the photographs in. Straight from the camera roll or the SD card is
   fine — **HEIC and HEIF included**, along with JPG, JPEG, PNG, WebP, AVIF and
   TIFF. Any size, any orientation, any number at once.
3. Leave **"Commit directly to the `main` branch"** selected and click
   **Commit changes**.
4. Vercel rebuilds on its own — **about a minute**, near enough whatever you
   uploaded. (Measured: fifty 20-megapixel camera originals go from folder to
   finished site in 21 seconds of build; the rest is Vercel fetching the
   repository and installing.) It is **https://leaderm26.vercel.app**.
5. Open **https://leaderm26.vercel.app/admin/photos** and check the count.
   That page is the only place a problem is visible — a deployment goes green
   whether ten photographs landed or six, so this is the ten seconds that tells
   you which.

That is the whole job. Nothing to rename, nothing to edit, no code.

> **iPhone photographs are fine as they are.** HEIC is decoded during the build,
> orientation and capture time included. There is nothing to change in Settings
> and nothing to export.

**Put each batch in its own folder** — `photos/saturday-am/`, `photos/lunch/`.
GitHub's uploader lets you type a folder name into the path box before
committing, and dragging a folder in from a Mac keeps its name. This matters for
one reason: **if you upload a file whose name already exists in the same folder,
GitHub replaces it**, and the older photograph is gone before this site ever
sees it. Two cameras both counting from `IMG_0001` is exactly how that happens.
Different folders can hold the same filename safely — the ingest keeps them
apart and names the second one after its folder.

**Two limits worth knowing**, both GitHub's rather than this site's: **100 files
per upload** and **25 MB per file**. A camera JPEG is nowhere near 25 MB, so in
practice only the file count matters — a hundred at a time, as many times as
you like. On a phone, use *Add file → Upload files* and pick from the photo
library; drag-and-drop is a desktop gesture and iOS Safari has no equivalent.

Originals are committed as they arrive, so the repository grows by roughly what
the camera writes. That is fine into the hundreds of photographs; past a
gigabyte the build starts cloning a lot of data on every push, and the ingest
step says so in the log. If it ever gets there, the fix is a one-time pass to
replace the originals with 3000px exports — the site has never displayed
anything larger.

### What happens on its own

| | |
| --- | --- |
| **Identity** | Each photograph is keyed by its filename without the extension, so `DSC01757.JPG` is `DSC01757`. |
| **Orientation** | EXIF rotation is baked in. Nothing arrives sideways. |
| **Size** | The long edge is capped at 2560px for the build; your original stays untouched in the repo. |
| **Order** | Photographs sort by the time they were taken, read from EXIF. A batch uploaded at midnight lands in the order you shot it, wherever in the day that is — `order` in the captions file is a seat number, not a queue, so pinning one frame never pushes the rest down the page. The thirteen frames already here are re-encoded exports carrying no EXIF at all, so they are pinned by hand to hold the opening sequence and new photographs run after them; `/admin/photos` says so, and deleting those `order` lines undoes it. |
| **Timeline** | Once there are photographs from more than one half-day, the journal breaks itself into *Saturday morning*, *Saturday afternoon*, *Sunday morning* and so on. |
| **Caption** | Defaults to the capture time — "Saturday, 2:41 p.m." |
| **Alt text** | Defaults to an honest placeholder that says the frame has not been described yet. It never invents a description. |
| **A wrong clock** | A camera whose date is unset stamps its files 1980, which would rewrite the journal's dates. Anything outside living memory is disbelieved, said out loud in the log, and the frame is placed by filename instead. |
| **A bad captions file** | A byte-order mark, a stray comma, a `//` comment and the curly quotes a phone substitutes for straight ones are all repaired rather than costing every caption on the site. A block pasted one level too high — the likeliest mistake there is — is adopted where it was meant to go, and the photo desk says so. |
| **Duplicates** | Upload a full-resolution version of something already on the site and it **replaces** it rather than appearing twice — matched first on the filename, then on a perceptual hash of the picture itself, so a rename or re-export is still caught. The better copy wins and inherits the old caption, *and* the capture time and camera the re-export threw away. Two frames the camera timed a minute apart are never merged, however alike they look; two frames of the same size are never merged at all, since a burst from one seat is a burst; and a hash of a nearly featureless frame is not trusted in the first place. |
| **Navigation** | Once the journal covers three or more half-days it grows its own contents line, and the headline changes from "A day" to "Two days" on its own. |
| **Rhythm** | The first photograph of each half-day is given more of the measure, the way a section opener is in print — a claim about sequence, not about importance, so it needs no judgement from anyone. |

### The photo desk

**https://leaderm26.vercel.app/admin/photos** — unlisted, not indexed, works on
your phone. It shows every frame, what was read from EXIF, which files were
superseded, anything that could not be read, and which photographs still need a
real caption or alt text. It also prints a paste-ready block for the captions
file. Open it after a batch upload; it is the fastest way to see what is worth
ten more seconds of attention.

### Captions, alt text and featured photographs

One file, and only for the photographs that deserve it:
[`photos/captions.json`](photos/captions.json). Everything else keeps the
automatic defaults.

```json
{
  "photos": {
    "DSC01912": {
      "caption": "The last session",
      "alt": "Attendees packing up as the screens go dark in the ballroom.",
      "note": "Shown only in the photograph viewer.",
      "category": "room",
      "weight": "lead",
      "order": 14,
      "hidden": false
    }
  }
}
```

| Field | Does |
| --- | --- |
| `caption` | The line under the frame. Omit for the capture time. |
| `alt` | What is actually in the frame, for screen readers. **Worth writing.** |
| `note` | A second line, shown only in the photograph viewer. |
| `category` | `venue`, `room`, `people` or `artifact`. |
| `weight` | `lead` gives a full plate with its caption alongside; `major` opens a row; `minor` is the default. |
| `order` | A seat number, counting from 1. The frame sits in that position and everything unpinned flows around it by capture time — so pinning one photograph does not push the rest of the day down the page. |
| `takenAt` | `2026-08-29T14:20`, for a frame whose file lost its EXIF. Read as the camera's own wall clock, never converted into a time zone. |
| `hidden` | `true` keeps the file in the repository but off the page. |
| `featured` | `true` opens the journal with this photograph — the hero, and the share card. The first featured frame wins. |

A caption written against an old filename **follows the photograph** when a
higher-resolution version replaces it, even if the new file is named
differently. You never have to rewrite one.

**To take a photograph down**, delete the file in `photos/` (GitHub: open it →
the ⋯ menu → *Delete file*), or add `"hidden": true` to its entry if you would
rather keep the original in the repository. Either way the journal renumbers,
re-rows and rewrites its own contents line on the next build.

### Getting the captions written without writing them

The photographs are in the repository, so Claude can look at them. Open a
Claude Code session on this repo and say:

> Look at the photographs in `photos/` that `/admin/photos` lists as needing
> alt text. Write real alt text and a short editorial caption for each, in the
> voice already in `photos/captions.json`, and add them to that file. Describe
> only what is in the frame — never name a person, and never invent a session,
> a speaker or a fact. Then run the checks.

That is the intended path: upload photographs with no effort at all, and let
the descriptions catch up afterwards. The site is correct at every point in
between — a photograph with a generated caption is dated, ordered, and honest
about not having been described yet.

## Architecture

```
photos/                THE INBOX — drop photographs here, nothing else to do
  captions.json        optional overrides, only for frames that need them
scripts/
  ingest-photos.mjs    reads the inbox before every dev/build/check/test run
src/
  generated/           written by the ingest script, git-ignored, never edited
    photos/*.jpg         normalised masters (rotated, capped at 2560px)
    photo-index.json     dimensions, capture time, camera, fingerprints
  components/          one file per page section, each with scoped styles
  data/
    photos.ts          turns the index into typed records; ordering and defaults
    gallery.ts         joins records to image files, builds the justified rows
    tables.ts          the twenty table themes, transcribed on site
    site.ts            conference facts, contact details, section sequence
  layouts/Base.astro   <head>, metadata, JSON-LD
  pages/
    index.astro        section order
    404.astro
    admin/photos.astro the photo desk — unlisted ingestion status
  scripts/ui.ts        the only client-side JavaScript
  styles/global.css    design tokens and shared primitives
tools/                 screenshot, interaction, accessibility, perf harnesses
test/                  vitest specs
```

### Why the inbox is a build step, not a manifest

`photos/` is the single source of truth. `scripts/ingest-photos.mjs` runs from
npm `pre` hooks before `dev`, `build`, `check` and `test`, so it is never
something to remember. It decodes each file (baking in EXIF rotation), caps the
long edge, reads capture time and camera, fingerprints the picture, resolves
duplicates and writes `src/generated/`.

`src/generated/` is git-ignored and rebuilt every time, so it can never drift
from the originals. The script is written so that **nothing it meets can fail
the build**: an unreadable file is reported, skipped, and shown on the photo
desk.

### Gallery layout

`buildRows()` in `src/data/gallery.ts` groups photographs into rows whose
aspect ratios sum to a budget, then the CSS gives each frame
`flex: <ratio × 4> 1 0`. Because every frame in a line has a flex basis of zero
and grows in proportion to its ratio, widths land proportional to aspect ratio
and **every frame in a row ends up the same height** — a justified gallery with
no cropping and no JavaScript. On phones a `min-width: 42%` forces the same rows
to wrap two-up; a wrapped single frame runs full width.

### Photograph resolution

The original thirteen frames reached this repository already compressed to
300–400px on the long edge, and were upscaled once with a sharpening pass. That
ceiling is why the layout leans on scale contrast and whitespace rather than
full-bleed hero imagery, why display widths are capped in `Hero`, `Gathering`
and `Journal`, and why the viewer enlarges only to 1.35x — nothing is ever
stretched past what its file can carry.

Upload a camera original of any of them and it takes over automatically: the
supersede rule replaces the low-resolution copy, keeps its caption, and the
larger derivatives appear with no edit anywhere. The display caps stay as they
are; they are generous enough that a 2560px master is never the limit.

### Design decisions

- **Photography is the only decoration.** No gradients, shadows, glass or
  rounded cards. Structure comes from hairline rules, one accent colour
  (`--pine`) and whitespace.
- **Two typefaces, self-hosted.** Newsreader for display, Libre Franklin for
  everything else, both variable, both subset and axis-pinned by
  `npm run fonts:subset` (129kB → 47kB for Newsreader). No third-party font
  request, no FOUT from a blocking stylesheet.
- **The source photographs are low resolution** (300–400px on the long edge for
  some frames). Display sizes are capped accordingly and the layout leans on
  scale contrast and whitespace rather than full-bleed hero imagery, which these
  files cannot support. Future full-resolution photographs need no change —
  Astro will simply generate larger derivatives.
- **Each frame declares its own `sizes`.** In a justified row a landscape frame
  takes twice the measure a portrait one does, so `Journal.astro` derives
  `sizes` from `ratio / row.span`. A flat value under-served the widest frames
  by up to 1.96x.
- **The share card composes itself.** `src/pages/og.jpg.ts` composites whatever
  photograph currently opens the journal into `assets/og-plate.png`, which
  carries the typography with a transparent well. Mark a different frame
  `featured` and the preview follows. If anything fails, the plate is served
  alone rather than the build breaking.
- **CSS is inlined** (`build.inlineStylesheets: 'always'`) so the first paint
  needs one request. Fonts are preloaded. Measured: ~180kB first load, CLS 0,
  and zero axe-core violations at 1440 and 390 with the viewer open and closed.
- **Animation degrades to nothing.** Reveal transitions are scoped to `.js`,
  added by an inline script, so the page is fully visible without JavaScript,
  and `prefers-reduced-motion` disables them outright.

### Accuracy rules

Conference facts come either from LEADderm's own public material or from
something photographed in the room (the table-themes board, the floor plan, the
printed cards). Anything else is written as a labelled observation. Speaker
quotes, attendance figures, sponsors and session times are not invented — if a
number cannot be sourced, it is not on the page.

---

## Deployment

The `leaderm26` Vercel project is linked to this repository, so every push
builds: `main` goes to production at `leaderm26.vercel.app`, and any other
branch gets its own preview URL. Vercel detects Astro on its own; `vercel.json`
only adds immutable caching for `/_astro/*` and `/fonts/*` plus baseline
security headers.

Vercel Authentication is switched off for this project, so the deployment URLs
open for anyone — which is the point, since the site exists to be handed to
someone at a conference. Turn it back on under Project → Settings →
Deployment Protection if that ever stops being true.

If you move to a custom domain, set it in `src/data/site.ts` (`site.url`) and
`astro.config.mjs` (`site`) so canonical URLs, the sitemap and the Open Graph
tags follow.
