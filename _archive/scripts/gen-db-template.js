// 程序化生成「占位骨骼」——赛璐璐两阶上色人形 + 标准骨架 + idle/attack 动画
// 输出 DragonBones 格式：*_ske.json / *_tex.json / *_tex.png（构建期可用 @napi-rs/canvas）
// 真立绘到位后：按同一套骨架命名重切图集换皮即可，动画/运行时不变。
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const OUT = path.resolve(__dirname, '..', 'art', '02_dragonbones');
const NAME = 'char_template';
fs.mkdirSync(OUT, { recursive: true });

// ---- 赛璐璐配色（火属性 · 绯红/黑 · 深发）----
const C = {
  skin: '#f4d0aa', skinS: '#dba884',
  hair: '#2c2333', hairS: '#1a1320',
  dress: '#b3252f', dressS: '#7c1620',
  flame: '#ff7a3c',
  dark: '#2a2030', darkS: '#181018',
  boot: '#b3252f', bootS: '#7c1620',
  line: '#241a2e',
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// 两阶赛璐璐部件：底色 + 右下硬边暗部 + 描边
function celShape(ctx, w, h, base, shadow, round) {
  const r = round != null ? round : Math.min(w, h) * 0.4;
  rr(ctx, 1, 1, w - 2, h - 2, r); ctx.fillStyle = base; ctx.fill();
  ctx.save(); rr(ctx, 1, 1, w - 2, h - 2, r); ctx.clip();
  ctx.fillStyle = shadow; ctx.beginPath();
  ctx.moveTo(w * 0.58, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w * 0.42, h); ctx.closePath(); ctx.fill();
  ctx.restore();
  rr(ctx, 1, 1, w - 2, h - 2, r); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
}

// ---- 部件清单（唯一图块，l/r 共用）----
const parts = [
  { name: 'hair_b', w: 76, h: 92, ax: 38, ay: 64, draw(ctx, w, h) {
      ctx.beginPath(); ctx.moveTo(w * 0.5, 2);
      ctx.bezierCurveTo(w, h * 0.1, w * 1.02, h * 0.9, w * 0.72, h - 2);
      ctx.lineTo(w * 0.28, h - 2);
      ctx.bezierCurveTo(-w * 0.02, h * 0.9, 0, h * 0.1, w * 0.5, 2); ctx.closePath();
      ctx.fillStyle = C.hair; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = C.hairS;
      ctx.fillRect(w * 0.5, 0, w * 0.5, h); ctx.restore();
      ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    } },
  { name: 'head', w: 56, h: 60, ax: 28, ay: 56, draw(ctx, w, h) {
      // 脸
      ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.skin; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = C.skinS; ctx.fillRect(w * 0.6, 0, w, h); ctx.restore();
      ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
      // 眼
      ctx.fillStyle = '#3a2630';
      ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.5, 3.4, 5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.64, h * 0.5, 3.4, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = C.flame;
      ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.46, 1.4, 2, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.64, h * 0.46, 1.4, 2, 0, 0, 7); ctx.fill();
      // 口
      ctx.strokeStyle = '#9a4040'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(w * 0.45, h * 0.72); ctx.lineTo(w * 0.55, h * 0.72); ctx.stroke();
    } },
  { name: 'hair_f', w: 60, h: 38, ax: 30, ay: 30, draw(ctx, w, h) {
      ctx.beginPath(); ctx.moveTo(2, h * 0.3);
      ctx.lineTo(w * 0.3, h - 2); ctx.lineTo(w * 0.45, h * 0.4);
      ctx.lineTo(w * 0.6, h - 2); ctx.lineTo(w * 0.8, h * 0.45);
      ctx.lineTo(w - 2, h - 4); ctx.lineTo(w - 4, 4); ctx.lineTo(4, 6); ctx.closePath();
      ctx.fillStyle = C.hair; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = C.hairS; ctx.fillRect(w * 0.55, 0, w, h); ctx.restore();
      ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    } },
  { name: 'torso', w: 70, h: 104, ax: 35, ay: 8, draw(ctx, w, h) {
      // 连衣裙：上窄下宽
      ctx.beginPath();
      ctx.moveTo(w * 0.26, 4); ctx.lineTo(w * 0.74, 4);
      ctx.lineTo(w * 0.92, h - 4); ctx.lineTo(w * 0.08, h - 4); ctx.closePath();
      ctx.fillStyle = C.dress; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = C.dressS;
      ctx.beginPath(); ctx.moveTo(w * 0.55, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w * 0.42, h); ctx.closePath(); ctx.fill();
      // 火焰裙摆
      ctx.fillStyle = C.flame; ctx.fillRect(0, h - 16, w, 8); ctx.restore();
      ctx.beginPath();
      ctx.moveTo(w * 0.26, 4); ctx.lineTo(w * 0.74, 4);
      ctx.lineTo(w * 0.92, h - 4); ctx.lineTo(w * 0.08, h - 4); ctx.closePath();
      ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
      // 领口
      ctx.fillStyle = C.dark; ctx.beginPath();
      ctx.moveTo(w * 0.4, 4); ctx.lineTo(w * 0.6, 4); ctx.lineTo(w * 0.5, 16); ctx.closePath(); ctx.fill();
    } },
  { name: 'arm_up', w: 22, h: 56, ax: 11, ay: 7, draw(ctx, w, h) { celShape(ctx, w, h, C.skin, C.skinS, 10); } },
  { name: 'arm_fore', w: 20, h: 52, ax: 10, ay: 5, draw(ctx, w, h) { celShape(ctx, w, h, C.skin, C.skinS, 9); } },
  { name: 'hand', w: 22, h: 22, ax: 11, ay: 5, draw(ctx, w, h) { celShape(ctx, w, h, C.skin, C.skinS, 9); } },
  { name: 'thigh', w: 26, h: 70, ax: 13, ay: 7, draw(ctx, w, h) { celShape(ctx, w, h, C.dark, C.darkS, 11); } },
  { name: 'shin', w: 22, h: 64, ax: 11, ay: 5, draw(ctx, w, h) { celShape(ctx, w, h, C.dark, C.darkS, 9); } },
  { name: 'foot', w: 30, h: 24, ax: 13, ay: 5, draw(ctx, w, h) {
      ctx.beginPath(); rr(ctx, 1, 1, w - 2, h - 2, 8); ctx.fillStyle = C.boot; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = C.bootS; ctx.fillRect(0, h * 0.5, w, h); ctx.restore();
      rr(ctx, 1, 1, w - 2, h - 2, 8); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    } },
];

