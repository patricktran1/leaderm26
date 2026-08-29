import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--disable-background-networking','--no-first-run'] });
for (const v of [{n:'desktop',w:1440,h:900,d:2},{n:'phone',w:390,h:844,d:3}]) {
  const ctx = await b.newContext({ viewport:{width:v.w,height:v.h}, deviceScaleFactor:v.d, isMobile:v.n==='phone' });
  const page = await ctx.newPage();
  let bytes = 0; const byType = {};
  page.on('response', async r => {
    try { const buf = await r.body(); bytes += buf.length;
      const t = r.request().resourceType(); byType[t] = (byType[t]||0)+buf.length; } catch {}
  });
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  const metrics = await page.evaluate(() => new Promise(res => {
    const out = {};
    const nav = performance.getEntriesByType('navigation')[0];
    out.domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
    out.load = Math.round(nav.loadEventEnd);
    new PerformanceObserver(list => { const e = list.getEntries().at(-1); out.lcp = Math.round(e.startTime); }).observe({type:'largest-contentful-paint', buffered:true});
    let cls = 0;
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({type:'layout-shift', buffered:true});
    setTimeout(() => { out.cls = Math.round(cls*10000)/10000; res(out); }, 1200);
  }));
  console.log(`\n${v.n}: initial network ${(bytes/1024).toFixed(1)} KB`);
  for (const [k,val] of Object.entries(byType).sort((a,b)=>b[1]-a[1])) console.log(`   ${k.padEnd(10)} ${(val/1024).toFixed(1)} KB`);
  console.log('   metrics', JSON.stringify(metrics));
  await ctx.close();
}
await b.close();
