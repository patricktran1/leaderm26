import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-first-run'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.click('[data-menu-open]'); await p.waitForTimeout(700);
await p.screenshot({ path:'/tmp/critique/menu-390.png' });
await b.close();
