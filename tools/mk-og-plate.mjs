/**
 * Draws the typographic plate for a share card and writes it to assets/.
 *
 * The card itself is composed at build time (see src/pages/*og*.ts): a plate
 * with a transparent well on the right, and whichever photograph currently
 * leads the journal composited into it. Only the typography is fixed, so it
 * is rendered here, once, in a real browser with the site's own web fonts —
 * a build server's font set is not something to bet a share preview on.
 *
 *   node tools/mk-og-plate.mjs practices
 *
 * Re-run it and commit the PNG when the wording changes.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const W = 2400;
const H = 1260;
/** Must match WELL_X in the route that composites the photograph. */
const WELL = 0.6;

const which = process.argv[2] ?? 'practices';

const fonts = Object.fromEntries(
  await Promise.all(
    [
      ['serif', 'public/fonts/newsreader-normal-latin.woff2'],
      ['sans', 'public/fonts/libre-franklin-normal-latin.woff2'],
    ].map(async ([key, file]) => [key, (await readFile(path.join(process.cwd(), file))).toString('base64')]),
  ),
);

const plates = {
  practices: {
    out: 'assets/og-practices-plate.png',
    ink: '#101215',
    fg: '#f0ede7',
    dim: '#9ba0a6',
    rule: '#33373d',
    kicker: 'Patrick Tran, MD, FAAD',
    head: 'A dermatologist<br />who builds the<br />software.',
    label: 'For dermatology practices',
    lines: ['Presence · Operations · Intelligence', 'The journal on this site is the demonstration.'],
  },
};

const p = plates[which];
if (!p) throw new Error(`no plate named "${which}"`);

const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: N; src: url(data:font/woff2;base64,${fonts.serif}) format('woff2'); font-weight: 200 600 }
  @font-face { font-family: F; src: url(data:font/woff2;base64,${fonts.sans}) format('woff2'); font-weight: 300 700 }
  * { margin: 0; box-sizing: border-box }
  html, body { width: ${W}px; height: ${H}px; background: transparent }
  .plate {
    width: ${W * WELL}px; height: ${H}px; background: ${p.ink}; color: ${p.fg};
    padding: 132px 150px; display: flex; flex-direction: column; font-family: F;
    -webkit-font-smoothing: antialiased;
  }
  .kicker { font-size: 34px; font-weight: 600; letter-spacing: .17em; text-transform: uppercase; color: ${p.dim} }
  .head {
    margin-top: auto; font-family: N; font-weight: 300; font-size: 138px; line-height: .98;
    letter-spacing: -.025em;
  }
  .rule { margin-top: 92px; border-top: 2px solid ${p.rule} }
  .label { padding-top: 46px; font-size: 30px; font-weight: 600; letter-spacing: .17em; text-transform: uppercase; color: ${p.dim} }
  .line { padding-top: 16px; font-family: N; font-weight: 300; font-size: 40px; letter-spacing: -.01em; color: ${p.fg} }
  .line + .line { color: ${p.dim}; font-size: 36px }
</style>
<div class="plate">
  <p class="kicker">${p.kicker}</p>
  <h1 class="head">${p.head}</h1>
  <div class="rule"></div>
  <p class="label">${p.label}</p>
  ${p.lines.map((l) => `<p class="line">${l}</p>`).join('')}
</div>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ omitBackground: true });
await browser.close();

await writeFile(path.join(process.cwd(), p.out), png);
console.log(`wrote ${p.out} (${W}x${H})`);
