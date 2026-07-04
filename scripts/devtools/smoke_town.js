const path = '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core';
const { chromium } = require(path);
(async () => {
  const http = require('http'); const fsp = require('fs');
  const srv = http.createServer((req, res) => {
    const f = '/home/user/Maodou' + decodeURIComponent(req.url.split('?')[0]);
    const p = f.endsWith('/') ? f + 'index.html' : f;
    try { const buf = fsp.readFileSync(p); res.writeHead(200); res.end(buf); }
    catch (e) { res.writeHead(404); res.end('nf'); }
  }).listen(18897);
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await br.newPage({ viewport: { width: 960, height: 520 } });
  const errs = [], n404 = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  pg.on('response', r => { if (r.status() === 404) n404.push(r.url().slice(-70)); });
  await pg.goto('http://127.0.0.1:18897/index.html', { waitUntil: 'load', timeout: 30000 });
  await pg.waitForTimeout(3500);
  await pg.evaluate(() => {
    const op = window.SCRIPTS.chapter1.find(o => o.op === 'scene' && o.bg === 'town');
    window.Diorama.run({ stage: op.stage, actors: op.actors, steps: [{ t: 'camera', x: 50, y: 50, scale: 0.42, dur: 300 }, { t: 'camera', x: 50, y: 50, scale: 0.42, dur: 45000 }] });
  });
  await pg.waitForTimeout(4500);
  await pg.screenshot({ path: process.argv[2] || 'town_shot.png' });
  console.log('pageerror:', errs.length ? errs : '无', ' 404:', n404.length ? [...new Set(n404)] : '无');
  await br.close(); srv.close();
  process.exit(0);
})();
