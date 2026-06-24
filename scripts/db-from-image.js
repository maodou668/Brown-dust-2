// 从 Gemini 立绘自动切件 → 生成 DragonBones 资产（本地，无需联网）
// 思路：白底转 alpha，按"躯干中柱 + 左右展开臂 + 双腿"区域分割，每件裁边打图集，
//       配标准骨架命名 + idle/attack/walk 动画。真立绘 A 字姿势专用。
const fs = require('fs'), path = require('path');
const { loadImage, createCanvas } = require('@napi-rs/canvas');

const SRC = path.resolve(__dirname, '..', 'art', '01_splash', 'lecliss_pose.png');
const OUT = path.resolve(__dirname, '..', 'art', '02_dragonbones');
const NAME = 'lecliss';

// —— 分区参数（绝对像素，依据轮廓剖面，可微调）——
const P = {
  cx: 704,            // 人物中线
  neckY: 200,         // 头/躯干分界
  splitY: 560,        // 躯干(含裙)/腿分界
  torsoL: 590, torsoR: 818,  // 躯干中柱左右边界（外侧即手臂）
  shoulderL: 630, shoulderR: 778, shoulderY: 214,
  legL: 668, legR: 742,   // 左右腿中线附近
  armBottom: 392,     // 手臂（含手套）到此为止，再往下的宽出部分是裙摆=躯干
};

