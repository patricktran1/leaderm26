import { chromium } from 'playwright';
const url = process.env.URL || 'http://localhost:4321/';
const out = process.env.OUT || '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-background-networking','--disable-component-update','--no-first-run','--disable-sync'] });
const viewports = [
  { name: 'desktop', width: 1440, height: 900, dsf: 2 },
  { name: 'laptop', width: 1280, height: 800, dsf: 2 },
  { name: 'tablet', width: 834, height: 1112, dsf: 2 },
  { name: 'phone', width: 390, height: 844, dsf: 3 },
];
const errors = [];
for (const v of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dsf,
    isMobile: v.name === 'phone',
    hasTouch: v.name === 'phone' || v.name === 'tablet',
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${v.name}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${v.name}] pageerror ${e.message}`));
  page.on('requestfailed', r => errors.push(`[${v.name}] failed ${r.url()}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  // trigger all reveals
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
  });
  await page.evaluate(() => {
    const waits = Array.from(document.images).filter(i => !i.complete).map(i => new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); }));
    return Promise.race([Promise.all(waits), new Promise(r => setTimeout(r, 4000))]);
  });
  await page.waitForTimeout(700);
  if (process.env.FORCE_VISIBLE) await page.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important}' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${v.name}-full.png`, fullPage: true });
  await page.screenshot({ path: `${out}/${v.name}-top.png` });
  const h = await page.evaluate(() => document.body.scrollHeight);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(v.name, 'height', h, 'hOverflow', overflow);
  await ctx.close();
}
await browser.close();
if (errors.length) { console.log('--- ERRORS ---'); errors.forEach(e => console.log(e)); }
else console.log('no console errors');
