import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-background-networking','--no-first-run'] });
for (const [w,h,tag] of [[1440,900,'1440'],[390,844,'390']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  await page.evaluate(()=>document.querySelector('[data-lightbox="0"]').scrollIntoView());
  await page.waitForTimeout(400);
  await page.click('[data-lightbox="0"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `/tmp/critique/lb-${tag}-a.png` });
  const m = await page.evaluate(()=>{const i=document.querySelector('[data-lb-image]');const r=i.getBoundingClientRect();return {css:Math.round(r.width)+'x'+Math.round(r.height), nat:i.naturalWidth+'x'+i.naturalHeight, src:i.src.split('/').pop()};});
  console.log(tag,'slide0',JSON.stringify(m));
  // step to a landscape one
  for(let k=0;k<12;k++){ await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120);}
  await page.waitForTimeout(700);
  await page.screenshot({ path: `/tmp/critique/lb-${tag}-b.png` });
  const m2 = await page.evaluate(()=>{const i=document.querySelector('[data-lb-image]');const r=i.getBoundingClientRect();return {css:Math.round(r.width)+'x'+Math.round(r.height), nat:i.naturalWidth+'x'+i.naturalHeight};});
  console.log(tag,'slide12',JSON.stringify(m2));
  await ctx.close();
}
await b.close();
