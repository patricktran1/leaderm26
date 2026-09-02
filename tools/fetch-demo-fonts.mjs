/**
 * Pulls the latin cut of each demo-direction typeface and self-hosts it.
 *
 * The three practice-demo directions have to look like three different studios
 * made them, and type is most of that. Google already publishes a latin-only
 * woff2 per family, so this fetches that file rather than shipping a request to
 * a third party from a page a prospect opens — and rather than re-running the
 * subsetting pipeline, which needs Python on the machine.
 *
 *   node tools/fetch-demo-fonts.mjs
 *
 * Run it once; the files are committed. Licences: all three are SIL OFL.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** The latin block's unicode-range always begins U+0000-00FF. */
const LATIN = /unicode-range:\s*U\+0000-00FF/;

const FAMILIES = [
  { out: 'source-serif-4.woff2', query: 'Source+Serif+4:wght@300..700' },
  { out: 'inter.woff2', query: 'Inter:wght@300..700' },
  { out: 'cormorant-garamond.woff2', query: 'Cormorant+Garamond:wght@300..600' },
];

const dir = path.join(process.cwd(), 'public/fonts/demo');
await mkdir(dir, { recursive: true });

for (const { out, query } of FAMILIES) {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${query}&display=swap`, {
      headers: { 'User-Agent': UA },
    })
  ).text();

  const face = css
    .split('@font-face')
    .find((block) => LATIN.test(block));
  if (!face) throw new Error(`no latin cut for ${query}`);
  const url = /src:\s*url\((https:[^)]+\.woff2)\)/.exec(face)?.[1];
  if (!url) throw new Error(`no woff2 url for ${query}`);

  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(path.join(dir, out), bytes);
  console.log(`${out.padEnd(26)} ${(bytes.length / 1024).toFixed(1)} kB  ${url.split('/').pop()}`);
}
