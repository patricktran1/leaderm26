import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-background-networking','--no-first-run'] });
for (const w of [1440, 834, 390]) {
const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.addStyleTag({content:'html{scroll-behavior:auto!important} .js .reveal{opacity:1!important;transform:none!important;transition:none!important}'});
await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const out = {};
  // upscale factor for every img
  out.imgs = [...document.querySelectorAll('img')].map(i => ({
    src: i.currentSrc.split('/').pop().slice(0,40),
    css: Math.round(i.getBoundingClientRect().width)+'x'+Math.round(i.getBoundingClientRect().height),
    nat: i.naturalWidth+'x'+i.naturalHeight,
    upscale1x: +(i.getBoundingClientRect().width / i.naturalWidth).toFixed(2),
    upscale2x: +(2*i.getBoundingClientRect().width / i.naturalWidth).toFixed(2),
  }));
  // objectives baselines
  out.obj = [...document.querySelectorAll('.objective')].map(o=>({
    t:o.querySelector('.objective__t').textContent,
    top: Math.round(o.getBoundingClientRect().top + window.scrollY),
    h3top: Math.round(o.querySelector('.objective__t').getBoundingClientRect().top + window.scrollY),
  }));
  const g = document.querySelector('.prose');
  out.gatherText = (document.querySelector('#gathering')||document.body).innerText.slice(0,600);
  // gaps between section bottoms
  out.sections = [...document.querySelectorAll('section, footer')].map(s=>{
    const kids=[...s.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().height>0);
    const b = s.getBoundingClientRect();
    let maxBottom = -1e9;
    for (const k of kids){const kb=k.getBoundingClientRect(); if(kb.bottom>maxBottom) maxBottom=kb.bottom;}
    return {id:s.id||s.className, top:Math.round(b.top+scrollY), bottom:Math.round(b.bottom+scrollY), h:Math.round(b.height), tailGap: Math.round(b.bottom-maxBottom)};
  });
  // journal rows
  out.rows = [...document.querySelectorAll('.jrow')].map(r=>{
    const rb=r.getBoundingClientRect();
    return {cls:r.className, left:Math.round(rb.left), right:Math.round(rb.right), w:Math.round(rb.width), n:r.children.length,
      items:[...r.children].map(c=>Math.round(c.getBoundingClientRect().width))};
  });
  out.shell = (()=>{const s=document.querySelector('.shell').getBoundingClientRect(); return {l:Math.round(s.left), r:Math.round(s.right)};})();
  out.vw = innerWidth;
  return out;
});
console.log('==== width', w, 'shell', JSON.stringify(r.shell));
console.log('gatherText:', JSON.stringify(r.gatherText.slice(150,260)));
console.log('objectives:', JSON.stringify(r.obj));
console.log('rows:'); r.rows.forEach(x=>console.log('  ',x.cls, 'x',x.left,'->',x.right,'w',x.w,'items',JSON.stringify(x.items)));
console.log('sections tailGap:'); r.sections.forEach(s=>console.log('  ',s.id, 'h',s.h,'tailGap',s.tailGap));
console.log('imgs:'); r.imgs.forEach(i=>console.log('  ',i.src,'css',i.css,'nat',i.nat,'up1x',i.upscale1x,'up2x',i.upscale2x));
await ctx.close();
}
await b.close();
