// 烛河村 v5 等距版 = v4 地块拓扑 + 摆放语法§十(等距朝向: 每栋门脸(grid东)接门前径/院坝)
const T = 'art/06_story/tiles/';
const P = 'art/06_story/props/';
const R = rs => { const a = Array(45).fill('0'); for (const [s, e] of rs) for (let i = s; i <= e; i++) a[i] = '1'; return a.join(''); };
const rows = [];
for (let r = 0; r <= 26; r++) {
  const seg = [];
  if (r === 8 || r === 9) seg.push([3, 41]);                    // 北后巷
  if (r >= 7 && r <= 9) seg.push([24, 27]);                     // 村长家门前场(广场北伸到门口)
  if (r >= 10 && r <= 13) seg.push([9, 11]);                    // 石屋门前径(列)
  if (r >= 10 && r <= 13) seg.push([17, 28]);                   // 广场
  if (r >= 10 && r <= 13) seg.push([33, 35]);                   // 木屋B门前径(列)
  if (r >= 4 && r <= 9) seg.push([41, 43]);                     // 磨坊门前院(东缘)
  if (r >= 14 && r <= 16) seg.push([0, 43]);                    // 主路
  if (r >= 17 && r <= 22) seg.push([14, 16]);                   // 南巷
  if (r >= 17 && r <= 22) seg.push([21, 24]);                   // 农家院坝(贫户屋门前)
  rows.push(R(seg));
}
module.exports = { stage: {
  pxScale: 2, actorScale: 1,
  mute: 0.15, gloom: 'rgb(203,214,203)', tone: 'rgba(60,95,80,.07)', vignette: 0.26,
  cam: { x: 50, y: 50 },
  parts: [
    { type: 'smoke', x: 20.8, y: 2.6 },   // 村长家烟囱
    { type: 'smoke', x: 19.4, y: 16.5 },  // 贫户屋烟囱
    { type: 'leaves', n: 10 },
  ],
  map: {
    tile: 32,
    layers: [
      { sheet: T + 'grass_var.png', fullVar: [
        [0,0],[0,0],[0,0],[32,0],[0,0],[64,0],[0,0],[0,0],[96,0],[0,0],[128,0],[0,0],[0,0],[160,0],[0,0],[32,0],
      ] },
      { sheet: T + 'road_grass.png', lut: T + 'road_grass.lut.json', grid: rows },
    ],
  },
  props: [
    // ---- 北排四栋(脚线齐, 门脸grid东各接门前径) ----
    { img: P + 'house_stone_a.png',  x: 7,    y: 8.4, s: 0.8 },   // 门前径 x9-10
    { img: P + 'firewood.png',       x: 4.6,  y: 8.2, s: 0.5 },
    { img: P + 'tree_dead.png',      x: 12,   y: 5.4, s: 0.6 },   // 坟场
    { img: P + 'graves.png',         x: 13.8, y: 6.8, s: 0.55 },
    { img: P + 'tree_dead.png',      x: 15.6, y: 5.8, s: 0.5 },
    { img: P + 'fence_rail.png',     x: 12.6, y: 7.8, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 14.8, y: 7.8, s: 0.28 },
    { img: P + 'house_timber_a.png', x: 22,   y: 8.6, s: 0.9 },   // 门前场=广场北伸(x24-26,r7-9)
    { img: P + 'firewood.png',       x: 18.6, y: 8.3, s: 0.5 },
    { img: P + 'tree_oak.png',       x: 18.9, y: 6.4, s: 0.55 },  // 村长家院角果树
    { img: P + 'house_timber_b.png', x: 30.5, y: 8.4, s: 0.8 },   // 门前径 x33-34
    { img: P + 'crate_barrel.png',   x: 27.9, y: 8.2, s: 0.4 },
    { img: P + 'windmill_new.png',   x: 37.8, y: 8.8, s: 1.05 },  // 门前院 x41-42
    { img: P + 'crate_barrel.png',   x: 41.5, y: 9.6, s: 0.4 },
    // ---- 广场(井=锚, 灯柱对称, 东缘箱桶) ----
    { img: P + 'well.png',           x: 22.5, y: 12.2, s: 0.38 },
    { img: P + 'lantern.png',        x: 18,   y: 10.6, s: 0.45, glow: { r: 2.6 } },
    { img: P + 'lantern.png',        x: 27,   y: 10.6, s: 0.45, glow: { r: 2.6 } },
    { img: P + 'crate_barrel.png',   x: 27.6, y: 12.8, s: 0.4 },
    // ---- 南片·农家院坝(dirt院坝x21-23为贫户屋门前场; 围栏北缘留西口) ----
    { img: P + 'house_poor_c.png',   x: 18.7, y: 21.2, s: 0.75 },
    { img: P + 'chicken_coop.png',   x: 25.8, y: 21,   s: 0.75 },
    { img: P + 'fence_rail.png',     x: 19.6, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 21.2, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 22.8, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 24.4, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 19.6, y: 23.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 21.2, y: 23.4, s: 0.28 },
    // ---- 牧栏(西南, 上下缘围栏+干草车) ----
    { img: P + 'fence_rail.png',     x: 4.1,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 5.7,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 7.3,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 8.9,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 4.1,  y: 21.8, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 5.7,  y: 21.8, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 7.3,  y: 21.8, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 8.9,  y: 21.8, s: 0.28 },
    { img: P + 'hay_cart.png',       x: 6.5,  y: 19.8, s: 0.5 },
    // ---- 林缘收边带 ----
    { img: P + 'tree_oak.png',  x: 3,    y: 2.2, s: 0.7 },
    { img: P + 'tree_dead.png', x: 8,    y: 1.8, s: 0.6 },
    { img: P + 'tree_oak.png',  x: 13,   y: 2.5, s: 0.65 },
    { img: P + 'tree_oak.png',  x: 33.5, y: 2.3, s: 0.6 },
    { img: P + 'tree_dead.png', x: 35.8, y: 1.7, s: 0.55 },
    { img: P + 'tree_oak.png',  x: 1,    y: 7,   s: 0.7 },
    { img: P + 'tree_dead.png', x: 1.5,  y: 12,  s: 0.55 },
    { img: P + 'tree_oak.png',  x: 1,    y: 19,  s: 0.75 },
    { img: P + 'tree_oak.png',  x: 43,   y: 13,  s: 0.7 },
    { img: P + 'tree_oak.png',  x: 42.8, y: 17.5, s: 0.68 },
    { img: P + 'tree_oak.png',  x: 43.4, y: 22,  s: 0.78 },
    { img: P + 'tree_oak.png',  x: 3,    y: 24.6, s: 0.85 },
    { img: P + 'tree_dead.png', x: 6.3,  y: 23.6, s: 0.6 },
    { img: P + 'tree_oak.png',  x: 9,    y: 25.2, s: 0.75 },
    { img: P + 'tree_oak.png',  x: 14,   y: 24.4, s: 0.8 },
    { img: P + 'tree_oak.png',  x: 28.6, y: 24.2, s: 0.66 },
    { img: P + 'tree_oak.png',  x: 31.8, y: 25.2, s: 0.7 },
    { img: P + 'tree_oak.png',  x: 35,   y: 23.9, s: 0.82 },
    { img: P + 'tree_dead.png', x: 38,   y: 25.4, s: 0.6 },
    { img: P + 'tree_oak.png',  x: 41,   y: 24.3, s: 0.75 },
    { img: P + 'tree_oak.png',  x: 30.9, y: 5.9, s: 0.55 },   // 木屋B/磨坊户间隔断
  ],
} };
