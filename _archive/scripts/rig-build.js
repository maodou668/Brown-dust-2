// 把 lecliss 立绘切成骨骼部件 → 输出部件图集 + rig.json，并做"重组验证"。
// 用多边形遮罩，关节处留重叠；绘制顺序保证躯干盖肩窝、裙盖髋窝。
// 用法: node scripts/rig-build.js [--check]   (--check 只重组验证不写文件)
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const SRC = 'art/03_sprite/lecliss_chibi.webp';
const OUT_DIR = 'art/04_rig';
const TARGET = path.join(OUT_DIR, 'lecliss');

// ---- 骨骼：name, parent, 轴心(源图坐标) ----
const BONES = [
  ['root', null, [235, 300]],
  ['spine', 'root', [235, 285]],
  ['chest', 'spine', [235, 175]],
  ['neck', 'chest', [235, 150]],
  ['head', 'neck', [235, 140]],
  ['hair', 'chest', [235, 150]],
  ['armL', 'chest', [188, 168]],        // 图左 = 角色右臂；整条手臂一根骨
  ['armR', 'chest', [285, 168]],
  ['thighL', 'root', [212, 305]],
  ['shinL', 'thighL', [205, 480]],
  ['thighR', 'root', [260, 305]],
  ['shinR', 'thighR', [268, 480]],
];

// ---- 部件：name, bone, z, 多边形(源图坐标) ----
// 多边形尽量覆盖该部件，并在关节处向父件多伸 10~20px 作重叠。
// subHair:true → 抽取后把"头发区域"像素抠掉(头发只归 hair_back，手臂不夹带头发)。
const HAIR_MASK = [   // 头发占据的大致区域(用于从手臂里减掉头发)
  [150,80],[104,250],[100,400],[160,430],[210,330],[214,150],[235,90],[256,150],[262,330],[312,430],[366,400],[362,250],[322,80],[235,30] ];
const PARTS = [
  { name: 'hair_back', bone: 'hair', z: 0, poly: [
    [150,90],[112,250],[110,382],[155,418],[202,340],[212,180],[235,118],[258,180],[270,340],[316,418],[360,382],[358,250],[320,90],[235,38] ] },

  { name: 'thighL', bone: 'thighL', z: 10, poly: [[184,292],[239,292],[236,522],[193,522],[178,400]] },
  { name: 'thighR', bone: 'thighR', z: 10, poly: [[232,292],[289,292],[293,400],[278,522],[235,522]] },
  { name: 'shinL', bone: 'shinL', z: 11, poly: [[138,494],[238,494],[240,742],[128,742]] },
  { name: 'shinR', bone: 'shinR', z: 11, poly: [[234,494],[326,494],[336,742],[232,742]] },

  { name: 'skirt', bone: 'spine', z: 20, poly: [
    [144,248],[86,396],[42,598],[120,654],[190,548],[206,438],[235,428],[268,438],[290,548],[352,654],[432,598],[382,396],[328,248],[235,234] ] },

  { name: 'armL', bone: 'armL', z: 30, subHair: true, poly: [
    [143,142],[212,150],[206,210],[184,248],[140,372],[30,360],[46,248],[100,196] ] },
  { name: 'armR', bone: 'armR', z: 30, subHair: true, poly: [
    [259,150],[328,142],[372,196],[426,248],[442,360],[332,372],[286,248],[264,210] ] },

  { name: 'torso', bone: 'chest', z: 40, poly: [
    [176,140],[297,140],[304,210],[283,302],[235,310],[187,302],[168,210] ] },

  { name: 'head', bone: 'head', z: 60, poly: [
    [160,26],[176,10],[294,10],[310,40],[303,150],[273,180],[235,186],[199,180],[168,150] ] },
];

function clipPoly(ctx, poly) {
  ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath(); ctx.clip();
}
function bboxOf(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data; let a = w, b = 0, c = h, e = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) {
    if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > e) e = y;
  }
  return b >= a ? { x: a, y: c, w: b - a + 1, h: e - c + 1 } : null;
}

