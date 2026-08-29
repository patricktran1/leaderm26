import { chromium } from 'playwright';

const URL = 'http://localhost:4321/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-background-networking','--no-first-run'] });

async function run(width, height, openLightbox) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  // force all reveals in so hidden-by-opacity content is measured
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-in')));
  if (openLightbox) {
    await page.click('[data-lightbox="0"]');
    await page.waitForTimeout(600);
  }
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, { resultTypes: ['violations','incomplete'] });
    const map = (arr) => arr.map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.slice(0, 8).map(n => ({
        target: n.target, html: n.html.slice(0, 200),
        msgs: [...n.any, ...n.all, ...n.none].map(c => ({ id: c.id, message: c.message, data: c.data }))
      }))
    }));
    return { violations: map(r.violations), incomplete: map(r.incomplete) };
  });
  console.log('=== ' + width + 'x' + height + (openLightbox ? ' LIGHTBOX OPEN' : '') + ' ===');
  console.log(JSON.stringify(res, null, 1));
  await ctx.close();
}

await run(1440, 900, false);
await run(1440, 900, true);
await run(390, 844, false);
await run(390, 844, true);
await b.close();
