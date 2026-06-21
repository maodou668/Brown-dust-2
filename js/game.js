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
      // 抽卡保底计数（距上次 5★）
      pity: 0,
      _uidSeq: 1,
    };
  },

  /** 生成一个已拥有角色实例 */
  makeOwned(charId, level = 1) {
    const uid = 'u' + (this.state ? this.state._uidSeq++ : Date.now() + Math.random());
    return { uid, charId, level, exp: 0, star: window.GameData.CHARACTERS[charId].rarity };
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

  /** 根据等级计算角色最终属性 */
  computeStats(owned) {
    const def = window.GameData.CHARACTERS[owned.charId];
    const lv = owned.level - 1;
    return {
      maxHp: Math.round(def.base.hp + def.grow.hp * lv),
      atk:   Math.round(def.base.atk + def.grow.atk * lv),
      def:   Math.round(def.base.def + def.grow.def * lv),
      spd:   def.base.spd,
      crit:  def.base.crit,
    };
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
    this.save();
  },
};

window.Game = Game;