(async () => {
  const check = process.argv.includes('--check');
  const img = await loadImage(SRC); const W = img.width, H = img.height;
  const boneMap = {}; BONES.forEach(b => boneMap[b[0]] = { name: b[0], parent: b[1], pivot: b[2] });

  // 紫发判定：紫罗兰(B>R 且 R>=G 的发色)，用于把头发从手臂里抠掉
  const isHair = (R, G, B, A) => A > 8 && B > R + 4 && R >= G - 4 && B > 40 && (R - G) < 45;
  // 抽取每个部件到独立 canvas（裁到 bbox）
  const extracted = [];
  for (const p of PARTS) {
    const c = createCanvas(W, H), x = c.getContext('2d');
    x.save(); clipPoly(x, p.poly); x.drawImage(img, 0, 0); x.restore();
    // subHair：仅在 HAIR_MASK 区域内、且像素为发色时抠掉
    if (p.subHair) {
      const mc = createCanvas(W, H), mx = mc.getContext('2d');
      mx.save(); clipPoly(mx, HAIR_MASK); mx.fillStyle = '#fff'; mx.fillRect(0, 0, W, H); mx.restore();
      const inMask = mx.getImageData(0, 0, W, H).data;
      const id = x.getImageData(0, 0, W, H); const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (inMask[i + 3] > 0 && isHair(d[i], d[i + 1], d[i + 2], d[i + 3])) d[i + 3] = 0;
      }
      x.putImageData(id, 0, 0);
    }
    const bb = bboxOf(x, W, H);
    if (!bb) { console.warn('空部件', p.name); continue; }
    const pc = createCanvas(bb.w, bb.h), px = pc.getContext('2d');
    px.drawImage(c, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
    // 把抠发后的 alpha 同步到裁切图
    if (p.subHair) { px.clearRect(0, 0, bb.w, bb.h); px.drawImage(x.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); }
    extracted.push({ part: p, bb, canvas: pc });
  }

  // ---- 重组验证：按 z 序把部件画回原位，应≈原图 ----
  const re = createCanvas(W, H), rx = re.getContext('2d');
  extracted.slice().sort((m, n) => m.part.z - n.part.z).forEach(e => {
    rx.drawImage(e.canvas, e.bb.x, e.bb.y);
  });
  // 覆盖率：原图不透明像素中，被部件覆盖的比例
  const od = createCanvas(W, H); const ox = od.getContext('2d'); ox.drawImage(img, 0, 0);
  const oa = ox.getImageData(0, 0, W, H).data, ra = rx.getImageData(0, 0, W, H).data;
  let orig = 0, covered = 0, miss = 0;
  const missMap = createCanvas(W, H), mm = missMap.getContext('2d');
  mm.drawImage(img, 0, 0); const md = mm.getImageData(0, 0, W, H);
  for (let i = 0; i < oa.length; i += 4) {
    if (oa[i + 3] > 40) { orig++; if (ra[i + 3] > 8) covered++; else { miss++; md.data[i] = 255; md.data[i + 1] = 0; md.data[i + 2] = 255; md.data[i + 3] = 255; } }
  }
  mm.putImageData(md, 0, 0);
  fs.mkdirSync('/tmp/sheets', { recursive: true });
  fs.writeFileSync('/tmp/sheets/_reassemble.png', re.toBuffer('image/png'));
  fs.writeFileSync('/tmp/sheets/_miss.png', missMap.toBuffer('image/png'));
  console.log(`重组覆盖率 ${(covered / orig * 100).toFixed(2)}%  缺口像素 ${miss}/${orig}`);
  console.log('  -> /tmp/sheets/_reassemble.png  /tmp/sheets/_miss.png (粉色=没被任何部件覆盖)');

  if (check) return;

  // ---- 打包图集(竖排) + rig.json ----
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pad = 2, aw = Math.max(...extracted.map(e => e.bb.w));
  const ah = extracted.reduce((s, e) => s + e.bb.h + pad, 0);
  const atlas = createCanvas(aw, ah), ax2 = atlas.getContext('2d');
  let cy = 0; const parts = [];
  for (const e of extracted) {
    ax2.drawImage(e.canvas, 0, cy);
    const piv = boneMap[e.part.bone].pivot;
    parts.push({ name: e.part.name, bone: e.part.bone, z: e.part.z,
      atlas: { x: 0, y: cy, w: e.bb.w, h: e.bb.h },
      off: [e.bb.x - piv[0], e.bb.y - piv[1]] });   // 部件左上相对 bone 轴心
    cy += e.bb.h + pad;
  }
  fs.writeFileSync(TARGET + '_atlas.png', atlas.toBuffer('image/png'));
  const bones = BONES.map(b => {
    const parentPiv = b[1] ? boneMap[b[1]].pivot : [0, 0];
    return { name: b[0], parent: b[1], rest: [b[2][0] - parentPiv[0], b[2][1] - parentPiv[1]], pivot: b[2] };
  });
  fs.writeFileSync(TARGET + '_rig.json', JSON.stringify({ image: 'lecliss_atlas.png', W, H, bones, parts }, null, 1));
  console.log('已写出', TARGET + '_atlas.png', '+', TARGET + '_rig.json', `(${parts.length}部件)`);
})();