// ---- 打包图集（货架式）----
const PAD = 2, ATLAS_W = 256;
let cx = PAD, cy = PAD, rowH = 0;
const sub = [];
parts.forEach(p => {
  if (cx + p.w + PAD > ATLAS_W) { cx = PAD; cy += rowH + PAD; rowH = 0; }
  p._x = cx; p._y = cy; rowH = Math.max(rowH, p.h); cx += p.w + PAD;
  sub.push({ name: p.name, x: p._x, y: p._y, width: p.w, height: p.h });
});
const ATLAS_H = cy + rowH + PAD;
const atlas = createCanvas(ATLAS_W, ATLAS_H);
const actx = atlas.getContext('2d');
parts.forEach(p => {
  actx.save(); actx.translate(p._x, p._y);
  actx.beginPath(); actx.rect(0, 0, p.w, p.h); actx.clip();
  p.draw(actx, p.w, p.h); actx.restore();
});
fs.writeFileSync(path.join(OUT, NAME + '_tex.png'), atlas.toBuffer('image/png'));

// ---- tex.json ----
const texJson = { name: NAME, imagePath: NAME + '_tex.png', SubTexture: sub };
fs.writeFileSync(path.join(OUT, NAME + '_tex.json'), JSON.stringify(texJson, null, 2));

// ---- ske.json（标准骨架 + 动画）----
const bone = (name, parent, x, y) => ({ name, parent, transform: { x: x || 0, y: y || 0 } });
const bones = [
  bone('root', null, 0, 0),
  bone('hip', 'root', 0, 0),
  bone('spine', 'hip', 0, -28),
  bone('chest', 'spine', 0, -42),
  bone('neck', 'chest', 0, -22),
  bone('head', 'neck', 0, -16),
  bone('hair_b', 'head', 0, 0),
  bone('hair_f', 'head', 0, 0),
  bone('shoulder_l', 'chest', -30, -6), bone('arm_l_up', 'shoulder_l', 0, 0), bone('arm_l_fore', 'arm_l_up', 0, 50), bone('hand_l', 'arm_l_fore', 0, 46),
  bone('shoulder_r', 'chest', 30, -6), bone('arm_r_up', 'shoulder_r', 0, 0), bone('arm_r_fore', 'arm_r_up', 0, 50), bone('hand_r', 'arm_r_fore', 0, 46),
  bone('thigh_l', 'hip', -15, 6), bone('shin_l', 'thigh_l', 0, 64), bone('foot_l', 'shin_l', 0, 60),
  bone('thigh_r', 'hip', 15, 6), bone('shin_r', 'thigh_r', 0, 64), bone('foot_r', 'shin_r', 0, 60),
];
// 插槽（z 决定前后）
const slotDef = [
  ['hair_b', 'hair_b', 0], ['thigh_l', 'thigh_l', 2], ['thigh_r', 'thigh_r', 2],
  ['shin_l', 'shin_l', 3], ['shin_r', 'shin_r', 3], ['foot_l', 'foot_l', 4], ['foot_r', 'foot_r', 4],
  ['torso', 'chest', 6],
  ['arm_l_up', 'arm_l_up', 7], ['arm_r_up', 'arm_r_up', 7],
  ['arm_l_fore', 'arm_l_fore', 8], ['arm_r_fore', 'arm_r_fore', 8],
  ['hand_l', 'hand_l', 9], ['hand_r', 'hand_r', 9],
  ['head', 'head', 12], ['hair_f', 'hair_f', 13],
];
const slots = slotDef.map(([name, parent, z]) => ({ name, parent, z }));
// 蒙皮：插槽 → 图块 + 锚点（图块共用：l/r 同图）
const texOf = { hair_b: 'hair_b', head: 'head', hair_f: 'hair_f', torso: 'torso',
  arm_l_up: 'arm_up', arm_r_up: 'arm_up', arm_l_fore: 'arm_fore', arm_r_fore: 'arm_fore',
  hand_l: 'hand', hand_r: 'hand', thigh_l: 'thigh', thigh_r: 'thigh', shin_l: 'shin', shin_r: 'shin',
  foot_l: 'foot', foot_r: 'foot' };
