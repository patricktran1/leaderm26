import { chromium } from 'playwright';
const base = 'http://localhost:4321/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-background-networking','--no-first-run'] });
const fails = [];
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails.push(m); };

// ---------- desktop: lightbox ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(base, { waitUntil: 'networkidle' });

  const total = await page.locator('[data-lightbox]').count();
  const pad = (n) => String(n).padStart(2, '0');
  await page.locator('[data-lightbox="0"]').scrollIntoViewIfNeeded();
  await page.locator('[data-lightbox="0"]').click();
  await page.waitForTimeout(500);
  ok(await page.locator('#lightbox').isVisible(), 'lightbox opens on click');
  ok(
    (await page.locator('[data-lb-count]').textContent()).trim() === `01 / ${pad(total)}`,
    `counter reads 01 / ${pad(total)}`,
  );
  const firstSrc = await page.locator('[data-lb-image]').getAttribute('src');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(350);
  ok(
    (await page.locator('[data-lb-count]').textContent()).trim() === `02 / ${pad(total)}`,
    'arrow-right advances',
  );
  ok(await page.locator('[data-lb-image]').getAttribute('src') !== firstSrc, 'image changes');
  ok((await page.locator('[data-lb-caption]').textContent()).trim().length > 0, 'caption present');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  ok(
    (await page.locator('[data-lb-count]').textContent()).trim() === `${pad(total)} / ${pad(total)}`,
    'wraps backwards to the last photograph',
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  ok(await page.locator('#lightbox').isHidden(), 'escape closes lightbox');
  ok(await page.evaluate(() => document.activeElement?.hasAttribute('data-lightbox')), 'focus returns to the trigger');
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden'), 'scroll lock released');

  // scrim click
  await page.locator('[data-lightbox="3"]').click();
  await page.waitForTimeout(400);
  const stageBox = await page.locator('[data-lb-stage]').boundingBox();
  await page.mouse.click(stageBox.x + 30, stageBox.y + 20);
  await page.waitForTimeout(500);
  ok(await page.locator('#lightbox').isHidden(), 'clicking outside the photograph closes the lightbox');

  // anchor navigation
  await page.click('.masthead__nav a[href="/#tables"]');
  await page.waitForTimeout(900);
  ok(await page.evaluate(() => window.scrollY > 1000), 'nav anchor scrolls');

  // skip link
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement?.classList.contains('skip-link')), 'first tab stop is the skip link');

  ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
  await ctx.close();
}

// ---------- phone: index panel + swipe ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  ok(!(await page.locator('.masthead__nav').isVisible()), 'inline nav hidden on phone');
  await page.click('[data-menu-open]');
  await page.waitForTimeout(400);
  ok(await page.locator('#index-panel').isVisible(), 'index panel opens');
  ok(await page.locator('[data-menu-open]').getAttribute('aria-expanded') === 'true', 'aria-expanded set');
  const box = await page.locator('#index-panel a[data-menu-link]').first().boundingBox();
  ok(box.height >= 44, `index link tap target >= 44px (got ${Math.round(box.height)})`);
  await page.click('[data-menu-link]');
  await page.waitForTimeout(500);
  ok(await page.locator('#index-panel').isHidden(), 'index panel closes on selection');

  await page.locator('[data-lightbox="1"]').scrollIntoViewIfNeeded();
  await page.locator('[data-lightbox="1"]').click();
  await page.waitForTimeout(500);
  ok(await page.locator('#lightbox').isVisible(), 'lightbox opens on phone');
  const before = (await page.locator('[data-lb-count]').textContent()).trim();
  const stage = await page.locator('[data-lb-stage]').boundingBox();
  await page.touchscreen.tap(stage.x + stage.width - 30, stage.y + stage.height / 2);
  await page.mouse.move(stage.x + stage.width - 40, stage.y + stage.height / 2);
  await page.evaluate(({ x, y, w }) => {
    const el = document.querySelector('[data-lb-stage]');
    const mk = (type, cx) => new TouchEvent(type, { bubbles: true, changedTouches: [new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })] });
    el.dispatchEvent(mk('touchstart', x + w - 40));
    el.dispatchEvent(mk('touchend', x + 40));
  }, { x: stage.x, y: stage.y + stage.height / 2, w: stage.width });
  await page.waitForTimeout(350);
  ok((await page.locator('[data-lb-count]').textContent()).trim() !== before, 'swipe advances the lightbox');
  const closeBox = await page.locator('[data-lb-close]').boundingBox();
  ok(closeBox.height >= 32, `close button tap target (got ${Math.round(closeBox.height)})`);
  await ctx.close();
}

// ---------- no-JS ----------
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  const opacity = await page.evaluate(() => getComputedStyle(document.querySelector('.reveal')).opacity);
  ok(opacity === '1', `content visible without JavaScript (opacity ${opacity})`);
  ok((await page.locator('.tables__row').count()) === 20, 'table list renders without JavaScript');
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nall interaction checks passed');
process.exit(fails.length ? 1 : 0);
