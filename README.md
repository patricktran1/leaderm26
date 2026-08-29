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
npm test           # vitest — photo manifest + gallery layout
```

Browser harnesses (need the preview server running on :4321):

```bash
node tools/shot.mjs        # screenshots at 4 viewports into /tmp/shots
node tools/interact.mjs    # lightbox, mobile nav, no-JS and keyboard checks
node tools/perf.mjs        # page weight, LCP, CLS
```

Set `FORCE_VISIBLE=1` for `shot.mjs` to disable reveal animations so full-page
screenshots are deterministic.

---

## Adding photographs

This is the whole workflow.

1. **Drop the file** into `src/assets/photos/` — `.webp`, `.jpg`, `.png` or `.avif`.
   Use the largest version you have. The build downsizes and re-encodes; it will
   never upscale, so a small source stays small.
2. **Add one entry** to the array in [`src/data/photos.ts`](src/data/photos.ts),
   with `id` matching the filename without its extension:

   ```ts
   {
     id: 'DSC01912',
     caption: 'The last session',
     alt: 'Attendees packing up as the screens go dark in the ballroom.',
     note: 'Optional second line, shown only in the lightbox.',
     category: 'room',        // venue | room | people | artifact
     weight: 'major',         // lead | major | minor
     feature: true,           // optional: eligible for hero placement
   }
   ```
3. **Commit and push.** Vercel rebuilds.

Order in the array is the order on the page and in the lightbox, so the journal
reads chronologically.

`weight` is a hint, not a column count:

| weight  | effect |
| ------- | ------ |
| `lead`  | a centred plate on a row of its own — keep these rare |
| `major` | opens a row and gets more of it |
| `minor` | fills out a row |

The build fails loudly if the manifest names a file that does not exist, and
`npm test` fails if a file on disk is missing from the manifest — so a photo can
never be silently dropped or silently published without alt text.

### Guardrails worth keeping

- `alt` is a description of the frame, not a caption. Never name a person in a
  photograph unless the identity is genuinely known.
- Captions are editorial and short. Facts about the conference belong in
  `src/data/site.ts` or `src/data/tables.ts`, where they can be checked.

---

## Architecture

```
src/
  assets/photos/       photograph masters — the only place image files live
  components/          one file per page section, each with scoped styles
  data/
    photos.ts          the photo manifest (edit this)
    gallery.ts         resolves the manifest against disk, builds gallery rows
    tables.ts          the twenty table themes, transcribed on site
    site.ts            conference facts, contact details, navigation
  layouts/Base.astro   <head>, metadata, JSON-LD
  pages/index.astro    section order
  scripts/ui.ts        the only client-side JavaScript
  styles/global.css    design tokens and shared primitives
tools/                 screenshot, interaction and performance harnesses
test/                  vitest specs
```

### Gallery layout

`buildRows()` in `src/data/gallery.ts` groups photographs into rows whose
aspect ratios sum to a budget, then the CSS gives each frame
`flex: <ratio × 4> 1 0`. Because every frame in a line has a flex basis of zero
and grows in proportion to its ratio, widths land proportional to aspect ratio
and **every frame in a row ends up the same height** — a justified gallery with
no cropping and no JavaScript. On phones a `min-width: 42%` forces the same rows
to wrap two-up; a wrapped single frame runs full width.

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
- **CSS is inlined** (`build.inlineStylesheets: 'always'`) so the first paint
  needs one request. Fonts are preloaded. Measured: ~177kB first load, CLS 0.
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

Vercel, zero configuration: it detects Astro, runs `npm run build`, serves
`dist/`. `vercel.json` adds immutable caching for `/_astro/*` and `/fonts/*`
plus baseline security headers.

To deploy: import the repository at [vercel.com/new](https://vercel.com/new), or
from a checkout run `npx vercel --prod`.

After the first deploy, set the real domain in `src/data/site.ts` (`site.url`)
and `astro.config.mjs` (`site`) so canonical URLs, the sitemap and Open Graph
tags point at it.
