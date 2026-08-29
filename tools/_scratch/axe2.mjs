import { chromium } from 'playwright';
const URL='http://localhost:4321/';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--disable-background-networking','--no-first-run'] });
async function run(w,h,lb){
  const ctx=await b.newContext({viewport:{width:w,height:h}});
  const page=await ctx.newPage();
  await page.emulateMedia({ reducedMotion:'reduce' }); // kill transitions so colours settle
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in')));
  await page.waitForTimeout(500);
  const guard=await page.evaluate(()=>getComputedStyle(document.querySelector('.label')).color);
  if(guard!=='rgb(116, 119, 125)') throw new Error('CSS not applied, got '+guard);
  if(lb){ await page.click('[data-lightbox="0"]'); await page.waitForTimeout(800); }
  await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const res=await page.evaluate(async()=>{
    const r=await axe.run(document,{});
    return {
      violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,tags:v.tags.filter(t=>t.startsWith('wcag')||t==='best-practice'),
        nodes:v.nodes.map(n=>({t:n.target,html:n.html.slice(0,140),m:[...n.any,...n.all,...n.none].map(c=>c.message)}))})),
      incomplete:r.incomplete.map(v=>({id:v.id,n:v.nodes.length,targets:v.nodes.map(n=>n.target).slice(0,12),msgs:[...new Set(v.nodes.flatMap(n=>[...n.any,...n.all,...n.none].map(c=>c.message)))]})),
      passes:r.passes.map(v=>v.id),
    };
  });
  console.log('=== '+w+'x'+h+(lb?' LIGHTBOX':'')+' ===');
  console.log(JSON.stringify(res,null,1));
  await ctx.close();
}
await run(1440,900,false); await run(1440,900,true); await run(390,844,false); await run(390,844,true);
await b.close();
