// 瓦片选材预览A(明快系): v5布局 + 新瓦片分材质分层
const base = require('/home/user/Maodou/dev/blueprints/town5_def.js');
const TV = 'art/06_story/tiles_v2/';
const R = rs => { const a = Array(45).fill('0'); for (const [s, e] of rs) for (let i = s; i <= e; i++) a[i] = '1'; return a.join(''); };
const grid = segsOf => Array.from({ length: 27 }, (_, r) => R(segsOf(r)));
const farmGrid   = grid(r => (r >= 18 && r <= 21) ? [[5, 9]] : []);
const gravelGrid = grid(r => {
  const s = [];
  if (r >= 10 && r <= 13) { s.push([9, 11]); s.push([33, 35]); }
  if (r >= 4 && r <= 9) s.push([41, 43]);
  return s;
});
const cobbleGrid = grid(r => {
  const s = [];
  if (r >= 10 && r <= 13) s.push([17, 28]);
  if (r >= 7 && r <= 9) s.push([24, 27]);
  return s;
});
const dirtGrid = grid(r => {
  const s = [];
  if (r === 8 || r === 9) s.push([3, 41]);
  if (r >= 14 && r <= 16) s.push([0, 43]);
  if (r >= 17 && r <= 22) { s.push([14, 16]); s.push([21, 24]); }
  return s;
});
const GRASS = { sheet: TV + (process.env.GRASS_E ? 'sageE.png' : 'dirtA.png'), fullVar: [[0, 96]] };
const ROAD  = TV + (process.env.GRASS_E ? 'sageE' : 'dirtA');
module.exports = { stage: { ...base.stage, map: { tile: 32, layers: [
  GRASS,
  { sheet: TV + 'farm.png',   lut: TV + 'farm.lut.json',   grid: farmGrid },
  { sheet: TV + 'gravel.png', lut: TV + 'gravel.lut.json', grid: gravelGrid },
  { sheet: TV + 'cobble.png', lut: TV + 'cobble.lut.json', grid: cobbleGrid },
  { sheet: ROAD + '.png',     lut: ROAD + '.lut.json',     grid: dirtGrid },
] }, props: [], parts: [], mute: 0, gloom: null, tone: null, vignette: 0 } };
