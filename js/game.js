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
    if (!this.state.worldFlags) this.state.worldFlags = {};
    if (!this.state.chapterProgress) this.state.chapterProgress = {};
    if (this.state.spark == null) this.state.spark = 0;
    if (this.state.powder == null) this.state.powder = 0;
    if (this.state.firstTen == null) this.state.firstTen = false;
    if (this.state.trialMax == null) this.state.trialMax = 0;
    if (!this.state.daily) this.state.daily = { lastClaim: null, streak: 0 };
    if (!this.state.quests) this.state.quests = { date: null, progress: { win: 0, pull: 0, levelup: 0 }, claimed: {} };
    if (!this.state.shop) this.state.shop = { date: null, slots: [], bought: {} };
    this.state.roster.forEach(o => {
      if (!o.equip) o.equip = { weapon: null, armor: null, accessory: null, ex: null };
      if (o.plus == null) o.plus = 0;
      // 服装：补齐 + 把老的 'base' 规范化为 'base_<charId>'
      if (!o.costumes || !o.costumes.length) o.costumes = ['base_' + o.charId];
      o.costumes = o.costumes.map(c => (c === 'base' ? 'base_' + o.charId : c));
      if (!o.activeCostume || o.activeCostume === 'base') o.activeCostume = 'base_' + o.charId;
    });
    // 升星迁移：把同名角色的重复实例合并为突破等级
    this._mergeDuplicates();
    // 初始化当日任务/商店
    this.ensureDaily();
    return this.state;
  },

  /** 合并 roster 中同 charId 的重复实例：保留最高等级，每个多余实例 +1 突破 */
  _mergeDuplicates() {
    const orig = this.state.roster;
    const cidByUid = {};
    orig.forEach(o => { cidByUid[o.uid] = o.charId; });
    const merged = {};
    orig.forEach(o => {
      const ex = merged[o.charId];
      if (!ex) {
        merged[o.charId] = o;
      } else {
        ex.level = Math.max(ex.level, o.level);
        ex.plus = Math.min(5, (ex.plus || 0) + 1);
      }
    });
    this.state.roster = Object.values(merged);
    // 重映射队伍 uid（被合并掉的实例 → 幸存实例）
    this.state.team = [...new Set((this.state.team || []).map(uid => {
      const cid = cidByUid[uid];
      const s = this.state.roster.find(o => o.charId === cid);
      return s ? s.uid : null;
    }).filter(Boolean))];
  },

  /** 新游戏的初始状态 */
  newGame() {
    return {
      gold: 1000,
      gem: 2000,
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
      // 探索地图的一次性标记（宝箱等）
      worldFlags: {},
      // 章节推进进度：{ chapterId: 已完成步数 }
      chapterProgress: {},
      // 抽卡保底计数（距上次 5★）
      pity: 0,
      firstTen: false, // 首次十连保底（必出 5★）是否已用
      trialMax: 0,     // 试炼之塔已通关的最高层数（用于解锁下一层）
      // 保底货币
      spark: 0,    // 闪耀之星：每抽 +1，200 兑换自选服装
      powder: 0,   // 希望之粉：每抽 +10，商店兑换必出 5★
      // 运营系统
      daily: { lastClaim: null, streak: 0 },
      quests: { date: null, progress: { win: 0, pull: 0, levelup: 0 }, claimed: {} },
      shop: { date: null, slots: [], bought: {} },
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
      plus: 0, // 突破等级 0~5
      costumes: ['base_' + charId],      // 拥有的服装 id 列表
      activeCostume: 'base_' + charId,   // 当前装扮（决定属性/外观）
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

  // ---------- 服装（BD2 模型：服装=收集单位，自带属性+招式）----------

  /** 规范化服装 id（兼容老存档 'base'） */
  normCostumeId(charId, id) {
    if (!id || id === 'base') return 'base_' + charId;
    return id;
  },

  /** 取某服装定义 */
  costumeDef(charId, costumeId) {
    const id = this.normCostumeId(charId, costumeId);
    return window.GameData.COSTUMES[id] || window.GameData.COSTUMES['base_' + charId];
  },

  /** 当前装扮定义（决定属性/外观） */
  activeCostumeDef(owned) {
    return this.costumeDef(owned.charId, owned.activeCostume);
  },
  activeElement(owned) { return this.activeCostumeDef(owned).element; },
  activeColor(owned) { return this.activeCostumeDef(owned).color; },

  /** 拥有的服装 id 列表（规范化、去重） */
  ownedCostumeIds(owned) {
    const out = [];
    (owned.costumes || []).forEach(cid => {
      const id = this.normCostumeId(owned.charId, cid);
      if (!out.includes(id)) out.push(id);
    });
    if (!out.length) out.push('base_' + owned.charId);
    return out;
  },

  /** 战斗技能池：普通攻击 + 各拥有服装的专属招式（去重） */
  battleSkills(owned) {
    const skills = ['basic_attack'];
    this.ownedCostumeIds(owned).forEach(cid => {
      const c = window.GameData.COSTUMES[cid];
      if (c && c.signature && !skills.includes(c.signature)) skills.push(c.signature);
    });
    return skills;
  },

  switchCostume(uid, costumeId) {
    const o = this.getOwned(uid);
    if (!o) return { ok: false };
    const id = this.normCostumeId(o.charId, costumeId);
    if (!this.ownedCostumeIds(o).includes(id)) return { ok: false, msg: '尚未拥有该服装' };
    o.activeCostume = id;
    this.save();
    return { ok: true };
  },

  /** 突破属性倍率：每级 +8% */
  plusMult(owned) {
    return 1 + (owned.plus || 0) * 0.08;
  },

  /** 根据「当前服装属性」+ 等级 + 突破 + 装备计算最终属性 */
  computeStats(owned) {
    const cos = this.activeCostumeDef(owned);
    const lv = owned.level - 1;
    const pm = this.plusMult(owned);
    const g = this.gearBonus(owned);
    return {
      maxHp: Math.round((cos.stats.hp + cos.grow.hp * lv) * pm) + g.hp,
      atk:   Math.round((cos.stats.atk + cos.grow.atk * lv) * pm) + g.atk,
      def:   Math.round((cos.stats.def + cos.grow.def * lv) * pm) + g.def,
      spd:   cos.stats.spd + g.spd,
      crit:  cos.stats.crit + g.crit,
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

  /** 装备评分（用于一键装备挑最优） */
  gearScore(tpl) {
    const s = tpl.stats || {};
    return (s.atk || 0) + (s.def || 0) * 1.2 + (s.hp || 0) / 8 + (s.crit || 0) * 800;
  },

  /** 该角色是否拥有「背包里未装备的」专属武器 */
  hasUnequippedEx(charId) {
    const exId = 'ex_' + charId;
    return this.state.inventory.some(g => g.tpl === exId && !this.gearEquippedBy(g.iid));
  },

  /** 某槽位背包中评分最高的未装备件，返回 iid */
  bestUnequippedGear(type, charId) {
    let best = null, bestScore = -1;
    this.state.inventory.forEach(g => {
      const tpl = this.getGearTpl(g.tpl);
      if (!tpl) return;
      if (type === 'ex') { if (tpl.type !== 'ex' || tpl.owner !== charId) return; }
      else if (tpl.type !== type) return;
      if (this.gearEquippedBy(g.iid)) return;
      const sc = this.gearScore(tpl);
      if (sc > bestScore) { bestScore = sc; best = g.iid; }
    });
    return best;
  },

  /** 一键装备：为空槽位填入最优件，并自动识别专属武器 */
  autoEquip(uid) {
    const o = this.getOwned(uid);
    if (!o) return { ok: false };
    let count = 0;
    ['weapon', 'armor', 'accessory', 'ex'].forEach(slot => {
      if (o.equip[slot]) return; // 已装备的不覆盖
      const iid = this.bestUnequippedGear(slot, o.charId);
      if (iid) { const r = this.equipGear(uid, iid); if (r.ok) count++; }
    });
    this.save();
    return { ok: true, count };
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

  /** 专属武器招募（只从抽奖产出，按稀有度概率） */
  gachaEx() {
    const G = window.GameData.GEAR.exGacha;
    if (this.state.gem < G.cost) return { ok: false, msg: '宝石不足' };
    this.state.gem -= G.cost;
    const r = Math.random();
    let rarity = 3;
    if (r < G.rates[5]) rarity = 5;
    else if (r < G.rates[5] + G.rates[4]) rarity = 4;
    const pool = window.GameData.GEAR.exPool[rarity];
    const tplId = pool[Math.floor(Math.random() * pool.length)];
    const result = { ok: true, tplId, rarity, dup: false };
    if (this.state.inventory.some(g => g.tpl === tplId)) {
      // 重复专属武器 → 返还宝石
      const refund = rarity === 5 ? 60 : rarity === 4 ? 30 : 15;
      this.state.gem += refund; result.dup = true; result.refund = refund;
    } else {
      this.addGear(tplId);
    }
    this.save();
    return result;
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
    this.incQuest('levelup', 1);
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
      if (this.state.team.length >= 5) return { ok: false, msg: "队伍已满（最多 5 人）" };
      this.state.team.push(uid);
    }
    this.save();
    return { ok: true };
  },

  // 将某角色放入指定出战位（用于主页队伍框按位置编辑 / 替换）
  setTeamSlot(slotIdx, uid) {
    if (this.state.team.includes(uid)) return { ok: false, msg: "该角色已在队伍中" };
    if (slotIdx < this.state.team.length) {
      this.state.team[slotIdx] = uid; // 替换该位置原有角色
    } else if (this.state.team.length < 5) {
      this.state.team.push(uid);      // 空位上阵
    } else {
      return { ok: false, msg: "队伍已满（最多 5 人）" };
    }
    this.save();
    return { ok: true };
  },

  // 清空指定出战位
  clearTeamSlot(slotIdx) {
    if (slotIdx < this.state.team.length) {
      this.state.team.splice(slotIdx, 1);
      this.save();
    }
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

  /** 把一套服装发给玩家（处理新角色/新服装/重复突破） */
  grantCostume(costumeId) {
    const cdef = window.GameData.COSTUMES[costumeId];
    const charId = cdef.charId;
    const result = { ok: true, costumeId, charId, rarity: cdef.rarity, isNew: false, newCostume: false, plusUp: false, plus: 0, refund: 0 };
    let owned = this.state.roster.find(o => o.charId === charId);
    if (!owned) {
      owned = this.makeOwned(charId, 1);
      owned.costumes = [costumeId];
      owned.activeCostume = costumeId;
      this.state.roster.push(owned);
      result.isNew = true; result.newCostume = true;
    } else if (!this.ownedCostumeIds(owned).includes(costumeId)) {
      owned.costumes.push(costumeId);
      result.newCostume = true;
    } else {
      if ((owned.plus || 0) < 5) {
        owned.plus = (owned.plus || 0) + 1;
        result.plusUp = true; result.plus = owned.plus;
      } else {
        const refund = cdef.rarity === 5 ? 50 : (cdef.rarity === 4 ? 25 : 10);
        this.state.gem += refund; result.refund = refund; result.plus = 5;
      }
    }
    return result;
  },

  /** 抽一次「服装」（force 可强制稀有度，用于首抽十连保底） */
  gachaPull(force) {
    if (this.state.gem < window.GameData.GACHA.cost) {
      return { ok: false, msg: '宝石不足' };
    }
    this.state.gem -= window.GameData.GACHA.cost;
    const rarity = force || this.rollRarity();
    if (rarity === 5) this.state.pity = 0;
    else this.state.pity++;
    // 保底货币 + 任务
    this.state.spark += 1;
    this.state.powder += 10;
    this.incQuest('pull', 1);

    const pool = window.GameData.COSTUME_POOL[rarity];
    const costumeId = pool[Math.floor(Math.random() * pool.length)];
    const result = this.grantCostume(costumeId);
    result.rarity = rarity;
    this.save();
    return result;
  },

  // ---------- 运营系统：签到 / 任务 / 商店 / 保底兑换 ----------

  CHECKIN: [
    { gold: 300 }, { gem: 60 }, { powder: 60 }, { gold: 600 },
    { gem: 120 }, { gear: 'arm_sr' }, { gem: 240, powder: 120 },
  ],
  QUESTS: [
    { id: 'q_win', name: '进行 3 场战斗', key: 'win', target: 3, reward: { gem: 100 } },
    { id: 'q_pull', name: '进行 1 次招募', key: 'pull', target: 1, reward: { gold: 300 } },
    { id: 'q_lvl', name: '升级佣兵 2 次', key: 'levelup', target: 2, reward: { gem: 60 } },
  ],
  SPARK_COST: 200,
  POWDER_COST: 200,

  today() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  /** 跨日重置任务与商店 */
  ensureDaily() {
    const t = this.today();
    if (this.state.quests.date !== t) {
      this.state.quests = { date: t, progress: { win: 0, pull: 0, levelup: 0 }, claimed: {} };
    }
    if (this.state.shop.date !== t || !this.state.shop.slots || !this.state.shop.slots.length) {
      this.state.shop = { date: t, slots: this.rollShop(), bought: {} };
    }
  },

  incQuest(key, n) {
    this.ensureDaily();
    this.state.quests.progress[key] = (this.state.quests.progress[key] || 0) + n;
    this.save();
  },

  applyReward(r) {
    if (r.gold) this.state.gold += r.gold;
    if (r.gem) this.state.gem += r.gem;
    if (r.powder) this.state.powder += r.powder;
    if (r.spark) this.state.spark += r.spark;
    if (r.gear) this.addGear(r.gear);
  },

  canCheckIn() { return this.state.daily.lastClaim !== this.today(); },

  checkIn() {
    if (!this.canCheckIn()) return { ok: false, msg: '今日已签到' };
    const idx = (this.state.daily.streak || 0) % 7;
    const reward = this.CHECKIN[idx];
    this.applyReward(reward);
    this.state.daily.lastClaim = this.today();
    this.state.daily.streak = (this.state.daily.streak || 0) + 1;
    this.save();
    return { ok: true, reward, day: idx + 1 };
  },

  claimQuest(id) {
    this.ensureDaily();
    const q = this.QUESTS.find(x => x.id === id);
    if (!q) return { ok: false };
    if (this.state.quests.claimed[id]) return { ok: false, msg: '已领取' };
    if ((this.state.quests.progress[q.key] || 0) < q.target) return { ok: false, msg: '未完成' };
    this.applyReward(q.reward);
    this.state.quests.claimed[id] = true;
    this.save();
    return { ok: true, reward: q.reward };
  },

  /** 闪耀之星兑换自选服装 */
  sparkExchange(costumeId) {
    if ((this.state.spark || 0) < this.SPARK_COST) return { ok: false, msg: '闪耀之星不足' };
    if (!window.GameData.COSTUMES[costumeId]) return { ok: false, msg: '无效服装' };
    this.state.spark -= this.SPARK_COST;
    const result = this.grantCostume(costumeId);
    this.save();
    return { ok: true, result };
  },

  /** 希望之粉兑换必出 5★ 服装 */
  powderBox() {
    if ((this.state.powder || 0) < this.POWDER_COST) return { ok: false, msg: '希望之粉不足' };
    this.state.powder -= this.POWDER_COST;
    const pool = window.GameData.COSTUME_POOL[5];
    const id = pool[Math.floor(Math.random() * pool.length)];
    const result = this.grantCostume(id);
    this.save();
    return { ok: true, result };
  },

  rollShop() {
    const tpls = ['wpn_sr', 'arm_sr', 'acc_sr', 'wpn_ur', 'arm_ur', 'acc_ur'];
    const slots = [];
    for (let i = 0; i < 3; i++) {
      const t = tpls[Math.floor(Math.random() * tpls.length)];
      const tpl = this.getGearTpl(t);
      slots.push({ tpl: t, price: tpl.rarity === 5 ? 1500 : 600 });
    }
    return slots;
  },

  buyShopItem(idx) {
    this.ensureDaily();
    if (this.state.shop.bought[idx]) return { ok: false, msg: '已售出' };
    const slot = this.state.shop.slots[idx];
    if (!slot) return { ok: false };
    if (this.state.gold < slot.price) return { ok: false, msg: '金币不足' };
    this.state.gold -= slot.price;
    this.addGear(slot.tpl);
    this.state.shop.bought[idx] = true;
    this.save();
    return { ok: true, tpl: slot.tpl };
  },

  // ---------- 关卡结算 ----------

  /** 战斗胜利结算奖励 */
  rewardStage(stage, firstClear) {
    const r = stage.reward;
    this.state.gold += r.gold;
    this.state.gem += firstClear ? r.gem : Math.round(r.gem * 0.3);
    this.incQuest('win', 1);
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
