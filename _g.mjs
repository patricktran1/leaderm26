import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-first-run'] });
for (const w of [1440,390]) {
const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.addStyleTag({content:'html{scroll-behavior:auto!important} .js .reveal{opacity:1!important;transform:none!important}'});
const r = await p.evaluate(()=>{
 const B=e=>{const x=document.querySelector(e).getBoundingClientRect();return {t:Math.round(x.top+scrollY),b:Math.round(x.bottom+scrollY),l:Math.round(x.left),r:Math.round(x.right)}};
 const o={};
 o.objectives=B('.objectives'); o.grounded=B('.grounded'); o.gathering=B('#gathering');
 o.journal=B('#journal'); o.jbody=B('.journal__body');
 // last two jrows
 const rows=[...document.querySelectorAll('.jrow')].map(x=>{const c=x.getBoundingClientRect();return {l:Math.round(c.left),r:Math.round(c.right),t:Math.round(c.top+scrollY),b:Math.round(c.bottom+scrollY)}});
 o.lastRows=rows.slice(-3);
 // mobile grouping: distance from a wrapped item's top to the caption above
 const shots=[...document.querySelectorAll('.jrow')][1];
 if(shots) o.row2=[...shots.children].map(c=>{const x=c.getBoundingClientRect();return {t:Math.round(x.top+scrollY),b:Math.round(x.bottom+scrollY),w:Math.round(x.width)}});
 o.rowGapCss=getComputedStyle(document.querySelector('.journal__body')).rowGap;
 o.flexGap=getComputedStyle(document.querySelector('.jrow')).gap;
 // tables double rule check
 const rows10=document.querySelectorAll('.tables__row')[9];
 o.tables10=rows10?getComputedStyle(rows10).borderBottomWidth:'n/a';
 return o;});
console.log(w, JSON.stringify(r,null,1));
await ctx.close();}
await b.close();
