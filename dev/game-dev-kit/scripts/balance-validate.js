// ============================================================
//  数值校验闸门 —— 在 build 前运行；任何「带数值」内容越界即失败退出。
//  覆盖：技能威力 / 服装属性 / 装备属性 / 敌人属性。
//  用法：node scripts/balance-validate.js        （--quiet 只在失败时输出）
//  这是「未来加角色/道具不破坏平衡」的硬保障。
// ============================================================
const fs = require('fs'), vm = require('vm'), path = require('path');
const QUIET = process.argv.includes('--quiet');
const ctx = { console, Math, Object, Array, JSON, Date };
ctx.window = ctx; ctx.window.GameData = {}; vm.createContext(ctx);
for (const f of ['data.js', 'balance.js', 'budget.js', 'gear.js', 'costumes.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
const { GameData, Balance, Budget } = ctx.window;

const violations = [];
const notes = [];
function log(s) { if (!QUIET) console.log(s); }

// ---- 1) 技能威力（沿用 Balance 模型，|score-1|<=0.18）----
// 只校验「实战可达」技能：普攻 + 职业技 + 所有服装专属招式。
// （data.js 里 CHARACTERS[].skills 的旧技能在服装系统下已不可达，属历史死数据，不计入。）
const reachable = new Set(['basic_attack']);
Object.values(GameData.CLASS_SKILL_OF || {}).forEach(id => reachable.add(id));
Object.values(GameData.COSTUMES).forEach(c => { if (c.signature) reachable.add(c.signature); });
let skMax = 0, skN = 0;
reachable.forEach(id => {
  const sk = GameData.SKILLS[id];
  if (!sk || sk.effect == null || sk.power == null) return;
  const score = Balance.score(sk); const dev = Math.abs(score - 1);
  skN++; skMax = Math.max(skMax, dev);
  if (dev > 0.18) violations.push(`技能 ${id}「${sk.name}」平衡分 ${score.toFixed(2)}（偏离 ${dev.toFixed(2)}>0.18）`);
});
log(`【技能】实战可达 ${skN} 个，最大偏离 ${skMax.toFixed(2)}（阈值 0.18）`);

// ---- 2) 服装属性（双轴预算）----
let cosN = 0, cosWorst = { sum: 2, id: '' };
Object.values(GameData.COSTUMES).forEach(cos => {
  cosN++;
  const r = Budget.evalCostume(cos);
  if (Math.abs(r.sum - 2) > Math.abs(cosWorst.sum - 2)) cosWorst = { sum: r.sum, id: cos.id, o: r.oRatio, s: r.sRatio };
  if (!r.ok) violations.push(`服装 ${cos.id}「${cos.name}」${r.reason}  [O×${r.oRatio.toFixed(2)} S×${r.sRatio.toFixed(2)}]`);
});
log(`【服装】${cosN} 套，最偏离：${cosWorst.id} 预算和 ${cosWorst.sum.toFixed(2)}（标准 2.0；区间 [${Budget.BUDGET_LO}, ${Budget.BUDGET_HI}]）`);

// ---- 3) 装备属性（装备分上限）----
let gearN = 0;
[...Object.values(GameData.GEAR.common), ...Object.values(GameData.GEAR.ex)].forEach(tpl => {
  gearN++;
  const r = Budget.evalGear(tpl);
  if (!r.ok) violations.push(`装备 ${tpl.id}「${tpl.name}」${r.reason}（${tpl.rarity}★ 上限 ${r.cap}）`);
});
log(`【装备】${gearN} 件，按稀有度装备分上限校验`);

// ---- 4) 敌人属性（理智带）----
let enemyN = 0;
Object.entries(GameData.ENEMIES).forEach(([id, e]) => {
  enemyN++;
  const r = Budget.evalEnemy(e);
  if (!r.ok) violations.push(`敌人 ${id}「${e.name}」${r.reason}（${e.isBoss ? 'BOSS' : '普通'}带 O≤${r.cap.O} S≤${r.cap.S}）`);
});
log(`【敌人】${enemyN} 个，按 普通/BOSS 理智带校验`);

// ---- 汇总 ----
if (violations.length) {
  console.error('\n❌ 数值校验未通过，发现 ' + violations.length + ' 处越界：');
  violations.forEach(v => console.error('   · ' + v));
  console.error('\n请用 Budget.makeCharStats / 调整规格使其回到预算内，再重新构建。');
  process.exit(1);
} else {
  log('\n✅ 数值校验通过：技能/服装/装备/敌人全部在预算内。');
  if (QUIET) console.log('✅ 数值校验通过');
}
