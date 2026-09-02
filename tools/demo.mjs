/**
 * The factory's audit.
 *
 * Two jobs the unit tests cannot do. First the ordinary one: every surface of
 * every concept renders, is unindexable, fits a phone, and points its actions
 * somewhere real. Second the one that matters most — proving the three
 * directions are actually three designs. A "reskinned template" is the failure
 * mode this whole exercise exists to avoid, and it is invisible in a diff, so
 * it is measured here: typefaces, palettes, navigation model, page structure.
 */
import { chromium } from 'playwright';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const base = process.env.URL || 'http://localhost:4321/';
const url = (p) => new URL(p, base).href;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--disable-background-networking', '--no-first-run'],
});
const fails = [];
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails.push(m); };

const dir = path.join(process.cwd(), 'practices');
const slugs = readdirSync(dir).filter((d) => existsSync(path.join(dir, d, 'concept.json')));
const concepts = slugs.map((slug) => JSON.parse(readFileSync(path.join(dir, slug, 'concept.json'), 'utf8')));
const SURFACES = ['', 'physicians', 'services', 'contact'];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

/* ------------------------------------------------ every surface, every one */
const shape = {};
for (const concept of concepts) {
  for (const surface of [...SURFACES, 'pitch']) {
    const href = `/demo/${concept.slug}${surface ? `/${surface}` : ''}`;
    const res = await page.goto(url(href), { waitUntil: 'networkidle' });
    ok(res.status() === 200, `${href} renders (${res.status()})`);

    const meta = await page.evaluate(() => ({
      robots: document.querySelector('meta[name="robots"]')?.content ?? '',
      title: document.title,
      h1: document.querySelectorAll('h1').length,
      flag: document.querySelector('.demo-flag')?.textContent?.trim() ?? '',
      foot: document.querySelector('.demo-foot')?.textContent?.trim() ?? '',
      lang: document.documentElement.lang,
    }));
    ok(/noindex/.test(meta.robots) && /nofollow/.test(meta.robots), `${href} is noindex,nofollow`);
    ok(meta.title.length > 5, `${href} has a title (${meta.title})`);
    ok(meta.h1 === 1, `${href} has exactly one h1 (${meta.h1})`);
    ok(meta.lang === 'en', `${href} declares a language`);
    if (concept.status !== 'ready') {
      ok(/Synthetic example|Draft concept/.test(meta.flag), `${href} says it is not finished work`);
    }
    ok(/proposal, not a statement/.test(meta.foot), `${href} closes with the proposal disclaimer`);

    // Nothing may claim the practice endorsed this.
    const body = await page.evaluate(() => document.body.innerText);
    ok(!/in partnership with|official (site|website) (of|for)/i.test(body), `${href} claims no endorsement`);
  }

  // The structural fingerprint of this direction's home page.
  await page.goto(url(`/demo/${concept.slug}`), { waitUntil: 'networkidle' });
  shape[concept.direction] = await page.evaluate(() => {
    const styleOf = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : '';
    };
    const head = document.querySelector('header');
    return {
      bodyFont: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g, ''),
      displayFont: (styleOf('h1', 'fontFamily') || '').split(',')[0].replace(/"/g, ''),
      displaySize: Math.round(parseFloat(styleOf('h1', 'fontSize') || '0')),
      paper: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.body).color,
      headerPosition: head ? getComputedStyle(head).position : 'none',
      headerAlign: head ? getComputedStyle(head).textAlign : 'none',
      // How many things you can click in the header — a toolbar or a title page.
      headerLinks: head ? head.querySelectorAll('a, button').length : 0,
      hasOverlayMenu: Boolean(document.querySelector('[data-panel-open]')),
      hasStickyDock: Boolean(document.querySelector('.cl-dock')),
      hasFilter: Boolean(document.querySelector('[data-finder]')),
      // The signature of how services are presented.
      sectionOrder: [...document.querySelectorAll('main section')]
        .map((s) => s.className.split(' ')[0] || 'band')
        .join('>'),
    };
  });
}

