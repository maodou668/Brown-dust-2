// 深渊精调探针：高采样跑强队，给出稳定胜率，便于精确调参
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
    else {
      if (Battle.comboReady()) { Battle.unleashCombo(); }
      else { const pick = smartAlly(c); Battle.executeSkill(c, pick.id, pick.target || (Battle.validTargets(c, pick.id) || [])[0]); }
    }
    Battle.checkEnd(); Battle.advance();
  }
  return { result: Battle.result, turns: Battle.round };
}
function makeTeam(charIds, level) { const t = charIds.map(c => Game.makeOwned(c, level)); Game.state.roster = t; Game.state.team = t.map(o => o.uid); return Game.state.team; }
function stageFrom(s) { return { id: s.id, name: s.name, enemies: s.enemies, isBoss: s.isBoss, mod: s.mod }; }

const BALANCED = ['justia', 'lecliss', 'seir', 'refithea', 'rigenette'];
const N = parseInt(process.env.N || '200', 10);
GameData.ABYSS.forEach(s => {
  makeTeam(BALANCED, s.recommend);
  let wins = 0, turns = [];
  for (let i = 0; i < N; i++) { const r = runBattle(Game.state.team, stageFrom(s)); if (r.result === 'win') wins++; turns.push(r.turns); }
  const wr = (wins / N * 100).toFixed(0), at = (turns.reduce((a, b) => a + b, 0) / N).toFixed(1);
  console.log(`  ${s.name.padEnd(20)} 胜率 ${String(wr).padStart(3)}%  平均 ${String(at).padStart(5)} 回合  [atkMul:${s.mod.atkMul} hpMul:${s.mod.hpMul} healCut:${s.mod.healCut}]`);
});
