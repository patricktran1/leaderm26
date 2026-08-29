/**
 * Cuts the shipped webfonts down to what this site actually renders:
 *   1. glyphs — Latin-1 plus the typographic punctuation and arrows in use;
 *   2. axes  — Newsreader's optical-size axis is pinned at 44 (a single cut
 *      that holds up from 13px captions to 100px display), and both fonts are
 *      clipped to the weight range the design uses.
 * Together this takes Newsreader from 129kB to ~47kB.
 *
 * Run `npm run fonts:subset` after replacing a font file. Requires Python with
 * `fonttools` and `brotli` installed (pip install fonttools brotli).
 */
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const UNICODES = [
  'U+0020-007E', // basic latin
  'U+00A0-00FF', // latin-1 supplement (accented names)
  'U+0131,U+0152-0153,U+015E-015F,U+0160-0161,U+017D-017E', // dotless i, OE, S/Z with diacritics
  'U+2010-2015,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+2030,U+2039-203A', // punctuation
  'U+2044,U+20AC,U+2122,U+2190-2193,U+2197,U+2212,U+00D7', // fractions, currency, arrows, math
].join(',');

const FONTS = [
  { file: 'newsreader-normal-latin.woff2', axes: { opsz: '44', wght: '250:600' } },
  { file: 'libre-franklin-normal-latin.woff2', axes: { wght: '300:700' } },
];

for (const { file, axes } of FONTS) {
  const path = `public/fonts/${file}`;
  const before = statSync(path).size;
  execFileSync(
    'python3',
    [
      '-m', 'fontTools.varLib.instancer', path,
      ...Object.entries(axes).map(([axis, value]) => `${axis}=${value}`),
      '--output-file=/tmp/_instanced.ttf',
    ],
    { stdio: 'inherit' },
  );
  execFileSync(
    'python3',
    [
      '-m', 'fontTools.subset', '/tmp/_instanced.ttf',
      `--unicodes=${UNICODES}`,
      '--flavor=woff2',
      '--layout-features=kern,liga,calt,onum,tnum,frac',
      '--drop-tables+=DSIG',
      `--output-file=${path}`,
    ],
    { stdio: 'inherit' },
  );
  const after = statSync(path).size;
  console.log(`${file}: ${(before / 1024).toFixed(1)}kB -> ${(after / 1024).toFixed(1)}kB`);
}
