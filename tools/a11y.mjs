import { chromium } from 'playwright';
const base = 'http://localhost:4321/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--disable-background-networking','--no-first-run'] });
const fails = [];
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails.push(m); };

async function axe(page, label) {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const res = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
  const v = res.violations.map(x => `${x.id}(${x.impact}) x${x.nodes.length}`);
  ok(res.violations.length === 0, `axe clean — ${label}${v.length ? ': ' + v.join(', ') : ''}`);
  if (res.violations.length) for (const x of res.violations) console.log('   ', x.id, x.nodes.slice(0,3).map(n => n.failureSummary?.split('\n')[1] || n.target.join(' ')).join(' | '));
}

for (const v of [{n:'1440', w:1440, h:900}, {n:'390', w:390, h:844, m:true}]) {
  const ctx = await b.newContext({ viewport:{width:v.w,height:v.h}, isMobile:!!v.m, hasTouch:!!v.m });
  const page = await ctx.newPage();
  await page.goto(base, {waitUntil:'networkidle'});
  await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}.reveal{opacity:1!important;transform:none!important}'});
  await axe(page, `${v.n} closed`);
  await page.locator('[data-lightbox="0"]').scrollIntoViewIfNeeded();
  await page.locator('[data-lightbox="0"]').click();
  await page.waitForTimeout(500);
  await axe(page, `${v.n} lightbox open`);

  // focus trap inside the lightbox
  const seen = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => {
      const a = document.activeElement;
      return a ? (a.getAttribute('data-lb-close') !== null ? 'close'
        : a.getAttribute('data-lb-prev') !== null ? 'prev'
        : a.getAttribute('data-lb-next') !== null ? 'next'
        : a.tagName.toLowerCase() + '.' + (a.className || '')) : 'none';
    }));
  }
  ok(seen.every(s => ['close','prev','next'].includes(s)), `${v.n} lightbox traps Tab (${[...new Set(seen)].join(',')})`);
  ok(await page.evaluate(() => document.querySelector('main').hasAttribute('inert')), `${v.n} page is inert while viewer is open`);
  const navVisible = await page.locator('[data-lb-next]').isVisible();
  ok(navVisible, `${v.n} next control is available`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok(!(await page.evaluate(() => document.querySelector('main').hasAttribute('inert'))), `${v.n} inert released on close`);
  await ctx.close();
}

// the photo desk
{
  for (const w of [1440, 390]) {
    const ctx = await b.newContext({ viewport:{width:w,height:900}, isMobile: w < 500 });
    const page = await ctx.newPage();
    await page.goto(base + 'admin/photos', {waitUntil:'networkidle'});
    await page.addStyleTag({content:'*,*::before,*::after{transition:none!important}'});
    await axe(page, `photo desk ${w}`);
    ok(!(await page.evaluate(()=>document.documentElement.scrollWidth > document.documentElement.clientWidth)), `photo desk ${w} has no horizontal overflow`);
    await ctx.close();
  }
}

// the practice page
{
  for (const w of [1440, 390]) {
    const ctx = await b.newContext({ viewport:{width:w,height:900}, isMobile: w < 500, hasTouch: w < 500 });
    const page = await ctx.newPage();
    await page.goto(base + 'for-practices', {waitUntil:'networkidle'});
    await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}.reveal{opacity:1!important;transform:none!important}'});
    await axe(page, `practice page ${w}`);
    ok(!(await page.evaluate(()=>document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), `practice page ${w} has no horizontal overflow`);
    // Keyboard: the primary action must be reachable without a mouse.
    const stops = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      stops.push(await page.evaluate(() => document.activeElement?.getAttribute('data-goal') ?? document.activeElement?.className ?? ''));
    }
    ok(stops.some((s) => s.includes('practice-start')), `practice page ${w} reaches the primary action by Tab (${stops.filter(Boolean).slice(0,5).join(' > ')})`);
    await ctx.close();
  }
}

// mobile index panel trap
{
  const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  await page.goto(base, {waitUntil:'networkidle'});
  await page.addStyleTag({content:'*,*::before,*::after{transition:none!important}'});
  await page.click('[data-menu-open]');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelector('main').hasAttribute('inert')), 'index panel makes the page inert');
  const inside = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    inside.push(await page.evaluate(() => !!document.activeElement?.closest('#index-panel')));
  }
  ok(inside.every(Boolean), 'index panel traps Tab');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok(!(await page.evaluate(() => document.querySelector('main').hasAttribute('inert'))), 'index panel releases inert');
  await ctx.close();
}

// tap targets
{
  const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  await page.goto(base, {waitUntil:'networkidle'});
  await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}.reveal{opacity:1!important;transform:none!important}'});
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // WCAG 2.2 2.5.8 exempts targets inside a sentence or block of text.
      if (el.closest('p, li, figcaption, dd')) continue;
      if (r.height < 24 || r.width < 24) out.push(`${el.tagName.toLowerCase()}.${el.className || '?'} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  ok(small.length === 0, `no target under 24px${small.length ? ': ' + small.join(' | ') : ''}`);
  await ctx.close();
}

await b.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nall accessibility checks passed');
process.exit(fails.length ? 1 : 0);
