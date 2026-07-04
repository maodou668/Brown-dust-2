// 烛河村 v4 摆放定义（施工图配套 · 效果图/引擎共用一份坐标）
// 原则: 北排四栋脚线齐(y8.4-8.8) 门全朝南 | 广场正中村长家对轴 | 路网横平竖直 | 南片农家自成院坝
const T = 'art/06_story/tiles/';
const P = 'art/06_story/props/';
const R = rs => { const a = Array(45).fill('0'); for (const [s, e] of rs) for (let i = s; i <= e; i++) a[i] = '1'; return a.join(''); };
const rep = (n, f) => Array.from({ length: n }, f);
const roadGrid = [
  ...rep(8, () => R([])),
  R([[3, 41]]),                                  // 北后巷 (r8)
  R([[3, 41]]),
  ...rep(4, () => R([[6, 8], [17, 28], [37, 39]])),  // 西巷+广场+磨坊支路 (r10-13)
  ...rep(3, () => R([[0, 42]])),                 // 主路 tiles14-15 (r14-16)
  ...rep(6, () => R([[14, 16]])),                // 南巷 (r17-22)
  ...rep(4, () => R([])),
];
module.exports = { stage: {
  pxScale: 2, actorScale: 1,
  mute: 0.15, gloom: 'rgb(203,214,203)', tone: 'rgba(60,95,80,.07)', vignette: 0.26,
  cam: { x: 50, y: 50 },
  parts: [
    { type: 'smoke', x: 20.8, y: 2.7 },
    { type: 'smoke', x: 19.5, y: 16.5 },
    { type: 'leaves', n: 10 },
  ],
  map: {
    tile: 32,
    layers: [
      { sheet: T + 'grass_var.png', fullVar: [
        [0,0],[0,0],[0,0],[32,0],[0,0],[64,0],[0,0],[0,0],[96,0],[0,0],[128,0],[0,0],[0,0],[160,0],[0,0],[32,0],
      ] },
      { sheet: T + 'road_grass.png', lut: T + 'road_grass.lut.json', grid: roadGrid },
    ],
  },
  props: [
    // ---- 北排四栋(脚线齐 y8.4-8.8, 门全朝南开向后巷) ----
    { img: P + 'house_stone_a.png',  x: 7,    y: 8.4, s: 0.8 },
    { img: P + 'firewood.png',       x: 9.8,  y: 8.2, s: 0.5 },
    { img: P + 'crate_barrel.png',   x: 4.4,  y: 8.3, s: 0.38 },
    // 坟场(石屋与村长家之间, 枯树把守)
    { img: P + 'tree_dead.png',      x: 12,   y: 5.4, s: 0.6 },
    { img: P + 'graves.png',         x: 13.8, y: 6.8, s: 0.55 },
    { img: P + 'tree_dead.png',      x: 15.6, y: 5.8, s: 0.5 },
    { img: P + 'fence_rail.png',     x: 12.6, y: 7.8, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 14.8, y: 7.8, s: 0.28 },
    // 村长家(正对广场中轴 x22)
    { img: P + 'house_timber_a.png', x: 22,   y: 8.6, s: 0.9 },
    { img: P + 'firewood.png',       x: 18.4, y: 8.4, s: 0.5 },
    { img: P + 'tree_oak.png',       x: 26.2, y: 6.8, s: 0.55 },
    // 木屋B
    { img: P + 'house_timber_b.png', x: 30.5, y: 8.4, s: 0.8 },
    { img: P + 'crate_barrel.png',   x: 33.6, y: 8.2, s: 0.4 },
    // 磨坊(溪东位, 支路引导)
    { img: P + 'windmill_new.png',   x: 37.8, y: 8.8, s: 1.05 },
    { img: P + 'crate_barrel.png',   x: 36,   y: 12.0, s: 0.4 },
    // ---- 广场家具(对称) ----
    { img: P + 'well.png',           x: 24.5, y: 11.8, s: 0.38 },
    { img: P + 'lantern.png',        x: 18,   y: 9.8,  s: 0.45, glow: { r: 2.6 } },
    { img: P + 'lantern.png',        x: 26.5, y: 9.8,  s: 0.45, glow: { r: 2.6 } },
    { img: P + 'crate_barrel.png',   x: 27.6, y: 12.6, s: 0.4 },
    // ---- 主路北缘栅栏(规整成对, 广场两侧) ----
    { img: P + 'fence_rail.png',     x: 10.2, y: 13.85, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 11.8, y: 13.85, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 30.6, y: 13.85, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 32.2, y: 13.85, s: 0.28 },
    // ---- 南片·农家院坝(贫户屋+鸡圈, 北缘围栏留西口接南巷) ----
    { img: P + 'house_poor_c.png',   x: 18.7, y: 21.2, s: 0.75 },
    { img: P + 'chicken_coop.png',   x: 24.2, y: 21,   s: 0.75 },
    { img: P + 'fence_rail.png',     x: 20,   y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 21.6, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 23.2, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 24.8, y: 16.9, s: 0.28 },
    // ---- 西南·牧栏(空场, 上下两排围栏) ----
    { img: P + 'fence_rail.png',     x: 4.1,  y: 17.0, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 5.7,  y: 17.0, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 7.3,  y: 17.0, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 8.9,  y: 17.0, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 4.1,  y: 22.2, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 5.7,  y: 22.2, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 7.3,  y: 22.2, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 8.9,  y: 22.2, s: 0.28 },
    { img: P + 'hay_cart.png',       x: 6.5,  y: 19.8, s: 0.5 },
    // ---- 树线收边 ----
    { img: P + 'tree_oak.png',  x: 3,    y: 2.2, s: 0.7 },
    { img: P + 'tree_dead.png', x: 8,    y: 1.8, s: 0.6 },
    { img: P + 'tree_oak.png',  x: 13,   y: 2.5, s: 0.65 },
    { img: P + 'tree_oak.png',  x: 33.5, y: 2.3, s: 0.6 },
    { img: P + 'tree_dead.png', x: 35.8, y: 1.7, s: 0.55 },
    { img: P + 'tree_oak.png',  x: 1,    y: 7,   s: 0.7 },
    { img: P + 'tree_dead.png', x: 1.5,  y: 12,  s: 0.55 },
    { img: P + 'tree_oak.png',  x: 1,    y: 19,  s: 0.75 },
    { img: P + 'tree_oak.png',  x: 43,   y: 6,   s: 0.7 },
    { img: P + 'tree_dead.png', x: 43.5, y: 11,  s: 0.6 },
    { img: P + 'tree_oak.png',  x: 42.8, y: 17.5, s: 0.68 },
    { img: P + 'tree_oak.png',  x: 43.4, y: 22,  s: 0.78 },
    { img: P + 'tree_oak.png',  x: 3,    y: 24.6, s: 0.85 },
    { img: P + 'tree_dead.png', x: 6.3,  y: 23.6, s: 0.6 },
    { img: P + 'tree_oak.png',  x: 9,    y: 25.2, s: 0.75 },
    { img: P + 'tree_oak.png',  x: 18,   y: 24.2, s: 0.8 },
    { img: P + 'tree_oak.png',  x: 21,   y: 25.6, s: 0.9 },
    { img: P + 'tree_dead.png', x: 28.6, y: 23.8, s: 0.66 },
    { img: P + 'tree_oak.png',  x: 31.8, y: 25.2, s: 0.7 },
    { img: P + 'tree_oak.png',  x: 31,   y: 23.9, s: 0.82 },
    { img: P + 'tree_dead.png', x: 34,   y: 25.4, s: 0.6 },
    { img: P + 'tree_oak.png',  x: 37,   y: 24.3, s: 0.75 },
    { img: P + 'tree_oak.png',  x: 40.5, y: 25.6, s: 0.88 },
    { img: P + 'tree_oak.png',  x: 42,   y: 23.4, s: 0.7 },
    // 散石
    { img: P + 'rocks.png', x: 12.5, y: 18.8, s: 0.28 },
    { img: P + 'rocks.png', x: 35,   y: 18.5, s: 0.3 },
    { img: P + 'rocks.png', x: 29,   y: 6,    s: 0.3 },
  ],
} };
