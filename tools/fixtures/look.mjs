/* Renders a sandbox journal at several widths, images decoded, reveals off. */
import { chromium } from 'playwright';
const port = process.env.PORT || '4400';
const out = process.env.OUT || '/tmp/shots';
const tag = process.env.TAG || 'j';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const sizes = (process.env.SIZES || '1440x1000,390x844').split(',').map((s) => s.split('x').map(Number));
const facts = {};
for (const [w, h] of sizes) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '.js .reveal{opacity:1!important;transform:none!important}' });
  await p.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.setAttribute('loading', 'eager'));
  });
  await p.evaluate(() =>
    Promise.race([
      Promise.all([...document.images].map((i) => i.decode().catch(() => {}))),
      new Promise((r) => setTimeout(r, 25000)),
    ]),
  );
  await p.waitForTimeout(600);
  await p.locator('#journal').screenshot({ path: `${out}/${tag}-${w}.png` });
  if (!facts.title) {
    facts.title = (await p.locator('#journal-title').textContent()) ?? null;
    facts.span = await p.locator('.journal__span').textContent().catch(() => null);
    facts.buckets = await p.locator('.jrow__bucket').allTextContents();
    facts.contents = await p.locator('.contents a').allTextContents();
    facts.rows = await p.locator('.jrow').count();
    facts.leads = await p.locator('.jrow--lead').count();
    facts.perRow = await p.evaluate(() =>
      [...document.querySelectorAll('.jrow')].map((r) => r.querySelectorAll('.shot').length),
    );
  }
  facts[`h${w}`] = await p.evaluate(() => document.body.scrollHeight);
  await p.close();
}
await b.close();
console.log(JSON.stringify(facts, null, 1));
