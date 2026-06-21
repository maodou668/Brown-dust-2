// ============================================================
//  游戏状态管理 / 存档 / 角色养成
// ============================================================

const SAVE_KEY = 'bd2_save_v1';

const Game = {
  state: null,

  /** 初始化：读取存档或创建新存档 */
  init() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        this.state = JSON.parse(saved);
      } catch (e) {
        console.warn('存档损坏，重置', e);
        this.state = this.newGame();
      }
    } else {
      this.state = this.newGame();
    }
    // 存档版本迁移：补齐新增字段，保证老存档不报错
    if (!this.state.seenStory) this.state.seenStory = [];
    if (!this.state.inventory) this.state.inventory = [];
    if (!this.state._gearSeq) this.state._gearSeq = 1;
    this.state.roster.forEach(o => {
      if (!o.equip) o.equip = { weapon: null, armor: null, accessory: null, ex: null };
    });
    return this.state;
  },

  /** 新游戏的初始状态 */
  newGame() {
    return {
      gold: 500,
      gem: 300,
      // 已拥有角色：{ uid, charId, level, exp, star }
      roster: [
        this.makeOwned('teried', 1),
        this.makeOwned('mina', 1),
      ],
      // 出战队伍（uid 列表，最多 4 人）
      team: [],
      // 已通关关卡 id
      cleared: [],
      // 已观看的剧情 id
      seenStory: [],
      // 装备背包（gear 实例：{ iid, tpl }）
      inventory: [],
      // 抽卡保底计数（距上次 5★）
      pity: 0,
      _uidSeq: 1,
      _gearSeq: 1,
    };
  },

  /** 生成一个已拥有角色实例 */
  makeOwned(charId, level = 1) {
    const uid = 'u' + (this.state ? this.state._uidSeq++ : Date.now() + Math.random());
    return {
      uid, charId, level, exp: 0,
      star: window.GameData.CHARACTERS[charId].rarity,
      equip: { weapon: null, armor: null, accessory: null, ex: null },
    };
  },

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
  },

  reset() {
    localStorage.removeItem(SAVE_KEY);
    this.state = this.newGame();
    // 默认把初始两名角色编入队伍
    this.state.team = this.state.roster.map(o => o.uid);
    this.save();
  },

  // ---------- 角色数值计算 ----------

  /** 根据等级 + 装备计算角色最终属性 */
  computeStats(owned) {
    const def = window.GameData.CHARACTERS[owned.charId];
    const lv = owned.level - 1;
    const g = this.gearBonus(owned);
    return {
      maxHp: Math.round(def.base.hp + def.grow.hp * lv) + g.hp,
      atk:   Math.round(def.base.atk + def.grow.atk * lv) + g.atk,
      def:   Math.round(def.base.def + def.grow.def * lv) + g.def,
      spd:   def.base.spd + g.spd,
      crit:  def.base.crit + g.crit,
    };
  },

  // ---------- 装备 ----------

  getGearTpl(tplId) {
    const G = window.GameData.GEAR;
    return (G.common[tplId] || G.ex[tplId]) || null;
  },

  getGearInst(iid) {
    return this.state.inventory.find(g => g.iid === iid) || null;
  },

  /** 汇总某角色已装备的属性加成 */
  gearBonus(owned) {
    const b = { hp: 0, atk: 0, def: 0, spd: 0, crit: 0 };
    if (!owned.equip) return b;
    ['weapon', 'armor', 'accessory', 'ex'].forEach(slot => {
      const iid = owned.equip[slot];
      if (!iid) return;
      const inst = this.getGearInst(iid);
      if (!inst) return;
      const tpl = this.getGearTpl(inst.tpl);
      if (!tpl) return;
      Object.keys(tpl.stats).forEach(k => { b[k] = (b[k] || 0) + tpl.stats[k]; });
    });
    return b;
  },

  /** 新增一件装备到背包，返回 iid */
  addGear(tplId) {
    const iid = 'g' + (this.state._gearSeq++);
    this.state.inventory.push({ iid, tpl: tplId });
    return iid;
  },

  /** 给角色装备某件 gear（同件只能被一名角色装备） */
  equipGear(uid, iid) {
    const o = this.getOwned(uid);
    const inst = this.getGearInst(iid);
    if (!o || !inst) return { ok: false, msg: '装备不存在' };
    const tpl = this.getGearTpl(inst.tpl);
    if (!tpl) return { ok: false, msg: '装备无效' };
    if (tpl.type === 'ex' && tpl.owner !== o.charId) {
      return { ok: false, msg: '专属武器无法装备给该角色' };
    }
    const slot = tpl.type; // weapon/armor/accessory/ex
    // 从其他角色身上卸下同一件
    this.state.roster.forEach(x => {
      if (!x.equip) return;
      ['weapon', 'armor', 'accessory', 'ex'].forEach(s => { if (x.equip[s] === iid) x.equip[s] = null; });
    });
    o.equip[slot] = iid;
    this.save();
    return { ok: true };
  },

  unequipGear(uid, slot) {
    const o = this.getOwned(uid);
    if (o && o.equip) { o.equip[slot] = null; this.save(); }
  },

  /** 找出该 iid 当前被哪名角色装备（返回 owned 或 null） */
  gearEquippedBy(iid) {
    return this.state.roster.find(o => o.equip &&
      ['weapon', 'armor', 'accessory', 'ex'].some(s => o.equip[s] === iid)) || null;
  },

  /** 锻造通用装备：花金币，随机部位+稀有度 */
  craftGear() {
    const C = window.GameData.GEAR.CRAFT;
    if (this.state.gold < C.goldCost) return { ok: false, msg: '金币不足' };
    this.state.gold -= C.goldCost;
    const type = C.types[Math.floor(Math.random() * C.types.length)];
    const r = Math.random();
    let rarity = 3;
    if (r < C.rarityWeight[5]) rarity = 5;
    else if (r < C.rarityWeight[5] + C.rarityWeight[4]) rarity = 4;
    const prefix = { weapon: 'wpn', armor: 'arm', accessory: 'acc' }[type];
    const suffix = { 3: 'r', 4: 'sr', 5: 'ur' }[rarity];
    const tplId = `${prefix}_${suffix}`;
    const iid = this.addGear(tplId);
    this.save();
    return { ok: true, tplId, iid };
  },

  /** 打造某角色的专属武器（花宝石，每角色一件） */
  forgeEx(uid) {
    const o = this.getOwned(uid);
    if (!o) return { ok: false, msg: '角色不存在' };
    const tplId = 'ex_' + o.charId;
    const tpl = this.getGearTpl(tplId);
    if (!tpl) return { ok: false, msg: '该角色暂无专属武器' };
    // 已拥有则不可重复打造
    if (this.state.inventory.some(g => g.tpl === tplId)) {
      return { ok: false, msg: '已拥有该专属武器' };
    }
    if (this.state.gem < tpl.gemCost) return { ok: false, msg: '宝石不足' };
    this.state.gem -= tpl.gemCost;
    const iid = this.addGear(tplId);
    this.save();
    return { ok: true, tplId, iid };
  },

  /** 升级所需经验 */
  expToNext(level) {
    return Math.round(50 + level * level * 12);
  },

  /** 给某角色加经验，自动升级。返回升了几级 */
  addExp(owned, amount) {
    let levelsGained = 0;
    owned.exp += amount;
    while (owned.level < 60 && owned.exp >= this.expToNext(owned.level)) {
      owned.exp -= this.expToNext(owned.level);
      owned.level++;
      levelsGained++;
    }
    return levelsGained;
  },

  /** 花金币升级一次 */
  levelUpWithGold(uid) {
    const owned = this.getOwned(uid);
    if (!owned || owned.level >= 60) return { ok: false, msg: '已达最大等级' };
    const cost = 50 + owned.level * 30;
    if (this.state.gold < cost) return { ok: false, msg: '金币不足' };
    this.state.gold -= cost;
    owned.level++;
    owned.exp = 0;
    this.save();
    return { ok: true, cost, level: owned.level };
  },

  levelUpCost(level) {
    return 50 + level * 30;
  },

  // ---------- 队伍管理 ----------

  getOwned(uid) {
    return this.state.roster.find(o => o.uid === uid);
  },

  inTeam(uid) {
    return this.state.team.includes(uid);
  },

  toggleTeam(uid) {
    const idx = this.state.team.indexOf(uid);
    if (idx >= 0) {
      this.state.team.splice(idx, 1);
    } else {
      if (this.state.team.length >= 4) return { ok: false, msg: '队伍已满（最多 4 人）' };
      this.state.team.push(uid);
    }
    this.save();
    return { ok: true };
  },

  // ---------- 抽卡 ----------

  rollRarity() {
    const r = Math.random();
    // 软保底：90 抽必出 5★
    if (this.state.pity >= 89) return 5;
    const { rates } = window.GameData.GACHA;
    if (r < rates[5]) return 5;
    if (r < rates[5] + rates[4]) return 4;
    return 3;
  },

  /** 抽一次卡，返回获得的角色信息 */
  gachaPull() {
    if (this.state.gem < window.GameData.GACHA.cost) {
      return { ok: false, msg: '宝石不足' };
    }
    this.state.gem -= window.GameData.GACHA.cost;
    const rarity = this.rollRarity();
    if (rarity === 5) this.state.pity = 0;
    else this.state.pity++;

    const pool = window.GameData.GACHA.pool[rarity];
    const charId = pool[Math.floor(Math.random() * pool.length)];

    // 已拥有则转化为升星碎片（这里简单给宝石返还）
    const already = this.state.roster.some(o => o.charId === charId);
    let dup = false;
    if (already && rarity < 5) {
      dup = true;
      this.state.gem += 20; // 重复返还
    }
    const owned = this.makeOwned(charId, 1);
    this.state.roster.push(owned);
    this.save();
    return { ok: true, charId, rarity, dup, owned };
  },

  // ---------- 关卡结算 ----------

  /** 战斗胜利结算奖励 */
  rewardStage(stage, firstClear) {
    const r = stage.reward;
    this.state.gold += r.gold;
    this.state.gem += firstClear ? r.gem : Math.round(r.gem * 0.3);
    // 经验分配给出战队伍
    this.state.team.forEach(uid => {
      const o = this.getOwned(uid);
      if (o) this.addExp(o, r.exp);
    });
    if (firstClear && !this.state.cleared.includes(stage.id)) {
      this.state.cleared.push(stage.id);
    }
    // 装备掉落：40% 概率掉一件通用装备，越后期关卡稀有度越高
    let drop = null;
    if (Math.random() < 0.40) {
      const C = window.GameData.GEAR.CRAFT;
      const type = C.types[Math.floor(Math.random() * C.types.length)];
      // 关卡 id 越大，高稀有度概率越高
      const bonus = Math.min(0.30, stage.id * 0.04);
      const rr = Math.random();
      let rarity = 3;
      if (rr < C.rarityWeight[5] + bonus) rarity = 5;
      else if (rr < C.rarityWeight[5] + C.rarityWeight[4] + bonus) rarity = 4;
      const prefix = { weapon: 'wpn', armor: 'arm', accessory: 'acc' }[type];
      const suffix = { 3: 'r', 4: 'sr', 5: 'ur' }[rarity];
      drop = `${prefix}_${suffix}`;
      this.addGear(drop);
    }
    this.save();
    return { drop };
  },
};

window.Game = Game;
