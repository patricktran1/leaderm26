import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-background-networking','--no-first-run'] });
for (const w of [1440, 1024, 834, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  let h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += 400) { await page.evaluate((y)=>window.scrollTo(0,y), y); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  const left = await page.evaluate(() => document.querySelectorAll('.reveal:not(.is-in)').length);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/tmp/critique/full-${w}.png`, fullPage: true });
  console.log(w, 'unrevealed:', left, 'h', await page.evaluate(()=>document.documentElement.scrollHeight));
  await ctx.close();
}
await b.close();
