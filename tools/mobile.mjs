/* The phone audit: the sizes and orientations a conference actually happens in. */
import { chromium } from 'playwright';
const base = process.env.URL || 'http://localhost:4321/';
const out = process.env.OUT || '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fails = [];
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails.push(m); };

const cases = [
  { name: '360', width: 360, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '414', width: 414, height: 896 },
  { name: 'landscape', width: 844, height: 390 },
  { name: 'landscape-small', width: 740, height: 360 },
];

for (const c of cases) {
  const ctx = await browser.newContext({
    viewport: { width: c.width, height: c.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(overflow <= 1, `${c.name}: no horizontal overflow (${overflow}px)`);

  // Nothing wider than the viewport, which is what actually causes the overflow.
  const wide = await page.evaluate((w) =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().width > w + 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60))
      .slice(0, 4), c.width);
  ok(wide.length === 0, `${c.name}: nothing wider than the screen ${wide.join(', ')}`);

  await page.screenshot({ path: `${out}/mob-${c.name}.png` });

  // The viewer has to work in the hand, in either orientation.
  await page.locator('[data-lightbox="0"]').scrollIntoViewIfNeeded();
  await page.locator('[data-lightbox="0"]').click();
  await page.waitForTimeout(700);
  const shot = await page.evaluate(() => {
    const img = document.querySelector('[data-lb-image]');
    const r = img?.getBoundingClientRect();
    return r ? { w: r.width, h: r.height, top: r.top, bottom: r.bottom } : null;
  });
  ok(Boolean(shot && shot.w > 0 && shot.h > 0), `${c.name}: viewer shows the photograph`);
  ok(
    Boolean(shot && shot.top >= -1 && shot.bottom <= c.height + 1),
    `${c.name}: the photograph fits the screen (${shot ? Math.round(shot.top) : '?'}–${shot ? Math.round(shot.bottom) : '?'} of ${c.height})`,
  );
  const usable = shot ? (shot.w * shot.h) / (c.width * c.height) : 0;
  ok(usable > 0.28, `${c.name}: the photograph is worth opening (${Math.round(usable * 100)}% of the screen)`);
  await page.screenshot({ path: `${out}/mob-${c.name}-viewer.png` });
  await ctx.close();
}

/* The practice page is pitched on a phone, standing next to someone, so it is
   held to the same widths as the journal. */
for (const c of cases) {
  const ctx = await browser.newContext({
    viewport: { width: c.width, height: c.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(new URL('/for-practices', base).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(overflow <= 1, `${c.name} practice: no horizontal overflow (${overflow}px)`);

  const cta = await page.locator('[data-goal="practice-start"]').boundingBox();
  ok(Boolean(cta) && cta.height >= 44, `${c.name} practice: primary action is a real tap target (${cta ? Math.round(cta.height) : 0}px)`);

  if (c.height > c.width) {
    // Standing beside someone with a phone: the pitch and the way to act on it
    // have to be on the first screen, not two thumbs down.
    const top = await page.evaluate(() => {
      const el = document.querySelector('[data-goal="practice-start"]');
      return el ? el.getBoundingClientRect().bottom + window.scrollY : Infinity;
    });
    ok(top <= c.height, `${c.name} practice: the action is above the fold (${Math.round(top)} of ${c.height})`);
  }

  await page.screenshot({ path: `${out}/prac-${c.name}.png` });
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nall mobile checks passed');
process.exit(fails.length ? 1 : 0);
