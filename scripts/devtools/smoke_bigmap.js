// 大图村庄冒烟测试：自由行走进村沿路走一圈，多点截图（碰撞/遮挡/光晕目视验收）
// 用法: node scripts/devtools/smoke_bigmap.js <outdir>
const pwPath = '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core';
const { chromium } = require(pwPath);
(async () => {
  const outdir = process.argv[2] || '.';
  const http = require('http'); const fsp = require('fs');
  const srv = http.createServer((req, res) => {
    const f = '/home/user/Maodou' + decodeURIComponent(req.url.split('?')[0]);
    const p = f.endsWith('/') ? f + 'index.html' : f;
    try { const buf = fsp.readFileSync(p); res.writeHead(200); res.end(buf); }
    catch (e) { res.writeHead(404); res.end('nf'); }
  }).listen(18899);
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await br.newPage({ viewport: { width: 960, height: 520 } });
  const errs = [], n404 = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  pg.on('response', r => { if (r.status() === 404) n404.push(r.url().slice(-70)); });
  await pg.goto('http://127.0.0.1:18899/index.html', { waitUntil: 'load', timeout: 30000 });
  await pg.waitForTimeout(3500);

  // 直接开自由行走（绕过 UI 弹窗）
  await pg.evaluate(() => {
    const bm = window.BIGMAPS.town_day;
    window.Diorama.explore({ stage: { bigmap: 'town_day' }, sprite: 'teried', glow: true, scale: 1,
      x: bm.spawn[0] / bm.w * 100, y: bm.spawn[1] / bm.h * 100 });
  });
  await pg.waitForTimeout(3000);

  const pos = async () => pg.evaluate(() => {
    const a = window.Diorama.actors.player;
    return [Math.round(a.x / 100 * 1792), Math.round(a.y / 100 * 1024)];
  });
  // 传送辅助（把玩家放到指定原图 px，校验该点可走）
  const tp = async (x, y) => pg.evaluate(([x, y]) => {
    const a = window.Diorama.actors.player;
    a.x = x / 1792 * 100; a.y = y / 1024 * 100;
    return window.Diorama.blockedAt(a.x, a.y);
  }, [x, y]);
  // 按键行走 ms 毫秒
  const walk = async (key, ms) => {
    await pg.keyboard.down(key);
    await pg.waitForTimeout(ms);
    await pg.keyboard.up(key);
  };

  // 1) 出生点沿路向东北走（真实按键，验证碰撞手感）
  await walk('d', 1500); await walk('w', 600); await walk('d', 1200);
  console.log('walked to', await pos());
  await pg.screenshot({ path: outdir + '/bs1_road.png' });

  // 2) 传送到栅门前走门洞
  console.log('tp gate blocked?', await tp(340, 775));
  await walk('w', 700); await walk('d', 900);
  console.log('gate →', await pos());
  await pg.screenshot({ path: outdir + '/bs2_gate.png' });

  // 3) 大街走到广场
  console.log('tp street blocked?', await tp(565, 655));
  await walk('d', 2200);
  console.log('street →', await pos());
  await pg.screenshot({ path: outdir + '/bs3_street.png' });

  // 4) 井后遮挡验收（人站井北，应被井体盖住下半身）
  console.log('tp well-north blocked?', await tp(872, 425));
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: outdir + '/bs4_well.png' });

  // 5) 桥面
  console.log('tp bridge blocked?', await tp(1220, 597));
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: outdir + '/bs5_bridge.png' });

  // 6) 磨坊门前
  console.log('tp mill blocked?', await tp(1510, 358));
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: outdir + '/bs6_mill.png' });

  // 7) 墓园
  console.log('tp grave blocked?', await tp(300, 300));
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: outdir + '/bs7_grave.png' });

  // 8) 碰撞抽查：应被挡的点
  for (const [x, y, name] of [[872, 498, '井心'], [760, 200, '领主宅内'], [520, 570, '西屋内'], [1200, 750, '溪流'], [280, 250, '礼拜堂内'], [620, 800, '鸡圈院']]) {
    console.log(`block[${name}]`, await tp(x, y));
  }

  console.log('pageerror:', errs.length ? errs : '无', ' 404:', n404.length ? [...new Set(n404)] : '无');
  await br.close(); srv.close();
  process.exit(0);
})();
