#!/usr/bin/env node
// 从 PixelLab topdown tileset 元数据生成 wang LUT json
// 用法: node scripts/makelut.js <meta.json> <out.json> [--one=lower|upper]
//   --one 指定哪个地形算 '1'（mask 位）。铺"路 over 草"时路是 lower → --one=lower（默认）。
// 打包图布局（已程序化验证）：128×128 = 4×4，行主序 = 元数据 tileset_data.tiles 数组顺序。
// 输出: { tile: N, lut: { mask: [sx, sy] } }  坐标=图集像素偏移。mask = NW + NE*2 + SW*4 + SE*8。
const fs = require('fs');

const [metaPath, outPath] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const oneArg = (process.argv.find(a => a.startsWith('--one=')) || '--one=lower').split('=')[1];

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const tiles = (meta.tileset_data || meta).tiles || [];
if (tiles.length !== 16) { console.error(`tiles=${tiles.length}，预期 16`); process.exit(1); }
const T = (meta.tile_size && meta.tile_size.width) || 32;

const lut = {};
tiles.forEach((t, i) => {
  const c = t.corners || {};
  const bit = k => (String(c[k]).toLowerCase() === oneArg ? 1 : 0);
  const mask = bit('NW') + bit('NE') * 2 + bit('SW') * 4 + bit('SE') * 8;
  lut[mask] = [(i % 4) * T, Math.floor(i / 4) * T];
});
const missing = [];
for (let i = 0; i < 16; i++) if (!(i in lut)) missing.push(i);
fs.writeFileSync(outPath, JSON.stringify({ tile: T, lut }, null, 1));
console.log(`LUT ${Object.keys(lut).length}/16 → ${outPath}` + (missing.length ? ` 缺: ${missing.join(',')}` : ''));
