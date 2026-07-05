// 大图纯摇杆实走闸门：沿路点自动走全程, 卡住即报 (标定改动后必跑)
// 用法: node scripts/devtools/bigmap-walktrace.js [main|branch]
const pwPath = '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core';
const { chromium } = require(pwPath);
const ROUTES = {
  main: [[270,830],[302,798],[318,748],[332,700],[348,660],[385,640],[430,678],[485,695],[520,690],[560,650],[610,628],[700,578],[760,545],[930,580],[1010,500],[1060,478],[1125,590],[1240,595],[1310,586],[1390,670],[1440,495],[1520,355]],
  branch: [[255,845],[178,782],[255,845],[302,798],[385,640],[485,695],[610,628],[700,578],[755,525],[800,485],[792,435],[790,455],[700,458],[610,480],[520,502],[430,508],[390,480],[388,440],[330,385],[250,340],[388,470],[395,555],[400,630],[430,680],[485,695],[655,606],[700,690],[770,727],[700,690],[655,606]],
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
    const px = () => [D.actors.player.x / 100 * 1792, D.actors.player.y / 100 * 1024];
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
