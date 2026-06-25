// 通用关卡探针：对指定 trial/abyss id，跑「弱队 vs 正常队」高采样胜率，用于精调 mod
const fs = require('fs'), vm = require('vm'), path = require('path');
const store = {};
const ctx = { console, Math, Object, Array, JSON, Date, setTimeout, clearTimeout,
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => store[k] = String(v), removeItem: k => delete store[k] } };
ctx.window = ctx; ctx.window.GameData = {}; vm.createContext(ctx);
for (const f of ['data.js', 'balance.js', 'gear.js', 'costumes.js', 'game.js', 'battle.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
const { Game, Battle, GameData } = ctx.window;
const SK = GameData.SKILLS;
Game.init();
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
function runBattle(teamUids, stage) {
  Battle.setup(teamUids, stage);
  let guard = 0;
  while (!Battle.finished && guard++ < 400) {
    const c = Battle.current();
    if (!c || !c.alive) { Battle.advance(); continue; }
    if (Battle.isStunned(c)) { Battle.consumeStun(c); Battle.advance(); continue; }
    if (c.side === 'enemy') { Battle.enemyAct(); }
    else { if (Battle.comboReady()) Battle.unleashCombo(); else { const p = smartAlly(c); Battle.executeSkill(c, p.id, p.target || (Battle.validTargets(c, p.id) || [])[0]); } }
    Battle.checkEnd(); Battle.advance();
  }
  return { result: Battle.result, turns: Battle.round };
}
function makeTeam(charIds, level) { const t = charIds.map(c => Game.makeOwned(c, level)); Game.state.roster = t; Game.state.team = t.map(o => o.uid); return Game.state.team; }
function stageFrom(s) { return { id: s.id, name: s.name, enemies: s.enemies, isBoss: s.isBoss, mod: s.mod }; }

const BALANCED = ['justia', 'lecliss', 'seir', 'refithea', 'rigenette'];
const CASUAL = ['teried', 'lia', 'mina', 'loen', 'glacia'];
const N = parseInt(process.env.N || '200', 10);
const id = parseInt(process.env.ID || '102', 10);
const all = [...GameData.TRIALS, ...GameData.ABYSS];
const s = all.find(x => x.id === id);
function rate(team, lv) {
  makeTeam(team, lv); let w = 0, t = [];
  for (let i = 0; i < N; i++) { const r = runBattle(Game.state.team, stageFrom(s)); if (r.result === 'win') w++; t.push(r.turns); }
  return { wr: (w / N * 100).toFixed(0), at: (t.reduce((a, b) => a + b, 0) / N).toFixed(1) };
}
console.log(`关卡 ${s.name}  推荐Lv${s.recommend}  mod=${JSON.stringify(s.mod)}`);
const weakLv = parseInt(process.env.WEAK || (s.recommend - 7), 10);
const a = rate(BALANCED, weakLv), b = rate(BALANCED, s.recommend), c = rate(CASUAL, s.recommend);
console.log(`  弱队(强阵Lv${weakLv})     胜率 ${a.wr}%  平均 ${a.at} 回合  ← 应明显惩罚`);
console.log(`  推荐(强阵Lv${s.recommend})    胜率 ${b.wr}%  平均 ${b.at} 回合  ← 应稳过`);
console.log(`  平民(Lv${s.recommend})       胜率 ${c.wr}%  平均 ${c.at} 回合  ← 应可过但偏紧`);