/* ----------------------------------------- the compositions actually differ */
{
  const ids = Object.keys(shape);
  ok(ids.length === 3, `all three directions are exercised by a fixture (${ids.join(', ')})`);
  const distinct = (key) => new Set(ids.map((id) => shape[id][key])).size;

  ok(distinct('displayFont') === 3, `three display typefaces (${ids.map((i) => shape[i].displayFont).join(', ')})`);
  ok(distinct('paper') === 3, `three grounds (${ids.map((i) => shape[i].paper).join(' / ')})`);
  ok(distinct('ink') === 3, 'three ink colours');
  ok(distinct('headerPosition') >= 2, `navigation is not one sticky bar everywhere (${ids.map((i) => shape[i].headerPosition).join(', ')})`);
  ok(distinct('sectionOrder') === 3, 'three different section rhythms on the home page');
  ok(
    new Set(ids.map((i) => `${shape[i].hasOverlayMenu}${shape[i].hasStickyDock}${shape[i].hasFilter}`)).size === 3,
    'three different navigation and discovery models',
  );
  // Type scale has to move too, or it is one design at three colours.
  const sizes = ids.map((i) => shape[i].displaySize).sort((a, b) => a - b);
  ok(sizes.at(-1) - sizes[0] >= 16, `display sizes are genuinely different (${sizes.join(', ')}px)`);
}

/* ---------------------------------------------------- actions go somewhere */
for (const concept of concepts) {
  await page.goto(url(`/demo/${concept.slug}/contact`), { waitUntil: 'networkidle' });
  const hrefs = await page.$$eval('main a[href]', (els) => els.map((e) => e.getAttribute('href')));
  const bad = hrefs.filter((h) => /^(javascript:|#$)/.test(h) || h === '');
  ok(bad.length === 0, `${concept.slug}: no dead actions (${bad.join(', ')})`);
  // Never a form that could take a patient's details into nowhere.
  const forms = await page.$$eval('form', (els) => els.length);
  ok(forms === 0, `${concept.slug}: no form pretending to receive patient information`);
  const externals = await page.$$eval('a[target="_blank"]', (els) => els.map((e) => e.rel));
  ok(externals.every((rel) => /noopener/.test(rel)), `${concept.slug}: external links carry rel=noopener`);
}

/* --------------------------------------------------- the discovery models */
{
  const filtered = concepts.find((c) => c.direction === 'clinic');
  await page.goto(url(`/demo/${filtered.slug}/services`), { waitUntil: 'networkidle' });
  const total = await page.$$eval('[data-service]', (els) => els.length);
  await page.fill('[data-finder-input]', 'acne');
  await page.waitForTimeout(200);
  const shown = await page.$$eval('[data-service]:not([hidden])', (els) => els.length);
  ok(shown > 0 && shown < total, `clinic: the service filter narrows (${shown} of ${total})`);
  await page.fill('[data-finder-input]', 'zzzz');
  await page.waitForTimeout(200);
  ok(await page.locator('[data-finder-empty]').isVisible(), 'clinic: an empty result says what to do');

  // And the list is complete for anyone without JavaScript.
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const flat = await noJs.newPage();
  await flat.goto(url(`/demo/${filtered.slug}/services`), { waitUntil: 'load' });
  ok(
    (await flat.$$eval('[data-service]', (els) => els.filter((e) => !e.hidden).length)) === total,
    'clinic: every service is present without JavaScript',
  );
  await noJs.close();
}
{
  const overlay = concepts.find((c) => c.direction === 'atelier');
  await page.goto(url(`/demo/${overlay.slug}`), { waitUntil: 'networkidle' });
  await page.click('[data-panel-open]');
  await page.waitForTimeout(300);
  ok(await page.locator('#at-panel').isVisible(), 'atelier: the menu opens');
  ok(
    await page.evaluate(() => document.querySelector('main')?.hasAttribute('inert')),
    'atelier: the page behind the menu is inert',
  );
  const stops = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => Boolean(document.activeElement?.closest('#at-panel'))));
  }
  ok(stops.every(Boolean), 'atelier: the menu traps Tab');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok(await page.locator('#at-panel').isHidden(), 'atelier: Escape closes it');
  ok(
    await page.evaluate(() => document.activeElement?.hasAttribute('data-panel-open')),
    'atelier: focus goes back to the button',
  );
}

