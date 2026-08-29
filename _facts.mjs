import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-background-networking','--no-first-run'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.addStyleTag({content:'html{scroll-behavior:auto!important} .js .reveal{opacity:1!important;transform:none!important}'});
const r = await page.evaluate(()=>{
  const o={};
  o.emdash = document.querySelector('#gathering .prose').textContent.match(/.{30}Strong Ground.{20}/s)[0];
  o.hasNbsp = /— ?Strong/.test(document.querySelector('#gathering .prose').textContent);
  // hero dead space
  const hero=document.querySelector('.hero__grid').getBoundingClientRect();
  const lbl=document.querySelector('.hero .label').getBoundingClientRect();
  const fig=document.querySelector('.hero__figure').getBoundingClientRect();
  o.hero={gridTop:Math.round(hero.top+scrollY), labelTop:Math.round(lbl.top+scrollY), figTop:Math.round(fig.top+scrollY), figBottom:Math.round(fig.bottom+scrollY), typeBottom:Math.round(document.querySelector('.hero__type').getBoundingClientRect().bottom+scrollY)};
  // section head labels that wrap
  o.heads=[...document.querySelectorAll('.sec-head__index')].map(h=>({t:h.innerText.replace(/\n/g,'|'), h:Math.round(h.getBoundingClientRect().height), lblH:Math.round(h.querySelector('.label').getBoundingClientRect().height)}));
  // headline line counts
  o.h2 = [...document.querySelectorAll('.h2')].map(h=>({t:h.textContent, lines: h.getClientRects().length, w:Math.round(h.getBoundingClientRect().width)}));
  // duplicate images
  const srcs=[...document.querySelectorAll('img')].map(i=>i.currentSrc.split('/').pop().split('.')[0]);
  const cnt={}; srcs.forEach(s=>cnt[s]=(cnt[s]||0)+1);
  o.dupImages=Object.entries(cnt).filter(([k,v])=>v>1);
  // rule widths
  o.rules = {
    sectionRule: (()=>{const s=document.querySelector('#gathering').getBoundingClientRect();return Math.round(s.left)+'->'+Math.round(s.right);})(),
    datelineRule: (()=>{const s=document.querySelector('.dateline').getBoundingClientRect();return Math.round(s.left)+'->'+Math.round(s.right);})(),
    tablesRule: (()=>{const s=document.querySelector('.tables').getBoundingClientRect();return Math.round(s.left)+'->'+Math.round(s.right);})(),
  };
  o.title=document.title;
  o.meta=[...document.querySelectorAll('meta')].map(m=>m.getAttribute('name')||m.getAttribute('property')).filter(Boolean);
  // email occurrences
  o.emailCount=document.body.innerText.split('patrick@trandermatology.com').length-1;
  o.igCount=document.body.innerText.split('drpatricktran').length-1;
  // scrim opacity
  o.scrim=getComputedStyle(document.querySelector('.lb__scrim')).background.slice(0,60);
  // notes section dead space
  const nl=document.querySelector('.notes__list').getBoundingClientRect(), nm=document.querySelector('.notes__media').getBoundingClientRect();
  o.notes={listBottom:Math.round(nl.bottom+scrollY), mediaBottom:Math.round(nm.bottom+scrollY), sectionBottom:Math.round(document.querySelector('#notes').getBoundingClientRect().bottom+scrollY)};
  return o;
});
console.log(JSON.stringify(r,null,1));
await b.close();
