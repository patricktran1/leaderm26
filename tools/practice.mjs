/**
 * The conversion path, audited end to end.
 *
 * A sales page fails quietly: a mailto that lost its body, a share card that
 * 404s, a bridge from the journal that points at nothing. None of that shows
 * up in a build log, so it is checked here against the running site.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.env.URL || 'http://localhost:4321/';
const url = (p) => new URL(p, base).href;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--disable-background-networking', '--no-first-run'],
});
const fails = [];
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails.push(m); };

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

/* ------------------------------------------------------------- the route */
const res = await page.goto(url('/for-practices'), { waitUntil: 'networkidle' });
ok(res.status() === 200, `/for-practices responds (${res.status()})`);

const meta = await page.evaluate(() => {
  const get = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr) ?? null;
  return {
    title: document.title,
    description: get('meta[name="description"]'),
    canonical: get('link[rel="canonical"]', 'href'),
    robots: get('meta[name="robots"]'),
    ogType: get('meta[property="og:type"]'),
    ogTitle: get('meta[property="og:title"]'),
    ogImage: get('meta[property="og:image"]'),
    ogImageAlt: get('meta[property="og:image:alt"]'),
    twitterCard: get('meta[name="twitter:card"]'),
    twitterImage: get('meta[name="twitter:image"]'),
    jsonLd: document.querySelector('script[type="application/ld+json"]')?.textContent ?? '',
    h1: document.querySelectorAll('h1').length,
    h1Text: document.querySelector('h1')?.textContent.trim() ?? '',
    lang: document.documentElement.lang,
  };
});

ok(/dermatology practices/i.test(meta.title), `title is about the work (${meta.title})`);
ok(meta.title.length <= 65, `title fits a search result (${meta.title.length} chars)`);
ok(!/LEADderm 2026 — Field Notes$/.test(meta.title), 'title is not the journal’s');
ok(
  (meta.description ?? '').length > 90 && (meta.description ?? '').length <= 200,
  `description is a usable length (${(meta.description ?? '').length})`,
);
ok(/dermatolog/i.test(meta.description ?? ''), 'description names the audience');
ok(meta.canonical?.endsWith('/for-practices'), `canonical points at itself (${meta.canonical})`);
ok(/^index/.test(meta.robots ?? ''), `page is indexable (${meta.robots})`);
ok(meta.ogType === 'website', `og:type is website (${meta.ogType})`);
ok(meta.ogImage?.endsWith('/og-practices.jpg'), `its own share card (${meta.ogImage})`);
ok(meta.twitterImage === meta.ogImage, 'twitter card uses the same image');
ok(meta.twitterCard === 'summary_large_image', 'large summary card');
ok((meta.ogImageAlt ?? '').length > 20, 'the share card is described');
ok(meta.h1 === 1, `exactly one h1 (${meta.h1})`);
ok(/dermatologist/i.test(meta.h1Text), `the h1 says who built it (${meta.h1Text})`);
ok(meta.lang === 'en', 'language declared');

let ld = null;
try { ld = JSON.parse(meta.jsonLd); } catch { /* reported below */ }
ok(Boolean(ld), 'structured data parses');
const types = (ld?.['@graph'] ?? []).map((n) => n['@type']);
ok(types.includes('ProfessionalService'), `structured data describes a service (${types.join(', ')})`);
ok(!types.includes('Article'), 'the journal’s article schema does not leak onto this page');

/* -------------------------------------------------------- the share card */
{
  const card = await ctx.request.get(url('/og-practices.jpg'));
  ok(card.status() === 200, `share card renders (${card.status()})`);
  if (card.status() === 200) {
    const m = await sharp(await card.body()).metadata();
    ok(m.width === 1200 && m.height === 630, `share card is 1200x630 (${m.width}x${m.height})`);
    ok(m.format === 'jpeg', `share card is a jpeg (${m.format})`);
  }
}

