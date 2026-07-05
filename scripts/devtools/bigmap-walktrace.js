// 大图纯摇杆实走闸门：沿路点自动走全程, 卡住即报 (标定改动后必跑)
// 用法: node scripts/devtools/bigmap-walktrace.js [main|branch]
const pwPath = '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core';
const { chromium } = require(pwPath);
const ROUTES = {
  main: [[350,1360],[450,1260],[510,1190],[523,1150],[560,1100],[650,1000],[980,845],[1050,760],[1100,700],[1230,590],[1400,640],[1630,780],[1625,915],[1660,938],[1790,935],[1910,930],[2010,850],[2100,690],[2200,540],[2280,480],[2330,490]],
  branch: [[250,1350],[300,1400],[250,1330],[400,1280],[523,1150],[700,950],[980,845],[1150,660],[1240,540],[1150,700],[1000,1000],[760,1030],[700,1180],[870,1245],[1080,1240],[620,1140]],
};
(async () => {
  const route = ROUTES[process.argv[2] || 'main'];
  const http = require('http'); const fsp = require('fs');
  const srv = http.createServer((req, res) => {
    const f = '/home/user/Maodou' + decodeURIComponent(req.url.split('?')[0]);
    const p = f.endsWith('/') ? f + 'index.html' : f;
    try { const buf = fsp.readFileSync(p); res.writeHead(200); res.end(buf); }
    catch (e) { res.writeHead(404); res.end('nf'); }
  }).listen(18890 + Math.floor(Math.random() * 60));
  const port = srv.address().port;
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await br.newPage({ viewport: { width: 960, height: 520 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await pg.waitForTimeout(3500);
  await pg.evaluate(() => {
    const bm = window.BIGMAPS.town_day;
    window.Diorama.explore({ stage: { bigmap: 'town_day' }, sprite: 'teried', glow: true, scale: 1,
      x: bm.spawn[0] / bm.w * 100, y: bm.spawn[1] / bm.h * 100 });
  });
  await pg.waitForTimeout(2500);
  const result = await pg.evaluate(async (route) => {
    const D = window.Diorama, log = [];
    const W = D.world.w, H = D.world.h;
    const px = () => [D.actors.player.x / 100 * W, D.actors.player.y / 100 * H];
    for (const [tx, ty] of route) {
      let stuck = 0, last = px();
      for (let i = 0; i < 400; i++) {
        const [x, y] = px();
        const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
        if (d < 14) break;
        D.ctl.joy.active = true; D.ctl.joy.x = dx / d; D.ctl.joy.y = dy / d;
        await new Promise(r => setTimeout(r, 20));
        const [nx, ny] = px();
        if (Math.hypot(nx - last[0], ny - last[1]) < 0.5) stuck++; else stuck = 0;
        last = [nx, ny];
        if (stuck > 50) break;
      }
      D.ctl.joy.active = false; D.ctl.joy.x = D.ctl.joy.y = 0;
      const [fx, fy] = px();
      const ok = Math.hypot(tx - fx, ty - fy) < 20;
      log.push(`${ok ? '✓' : '✗卡'} 目标(${tx},${ty}) 实到(${Math.round(fx)},${Math.round(fy)})`);
      if (!ok) break;
    }
    return log;
  }, route);
  console.log(result.join('\n'));
  console.log('pageerror:', errs.length ? errs : '无');
  await br.close(); srv.close(); process.exit(0);
})();