const anchorOf = {}; parts.forEach(p => anchorOf[p.name] = { ax: p.ax, ay: p.ay });
const skinSlots = slotDef.map(([name]) => {
  const tx = texOf[name], a = anchorOf[tx];
  return { name, display: [{ name: tx, transform: { x: a.ax, y: a.ay } }] };
});

// 动画帧助手
const rf = (...fr) => fr.map(([d, r]) => ({ duration: d, tweenEasing: 0, rotate: r }));
const idle = {
  name: 'idle', playTimes: 0, duration: 48,
  bone: [
    { name: 'chest', rotateFrame: rf([24, 2], [24, -2]) },
    { name: 'head', rotateFrame: rf([24, -1.5], [24, 1.5]) },
    { name: 'hair_b', rotateFrame: rf([24, 3], [24, -3]) },
    { name: 'hair_f', rotateFrame: rf([24, 1.5], [24, -1.5]) },
    { name: 'arm_l_up', rotateFrame: rf([24, 3], [24, -3]) },
    { name: 'arm_r_up', rotateFrame: rf([24, -3], [24, 3]) },
  ],
};
const attack = {
  name: 'attack_normal', playTimes: 1, duration: 18,
  bone: [
    { name: 'chest', rotateFrame: rf([6, -6], [6, 12], [6, 0]) },
    { name: 'arm_r_up', rotateFrame: rf([6, 36], [6, -116], [6, 0]) },
    { name: 'arm_r_fore', rotateFrame: rf([6, 24], [6, -36], [6, 0]) },
    { name: 'arm_l_up', rotateFrame: rf([6, -10], [6, 20], [6, 0]) },
    { name: 'thigh_r', rotateFrame: rf([6, 0], [6, -14], [6, 0]) },
  ],
};
const walk = {
  name: 'walk', playTimes: 0, duration: 32,
  bone: [
    { name: 'thigh_l', rotateFrame: rf([8, 24], [8, 0], [8, -24], [8, 0]) },
    { name: 'shin_l', rotateFrame: rf([8, 0], [8, 28], [8, 10], [8, 0]) },
    { name: 'thigh_r', rotateFrame: rf([8, -24], [8, 0], [8, 24], [8, 0]) },
    { name: 'shin_r', rotateFrame: rf([8, 10], [8, 0], [8, 0], [8, 28]) },
    { name: 'arm_l_up', rotateFrame: rf([8, -18], [8, 0], [8, 18], [8, 0]) },
    { name: 'arm_r_up', rotateFrame: rf([8, 18], [8, 0], [8, -18], [8, 0]) },
    { name: 'chest', rotateFrame: rf([8, 1.5], [8, 0], [8, -1.5], [8, 0]) },
  ],
};

const ske = {
  frameRate: 24, name: NAME, version: '5.5', armature: [{
    name: 'char', frameRate: 24,
    bone: bones, slot: slots, skin: [{ slot: skinSlots }],
    animation: [idle, attack, walk],
    defaultActions: [{ gotoAndPlay: 'idle' }],
  }],
};
fs.writeFileSync(path.join(OUT, NAME + '_ske.json'), JSON.stringify(ske, null, 2));

console.log('已生成占位骨骼：', NAME);
console.log('  图集', ATLAS_W + 'x' + ATLAS_H, '部件', parts.length, '插槽', slots.length, '动画', ske.armature[0].animation.length);
