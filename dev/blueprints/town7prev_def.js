// 阴湿系选材预览: v5布局 + 克苏鲁民俗恐怖地面 (SICK=1 切病态草变体)
const base = require('/home/user/Maodou/dev/blueprints/town5_def.js');
const TV = 'art/06_story/tiles_v2/';
const R = rs => { const a = Array(45).fill('0'); for (const [s, e] of rs) for (let i = s; i <= e; i++) a[i] = '1'; return a.join(''); };
const grid = segsOf => Array.from({ length: 27 }, (_, r) => R(segsOf(r)));
const farmGrid = grid(r => (r >= 18 && r <= 21) ? [[5, 9]] : []);
const flagGrid = grid(r => {
  const s = [];
  if (r >= 10 && r <= 13) s.push([17, 28]);
  if (r >= 7 && r <= 9) s.push([24, 27]);
  return s;
});
const mudGrid = grid(r => {
  const s = [];
  if (r === 8 || r === 9) s.push([3, 41]);
  if (r >= 10 && r <= 13) { s.push([9, 11]); s.push([33, 35]); }
  if (r >= 4 && r <= 9) s.push([41, 43]);
  if (r >= 14 && r <= 16) s.push([0, 43]);
  if (r >= 17 && r <= 22) { s.push([14, 16]); s.push([21, 24]); }
  return s;
});
const G = process.env.SICK ? 'sickgrass' : 'mudgrass';
module.exports = { stage: { ...base.stage, map: { tile: 32, layers: [
  { sheet: TV + G + '.png', fullVar: [[0, 96]] },
  { sheet: TV + 'deadfield.png', lut: TV + 'deadfield.lut.json', grid: farmGrid },
  { sheet: TV + 'flagstone.png', lut: TV + 'flagstone.lut.json', grid: flagGrid },
  { sheet: TV + G + '.png', lut: TV + G + '.lut.json', grid: mudGrid },
] }, props: [], parts: [], mute: 0, gloom: null, tone: null, vignette: 0 } };
