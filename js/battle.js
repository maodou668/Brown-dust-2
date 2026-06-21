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

    this.skills = opts.skills.slice(); // 技能 id 列表
    this.sp = 0;                       // 怒气 / 技能点
    this.maxSp = 6;

    this.shield = 0;                   // 当前护盾值
    this.buffs = [];                   // {stat:'atk'|'def', mult, turns}
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
      const st = Game.computeStats(owned);
      const pos = (def.cls === 'warrior' || def.cls === 'defender') ? 'front' : 'back';
      this.combatants.push(new Combatant({
        uid: 'A' + i, name: def.name, side: 'ally', charId: owned.charId,
        cls: def.cls, element: def.element, color: def.color, level: owned.level,
        pos, maxHp: st.maxHp, atk: st.atk, def: st.def, spd: st.spd, crit: st.crit,
        skills: def.skills,
      }));
    });

    // 敌方
    stage.enemies.forEach((e, i) => {
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
        this.combatants.forEach(c => { if (c.alive) c.tickBuffs(); });
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

  /** 获取某技能当前是否可用（SP 足够） */
  canUseSkill(combatant, skillId) {
    const sk = window.GameData.SKILLS[skillId];
    return combatant.sp >= (sk.sp || 0);
  },

  /** 解析技能合法目标列表 */
  validTargets(combatant, skillId) {
    const sk = window.GameData.SKILLS[skillId];
    const enemySide = combatant.side === 'ally' ? this.aliveEnemies() : this.aliveAllies();
    const allySide = combatant.side === 'ally' ? this.aliveAllies() : this.aliveEnemies();
    switch (sk.target) {
      case 'enemySingle': return this.applyTaunt(combatant, enemySide);
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
    }
    if (this.onEvent) this.onEvent({ type: 'damage', target: defender, attacker, amount: dmg, crit: isCrit, elem: elem > 1 });
    return { dmg, isCrit, elem: elem > 1, tag };
  },

  /** 执行一个技能 */
  executeSkill(combatant, skillId, picked) {
    const sk = window.GameData.SKILLS[skillId];
    // 扣 SP
    combatant.sp -= (sk.sp || 0);

    const targets = this.resolveHitTargets(combatant, skillId, picked);

    if (sk.effect === 'damage') {
      let summary = [];
      targets.forEach(t => {
        if (!t.alive) return;
        const r = this.dealDamage(combatant, t, sk.power);
        summary.push(`${t.name} -${r.dmg}${r.tag}`);
      });
      this.pushLog(`${combatant.name} 使用「${sk.name}」：${summary.join('，')}`);
      // 附带减益（如水矛降防）
      if (sk.extra && sk.extra.type === 'debuffDef') {
        targets.forEach(t => {
          if (t.alive) t.buffs.push({ stat: 'def', mult: -sk.extra.power, turns: sk.extra.duration });
        });
      }
    } else if (sk.effect === 'heal') {
      const amt = Math.round(combatant.effAtk() * sk.power);
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
      const amt = Math.round(combatant.effAtk() * sk.power);
      targets.forEach(t => { if (t.alive) t.shield += amt; });
      this.pushLog(`${combatant.name} 使用「${sk.name}」，为全队附加 ${amt} 点护盾！`);
      if (sk.extra && sk.extra.type === 'taunt') combatant.taunting = 2;
    }

    // 行动后回复 SP（普攻类 sp=0 的技能也算行动）
    combatant.sp = Math.min(combatant.maxSp, combatant.sp + 2);

    this.checkEnd();
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

    // 优先使用 SP 充足的高威力技能
    const usable = c.skills
      .map(id => ({ id, sk: window.GameData.SKILLS[id] }))
      .filter(s => c.sp >= (s.sk.sp || 0));
    // 按威力排序，偏好消耗 SP 的强技能
    usable.sort((a, b) => (b.sk.power * (1 + (b.sk.sp || 0))) - (a.sk.power * (1 + (a.sk.sp || 0))));
    const choice = usable[0] || { id: c.skills[0], sk: window.GameData.SKILLS[c.skills[0]] };

    // 选目标：攻击类 → 优先打血量最低的我方；治疗 → 自己
    let picked;
    const targets = this.aliveAllies();
    if (choice.sk.effect === 'damage') {
      // 考虑嘲讽
      const taunters = this.aliveAllies().filter(a => a.taunting > 0);
      const pool = taunters.length ? taunters : targets;
      picked = pool.reduce((lo, t) => (t.hp < lo.hp ? t : lo), pool[0]);
    } else {
      picked = c;
    }
    this.executeSkill(c, choice.id, picked);
  },
};

window.Battle = Battle;
window.Combatant = Combatant;