/* --------------------------------------------------------- the CTA email */
{
  const hrefs = await page.$$eval('[data-goal^="practice-start"]', (els) => els.map((e) => e.getAttribute('href')));
  ok(hrefs.length >= 2, `the action appears at the top and the bottom (${hrefs.length})`);
  ok(new Set(hrefs).size === 1, 'both go to the same place');
  const href = hrefs[0] ?? '';
  ok(href.startsWith('mailto:patrick@trandermatology.com'), `mailto to the right address (${href.slice(0, 46)})`);
  const q = new URLSearchParams(href.split('?')[1] ?? '');
  ok((q.get('subject') ?? '').length > 0, `the email has a subject (${q.get('subject')})`);
  const body = q.get('body') ?? '';
  for (const field of ['Practice:', 'City:', 'Current website:']) {
    ok(body.includes(field), `the email asks for ${field.replace(':', '').toLowerCase()}`);
  }
  ok(/for-practices/.test(body), 'the email says where it came from');
  ok(body.split('\n').length >= 5, 'the email is a form, not a blank page');

  const label = await page.locator('[data-goal="practice-start"]').innerText();
  ok(label.trim().length <= 12, `the action is short (${label.trim()})`);
  ok(!/contact us/i.test(label), 'not "Contact us"');
}

/* -------------------------------------------------- links actually resolve */
{
  const links = await page.$$eval('main a[href], footer a[href]', (els) =>
    els.map((e) => ({ href: e.getAttribute('href'), external: e.target === '_blank', rel: e.rel })),
  );
  const internal = [...new Set(links.filter((l) => l.href.startsWith('/')).map((l) => l.href))];
  for (const href of internal) {
    const r = await ctx.request.get(url(href.split('#')[0] || '/'));
    ok(r.status() === 200, `${href} resolves (${r.status()})`);
  }
  const external = links.filter((l) => l.external);
  ok(external.length > 0 && external.every((l) => /noopener/.test(l.rel)), 'external links carry rel=noopener');

  const goals = await page.$$eval('[data-goal]', (els) => els.map((e) => e.getAttribute('data-goal')));
  for (const g of ['practice-start', 'practice-start-foot', 'email', 'instagram']) {
    ok(goals.includes(g), `the funnel step "${g}" is marked for measurement`);
  }
}

/* ------------------------------------------- the bridge from the journal */
{
  const home = await ctx.newPage();
  await home.goto(base, { waitUntil: 'networkidle' });
  const bridges = await home.$$eval('a[href="/for-practices"]', (els) =>
    els.map((e) => ({ text: e.textContent.trim(), inPractice: Boolean(e.closest('#practice')) })),
  );
  ok(bridges.length >= 1, `the journal links to the practice page (${bridges.length} times)`);
  ok(bridges.some((b) => b.inPractice), 'the bridge sits inside the existing practice section');
  ok(bridges.length <= 3, `and does not shout (${bridges.length} links)`);

  // The journal keeps its own identity: conference metadata, conference card.
  const homeMeta = await home.evaluate(() => ({
    title: document.title,
    og: document.querySelector('meta[property="og:image"]')?.content,
    type: document.querySelector('meta[property="og:type"]')?.content,
  }));
  ok(/LEADderm 2026/.test(homeMeta.title), `the journal's title is unchanged (${homeMeta.title})`);
  ok(homeMeta.og.endsWith('/og.jpg'), 'the journal keeps its own share card');
  ok(homeMeta.type === 'article', 'the journal is still an article');
  const cta = await home.locator('.cta').count();
  ok(cta === 0, `no loud call to action on the journal (${cta})`);
  await home.close();
}

/* ------------------------------------------------------- reduced motion */
{
  const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  const p = await rm.newPage();
  await p.goto(url('/for-practices'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  const hidden = await p.evaluate(() =>
    [...document.querySelectorAll('.reveal')].filter((el) => getComputedStyle(el).opacity !== '1').length,
  );
  ok(hidden === 0, `nothing stays hidden with reduced motion (${hidden} elements)`);
  await rm.close();
}

/* ------------------------------------------------------------ no errors */
ok(errs.length === 0, `no page errors: ${errs.join(' | ')}`);

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nall practice-page checks passed');
process.exit(fails.length ? 1 : 0);