(async () => {
  const img = await loadImage(SRC);
  const W = img.width, H = img.height;
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const src = ctx.getImageData(0, 0, W, H);
  const D = src.data;
  const fg = (x, y) => { const i = (y * W + x) * 4; const r = D[i], g = D[i + 1], b = D[i + 2], a = D[i + 3]; return a > 20 && !(r > 238 && g > 238 && b > 238); };

  // 区域判定：返回部件名
  function region(x, y) {
    if (!fg(x, y)) return null;
    if (y < P.neckY) return 'head';
    if (y < P.splitY) {
      if (y < P.armBottom && (x < P.torsoL || x > P.torsoR)) return x < P.torsoL ? 'arm_l' : 'arm_r';
      return 'torso';   // 中柱 + 手臂以下的裙摆
    }
    return x < P.cx ? 'leg_l' : 'leg_r';
  }

  const PARTS = ['head', 'arm_l', 'arm_r', 'torso', 'leg_l', 'leg_r'];
  // 各部件 bbox
  const box = {}; PARTS.forEach(p => box[p] = { x0: W, y0: H, x1: 0, y1: 0, n: 0 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = region(x, y); if (!r) continue;
    const b = box[r]; b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); b.n++;
  }

  // —— 分区预览（每区染色）——
  const segC = { head: '#ffd166', arm_l: '#06d6a0', arm_r: '#118ab2', torso: '#ef476f', leg_l: '#b06bff', leg_r: '#ff6b9d' };
  const prev = createCanvas(W, H), pctx = prev.getContext('2d');
  pctx.fillStyle = '#10141c'; pctx.fillRect(0, 0, W, H);
  const pim = pctx.getImageData(0, 0, W, H), PD = pim.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = region(x, y); if (!r) continue;
    const c = segC[r]; const i = (y * W + x) * 4;
    PD[i] = parseInt(c.slice(1, 3), 16); PD[i + 1] = parseInt(c.slice(3, 5), 16); PD[i + 2] = parseInt(c.slice(5, 7), 16); PD[i + 3] = 255;
  }
  pctx.putImageData(pim, 0, 0);
  // 画关节点
  pctx.fillStyle = '#fff';
  [[P.cx, P.neckY], [P.cx, P.splitY], [P.shoulderL, P.shoulderY], [P.shoulderR, P.shoulderY], [P.legL, P.splitY], [P.legR, P.splitY]].forEach(([x, y]) => { pctx.beginPath(); pctx.arc(x, y, 6, 0, 7); pctx.fill(); });
  fs.mkdirSync(path.join(OUT, 'preview'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'preview', 'lecliss_seg.png'), prev.toBuffer('image/png'));
  console.log('分区预览 → preview/lecliss_seg.png');
  PARTS.forEach(p => { const b = box[p]; console.log('  ' + p, b.n ? `bbox(${b.x0},${b.y0})-(${b.x1},${b.y1}) ${b.x1 - b.x0}x${b.y1 - b.y0} px=${b.n}` : '空'); });

  // —— 裁切各部件到独立画布 ——
  const crops = {};
  PARTS.forEach(p => {
    const b = box[p]; if (!b.n) return;
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    const pc = createCanvas(bw, bh), pcx = pc.getContext('2d');
    const im = pcx.createImageData(bw, bh), ID = im.data;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      if (region(x, y) !== p) continue;
      const si = (y * W + x) * 4, di = ((y - b.y0) * bw + (x - b.x0)) * 4;
      ID[di] = D[si]; ID[di + 1] = D[si + 1]; ID[di + 2] = D[si + 2]; ID[di + 3] = D[si + 3];
    }
    pcx.putImageData(im, 0, 0);
    crops[p] = { canvas: pc, ox: b.x0, oy: b.y0, w: bw, h: bh };
  });

  // —— 打图集 ——
  const PAD = 2; let ax = PAD, ay = PAD, rowH = 0; const ATLAS_W = 1024; const sub = [];
  PARTS.forEach(p => { const c = crops[p]; if (!c) return; if (ax + c.w + PAD > ATLAS_W) { ax = PAD; ay += rowH + PAD; rowH = 0; } c._ax = ax; c._ay = ay; rowH = Math.max(rowH, c.h); ax += c.w + PAD; sub.push({ name: p, x: c._ax, y: c._ay, width: c.w, height: c.h }); });
  const ATLAS_H = ay + rowH + PAD;
  const atlas = createCanvas(ATLAS_W, ATLAS_H), atx = atlas.getContext('2d');
  PARTS.forEach(p => { const c = crops[p]; if (!c) return; atx.drawImage(c.canvas, c._ax, c._ay); });
  fs.writeFileSync(path.join(OUT, NAME + '_tex.png'), atlas.toBuffer('image/png'));
  fs.writeFileSync(path.join(OUT, NAME + '_tex.json'), JSON.stringify({ name: NAME, imagePath: NAME + '_tex.png', SubTexture: sub }, null, 2));

  // —— 关节（图像绝对坐标）→ 骨骼 + 锚点 ——
  const J = {
    hip: [P.cx, P.splitY], neck: [P.cx, P.neckY],
    shoulder_l: [P.shoulderL, P.shoulderY], shoulder_r: [P.shoulderR, P.shoulderY],
    leg_l: [P.legL, P.splitY], leg_r: [P.legR, P.splitY],
  };
  const anchor = (p, jx, jy) => { const c = crops[p]; return { x: jx - c.ox, y: jy - c.oy }; };
  const bone = (name, parent, jx, jy, pjx, pjy) => ({ name, parent, transform: { x: jx - pjx, y: jy - pjy } });
  const bones = [
    { name: 'root', parent: null, transform: { x: 0, y: 0 } },
    bone('hip', 'root', J.hip[0], J.hip[1], J.hip[0], J.hip[1]),         // (0,0)
    bone('torso', 'hip', J.hip[0], J.hip[1], J.hip[0], J.hip[1]),        // 躯干绕髋旋转
    bone('head', 'torso', J.neck[0], J.neck[1], J.hip[0], J.hip[1]),
    bone('shoulder_l', 'torso', J.shoulder_l[0], J.shoulder_l[1], J.hip[0], J.hip[1]),
    bone('shoulder_r', 'torso', J.shoulder_r[0], J.shoulder_r[1], J.hip[0], J.hip[1]),
    bone('thigh_l', 'hip', J.leg_l[0], J.leg_l[1], J.hip[0], J.hip[1]),
    bone('thigh_r', 'hip', J.leg_r[0], J.leg_r[1], J.hip[0], J.hip[1]),
  ];
  const slotDef = [
    ['leg_l', 'thigh_l', 1], ['leg_r', 'thigh_r', 1],
    ['arm_l', 'shoulder_l', 2], ['arm_r', 'shoulder_r', 2],
    ['torso', 'torso', 4], ['head', 'head', 6],
  ];
  const slots = slotDef.map(([name, parent, z]) => ({ name, parent, z }));
  const skinSlots = slotDef.map(([name]) => {
    const j = name === 'head' ? J.neck : name === 'torso' ? J.hip : name === 'arm_l' ? J.shoulder_l : name === 'arm_r' ? J.shoulder_r : name === 'leg_l' ? J.leg_l : J.leg_r;
    const a = anchor(name, j[0], j[1]);
    return { name, display: [{ name, transform: { x: a.x, y: a.y } }] };
  });

  const rf = (...fr) => fr.map(([d, r]) => ({ duration: d, tweenEasing: 0, rotate: r }));
  const idle = { name: 'idle', playTimes: 0, duration: 60, bone: [
    { name: 'torso', rotateFrame: rf([30, 1.6], [30, -1.6]) },
    { name: 'head', rotateFrame: rf([30, -1], [30, 1]) },
    { name: 'shoulder_l', rotateFrame: rf([30, 2.5], [30, -2.5]) },
    { name: 'shoulder_r', rotateFrame: rf([30, -2.5], [30, 2.5]) },
  ] };
  // 攻击：前倾蓄力 + 右臂适度上抬（控制在小幅度，避免切件接缝外露）
  const attack = { name: 'attack_normal', playTimes: 1, duration: 21, bone: [
    { name: 'torso', rotateFrame: rf([5, -3], [4, 7], [6, 4], [6, 0]) },
    { name: 'shoulder_r', rotateFrame: rf([5, -14], [4, -42], [6, -20], [6, 0]) },
    { name: 'shoulder_l', rotateFrame: rf([5, 8], [4, 16], [6, 6], [6, 0]) },
    { name: 'thigh_r', rotateFrame: rf([5, 0], [4, -8], [6, -4], [6, 0]) },
    { name: 'head', rotateFrame: rf([5, 2], [4, -3], [6, -1], [6, 0]) },
  ] };
  const walk = { name: 'walk', playTimes: 0, duration: 36, bone: [
    { name: 'thigh_l', rotateFrame: rf([9, 9], [9, 0], [9, -9], [9, 0]) },
    { name: 'thigh_r', rotateFrame: rf([9, -9], [9, 0], [9, 9], [9, 0]) },
    { name: 'shoulder_l', rotateFrame: rf([9, -6], [9, 0], [9, 6], [9, 0]) },
    { name: 'shoulder_r', rotateFrame: rf([9, 6], [9, 0], [9, -6], [9, 0]) },
    { name: 'torso', rotateFrame: rf([9, 1], [9, 0], [9, -1], [9, 0]) },
    { name: 'head', rotateFrame: rf([9, -0.8], [9, 0], [9, 0.8], [9, 0]) },
  ] };

  const ske = { frameRate: 24, name: NAME, version: '5.5', armature: [{ name: 'char', frameRate: 24, bone: bones, slot: slots, skin: [{ slot: skinSlots }], animation: [idle, attack, walk], defaultActions: [{ gotoAndPlay: 'idle' }] }] };
  fs.writeFileSync(path.join(OUT, NAME + '_ske.json'), JSON.stringify(ske, null, 2));
  console.log('已生成 lecliss 骨骼：图集', ATLAS_W + 'x' + ATLAS_H, '部件', sub.length);
})();
