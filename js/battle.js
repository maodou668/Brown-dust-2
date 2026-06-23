// ============================================================
//  回合制战斗引擎
//  - 基于速度的行动顺序
//  - 技能 SP 充能、元素克制、暴击、护盾、增益/减益
//  - 玩家手动操作 + 敌方 AI
// ============================================================

class Combatant {
  constructor(opts) {
    this.uid = opts.uid;            // 唯一标识
    this.name = opts.name;
    this.side = opts.side;          // 'ally' | 'enemy'
    this.charId = opts.charId;      // 引用图鉴 id（角色或敌人）
    this.cls = opts.cls;
    this.element = opts.element;
    this.color = opts.color;
    this.level = opts.level;
    this.pos = opts.pos;            // 'front' | 'back'
    this.isBoss = !!opts.isBoss;

    this.maxHp = opts.maxHp;
    this.hp = opts.maxHp;
    this.atk = opts.atk;
    this.def = opts.def;
    this.spd = opts.spd;
    this.crit = opts.crit;

    this.skills = opts.skills.slice(); // 技能 id 列表（含普攻）
    this.sigSkillId = opts.sigSkillId || null; // 当前服装的专属招式（受突破强化）
    this.sigPlus = opts.sigPlus || 0;          // 当前服装突破等级 0~5
    this.sp = 3;                       // 起始 SP（可开局放低费技能）
    this.maxSp = 6;
    this.cooldowns = {};               // skillId -> 剩余冷却回合

    this.shield = 0;                   // 当前护盾值
    this.buffs = [];                   // {stat:'atk'|'def', mult, turns}
    this.statuses = [];                // {type:'poison'|'burn'|'stun'|'silence', turns, dmg}
    this.enraged = false;              // BOSS 狂暴标记
    this.taunting = 0;                 // 嘲讽剩余回合
    this.alive = true;
  }

  // 含增益后的有效攻击
  effAtk() {
    let m = 1;
    this.buffs.forEach(b => { if (b.stat === 'atk') m += b.mult; });
    return Math.round(this.atk * m);
  }

  // 含增益/减益后的有效防御
  effDef() {
    let m = 1;
    this.buffs.forEach(b => {
      if (b.stat === 'def') m += b.mult;       // 正为加防
    });
    return Math.max(0, Math.round(this.def * m));
  }

  tickBuffs() {
    this.buffs.forEach(b => b.turns--);
    this.buffs = this.buffs.filter(b => b.turns > 0);
    if (this.taunting > 0) this.taunting--;
    // 冷却递减
    Object.keys(this.cooldowns).forEach(k => {
      if (this.cooldowns[k] > 0) this.cooldowns[k]--;
    });
  }
}

