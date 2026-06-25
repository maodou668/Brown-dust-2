// ============================================================
//  综合自测：平衡性 + 好玩度量化
//  用智能玩家驱动跑大量战斗，统计胜率/节奏/动作多样性/连携/难度曲线/站位/特殊关。
//  用法: node scripts/playtest.js
// ============================================================
const fs = require('fs'), vm = require('vm'), path = require('path');
const store = {};
const ctx = {
  console, Math, Object, Array, JSON, Date, setTimeout, clearTimeout,
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => store[k] = String(v), removeItem: k => delete store[k] },
};
ctx.window = ctx; ctx.window.GameData = {}; vm.createContext(ctx);
for (const f of ['data.js', 'balance.js', 'gear.js', 'costumes.js', 'game.js', 'battle.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
const { Game, Battle, GameData } = ctx.window;
const SK = GameData.SKILLS;
Game.init();

// ---- 智能玩家驱动（镜像游戏内 autoPickAction + 连携）----
function smartAlly(c) {
  const foes = Battle.aliveEnemies(), friends = Battle.aliveAllies();
  const usable = c.skills.filter(id => Battle.canUseSkill(c, id)); usable.push('basic_attack');
  let best = { id: 'basic_attack', target: null }, bestVal = -1;
  for (const id of usable) {
    const sk = SK[id]; if (!sk) continue; let val = 0, target = null;
    if (sk.effect === 'damage') {
      if (sk.target === 'enemyAll') { val = c.effAtk() * sk.power * foes.length * 0.9; target = foes[0]; }
      else if (sk.target === 'enemyRow') {
        const tiers = {}; foes.forEach(f => (tiers[f.pos] = tiers[f.pos] || []).push(f));
        const g = Object.values(tiers).sort((a, b) => b.length - a.length)[0] || [foes[0]];
        val = c.effAtk() * sk.power * g.length * 0.9; target = g[0];
      } else {
        const pool = sk.pierce ? foes : Battle.frontline(foes);
        target = pool.reduce((lo, t) => (t.hp < lo.hp ? t : lo), pool[0]);
        val = Battle.estDamage(c, target, sk.power);
        if (target && val >= target.hp) val += 500;
        if (target && sk.pierce && (target.cls === 'healer')) val += 200;
      }
      if (sk.inflict) val += 100;
    } else if (sk.effect === 'heal') {
      const missing = friends.reduce((s, f) => s + (f.maxHp - f.hp), 0);
      if (missing < 60) val = -1;
      else { val = Math.min(missing, c.effAtk() * sk.power * (sk.target === 'allyAll' ? friends.length : 1)); target = sk.target === 'allySingle' ? friends.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] : c; }
    } else if (sk.effect === 'shield') { val = friends.some(f => f.hp < f.maxHp * 0.7) ? c.effAtk() * sk.power * friends.length * 0.4 : 25; target = c; }
    else if (sk.effect === 'buffAtk' || sk.effect === 'buffDef') { val = c.effAtk() * 0.5 * friends.length; target = c; }
    if (val > bestVal) { bestVal = val; best = { id, target }; }
  }
  return best;
}

// 动作分档：basic / class / signature
function tierOf(id) { const s = SK[id]; if (s.basic) return 'basic'; if (s.classSkill) return 'class'; return 'sig'; }

function runBattle(teamUids, stage, stats) {
  Battle.setup(teamUids, stage);
  let guard = 0;
  while (!Battle.finished && guard++ < 400) {
    const c = Battle.current();
    if (!c || !c.alive) { Battle.advance(); continue; }
    if (Battle.isStunned(c)) { Battle.consumeStun(c); Battle.advance(); continue; }
    if (c.side === 'enemy') { Battle.enemyAct(); }
    else {
      if (Battle.comboReady()) { Battle.unleashCombo(); if (stats) stats.combo++; }
      else {
        const pick = smartAlly(c);
        if (stats) stats.acts[tierOf(pick.id)]++;
        Battle.executeSkill(c, pick.id, pick.target || (Battle.validTargets(c, pick.id) || [])[0]);
      }
    }
    Battle.checkEnd(); Battle.advance();
  }
  return { result: Battle.result, turns: Battle.round, guard };
}

function makeTeam(charIds, level) { const t = charIds.map(c => Game.makeOwned(c, level)); Game.state.roster = t; Game.state.team = t.map(o => o.uid); return Game.state.team; }
const BALANCED = ['justia', 'lecliss', 'seir', 'refithea', 'rigenette']; // 强队：坦/群法/穿透弓/奶/爆发战
const CASUAL = ['teried', 'lia', 'mina', 'loen', 'glacia'];             // 平民队：3★ 为主 + 一个 4★，作为难度基准
const stageFrom = s => ({ id: s.id, name: s.name, enemies: s.enemies.map(e => ({ ...e })), reward: s.reward || {}, mod: s.mod, isBoss: s.isBoss });
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function pct(n) { return (n * 100).toFixed(0) + '%'; }

const RUNS = 25;
console.log('==================== 综合自测报告 ====================\n');

// ---- 1) 平衡性 ----
const sigIds = new Set(); Object.values(GameData.COSTUMES).forEach(c => c.signature && sigIds.add(c.signature));
Object.values(GameData.CLASS_SKILL_OF).forEach(id => sigIds.add(id)); sigIds.add('basic_attack');
let off = 0; [...sigIds].forEach(id => { const s = SK[id]; if (s && Math.abs(ctx.window.Balance.score(s) - 1) > 0.18) off++; });
console.log(`【1】平衡性：${sigIds.size} 个战斗技能，偏离曲线>0.18 的：${off} 个  → ${off === 0 ? '✅ 全部在线' : '⚠ 有超标'}`);

// ---- 2) 主线/试炼 推荐等级胜率 + 节奏 ----
console.log('\n【2】推荐等级下 胜率/平均回合（智能队 5 人 × ' + RUNS + ' 次/关）');
const acts = { basic: 0, class: 0, sig: 0 }; let comboTot = 0, comboBattles = 0, battles = 0;
const allContent = [...GameData.STAGES, ...GameData.TRIALS];
const curve = [];
allContent.forEach(s => {
  makeTeam(BALANCED, s.recommend || 15);
  let wins = 0, turns = [];
  for (let i = 0; i < RUNS; i++) { const st = { acts, combo: 0 }; const r = runBattle(Game.state.team, stageFrom(s), st); if (r.result === 'win') wins++; turns.push(r.turns); comboTot += st.combo; if (st.combo > 0) comboBattles++; battles++; }
  const wr = wins / RUNS;
  curve.push({ name: s.name, wr, t: avg(turns) });
  console.log(`  ${(s.name).padEnd(22)} 胜率 ${pct(wr).padStart(4)}  平均 ${avg(turns).toFixed(1).padStart(4)} 回合`);
});

// ---- 2b) 平民队难度基准（更能反映真实玩家体验）----
console.log('\n【2b】平民队（3★为主）推荐等级胜率 —— 真实难度基准');
const casualCurve = [];
allContent.forEach(s => {
  makeTeam(CASUAL, s.recommend || 15);
  let wins = 0, turns = [];
  for (let i = 0; i < RUNS; i++) { const r = runBattle(Game.state.team, stageFrom(s), null); if (r.result === 'win') wins++; turns.push(r.turns); }
  casualCurve.push({ name: s.name, wr: wins / RUNS, t: avg(turns) });
  console.log(`  ${(s.name).padEnd(22)} 胜率 ${pct(wins / RUNS).padStart(4)}  平均 ${avg(turns).toFixed(1).padStart(4)} 回合`);
});

// ---- 3) 动作多样性 ----
const totAct = acts.basic + acts.class + acts.sig || 1;
console.log('\n【3】动作多样性（所有战斗累计）：普攻 ' + pct(acts.basic / totAct) + ' / 职业技 ' + pct(acts.class / totAct) + ' / 专属大招 ' + pct(acts.sig / totAct));

// ---- 4) 连携使用 ----
console.log('\n【4】团队连携：平均每场发动 ' + (comboTot / battles).toFixed(2) + ' 次；' + pct(comboBattles / battles) + ' 的战斗至少发动 1 次');

// ---- 5) 难度曲线 ----
console.log('\n【5】难度曲线（固定智能队 Lv35 跨全部内容，胜率应随进度走低/回合走高）');
makeTeam(BALANCED, 35);
let prevT = 0, monotonic = true;
[...GameData.STAGES, ...GameData.TRIALS].forEach(s => {
  let wins = 0, turns = [];
  for (let i = 0; i < 12; i++) { const r = runBattle(Game.state.team, stageFrom(s), null); if (r.result === 'win') wins++; turns.push(r.turns); }
  const t = avg(turns);
  console.log(`  ${s.name.padEnd(22)} 胜率 ${pct(wins / 12).padStart(4)}  平均 ${t.toFixed(1).padStart(4)} 回合`);
});

// ---- 6) 特殊关卡机制 ----
console.log('\n【6】特殊机制关：');
// 6a 限时（trial 102 turnLimit 8）——弱队应可能超时失败
const t102 = GameData.TRIALS.find(t => t.id === 102);
makeTeam(BALANCED, 12); // 低于推荐19，故意偏弱
let to = 0; for (let i = 0; i < RUNS; i++) { const r = runBattle(Game.state.team, stageFrom(t102), null); if (r.result === 'lose') to++; }
console.log(`  限时关(${t102.mod.turnLimit}回合) 低级弱队失败率 ${pct(to / RUNS)}  → ${to > 0 ? '✅ 限时会惩罚拖延' : '⚠ 限时未触发(队伍太强)'}`);
// 6b 护甲BOSS（trial 106 armored）——对比有/无破防的击杀难度
const t106 = GameData.TRIALS.find(t => t.id === 106);
makeTeam(BALANCED, 38);
let aw = 0, at = []; for (let i = 0; i < RUNS; i++) { const r = runBattle(Game.state.team, stageFrom(t106), null); if (r.result === 'win') aw++; at.push(r.turns); }
console.log(`  护甲女皇(须破防) 胜率 ${pct(aw / RUNS)}  平均 ${avg(at).toFixed(1)} 回合 → ${aw > 0 ? '✅ 可破防击杀' : '⚠ 打不过'}`);

// ---- 6c) 深渊：必须挑战满练强队 ----
console.log('\n【6c】深渊（专为满练强队设计，强队应 ~40~80% 而非 100%）');
const abyssWr = [];
GameData.ABYSS.forEach(s => {
  makeTeam(BALANCED, s.recommend);
  let wins = 0, turns = [];
  for (let i = 0; i < RUNS; i++) { const r = runBattle(Game.state.team, stageFrom(s), null); if (r.result === 'win') wins++; turns.push(r.turns); }
  abyssWr.push(wins / RUNS);
  const mods = Object.entries(s.mod || {}).map(([k, v]) => k + (v !== true ? ':' + v : '')).join(' ');
  console.log(`  ${s.name.padEnd(18)} 强队胜率 ${pct(wins / RUNS).padStart(4)}  平均 ${avg(turns).toFixed(1).padStart(4)} 回合  [${mods}]`);
});

// ---- 7) 站位/穿透 ----
console.log('\n【7】站位机制：');
makeTeam(['lecliss', 'seir'], 14);
Battle.setup(Game.state.team, stageFrom(GameData.STAGES[4]));
const mage = Battle.aliveAllies()[0];
const single = Battle.validTargets(mage, GameData.CLASS_SKILL_OF.mage); // 穿透
const basicT = Battle.validTargets(mage, 'basic_attack'); // 非穿透
const backReachableByPierce = single.some(t => t.pos === 'back');
const backReachableByBasic = basicT.some(t => t.pos === 'back');
console.log(`  穿透技可点后排：${backReachableByPierce ? '✅' : '✗'}；普攻只能点前排：${!backReachableByBasic ? '✅' : '✗(后排也能点,前排保护失效)'}`);

// ---- 好玩度评分 ----
console.log('\n==================== 好玩度评分 ====================');
const casWr = avg(casualCurve.map(c => c.wr));
const recT = avg(curve.map(c => c.t));
const strongMin = Math.min(...curve.map(c => c.wr));     // 强队在最难内容的胜率
const check = (label, ok, detail) => console.log(`  ${ok ? '✅' : '⚠ '} ${label}：${detail}`);
check('平民队推荐胜率合理(55~92%)', casWr >= 0.55 && casWr <= 0.92, pct(casWr) + ' 平均（平民队）');
check('深渊真正挑战满练强队(均<85%且非0)', abyssWr.every(w => w < 0.85) && abyssWr.some(w => w > 0.05), '深渊强队胜率 ' + abyssWr.map(pct).join('/'));
check('战斗节奏(4~18回合)', recT >= 4 && recT <= 18, recT.toFixed(1) + ' 回合平均');
check('三档动作都被用到', acts.basic > 0 && acts.class > 0 && acts.sig > 0, '普攻/职业/大招占比 ' + pct(acts.basic / totAct) + '/' + pct(acts.class / totAct) + '/' + pct(acts.sig / totAct));
check('连携常被触发', comboBattles / battles > 0.3, pct(comboBattles / battles) + ' 战斗用到');
check('平衡无崩盘', off === 0, off + ' 个超标技能');
check('站位/穿透生效', backReachableByPierce && !backReachableByBasic, '前排保护+穿透越位');
console.log('\n完成。');
