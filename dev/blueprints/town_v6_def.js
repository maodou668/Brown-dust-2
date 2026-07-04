// 烛河村 v6 正式版(设定书全量): 52列x27行 | 溪流+坡上磨坊+村栅门+坟场+农家院坝+民房DEF
// 地面: sickgrass_d2 基底 | 路/院=湿泥(sickgrass lut) | 广场=flagstone_s | 田=deadfield_s | 溪=water_s
const T2 = 'art/06_story/tiles_v2/';
const P = 'art/06_story/props/';
const C = 53;   // 角点列数(52格宽)
const R = rs => { const a = Array(C).fill('0'); for (const [s, e] of rs) for (let i = s; i <= e && i < C; i++) a[i] = '1'; return a.join(''); };
const grid = segsOf => Array.from({ length: 27 }, (_, r) => R(segsOf(r)));
const waterGrid = grid(() => [[38, 41]]);                       // 溪: 贯穿南北
const farmGrid  = grid(r => (r >= 18 && r <= 21) ? [[5, 9]] : []);
const flagGrid  = grid(r => {
  const s = [];
  if (r >= 10 && r <= 14) s.push([17, 28]);
  if (r >= 7 && r <= 10) s.push([24, 27]);
  return s;
});
const mudGrid = grid(r => {
  const s = [];
  if (r === 8 || r === 9) s.push([3, 36]);                      // 北后巷
  if (r >= 10 && r <= 13) { s.push([9, 11]); s.push([33, 35]); } // 门前径x2
  if (r >= 14 && r <= 16) { s.push([0, 38]); s.push([41, 46]); } // 主路(溪处断开由桥接)+东岸段
  if (r >= 9 && r <= 14) s.push([44, 46]);                      // 坡道折返(竖段)
  if (r === 8 || r === 9) s.push([44, 50]);                     // 坡顶段到磨坊
  if (r >= 17 && r <= 22) { s.push([14, 16]); s.push([21, 24]); } // 南巷+农家院坝
  return s;
});
module.exports = { stage: {
  pxScale: 2, actorScale: 1,
  mute: 0.22, gloom: 'rgb(176,190,186)', tone: 'rgba(36,56,64,.12)', vignette: 0.4,
  cam: { x: 50, y: 50 },
  parts: [
    { type: 'smoke', x: 20.8, y: 2.6 },
    { type: 'smoke', x: 19.5, y: 16.5 },
    { type: 'leaves', n: 6 },
  ],
  map: {
    tile: 32,
    layers: [
      { sheet: T2 + 'barren.png', fullVar: [[0, 96]] },
      { sheet: T2 + 'water_b.png',     lut: T2 + 'water_b.lut.json',     grid: waterGrid },
      { sheet: T2 + 'deadfield_b.png', lut: T2 + 'deadfield_b.lut.json', grid: farmGrid },
      { sheet: T2 + 'barren.png', lut: T2 + 'barren.lut.json', grid: mudGrid },
      { sheet: T2 + 'flagstone_b.png', lut: T2 + 'flagstone_b.lut.json', grid: flagGrid },
    ],
  },
  props: [
    // ---- 村西口: 栅门(等距合身度待目检) ----
    { img: P + 'village_gate.png', x: 2.2, y: 16.4, s: 0.8 },
    // ---- 北排(门朝grid东): 石屋 | 坟场 | 村长家 | 木屋B | 民房D ----
    { img: P + 'house_stone_a.png',  x: 7,    y: 8.4, s: 0.8 },
    { img: P + 'firewood.png',       x: 4.6,  y: 8.2, s: 0.5 },
    { img: P + 'tree_dead.png',      x: 12,   y: 5.4, s: 0.6 },
    { img: P + 'graves.png',         x: 13.8, y: 6.8, s: 0.55 },
    { img: P + 'tree_dead.png',      x: 15.6, y: 5.8, s: 0.5 },
    { img: P + 'fence_rail.png',     x: 12.6, y: 7.8, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 14.8, y: 7.8, s: 0.28 },
    { img: P + 'house_timber_a.png', x: 22,   y: 8.6, s: 0.9 },
    { img: P + 'firewood.png',       x: 18.6, y: 8.3, s: 0.5 },
    { img: P + 'tree_oak.png',       x: 18.9, y: 6.4, s: 0.55 },
    { img: P + 'house_timber_b.png', x: 29.5, y: 8.4, s: 0.8 },
    { img: P + 'house_d.png',        x: 35,   y: 8.4, s: 0.8 },
    { img: P + 'crate_barrel.png',   x: 32.2, y: 8.2, s: 0.4 },
    // ---- 广场 ----
    { img: P + 'well.png',           x: 22.5, y: 12.2, s: 0.5 },
    { img: P + 'lantern.png',        x: 18,   y: 10.6, s: 0.45, glow: { r: 2.6 } },
    { img: P + 'lantern.png',        x: 27,   y: 10.6, s: 0.45, glow: { r: 2.6 } },
    { img: P + 'crate_barrel.png',   x: 27.6, y: 12.8, s: 0.4 },
    // ---- 南片: 民房F | 南巷 | 贫户屋 | 院坝 | 鸡圈 | 民房E ----
    { img: P + 'house_f.png',        x: 11,   y: 21.2, s: 0.8 },
    { img: P + 'house_poor_c.png',   x: 18.7, y: 21.2, s: 0.75 },
    { img: P + 'chicken_coop.png',   x: 25.8, y: 21,   s: 0.75 },
    { img: P + 'house_e.png',        x: 31.8, y: 21.2, s: 0.8 },
    { img: P + 'fence_rail.png',     x: 19.6, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 21.2, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 22.8, y: 16.9, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 24.4, y: 16.9, s: 0.28 },
    // ---- 牧栏+农田(西南) ----
    { img: P + 'fence_rail.png',     x: 4.1,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 5.7,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 7.3,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 8.9,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 4.1,  y: 22.2, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 5.7,  y: 22.2, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 7.3,  y: 22.2, s: 0.28 },
    { img: P + 'fence_rail.png',     x: 8.9,  y: 22.2, s: 0.28 },
    { img: P + 'hay_cart.png',       x: 6.5,  y: 19.8, s: 0.5 },
    // ---- 磨坊桥 + 坡上磨坊(溪东高地) ----
    { img: P + 'bridge_td.png',      x: 39.5, y: 16.2, s: 0.8, flat: true },
    { img: P + 'windmill_new.png',   x: 47.5, y: 8.6,  s: 1.05 },
    { img: P + 'crate_barrel.png',   x: 44.6, y: 9.4,  s: 0.4 },
    // ---- 每户外圈篱笆(横向件只围南北沿; 竖向栏杆=资产缺口) ----
    { img: P + 'fence_rail.png', x: 5.2,  y: 3.6, s: 0.28 },
    { img: P + 'fence_rail.png', x: 7.4,  y: 3.6, s: 0.28 },
    { img: P + 'fence_rail.png', x: 19.6, y: 2.6, s: 0.28 },
    { img: P + 'fence_rail.png', x: 21.8, y: 2.6, s: 0.28 },
    { img: P + 'fence_rail.png', x: 24,   y: 2.6, s: 0.28 },
    { img: P + 'fence_rail.png', x: 27.6, y: 4.1, s: 0.28 },
    { img: P + 'fence_rail.png', x: 29.8, y: 4.1, s: 0.28 },
    { img: P + 'fence_rail.png', x: 33.6, y: 4.6, s: 0.28 },
    { img: P + 'fence_rail.png', x: 35.8, y: 4.6, s: 0.28 },
    { img: P + 'fence_rail.png', x: 9.4,  y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png', x: 12.4, y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png', x: 9.4,  y: 22.2, s: 0.28 },
    { img: P + 'fence_rail.png', x: 12.4, y: 22.2, s: 0.28 },
    { img: P + 'fence_rail.png', x: 29.8, y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png', x: 33,   y: 17.4, s: 0.28 },
    { img: P + 'fence_rail.png', x: 29.8, y: 22.4, s: 0.28 },
    { img: P + 'fence_rail.png', x: 33,   y: 22.4, s: 0.28 },
    // ---- 林缘收边 ----
    { img: P + 'tree_dead.png',  x: 3,    y: 2.2, s: 0.7 },
    { img: P + 'tree_dead.png', x: 8,    y: 1.8, s: 0.6 },
    { img: P + 'tree_dead.png',  x: 13,   y: 2.5, s: 0.65 },
    { img: P + 'tree_dead.png',  x: 30,   y: 2.0, s: 0.62 },
    { img: P + 'tree_dead.png', x: 34,   y: 2.6, s: 0.55 },
    { img: P + 'tree_dead.png',  x: 1,    y: 7,   s: 0.7 },
    { img: P + 'tree_dead.png', x: 1.5,  y: 12,  s: 0.55 },
    { img: P + 'tree_dead.png',  x: 1,    y: 19,  s: 0.75 },
    { img: P + 'tree_dead.png',  x: 3,    y: 24.6, s: 0.85 },
    { img: P + 'tree_dead.png', x: 6.3,  y: 23.6, s: 0.6 },
    { img: P + 'tree_dead.png',  x: 9,    y: 25.2, s: 0.75 },
    { img: P + 'tree_dead.png',  x: 14,   y: 24.4, s: 0.8 },
    { img: P + 'tree_dead.png',  x: 28.6, y: 24.6, s: 0.66 },
    { img: P + 'tree_dead.png',  x: 34.5, y: 25.2, s: 0.7 },
    // 东岸坡地树(把磨坊围出孤立感)
    { img: P + 'tree_dead.png', x: 43.5, y: 3.2, s: 0.7 },
    { img: P + 'tree_dead.png',  x: 47,   y: 2.4, s: 0.65 },
    { img: P + 'tree_dead.png', x: 50.5, y: 5,   s: 0.72 },
    { img: P + 'tree_dead.png', x: 50.8, y: 12,  s: 0.6 },
    { img: P + 'tree_dead.png',  x: 49.5, y: 18,  s: 0.78 },
    { img: P + 'tree_dead.png', x: 47,   y: 22.5, s: 0.66 },
    { img: P + 'tree_oak.png',  x: 43,   y: 24.8, s: 0.8 },
  ],
} };
