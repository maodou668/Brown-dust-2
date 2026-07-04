#!/usr/bin/env node
// 场景离线预览器：渲染 Diorama map def（多层地形+decor+props+actor标记）→ 整图 png
// 用法: node scripts/mappreview.js <def.js | 章节id> <out.png> [scale=2]
//   def.js: module.exports = { stage: {...}, actors: {...} }（与 story2 场景 op 同构）
//   章节id: 从 js/story2.js 的 SCRIPTS 里取第一个带 stage 的 op
// 逻辑与 js/director.js Diorama tick 保持同构（改渲染器时同步这里）。
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const [defArg, out = 'preview.png', scaleArg] = process.argv.slice(2);
  if (!defArg) { console.error('用法: node scripts/mappreview.js <def.js|章节id> <out.png> [scale]'); process.exit(1); }
  let cfg;
  if (defArg.endsWith('.js') && fs.existsSync(defArg)) {
    cfg = require(path.resolve(defArg));
  } else {
    global.window = {};
    require(path.join(ROOT, 'js/story2.js'));
    const ops = (global.window.SCRIPTS || {})[defArg] || [];
    cfg = ops.find(o => o.stage);
    if (!cfg) { console.error(`章节 ${defArg} 里没有 stage 场景`); process.exit(1); }
  }
  const st = cfg.stage, m = st.map, T = m.tile || 32;
  const S = +(scaleArg || 2);
  const gsrc = m.grid || (m.layers || []).map(l => l.grid).find(Boolean);
  const worldW = (gsrc[0].length - 1) * T, worldH = (gsrc.length - 1) * T;
  const cv = createCanvas(worldW * S, worldH * S);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#101014'; ctx.fillRect(0, 0, cv.width, cv.height);

  const imgs = {};
  const img = async src => imgs[src] || (imgs[src] = await loadImage(path.resolve(ROOT, src)));
  const lutOf = l => {
    if (l._lut) return l._lut;
    if (typeof l.lut === 'string') { const j = JSON.parse(fs.readFileSync(path.resolve(ROOT, l.lut), 'utf8')); l._lut = j.lut || j; }
    else l._lut = l.lut || {};
    return l._lut;
  };

  // 多层地形
  for (const l of m.layers || []) {
    const sh = await img(l.sheet);
    const grid = l.grid, lut = lutOf(l);
    const rows = worldH / T, cols = worldW / T;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let t = null;
      if (!grid) t = l.fullVar[(c * 7 + r * 13) % l.fullVar.length];
      else {
        const mask = (grid[r][c] === '1' ? 1 : 0) + (grid[r][c + 1] === '1' ? 2 : 0)
                   + (grid[r + 1][c] === '1' ? 4 : 0) + (grid[r + 1][c + 1] === '1' ? 8 : 0);
        if (mask === 0) t = l.emptyVar ? l.emptyVar[(c * 11 + r * 17) % l.emptyVar.length] : null;
        else if (mask === 15 && l.fullVar) t = l.fullVar[(c * 7 + r * 13) % l.fullVar.length];
        else t = lut[mask];
      }
      if (t) ctx.drawImage(sh, t[0], t[1], T, T, c * T * S, r * T * S, T * S, T * S);
    }
  }
  // 装饰层
  if (m.decor) {
    const L = m.decor.legend || {};
    for (let r = 0; r < (m.decor.rows || []).length; r++) {
      const row = m.decor.rows[r];
      for (let c = 0; c < row.length; c++) {
        const e = L[row[c]]; if (!e) continue;
        const sh = await img((m.sheets || {})[e[0]]);
        ctx.drawImage(sh, e[1], e[2], T, T, c * T * S, r * T * S, T * S, T * S);
      }
    }
  }
  // props + actor 标记，按脚线 y 排序
  const ents = [];
  for (const pr of st.props || []) {
    const im = await img(pr.img);
    const fx = pr.x * T, fy = pr.y * T, s = (pr.s || 1) * S;
    ents.push({ y: fy, draw: () => {
      if (!pr.flat) {
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.beginPath();
        ctx.ellipse(fx * S, fy * S, im.width * s * 0.32, Math.max(2, im.width * s * 0.09), 0, 0, 7);
        ctx.fill();
      }
      ctx.drawImage(im, Math.round(fx * S - im.width * s / 2), Math.round(fy * S - im.height * s), im.width * s, im.height * s);
    } });
  }
  for (const id in cfg.actors || {}) {
    const a = cfg.actors[id];
    const wx = a.x / 100 * worldW, wy = a.y / 100 * worldH;
    ents.push({ y: wy, draw: () => {
      ctx.fillStyle = 'rgba(255,80,80,.8)';
      ctx.beginPath(); ctx.ellipse(wx * S, wy * S, 6 * S, 3 * S, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `${7 * S}px monospace`; ctx.fillText(id, wx * S - 10, wy * S - 6);
    } });
  }
  ents.sort((a, b) => a.y - b.y).forEach(e => e.draw());

  // 物件灯光晕（与 Diorama 同构，静态）
  for (const pr of cfg.stage.props || []) {
    if (!pr.glow) continue;
    const gx = pr.x * T * S, gy = (pr.y - (pr.glow.dy || 1.2)) * T * S;
    const gr = (pr.glow.r || 2.2) * T * S;
    const rg = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
    rg.addColorStop(0, pr.glow.color || 'rgba(255,196,110,.5)');
    rg.addColorStop(0.55, 'rgba(255,180,90,.16)');
    rg.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rg; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  // 色调层（与 Diorama 同构）
  if (st.mute) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${st.mute})`; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-over'; }
  if (st.tone) { ctx.fillStyle = st.tone; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (st.gloom) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = st.gloom === true ? 'rgb(152,188,168)' : st.gloom; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-over'; }
  if (st.night) { ctx.fillStyle = 'rgba(10,12,26,.42)'; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (st.rain) { ctx.strokeStyle = 'rgba(190,215,230,.16)'; ctx.lineWidth = Math.max(1, S / 3); ctx.beginPath();
    for (let i = 0; i < 140; i++) { const px = ((i * 379 + 61) % 977) / 977 * cv.width; const py = ((i * 613) % cv.height);
      ctx.moveTo(px, py); ctx.lineTo(px - 7 * (S / 2), py + 26 * (S / 2)); } ctx.stroke(); }

  fs.writeFileSync(out, cv.toBuffer('image/png'));
  console.log(`预览 ${worldW}x${worldH} @${S}x → ${out}`);
})();
