// 烛河村 v8 · 崔斯特姆化: 蜿蜒窄路/弯溪/错落摆放/林团/连续围墙 (确定性伪随机, 无Math.random)
const T2 = 'art/06_story/tiles_v2/';
const P = 'art/06_story/props/';
const COLS = 53, ROWS = 27;   // 角点
const h1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mk = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const stamp = (g, x, y, w = 1) => {
  for (let dy = 0; dy <= w; dy++) for (let dx = 0; dx <= w; dx++) {
    const yy = Math.round(y) + dy, xx = Math.round(x) + dx;
    if (yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS) g[yy][xx] = 1;
  }
};
// 蜿蜒小道: 从A到B, 垂直方向抖动
const carve = (g, x0, y0, x1, y1, seed, w = 1, amp = 1.2) => {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const j = (h1(seed + i * 0.37) - 0.5) * 2 * amp;
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) y += j; else x += j;
    stamp(g, x, y, w);
  }
};
const gridStr = g => g.map(r => r.join(''));

// ---- 溪(蜿蜒 2-3宽) ----
const water = mk();
for (let y = 0; y <= ROWS - 1; y++) {
  const cx = 39 + Math.round(1.8 * Math.sin(y * 0.42) + 0.9 * Math.sin(y * 1.31));
  for (let x = cx - 1; x <= cx + 1; x++) stamp(water, x, y, 0);
  stamp(water, cx, y, 1);
}
// ---- 路网(窄道蜿蜒) ----
const mud = mk();
carve(mud, 1, 15.5, 20, 15.2, 7, 1, 1.0);        // 村口→广场南缘
carve(mud, 25, 15.2, 37.5, 15.4, 17, 1, 1.0);    // 广场→桥头
carve(mud, 41.5, 15.4, 45, 15.2, 27, 1, 0.6);    // 东岸
carve(mud, 45, 15, 45, 9.5, 37, 1, 0.6);         // 坡道竖段
carve(mud, 45, 9, 49.5, 8.6, 47, 1, 0.5);        // 坡顶到磨坊
carve(mud, 5, 8.8, 35.5, 8.4, 57, 1, 0.9);       // 北后巷(1宽)
carve(mud, 15, 15.5, 15, 21.5, 67, 1, 0.5);      // 南巷(1宽)
carve(mud, 21.5, 12.8, 21.5, 15.2, 77, 1, 0.3);  // 广场→主路
// 各家门前小股(1宽,门在grid东)
carve(mud, 9.3, 8.3, 10.5, 8.8, 87, 1, 0.2);
carve(mud, 24.6, 8.6, 25.5, 10.8, 97, 1, 0.3);
carve(mud, 31.2, 8.2, 32, 8.6, 107, 1, 0.2);
carve(mud, 37.2, 8.6, 37.8, 9.2, 117, 1, 0.2);
carve(mud, 13.4, 20.8, 15, 20.8, 127, 1, 0.2);
carve(mud, 20.4, 21.4, 21.5, 20.6, 137, 1, 0.2);
carve(mud, 33.4, 21.6, 34.5, 19.5, 147, 1, 0.2);
// 院坝(贫户屋门前小片)
for (let y = 18; y <= 21; y++) for (let x = 21; x <= 23; x++) stamp(mud, x, y, 0);
// ---- 小广场(苔石板 8x4 + 村长家门前伸出) ----
const flag = mk();
for (let y = 11; y <= 14; y++) for (let x = 17; x <= 25; x++) stamp(flag, x, y, 0);
for (let y = 8; y <= 11; y++) for (let x = 23; x <= 26; x++) stamp(flag, x, y, 0);
// ---- 枯田(田块 + 散布斑块) ----
const dead = mk();
for (let y = 18; y <= 21; y++) for (let x = 5, e = 9; x <= e; x++) stamp(dead, x, y, 0);
for (let i = 0; i < 9; i++) {
  const px = 3 + Math.floor(h1(i * 3.1) * 33), py = 2 + Math.floor(h1(i * 7.7) * 22);
  if (px > 16 && px < 29 && py > 9 && py < 16) continue;   // 避开广场
  stamp(dead, px, py, 1 + (i % 2));
}
module.exports = { stage: {
  pxScale: 2, actorScale: 1,
  mute: 0.22, gloom: 'rgb(186,198,194)', tone: 'rgba(36,56,64,.12)', vignette: 0.4,
  cam: { x: 50, y: 50 },
  parts: [
    { type: 'smoke', x: 20.3, y: 2.8 },
    { type: 'smoke', x: 18.3, y: 16.7 },
    { type: 'leaves', n: 6 },
  ],
  map: {
    tile: 32,
    layers: [
      { sheet: T2 + 'barren.png', fullVar: [[0, 96]] },
      { sheet: T2 + 'water_b.png',     lut: T2 + 'water_b.lut.json',     grid: gridStr(water) },
      { sheet: T2 + 'deadfield_b.png', lut: T2 + 'deadfield_b.lut.json', grid: gridStr(dead) },
      { sheet: T2 + 'barren.png',      lut: T2 + 'barren.lut.json',      grid: gridStr(mud) },
      { sheet: T2 + 'flagstone_b.png', lut: T2 + 'flagstone_b.lut.json', grid: gridStr(flag) },
    ],
  },
  props: (() => {
    const pr = [];
    const F = (x, y) => pr.push({ img: P + 'fence_rail.png', x, y, s: 0.28 });
    // 北排(错落脚线)
    pr.push({ img: P + 'house_stone_a.png',  x: 6.5,  y: 8.2, s: 0.8 });
    pr.push({ img: P + 'firewood.png',       x: 4.2,  y: 8.0, s: 0.5 });
    // 坟场(连续围墙圈)
    pr.push({ img: P + 'tree_dead.png', x: 11.6, y: 4.6, s: 0.62 });
    pr.push({ img: P + 'graves.png',    x: 13.6, y: 6.2, s: 0.55 });
    pr.push({ img: P + 'tree_dead.png', x: 15.4, y: 5.2, s: 0.5 });
    [11.4, 13.0, 14.6].forEach(x => F(x, 3.6));
    [11.4, 13.0, 14.6].forEach(x => F(x, 7.4));
    // 村长家(唯一活树)
    pr.push({ img: P + 'house_timber_a.png', x: 21.5, y: 8.8, s: 0.9 });
    pr.push({ img: P + 'firewood.png',       x: 18.1, y: 8.5, s: 0.5 });
    pr.push({ img: P + 'tree_oak.png',       x: 18.4, y: 6.2, s: 0.55 });
    [19.2, 20.8, 22.4].forEach(x => F(x, 2.8));
    pr.push({ img: P + 'house_timber_b.png', x: 28.5, y: 8.0, s: 0.8 });
    [27.2, 28.8].forEach(x => F(x, 4.0));
    pr.push({ img: P + 'house_d.png',        x: 34.5, y: 8.6, s: 0.8 });
    [33.2, 34.8].forEach(x => F(x, 4.7));
    pr.push({ img: P + 'crate_barrel.png',   x: 31.6, y: 8.1, s: 0.4 });
    // 小广场
    pr.push({ img: P + 'well.png',         x: 21.5, y: 12.6, s: 0.5 });
    pr.push({ img: P + 'lantern.png',      x: 18.4, y: 11.4, s: 0.45, glow: { r: 2.6 } });
    pr.push({ img: P + 'lantern.png',      x: 24.6, y: 11.4, s: 0.45, glow: { r: 2.6 } });
    pr.push({ img: P + 'crate_barrel.png', x: 24.9, y: 13.6, s: 0.4 });
    // 南片(错落)
    pr.push({ img: P + 'house_f.png',      x: 10.5, y: 20.6, s: 0.8 });
    pr.push({ img: P + 'house_poor_c.png', x: 17.5, y: 21.4, s: 0.75 });
    pr.push({ img: P + 'chicken_coop.png', x: 24,   y: 20.8, s: 0.75 });
    pr.push({ img: P + 'house_e.png',      x: 30.5, y: 21.6, s: 0.8 });
    [16.2, 17.8, 19.4].forEach(x => F(x, 17.6));
    [22.8, 24.4].forEach(x => F(x, 17.2));
    [29.2, 30.8].forEach(x => F(x, 18.0));
    // 牧栏+田(连续两沿)
    [4.1, 5.7, 7.3, 8.9].forEach(x => F(x, 17.4));
    [4.1, 5.7, 7.3, 8.9].forEach(x => F(x, 22.2));
    pr.push({ img: P + 'hay_cart.png', x: 6.5, y: 19.9, s: 0.5 });
    // 村栅门 + 桥
    pr.push({ img: P + 'village_gate.png', x: 2.2, y: 16.4, s: 0.8 });
    pr.push({ img: P + 'bridge_td.png',    x: 39.3, y: 16.4, s: 0.8, flat: true });
    // 磨坊(坡上)
    pr.push({ img: P + 'windmill_new.png', x: 47.5, y: 8.6, s: 1.05 });
    pr.push({ img: P + 'crate_barrel.png', x: 44.7, y: 9.3, s: 0.4 });
    // ---- 林团(四角+边缘, 崔斯特姆式黑压压) + 内部零星 ----
    const clump = (cx, cy, n, seed, rMax = 3.2) => {
      for (let i = 0; i < n; i++) {
        const a = h1(seed + i * 1.7) * 6.283, r = 0.8 + h1(seed + i * 2.9) * rMax;
        const x = cx + Math.cos(a) * r * 1.4, y = cy + Math.sin(a) * r;
        if (x < 0.8 || x > 51 || y < 0.8 || y > 25.6) continue;
        pr.push({ img: P + 'tree_dead.png', x: +x.toFixed(1), y: +y.toFixed(1), s: +(0.5 + h1(seed + i * 4.3) * 0.38).toFixed(2) });
      }
    };
    clump(2.5, 3, 7, 11); clump(7, 1.8, 6, 22);
    clump(33, 2, 6, 33); clump(36.5, 4.5, 5, 44);
    clump(1.8, 21, 6, 55); clump(2.2, 12, 4, 66);
    clump(12, 24.8, 7, 77); clump(27, 24.9, 6, 88);
    clump(35, 24.2, 5, 99);
    clump(44, 3.2, 6, 111); clump(50.5, 12.5, 6, 122); clump(47, 22.8, 7, 133); clump(42.5, 25, 5, 144);
    // 内部零星
    [[9.5, 12.6], [30.8, 12.2], [26.5, 6.2], [12.5, 18.2], [36.2, 18.6]].forEach(([x, y], i) =>
      pr.push({ img: P + 'tree_dead.png', x, y, s: +(0.5 + h1(i * 9.1) * 0.3).toFixed(2) }));
    // 溪边唯一另一棵活树
    pr.push({ img: P + 'tree_oak.png', x: 36.6, y: 23.2, s: 0.72 });
    return pr;
  })(),
} };
