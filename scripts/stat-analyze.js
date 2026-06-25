// 分析现有角色的「进攻O / 生存S」双轴分布，按 稀有度×原型 分组，导出校验区间
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, Object, Array, JSON, Date };
ctx.window = ctx; ctx.window.GameData = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'), ctx, { filename: 'data.js' });
const D = ctx.window.GameData;

// 原型：把职业归类，每类有自己的 O/S 取向
const ARCHETYPE = { defender: 'tank', warrior: 'bruiser', archer: 'dps', mage: 'dps', healer: 'support' };
// 进攻值 O：期望单次输出能力
function O(s) { return Math.round(s.atk * (1 + 0.6 * (s.crit || 0)) * (0.85 + 0.15 * (s.spd || 100) / 100)); }
// 生存值 S：等效血量 EHP
function S(s) { return Math.round(s.hp * (1 + (s.def || 0) / 100)); }
function atLevel(b, g, lv) { return { hp: b.hp + (g.hp||0)*(lv-1), atk: b.atk + (g.atk||0)*(lv-1), def: b.def + (g.def||0)*(lv-1), spd: b.spd, crit: b.crit }; }

const cells = {};
Object.values(D.CHARACTERS).forEach(c => {
  const s = atLevel(c.base, c.grow, 60);
  const arch = ARCHETYPE[c.cls];
  const key = c.rarity + '/' + arch;
  (cells[key] = cells[key] || []).push({ name: c.name, cls: c.cls, o: O(s), s: S(s) });
});

console.log('=== 稀有度×原型：O(进攻) / S(生存) Lv60 ===');
Object.keys(cells).sort().forEach(k => {
  const a = cells[k];
  const os = a.map(x => x.o), ss = a.map(x => x.s);
  const oMin = Math.min(...os), oMax = Math.max(...os), sMin = Math.min(...ss), sMax = Math.max(...ss);
  console.log(`\n  [${k}]  n=${a.length}`);
  a.forEach(x => console.log(`     ${x.name.padEnd(7)}(${x.cls}) O=${String(x.o).padStart(5)} S=${String(x.s).padStart(6)}`));
  console.log(`     → O[${oMin}~${oMax}] S[${sMin}~${sMax}]`);
});