/* ------------------------------------------------------------- the phone */
for (const width of [360, 390, 414, 768]) {
  const mob = await browser.newContext({
    viewport: { width, height: width < 500 ? 800 : 1024 },
    isMobile: width < 500,
    hasTouch: width < 500,
    deviceScaleFactor: 2,
  });
  const p = await mob.newPage();
  for (const concept of concepts) {
    for (const surface of ['', 'services']) {
      const href = `/demo/${concept.slug}${surface ? `/${surface}` : ''}`;
      await p.goto(url(href), { waitUntil: 'networkidle' });
      await p.waitForTimeout(200);
      const over = await p.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      ok(over <= 1, `${width}px ${href}: no horizontal overflow (${over}px)`);
    }
    // The first screen has to carry the practice's name and a way to act.
    await p.goto(url(`/demo/${concept.slug}`), { waitUntil: 'networkidle' });
    const firstScreen = await p.evaluate((h) => {
      const within = (el) => {
        const r = el.getBoundingClientRect();
        return r.top < h && r.bottom > 0;
      };
      const nameSeen = [...document.querySelectorAll('header a, h1')].some(within);
      const actionSeen = [...document.querySelectorAll('a[href], button')].some(within);
      return { nameSeen, actionSeen };
    }, width < 500 ? 800 : 1024);
    ok(firstScreen.nameSeen, `${width}px ${concept.slug}: the practice is named on the first screen`);
    ok(firstScreen.actionSeen, `${width}px ${concept.slug}: something to act on is on the first screen`);
  }
  await mob.close();
}

/* ------------------------------------------------------------ accessibility */
for (const concept of concepts) {
  for (const surface of ['', 'services']) {
    const href = `/demo/${concept.slug}${surface ? `/${surface}` : ''}`;
    await page.goto(url(href), { waitUntil: 'networkidle' });
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important}.rise{opacity:1!important;transform:none!important}',
    });
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const res = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
    const v = res.violations.map((x) => `${x.id}(${x.impact}) x${x.nodes.length}`);
    ok(res.violations.length === 0, `axe clean — ${href}${v.length ? ': ' + v.join(', ') : ''}`);
    if (res.violations.length) {
      for (const x of res.violations) {
        console.log('   ', x.id, x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | '));
      }
    }
  }
}

/* ------------------------------------------ nothing leaks to the public site */
{
  const map = await ctx.request.get(url('/sitemap-0.xml'));
  if (map.status() === 200) {
    const xml = await map.text();
    ok(!/\/demo\//.test(xml), 'no concept is listed in the sitemap');
  } else {
    console.log('SKIP sitemap (dev server)');
  }
  const robots = await (await ctx.request.get(url('/robots.txt'))).text();
  ok(/Disallow: \/demo\//.test(robots), 'robots.txt disallows the concepts');

  const home = await ctx.newPage();
  await home.goto(base, { waitUntil: 'networkidle' });
  const leaks = await home.$$eval('a[href*="/demo"]', (els) => els.map((e) => e.getAttribute('href')));
  ok(leaks.length === 0, `the journal does not link to the factory (${leaks.join(', ')})`);
  await home.close();
}

ok(errs.length === 0, `no page errors: ${errs.join(' | ')}`);

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nall practice-demo checks passed');
process.exit(fails.length ? 1 : 0);
