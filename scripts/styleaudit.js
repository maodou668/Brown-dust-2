// 全游戏风格体检 v1：各资产孤岛采样 + 量化(饱和度/明度/描边%) + 主色条
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/home/user/Maodou/assets/fonts/zpix.ttf', 'Zpix');
const R = '/home/user/Maodou/art/';
const SAMPLES = [
  ['人物·泰瑞德(锁法A)', R + '05_pixellab/teried_field/idle/south/00.png', 2],
  ['人物·加西亚(锁法A)', R + '05_pixellab/garcia_field/idle/south/00.png', 2],
  ['NPC立绘·村长', R + '06_story/portraits/npc_headman.png', 1],
  ['UI·面板头', R + '05_pixellab/ui/panel_header.png', 1],
  ['UI·按钮', R + '05_pixellab/ui/button.png', 1],
  ['场景·草地土路瓦', R + '06_story/tiles/road_grass.png', 1],
  ['场景·旧木屋(已接入)', R + '06_story/props/house_timber.png', 1],
  ['场景·新石屋(本批)', __dirname + '/processed/stonehouse_td.png', 1],
  ['场景·新干草车(本批)', __dirname + '/processed/haycart2_dk.png', 1],
  ['VFX·火矢帧', R + '05_pixellab/fx/fire_arrow/frame_002.png', 1],
];
const rgb2hsv = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const v = mx / 255, s = mx ? d / mx : 0;
  return [0, s, v];
};
(async () => {
  const CELL = 230, HEAD = 60, INFO = 92;
  const COLS = 5, ROWS = Math.ceil(SAMPLES.length / COLS);
  const cv = createCanvas(COLS * CELL + 20, ROWS * (CELL + INFO) + HEAD);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#1c1f22'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffd97a'; ctx.font = 'bold 20px Zpix';
  ctx.fillText('全游戏风格体检 v1 —— 各资产"孤岛"采样：饱和度/明度/描边 三轴 + 主色条', 14, 34);
  const stats = [];
  for (let i = 0; i < SAMPLES.length; i++) {
    const [name, p, z] = SAMPLES[i];
    let im; try { im = await loadImage(p); } catch (e) { console.log('MISS', name, p); continue; }
    const c2 = createCanvas(im.width, im.height); const c2x = c2.getContext('2d');
    c2x.drawImage(im, 0, 0);
    const d = c2x.getImageData(0, 0, im.width, im.height).data;
    let sS = 0, sV = 0, n = 0, dark = 0;
    const pal = new Map();
    for (let k = 0; k < im.width * im.height; k++) {
      if (d[k * 4 + 3] < 128) continue;
      const r = d[k * 4], g = d[k * 4 + 1], b = d[k * 4 + 2];
      const [, s, v] = rgb2hsv(r, g, b);
      sS += s; sV += v; n++;
      if (Math.max(r, g, b) < 56) dark++;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      pal.set(key, (pal.get(key) || 0) + 1);
    }
    const top = [...pal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([k]) => [((k >> 8) & 15) * 17, ((k >> 4) & 15) * 17, (k & 15) * 17]);
    const S = (sS / n * 100), V = (sV / n * 100), DK = (dark / n * 100);
    stats.push([name, S, V, DK]);
    const cx = (i % COLS) * CELL + 14, cy = Math.floor(i / COLS) * (CELL + INFO) + HEAD;
    ctx.fillStyle = '#3a4038'; ctx.fillRect(cx, cy, CELL - 14, CELL - 14);
    const sc = Math.min((CELL - 40) / im.width, (CELL - 40) / im.height, z);
    const w = Math.round(im.width * sc), h = Math.round(im.height * sc);
    ctx.drawImage(im, cx + (CELL - 14 - w) / 2, cy + (CELL - 14 - h) / 2, w, h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Zpix';
    ctx.fillText(name, cx, cy + CELL + 2);
    ctx.font = '12px Zpix'; ctx.fillStyle = '#c8d0c8';
    ctx.fillText(`饱和 ${S.toFixed(0)}%  明度 ${V.toFixed(0)}%  描边 ${DK.toFixed(0)}%`, cx, cy + CELL + 20);
    top.forEach((c, j) => { ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(cx + j * 26, cy + CELL + 30, 24, 20); });
    ctx.strokeStyle = '#555'; ctx.strokeRect(cx, cy + CELL + 30, 26 * 8 - 2, 20);
  }
  fs.writeFileSync(__dirname + '/style_audit_v1.png', cv.toBuffer('image/png'));
  console.log('===数值===');
  stats.forEach(([n, s, v, dk]) => console.log(`${n}: 饱和${s.toFixed(1)}% 明度${v.toFixed(1)}% 描边${dk.toFixed(1)}%`));
})();