const Battle = {
  combatants: [],
  log: [],
  turnOrder: [],
  turnIdx: 0,
  round: 1,
  onEvent: null,   // UI 回调
  finished: false,
  result: null,    // 'win' | 'lose'

  /** 从存档队伍 + 关卡数据构建战斗 */
  setup(teamUids, stage) {
    this.combatants = [];
    this.log = [];
    this.round = 1;
    this.turnIdx = 0;
    this.finished = false;
    this.result = null;

    const D = window.GameData;

    // 我方
    teamUids.forEach((uid, i) => {
      const owned = Game.getOwned(uid);
      if (!owned) return;
      const def = D.CHARACTERS[owned.charId];
      const cos = Game.activeCostumeDef(owned); // 当前装扮：属性/元素/配色
      const st = Game.computeStats(owned);
      // 三段站位：坦克/战士在前，弓手居中，法师/治疗在后
      const pos = (def.cls === 'warrior' || def.cls === 'defender') ? 'front'
                : (def.cls === 'archer' || def.cls === 'rogue') ? 'mid' : 'back';
      this.combatants.push(new Combatant({
        uid: 'A' + i, name: def.name, side: 'ally', charId: owned.charId,
        cls: def.cls, element: cos.element, color: cos.color, level: owned.level,
        pos, maxHp: st.maxHp, atk: st.atk, def: st.def, spd: st.spd, crit: st.crit,
        skills: Game.battleSkills(owned), // 普攻 + 各服装招式
        sigSkillId: cos.signature,        // 当前服装专属招式（受突破强化）
        sigPlus: owned.plus || 0,         // 突破等级
      }));
    });

    // 敌方
    stage.enemies.forEach((e, i) => {
      // 竞技场 / 角色型敌人：用角色数据构建（与我方同一套属性体系）
      if (e.char) {
        const ao = Game.aiOwned(e.char, e.level || 1, e.plus || 0);
        const cdef = D.CHARACTERS[e.char];
        const cos = Game.activeCostumeDef(ao);
        const st = Game.computeStats(ao);
        const pos = e.pos || ((cdef.cls === 'warrior' || cdef.cls === 'defender') ? 'front'
          : (cdef.cls === 'archer' || cdef.cls === 'rogue') ? 'mid' : 'back');
        this.combatants.push(new Combatant({
          uid: 'E' + i, name: cdef.name, side: 'enemy', charId: e.char,
          cls: cdef.cls, element: cos.element, color: cos.color, level: ao.level, pos,
          maxHp: st.maxHp, atk: st.atk, def: st.def, spd: st.spd, crit: st.crit,
          skills: Game.battleSkills(ao), sigSkillId: cos.signature, sigPlus: ao.plus,
        }));
        return;
      }
      const def = D.ENEMIES[e.id];
      const lv = e.level - 1;
      const grow = { hp: def.base.hp * 0.10, atk: def.base.atk * 0.08, def: def.base.def * 0.08 };
      this.combatants.push(new Combatant({
        uid: 'E' + i, name: def.name, side: 'enemy', charId: e.id,
        cls: 'enemy', element: def.element, color: def.color, level: e.level,
        pos: e.pos,
        maxHp: Math.round(def.base.hp + grow.hp * lv),
        atk: Math.round(def.base.atk + grow.atk * lv),
        def: Math.round(def.base.def + grow.def * lv),
        spd: def.base.spd, crit: def.base.crit,
        skills: def.skills, isBoss: def.isBoss,
      }));
    });

    this.buildTurnOrder();
    this.pushLog(`⚔️ 战斗开始！ ${stage.name}`);
  },

  buildTurnOrder() {
    // 按速度从高到低排序（同速随机）
    this.turnOrder = this.combatants
      .filter(c => c.alive)
      .sort((a, b) => (b.spd - a.spd) || (Math.random() - 0.5));
    this.turnIdx = 0;
  },

  allies() { return this.combatants.filter(c => c.side === 'ally'); },
  enemies() { return this.combatants.filter(c => c.side === 'enemy'); },
  aliveAllies() { return this.allies().filter(c => c.alive); },
  aliveEnemies() { return this.enemies().filter(c => c.alive); },

  current() {
    return this.turnOrder[this.turnIdx];
  },

  pushLog(msg) {
    this.log.push(msg);
    if (this.onEvent) this.onEvent({ type: 'log', msg });
  },

  // ---------- 战斗主流程 ----------

  /** 推进到下一个存活单位的回合；若一轮结束则进入新回合 */
  advance() {
    do {
      this.turnIdx++;
      if (this.turnIdx >= this.turnOrder.length) {
        // 新回合
        this.round++;
        this.tickRound();
        this.buildTurnOrder();
        this.pushLog(`—— 第 ${this.round} 回合 ——`);
      }
    } while (this.current() && !this.current().alive);
    return this.current();
  },

  /** 当前是否轮到我方操作 */
  isPlayerTurn() {
    const c = this.current();
    return c && c.alive && c.side === 'ally' && !this.finished;
  },

  /** 技能冷却回合数（未显式定义则按 SP 估算） */
  skillCD(sk) {
    if (sk.cd != null) return sk.cd;
    const sp = sk.sp || 0;
    return sp >= 4 ? 3 : sp >= 2 ? 2 : 1;
  },

  /** 突破对「当前服装专属招式」的强化：威力倍率（每级 +6%） */
  sigPowerMult(c, skillId) {
    return (c.sigSkillId && c.sigSkillId === skillId && c.sigPlus) ? (1 + c.sigPlus * 0.06) : 1;
  },
  /** 突破对「当前服装专属招式」的 SP 减免：每 2 级 -1 SP（最低 0） */
  skillSp(c, skillId) {
    const sk = window.GameData.SKILLS[skillId];
    let sp = sk.sp || 0;
    if (c.sigSkillId && c.sigSkillId === skillId && c.sigPlus) sp = Math.max(0, sp - Math.floor(c.sigPlus / 2));
    return sp;
  },

  /** 技能当前是否可用（SP 足够、不在冷却、未被沉默）；普攻恒可用 */
  canUseSkill(combatant, skillId) {
    const sk = window.GameData.SKILLS[skillId];
    if (sk.basic) return true;
    if (this.isSilenced(combatant)) return false;
    if ((combatant.cooldowns[skillId] || 0) > 0) return false;
    return combatant.sp >= this.skillSp(combatant, skillId);
  },

  // ---------- 状态效果 ----------
  hasStatus(c, type) { return c.statuses.some(s => s.type === type && s.turns > 0); },
  isStunned(c) { return this.hasStatus(c, 'stun'); },
  isSilenced(c) { return this.hasStatus(c, 'silence'); },
  consumeStun(c) {
    const s = c.statuses.find(x => x.type === 'stun' && x.turns > 0);
    if (s) { s.turns--; c.statuses = c.statuses.filter(x => x.turns > 0); }
  },

  /** 施加状态（同类刷新为较长持续） */
  applyStatus(target, inflict, attacker) {
    const st = { type: inflict.type, turns: inflict.turns };
    if (inflict.type === 'poison' || inflict.type === 'burn') {
      st.dmg = Math.max(1, Math.round(attacker.effAtk() * (inflict.power || 0.4)));
    }
    const ex = target.statuses.find(s => s.type === inflict.type);
    if (ex) { ex.turns = Math.max(ex.turns, st.turns); if (st.dmg) ex.dmg = st.dmg; }
    else target.statuses.push(st);
    const nm = { poison: '中毒', burn: '灼烧', stun: '眩晕', silence: '沉默' }[inflict.type] || inflict.type;
    this.pushLog(`☣ ${target.name} 陷入${nm}！`);
    if (this.onEvent) this.onEvent({ type: 'status', target, status: inflict.type });
  },

  /** 每回合：持续伤害结算 + 各类持续时间递减 */
  tickRound() {
    this.combatants.forEach(c => {
      if (!c.alive) return;
      // 持续伤害（中毒/灼烧）
      c.statuses.filter(s => (s.type === 'poison' || s.type === 'burn') && s.turns > 0).forEach(s => {
        if (!c.alive) return;
        let dmg = s.dmg || 1;
        if (c.shield > 0) { const a = Math.min(c.shield, dmg); c.shield -= a; dmg -= a; }
        c.hp -= dmg;
        const icon = s.type === 'poison' ? '☠' : '🔥';
        this.pushLog(`${icon} ${c.name} 受到 ${dmg} 点${s.type === 'poison' ? '中毒' : '灼烧'}伤害`);
        if (this.onEvent) this.onEvent({ type: 'damage', target: c, amount: dmg, crit: false, elem: false, dot: true });
        if (c.hp <= 0) { c.hp = 0; c.alive = false; this.pushLog(`💀 ${c.name} 被击倒！`); }
      });
      // 持续时间递减（眩晕在行动时单独消耗）
      c.buffs.forEach(b => b.turns--); c.buffs = c.buffs.filter(b => b.turns > 0);
      c.statuses.forEach(s => { if (s.type !== 'stun') s.turns--; });
      c.statuses = c.statuses.filter(s => s.turns > 0);
      if (c.taunting > 0) c.taunting--;
      Object.keys(c.cooldowns).forEach(k => { if (c.cooldowns[k] > 0) c.cooldowns[k]--; });
    });
  },

  // 三段站位（由前到后）：前排 → 中排 → 后排
  TIER_ORDER: ['front', 'mid', 'back'],
  tierIdx(pos) { const i = this.TIER_ORDER.indexOf(pos); return i < 0 ? 0 : i; },

  /** 前排保护：只能攻击「当前最靠前、仍有存活单位」的那一段站位（穿透技能除外） */
  frontline(units) {
    const alive = units.filter(u => u.alive);
    if (!alive.length) return [];
    const minT = Math.min(...alive.map(u => this.tierIdx(u.pos)));
    return alive.filter(u => this.tierIdx(u.pos) === minT);
  },

  /** 解析技能合法目标列表 */
  validTargets(combatant, skillId) {
    const sk = window.GameData.SKILLS[skillId];
    const enemySide = combatant.side === 'ally' ? this.aliveEnemies() : this.aliveAllies();
    const allySide = combatant.side === 'ally' ? this.aliveAllies() : this.aliveEnemies();
    switch (sk.target) {
      case 'enemySingle': return sk.pierce ? enemySide : this.frontline(enemySide);
      case 'enemyRow':    return enemySide; // 选一个代表，命中其整排
      case 'enemyAll':    return enemySide;
      case 'allySingle':  return allySide;
      case 'allyAll':     return allySide;
      case 'self':        return [combatant];
    }
    return [];
  },

  /** 嘲讽：若敌方有嘲讽单位，单体攻击只能选它 */
  applyTaunt(attacker, targets) {
    if (attacker.side !== 'enemy') {
      // 我方攻击敌人，敌人无嘲讽机制（简化）
      return targets;
    }
    return targets;
  },

  /** 实际收集技能命中的目标 */
  resolveHitTargets(combatant, skillId, picked) {
    const sk = window.GameData.SKILLS[skillId];
    switch (sk.target) {
      case 'enemySingle':
      case 'allySingle':
        return [picked];
      case 'self':
        return [combatant];
      case 'enemyAll':
        return combatant.side === 'ally' ? this.aliveEnemies() : this.aliveAllies();
      case 'allyAll':
        return combatant.side === 'ally' ? this.aliveAllies() : this.aliveEnemies();
      case 'enemyRow': {
        const side = combatant.side === 'ally' ? this.aliveEnemies() : this.aliveAllies();
        return side.filter(c => c.pos === picked.pos);
      }
    }
    return [];
  },

  /** 元素克制倍率 */
  elementMult(attacker, defender) {
    const E = window.GameData.ELEMENTS[attacker.element];
    if (E && E.strong === defender.element) return 1.3;
    return 1.0;
  },

  /** 计算并施加一次伤害 */
  dealDamage(attacker, defender, power) {
    const elem = this.elementMult(attacker, defender);
    const isCrit = Math.random() < attacker.crit;
    const critMult = isCrit ? 1.6 : 1.0;
    const raw = attacker.effAtk() * power * elem * critMult;
    // 防御减伤公式
    const reduced = raw * (100 / (100 + defender.effDef()));
    let dmg = Math.max(1, Math.round(reduced));

    // 护盾吸收
    if (defender.shield > 0) {
      const absorb = Math.min(defender.shield, dmg);
      defender.shield -= absorb;
      dmg -= absorb;
    }
    defender.hp -= dmg;

    let tag = '';
    if (elem > 1) tag += ' 🔥克制';
    if (isCrit) tag += ' ✨暴击';

    if (defender.hp <= 0) {
      defender.hp = 0;
      defender.alive = false;
      this.pushLog(`💀 ${defender.name} 被击倒！`);
    } else if (defender.isBoss && !defender.enraged && defender.hp <= defender.maxHp * 0.5) {
      // BOSS 狂暴：血量过半，攻击大幅提升
      defender.enraged = true;
      defender.buffs.push({ stat: 'atk', mult: 0.5, turns: 999 });
      this.pushLog(`🔥 ${defender.name} 进入【狂暴】，攻击大幅提升！`);
      if (this.onEvent) this.onEvent({ type: 'enrage', target: defender });
    }
    if (this.onEvent) this.onEvent({ type: 'damage', target: defender, attacker, amount: dmg, crit: isCrit, elem: elem > 1 });
    return { dmg, isCrit, elem: elem > 1, tag };
  },

  /** 执行一个技能 */
  executeSkill(combatant, skillId, picked) {
    const sk = window.GameData.SKILLS[skillId];
    // 扣 SP（突破对专属招式有减免）
    combatant.sp -= this.skillSp(combatant, skillId);
    const sigMul = this.sigPowerMult(combatant, skillId); // 突破对专属招式的威力强化

    const targets = this.resolveHitTargets(combatant, skillId, picked);

    if (sk.effect === 'damage') {
      let summary = [];
      targets.forEach(t => {
        if (!t.alive) return;
        const r = this.dealDamage(combatant, t, sk.power * sigMul);
        summary.push(`${t.name} -${r.dmg}${r.tag}`);
        // 击退位移
        if (sk.knockback && t.alive) this.applyKnockback(combatant, t, r.dmg);
      });
      this.pushLog(`${combatant.name} 使用「${sk.name}」：${summary.join('，')}`);
      // 附带减益（如水矛降防）
      if (sk.extra && sk.extra.type === 'debuffDef') {
        targets.forEach(t => {
          if (t.alive) t.buffs.push({ stat: 'def', mult: -sk.extra.power, turns: sk.extra.duration });
        });
      }
      // 附带状态（中毒/灼烧/眩晕/沉默）
      if (sk.inflict) {
        targets.forEach(t => { if (t.alive) this.applyStatus(t, sk.inflict, combatant); });
      }
    } else if (sk.effect === 'heal') {
      const amt = Math.round(combatant.effAtk() * sk.power * sigMul);
      let summary = [];
      targets.forEach(t => {
        if (!t.alive) return;
        const before = t.hp;
        t.hp = Math.min(t.maxHp, t.hp + amt);
        summary.push(`${t.name} +${t.hp - before}`);
        if (this.onEvent) this.onEvent({ type: 'heal', target: t, attacker: combatant, amount: t.hp - before });
      });
      this.pushLog(`${combatant.name} 使用「${sk.name}」：${summary.join('，')}`);
    } else if (sk.effect === 'buffAtk' || sk.effect === 'buffDef') {
      const stat = sk.effect === 'buffAtk' ? 'atk' : 'def';
      targets.forEach(t => {
        if (t.alive) t.buffs.push({ stat, mult: sk.power, turns: sk.duration });
      });
      this.pushLog(`${combatant.name} 使用「${sk.name}」，提升${stat === 'atk' ? '攻击' : '防御'}！`);
    } else if (sk.effect === 'shield') {
      const amt = Math.round(combatant.effAtk() * sk.power * sigMul);
      targets.forEach(t => { if (t.alive) t.shield += amt; });
      this.pushLog(`${combatant.name} 使用「${sk.name}」，为全队附加 ${amt} 点护盾！`);
      if (sk.extra && sk.extra.type === 'taunt') combatant.taunting = 2;
    }

    // SP 与冷却：普攻回复 SP；招式进入冷却
    if (sk.basic) {
      combatant.sp = Math.min(combatant.maxSp, combatant.sp + 3);
    } else {
      combatant.cooldowns[skillId] = this.skillCD(sk);
    }

    this.checkEnd();
  },

  /** 击退：沿站位向后推一段（前→中→后）；已在最后排则撞墙受额外伤害 */
  applyKnockback(attacker, target, baseDmg) {
    const order = this.TIER_ORDER;
    const i = order.indexOf(target.pos);
    if (i >= 0 && i < order.length - 1) {
      const tierName = { mid: '中排', back: '后排' }[order[i + 1]] || '后排';
      target.pos = order[i + 1];
      this.pushLog(`↩ ${target.name} 被击退到${tierName}！`);
      if (this.onEvent) this.onEvent({ type: 'knockback', target, kind: 'push' });
    } else {
      // 撞墙：额外碰撞伤害
      let dmg = Math.max(1, Math.round(baseDmg * 0.35));
      if (target.shield > 0) {
        const a = Math.min(target.shield, dmg);
        target.shield -= a; dmg -= a;
      }
      target.hp -= dmg;
      this.pushLog(`💥 ${target.name} 撞击受到 ${dmg} 额外伤害！`);
      if (this.onEvent) this.onEvent({ type: 'knockback', target, kind: 'collide' });
      if (dmg > 0 && this.onEvent) this.onEvent({ type: 'damage', target, attacker, amount: dmg, crit: false, elem: false });
      if (target.hp <= 0) {
        target.hp = 0; target.alive = false;
        this.pushLog(`💀 ${target.name} 被击倒！`);
      }
    }
  },

  checkEnd() {
    if (this.aliveEnemies().length === 0) {
      this.finished = true;
      this.result = 'win';
      this.pushLog('🎉 战斗胜利！');
      if (this.onEvent) this.onEvent({ type: 'end', result: 'win' });
    } else if (this.aliveAllies().length === 0) {
      this.finished = true;
      this.result = 'lose';
      this.pushLog('☠️ 全队覆灭……');
      if (this.onEvent) this.onEvent({ type: 'end', result: 'lose' });
    }
  },

  // ---------- 敌方 AI ----------

  enemyAct() {
    const c = this.current();
    if (!c || c.side !== 'enemy' || !c.alive) return;

    // 可用技能：SP 足够 且 不在冷却；否则用普通攻击
    const usable = c.skills
      .map(id => ({ id, sk: window.GameData.SKILLS[id] }))
      .filter(s => this.canUseSkill(c, s.id));
    usable.sort((a, b) => (b.sk.power * (1 + (b.sk.sp || 0))) - (a.sk.power * (1 + (a.sk.sp || 0))));
    const basic = { id: 'basic_attack', sk: window.GameData.SKILLS.basic_attack };
    const choice = usable[0] || basic;

    // 选目标：攻击类 → 优先打血量最低的我方；治疗 → 自己
    let picked;
    if (choice.sk.effect === 'damage') {
      // 嘲讽优先；否则受前排保护约束（穿透技能可越过前排）
      const taunters = this.aliveAllies().filter(a => a.taunting > 0);
      const pool = taunters.length
        ? taunters
        : (choice.sk.pierce ? this.aliveAllies() : this.frontline(this.aliveAllies()));
      picked = pool.reduce((lo, t) => (t.hp < lo.hp ? t : lo), pool[0]);
    } else {
      picked = c;
    }
    this.executeSkill(c, choice.id, picked);
  },
};

window.Battle = Battle;
window.Combatant = Combatant;
