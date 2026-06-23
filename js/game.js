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
    // 装备深化迁移：旧装备补强化等级与副词条
    this.state.inventory.forEach(g => {
      if (g.lvl == null) g.lvl = 0;
      if (!g.subs) { const tpl = this.getGearTpl(g.tpl); g.subs = tpl ? this.rollSubs(tpl.rarity) : []; }
    });
    if (!this.state.worldFlags) this.state.worldFlags = {};
    if (!this.state.chapterProgress) this.state.chapterProgress = {};
    if (this.state.spark == null) this.state.spark = 0;
    if (this.state.powder == null) this.state.powder = 0;
    if (this.state.firstTen == null) this.state.firstTen = false;
    if (this.state.trialMax == null) this.state.trialMax = 0;
    if (!this.state.stats) this.state.stats = { pulls: 0, wins: 0 };
    if (!this.state.achClaimed) this.state.achClaimed = {};
    if (!this.state.daily) this.state.daily = { lastClaim: null, streak: 0 };
    if (!this.state.quests) this.state.quests = { date: null, progress: { win: 0, pull: 0, levelup: 0 }, claimed: {} };
    if (!this.state.shop) this.state.shop = { date: null, slots: [], bought: {} };
    if (this.state.stamina == null) { this.state.stamina = 120; this.state.staminaTs = Date.now(); }
    if (!this.state.dispatch) this.state.dispatch = { slots: [null, null, null] };
    if (this.state.awakenStone == null) this.state.awakenStone = 0;
    if (!this.state.event) this.state.event = { date: null, runs: {}, coin: 0, stock: {} };
    this.state.roster.forEach(o => { if (o.aff == null) o.aff = 0; if (o.awaken == null) o.awaken = 0; });
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
    // 修复历史存档的 uid 冲突，并据此重建出战队伍（修复「佣兵有角色但出战不显示」）
    this._repairIds();
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

  /**
   * 修复 uid 冲突：历史存档中（尤其重置存档后）可能出现两个角色共用同一 uid，
   * 导致其中一个被当成「已出战」而在编队界面消失。这里：
   *  1) 先按 charId 记录队伍意图；2) 给所有重复/缺失 uid 的实例重新分配唯一 uid；
   *  3) 再按 charId 重建出战队伍（去重、限 5 人），保证 roster 与 team 始终一致。
   */
  _repairIds() {
    const roster = this.state.roster || [];
    // 1) 队伍意图：按当前 uid 解析出 charId（去重、保序）
    const teamCids = [];
    (this.state.team || []).forEach(uid => {
      const o = roster.find(x => x.uid === uid);
      if (o && !teamCids.includes(o.charId)) teamCids.push(o.charId);
    });
    // 2) 唯一化 uid
    const used = new Set();
    let seq = this.state._uidSeq || 1;
    const nextUid = () => { let u; do { u = 'u' + (seq++); } while (used.has(u) || roster.some(o => o.uid === u)); return u; };
    roster.forEach(o => {
      if (!o.uid || used.has(o.uid)) o.uid = nextUid();
      used.add(o.uid);
    });
    this.state._uidSeq = seq;
    // 3) 按 charId 重建队伍（roster 已按 charId 去重，charId→uid 唯一）
    this.state.team = teamCids
      .map(cid => { const o = roster.find(x => x.charId === cid); return o ? o.uid : null; })
      .filter(Boolean)
      .slice(0, 5);
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
      stats: { pulls: 0, wins: 0 }, // 终身统计（成就用）
      achClaimed: {},  // 已领取的成就 id
      // 保底货币
      spark: 0,    // 闪耀之星：每抽 +1，200 兑换自选服装
      powder: 0,   // 希望之粉：每抽 +10，商店兑换必出 5★
      // 运营系统
      daily: { lastClaim: null, streak: 0 },
      quests: { date: null, progress: { win: 0, pull: 0, levelup: 0 }, claimed: {} },
      shop: { date: null, slots: [], bought: {} },
      stamina: 120, staminaTs: Date.now(),     // 体力（资源副本消耗，随时间回复）
      awakenStone: 0,                          // 觉醒石（角色觉醒消耗）
      dispatch: { slots: [null, null, null] }, // 远征派遣槽（离线挂机）
      event: { date: null, runs: {}, coin: 0, stock: {} },  // 限时活动（活动本+活动商店）
      _uidSeq: 1,
      _gearSeq: 1,
    };
  },

  /** 生成全局唯一的 uid（扫描现有 roster，杜绝冲突） */
  freshUid() {
    const roster = (this.state && this.state.roster) || [];
    let seq = (this.state && this.state._uidSeq) || 1;
    let uid;
    do { uid = 'u' + (seq++); } while (roster.some(o => o.uid === uid));
    if (this.state) this.state._uidSeq = seq;
    return uid;
  },

  /** 生成一个已拥有角色实例 */
  makeOwned(charId, level = 1) {
    const uid = this.freshUid();
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

  /** 导出存档为可分享的字符串（清缓存/换设备的兜底） */
  exportSave() {
    try {
      const json = JSON.stringify(this.state);
      // 用 encodeURIComponent 兼容中文，再 base64
      return 'BD2' + btoa(unescape(encodeURIComponent(json)));
    } catch (e) { return null; }
  },

  /** 导入存档字符串；成功则替换当前存档并跑迁移 */
  importSave(code) {
    if (!code || typeof code !== 'string') return { ok: false, msg: '存档码为空' };
    code = code.trim();
    if (code.startsWith('BD2')) code = code.slice(3);
    let data;
    try {
      data = JSON.parse(decodeURIComponent(escape(atob(code))));
    } catch (e) { return { ok: false, msg: '存档码无效或已损坏' }; }
    if (!data || !Array.isArray(data.roster)) return { ok: false, msg: '不是有效的存档' };
    this.state = data;
    this.save();   // 先落盘，避免 init() 从 localStorage 读回旧档
    this.init();   // 跑迁移（补字段、修 uid、装备词条等）
    this.save();
    return { ok: true };
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

  /** 好感等级（0~10，每 100 好感 1 级）+ 觉醒倍率 */
  affLevel(owned) { return Math.min(10, Math.floor((owned.aff || 0) / 100)); },
  affMult(owned) { return 1 + this.affLevel(owned) * 0.01; },     // 好感：+1%/级 攻击与生命
  awakenMult(owned) { return 1 + (owned.awaken || 0) * 0.06; },   // 觉醒：+6%/级 全属性

  /** 根据「当前服装属性」+ 等级 + 突破 + 觉醒 + 好感 + 装备计算最终属性 */
  computeStats(owned) {
    const cos = this.activeCostumeDef(owned);
    const lv = owned.level - 1;
    const pm = this.plusMult(owned);
    const am = this.affMult(owned), wm = this.awakenMult(owned);
    const g = this.gearBonus(owned);
    return {
      maxHp: Math.round((cos.stats.hp + cos.grow.hp * lv) * pm * am * wm) + g.hp,
      atk:   Math.round((cos.stats.atk + cos.grow.atk * lv) * pm * am * wm) + g.atk,
      def:   Math.round((cos.stats.def + cos.grow.def * lv) * pm * wm) + g.def,
      spd:   cos.stats.spd + g.spd,
      crit:  cos.stats.crit + g.crit,
    };
  },

  // 好感（赠礼提升）
  GIFT_COST: 200, GIFT_AFF: 25, AFF_MAX: 1000,
  giveGift(uid) {
    const o = this.getOwned(uid); if (!o) return { ok: false };
    if ((o.aff || 0) >= this.AFF_MAX) return { ok: false, msg: '好感已满' };
    if (this.state.gold < this.GIFT_COST) return { ok: false, msg: '金币不足' };
    this.state.gold -= this.GIFT_COST;
    o.aff = Math.min(this.AFF_MAX, (o.aff || 0) + this.GIFT_AFF);
    this.save();
    return { ok: true, aff: o.aff, lv: this.affLevel(o) };
  },
  // 觉醒（消耗觉醒石 + 金币，提升星级与全属性）
  awakenCost(lv) { return { stone: 2 + lv * 2, gold: 2000 + lv * 2000 }; },
  awakenChar(uid) {
    const o = this.getOwned(uid); if (!o) return { ok: false };
    const lv = o.awaken || 0;
    if (lv >= 5) return { ok: false, msg: '已达最高觉醒' };
    const c = this.awakenCost(lv);
    if ((this.state.awakenStone || 0) < c.stone) return { ok: false, msg: '觉醒石不足' };
    if (this.state.gold < c.gold) return { ok: false, msg: '金币不足' };
    this.state.awakenStone -= c.stone; this.state.gold -= c.gold;
    o.awaken = lv + 1;
    this.save();
    return { ok: true, awaken: o.awaken };
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
  // ---------- 装备深化：强化 / 副词条 / 套装 ----------
  GEAR_MAX_LVL: 15,
  enhanceMult(lvl) { return 1 + (lvl || 0) * 0.05; }, // 主属性每级 +5%（满 +15 = +75%）
  enhanceCost(inst) {
    const tpl = this.getGearTpl(inst.tpl);
    const r = tpl ? tpl.rarity : 3;
    return Math.round((80 + (inst.lvl || 0) * 70) * (r === 5 ? 2 : r === 4 ? 1.5 : 1));
  },
  SUB_POOL: ['atk', 'def', 'hp', 'crit', 'spd'],
  SUB_BASE: { atk: 8, def: 5, hp: 60, crit: 0.02, spd: 3 },
  /** 按稀有度掷副词条：R=1 / SR=2 / UR=3 条 */
  rollSubs(rarity) {
    const n = rarity === 5 ? 3 : rarity === 4 ? 2 : 1;
    const w = rarity === 5 ? 2.4 : rarity === 4 ? 1.6 : 1;
    const pool = this.SUB_POOL.slice();
    const subs = [];
    for (let i = 0; i < n && pool.length; i++) {
      const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      let v = this.SUB_BASE[k] * w * (0.7 + Math.random() * 0.6);
      v = (k === 'crit') ? Math.round(v * 1000) / 1000 : Math.round(v);
      subs.push({ k, v });
    }
    return subs;
  },
  /** 套装：三件通用装备同稀有度时的额外加成 */
  setBonusOf(owned) {
    const b = { hp: 0, atk: 0, def: 0, spd: 0, crit: 0, name: '' };
    if (!owned.equip) return b;
    const rs = ['weapon', 'armor', 'accessory'].map(slot => {
      const iid = owned.equip[slot]; if (!iid) return null;
      const inst = this.getGearInst(iid); if (!inst) return null;
      const tpl = this.getGearTpl(inst.tpl); return tpl ? tpl.rarity : null;
    });
    if (rs.every(r => r === 5)) { b.crit += 0.08; b.atk += 40; b.spd += 6; b.name = '传说三件套'; }
    else if (rs.every(r => r === 4)) { b.crit += 0.04; b.atk += 20; b.name = '稀有三件套'; }
    else if (rs.every(r => r === 3)) { b.hp += 120; b.name = '坚甲三件套'; }
    return b;
  },
  enhanceGear(iid) {
    const inst = this.getGearInst(iid);
    if (!inst) return { ok: false };
    if ((inst.lvl || 0) >= this.GEAR_MAX_LVL) return { ok: false, msg: '已达最高强化' };
    const cost = this.enhanceCost(inst);
    if (this.state.gold < cost) return { ok: false, msg: '金币不足' };
    this.state.gold -= cost;
    inst.lvl = (inst.lvl || 0) + 1;
    this.save();
    return { ok: true, lvl: inst.lvl, cost };
  },

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
      const em = this.enhanceMult(inst.lvl);           // 强化：放大主属性
      Object.keys(tpl.stats).forEach(k => { b[k] = (b[k] || 0) + tpl.stats[k] * em; });
      (inst.subs || []).forEach(s => { b[s.k] = (b[s.k] || 0) + s.v; }); // 副词条
    });
    // 套装加成
    const sb = this.setBonusOf(owned);
    ['hp', 'atk', 'def', 'spd', 'crit'].forEach(k => { b[k] += sb[k]; });
    ['hp', 'atk', 'def', 'spd'].forEach(k => { b[k] = Math.round(b[k]); });
    return b;
  },

  /** 新增一件装备到背包，返回 iid */
  addGear(tplId) {
    const iid = 'g' + (this.state._gearSeq++);
    const tpl = this.getGearTpl(tplId);
    const subs = tpl ? this.rollSubs(tpl.rarity) : [];
    this.state.inventory.push({ iid, tpl: tplId, lvl: 0, subs });
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

  /** 一键分解：未装备的 R/SR 通用装备转为金币 */
  dismantleGear() {
    let gold = 0, n = 0;
    this.state.inventory = this.state.inventory.filter(g => {
      const tpl = this.getGearTpl(g.tpl);
      if (tpl && tpl.type !== 'ex' && tpl.rarity < 5 && !this.gearEquippedBy(g.iid)) {
        gold += (tpl.rarity === 4 ? 300 : 100) + (g.lvl || 0) * 50; n++; return false;
      }
      return true;
    });
    this.state.gold += gold; this.save();
    return { n, gold };
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
    this.state.stats.pulls++;
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

  // 上阵 / 移出（佣兵列表的快捷部署）
  toggleDeploy(uid) {
    const idx = this.state.team.indexOf(uid);
    if (idx >= 0) { this.state.team.splice(idx, 1); this.save(); return { ok: true, deployed: false }; }
    if (this.state.team.length >= 5) return { ok: false, msg: '阵形已满，点阵形槽位替换' };
    this.state.team.push(uid); this.save();
    return { ok: true, deployed: true };
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
    this.state.stats.pulls++;
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
    if (r.stone) this.state.awakenStone = (this.state.awakenStone || 0) + r.stone;
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
    this.state.stats.wins++;
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

  /** 一键扫荡：已通关的试炼层，免战斗直接结算（复刷奖励，与再战同档：宝石按 30%） */
  sweepTrial(idx) {
    const t = window.GameData.TRIALS[idx];
    if (!t) return { ok: false, msg: '关卡不存在' };
    if (idx >= (this.state.trialMax || 0)) return { ok: false, msg: '通关该层后才能扫荡' };
    const r = t.reward;
    const gold = r.gold;
    const gem = Math.round(r.gem * 0.3);
    this.state.gold += gold;
    this.state.gem += gem;
    this.state.team.forEach(uid => { const o = this.getOwned(uid); if (o) this.addExp(o, r.exp); });
    // 装备掉落（与 rewardStage 同概率/同加权）
    let drop = null;
    if (Math.random() < 0.40) {
      const C = window.GameData.GEAR.CRAFT;
      const type = C.types[Math.floor(Math.random() * C.types.length)];
      const bonus = Math.min(0.30, t.id * 0.04);
      const rr = Math.random();
      let rarity = 3;
      if (rr < C.rarityWeight[5] + bonus) rarity = 5;
      else if (rr < C.rarityWeight[5] + C.rarityWeight[4] + bonus) rarity = 4;
      drop = { weapon: 'wpn', armor: 'arm', accessory: 'acc' }[type] + '_' + { 3: 'r', 4: 'sr', 5: 'ur' }[rarity];
      this.addGear(drop);
    }
    this.save();
    return { ok: true, gold, gem, exp: r.exp, drop };
  },

  // ============================================================
  //  体力（行动力）—— 随时间回复，资源副本消耗
  // ============================================================
  STAMINA_MAX: 120,
  STAMINA_PER_MS: 5 * 60 * 1000,   // 每 5 分钟回 1 点

  syncStamina() {
    const now = Date.now();
    if (this.state.stamina == null) { this.state.stamina = this.STAMINA_MAX; this.state.staminaTs = now; }
    if (this.state.stamina >= this.STAMINA_MAX) { this.state.staminaTs = now; return; }
    const gained = Math.floor((now - this.state.staminaTs) / this.STAMINA_PER_MS);
    if (gained > 0) {
      this.state.stamina = Math.min(this.STAMINA_MAX, this.state.stamina + gained);
      this.state.staminaTs = this.state.stamina >= this.STAMINA_MAX ? now : this.state.staminaTs + gained * this.STAMINA_PER_MS;
    }
  },
  staminaEtaMs() { // 距下一点回复的毫秒
    this.syncStamina();
    if (this.state.stamina >= this.STAMINA_MAX) return 0;
    return this.STAMINA_PER_MS - (Date.now() - this.state.staminaTs);
  },
  spendStamina(n) {
    this.syncStamina();
    if (this.state.stamina < n) return false;
    if (this.state.stamina >= this.STAMINA_MAX) this.state.staminaTs = Date.now();
    this.state.stamina -= n;
    return true;
  },
  buyStamina() { // 宝石买体力
    if (this.state.gem < 50) return { ok: false, msg: '宝石不足（需 50）' };
    this.state.gem -= 50; this.state.stamina += 60; this.save();
    return { ok: true };
  },

  // 通用装备掉落（scale 越大越易出高稀有）
  rollGear(scale) {
    const C = window.GameData.GEAR.CRAFT;
    const type = C.types[Math.floor(Math.random() * C.types.length)];
    const bonus = Math.min(0.30, (scale || 0) * 0.04);
    const rr = Math.random();
    let rarity = 3;
    if (rr < C.rarityWeight[5] + bonus) rarity = 5;
    else if (rr < C.rarityWeight[5] + C.rarityWeight[4] + bonus) rarity = 4;
    const id = { weapon: 'wpn', armor: 'arm', accessory: 'acc' }[type] + '_' + { 3: 'r', 4: 'sr', 5: 'ur' }[rarity];
    this.addGear(id);
    return id;
  },

  // ============================================================
  //  资源副本（farm）—— 体力换金币/经验/装备，可多倍连刷
  // ============================================================
  FARM: [
    { id: 'gold',  icon: '🪙', name: '金币矿洞', desc: '稳定产出大量金币',     stam: 10, unlock: 1, reward: { gold: 1500 } },
    { id: 'exp',   icon: '📘', name: '修炼之地', desc: '出战队伍获得经验',     stam: 10, unlock: 2, reward: { exp: 800 } },
    { id: 'gear',  icon: '⚒️', name: '装备秘境', desc: '掉落装备 + 金币',      stam: 12, unlock: 4, reward: { gold: 500, gearScale: 6 } },
    { id: 'mixed', icon: '💎', name: '试炼回廊', desc: '综合产出（金/经/装）', stam: 15, unlock: 6, reward: { gold: 800, exp: 500, gearScale: 8 } },
  ],
  farmUnlocked(d) { return this.state.cleared.length >= d.unlock; },
  runFarm(id, times) {
    const d = this.FARM.find(x => x.id === id);
    if (!d) return { ok: false, msg: '副本不存在' };
    if (!this.farmUnlocked(d)) return { ok: false, msg: `通关 ${d.unlock} 关后解锁` };
    times = Math.max(1, times | 0);
    this.syncStamina();
    const cost = d.stam * times;
    if (this.state.stamina < cost) return { ok: false, msg: '体力不足' };
    this.spendStamina(cost);
    const tot = { gold: 0, exp: 0, gears: [] };
    for (let i = 0; i < times; i++) {
      const r = d.reward;
      if (r.gold) { this.state.gold += r.gold; tot.gold += r.gold; }
      if (r.exp) { this.state.team.forEach(uid => { const o = this.getOwned(uid); if (o) this.addExp(o, r.exp); }); tot.exp += r.exp; }
      if (r.gearScale && Math.random() < 0.6) tot.gears.push(this.rollGear(r.gearScale));
    }
    this.incQuest('win', times);
    this.save();
    return { ok: true, tot, cost };
  },

  // ============================================================
  //  远征派遣（dispatch）—— 离线挂机，按真实时间结算
  // ============================================================
  DISPATCH_TIERS: [
    { id: 't1', name: '近郊巡逻', hours: 0.5, icon: '🥾', reward: { gold: 600, exp: 200 } },
    { id: 't2', name: '商路护卫', hours: 2,   icon: '🛡️', reward: { gold: 2000, exp: 700 } },
    { id: 't3', name: '远方探索', hours: 4,   icon: '🧭', reward: { gold: 4200, exp: 1500, gem: 30 } },
    { id: 't4', name: '秘境远征', hours: 8,   icon: '🗺️', reward: { gold: 9000, exp: 3200, gem: 80, stone: 3, gearScale: 6 } },
  ],
  DISPATCH_SLOTS: 3,
  dispatchSlotUnlocked(i) { return i === 0 || this.state.cleared.length >= i * 2; }, // 第2/3槽位需通关进度
  // 派遣加成：参与人数 + 稀有度总和 → 奖励倍率
  dispatchMult(charUids) {
    let sum = 0;
    (charUids || []).forEach(uid => { const o = this.getOwned(uid); if (o) sum += window.GameData.CHARACTERS[o.charId].rarity; });
    return 1 + sum * 0.06; // 每点稀有度 +6%
  },
  startDispatch(slotIdx, tierId, charUids) {
    if (!this.dispatchSlotUnlocked(slotIdx)) return { ok: false, msg: '该派遣位未解锁' };
    if (this.state.dispatch.slots[slotIdx]) return { ok: false, msg: '该位正在派遣中' };
    const tier = this.DISPATCH_TIERS.find(t => t.id === tierId);
    if (!tier) return { ok: false, msg: '任务不存在' };
    charUids = (charUids || []).filter(Boolean);
    if (!charUids.length) return { ok: false, msg: '至少派遣 1 名佣兵' };
    // 不可与其它派遣位重复占用同一角色
    const busy = new Set();
    this.state.dispatch.slots.forEach(s => s && s.charUids.forEach(u => busy.add(u)));
    if (charUids.some(u => busy.has(u))) return { ok: false, msg: '有佣兵正在其它派遣中' };
    this.state.dispatch.slots[slotIdx] = { tierId, charUids, mult: this.dispatchMult(charUids), endTs: Date.now() + tier.hours * 3600 * 1000 };
    this.save();
    return { ok: true };
  },
  dispatchDone(slotIdx) {
    const s = this.state.dispatch.slots[slotIdx];
    return s && Date.now() >= s.endTs;
  },
  dispatchHomeTag() {
    const ready = this.state.dispatch.slots.filter((_, i) => this.dispatchDone(i)).length;
    return ready ? '✓' + ready : '';
  },
  claimDispatch(slotIdx) {
    const s = this.state.dispatch.slots[slotIdx];
    if (!s) return { ok: false, msg: '该位无派遣' };
    if (Date.now() < s.endTs) return { ok: false, msg: '尚未完成' };
    const tier = this.DISPATCH_TIERS.find(t => t.id === s.tierId);
    const r = tier.reward, m = s.mult || 1;
    const got = { gold: 0, exp: 0, gem: 0, gears: [] };
    if (r.gold) { const g = Math.round(r.gold * m); this.state.gold += g; got.gold = g; }
    if (r.gem) { const g = Math.round(r.gem * m); this.state.gem += g; got.gem = g; }
    if (r.exp) { const e = Math.round(r.exp * m); s.charUids.forEach(uid => { const o = this.getOwned(uid); if (o) this.addExp(o, e); }); got.exp = e; }
    if (r.stone) { const st = Math.round(r.stone * m); this.state.awakenStone += st; got.stone = st; }
    if (r.gearScale && Math.random() < 0.7) got.gears.push(this.rollGear(r.gearScale));
    this.state.dispatch.slots[slotIdx] = null;
    this.save();
    return { ok: true, got, tier };
  },
  cancelDispatch(slotIdx) {
    if (this.state.dispatch.slots[slotIdx]) { this.state.dispatch.slots[slotIdx] = null; this.save(); return { ok: true }; }
    return { ok: false };
  },

  // ============================================================
  //  竞技场（模拟 PvP）—— 挑战 AI 防守队，积分排名
  // ============================================================
  ARENA_MAX_ATTEMPTS: 5,
  ARENA_RANKS: [
    { min: 0, name: '青铜', icon: '🥉' }, { min: 1100, name: '白银', icon: '🥈' },
    { min: 1350, name: '黄金', icon: '🥇' }, { min: 1650, name: '铂金', icon: '💠' },
    { min: 2000, name: '钻石', icon: '💎' }, { min: 2500, name: '大师', icon: '👑' },
  ],
  arenaRank(pts) {
    let r = this.ARENA_RANKS[0];
    for (const x of this.ARENA_RANKS) if (pts >= x.min) r = x;
    return r;
  },
  // 合成一个「临时角色实例」给 AI / 战力估算用（不写入存档）
  aiOwned(charId, level, plus) {
    return {
      uid: 'ai', charId, level: level || 1, exp: 0,
      star: window.GameData.CHARACTERS[charId].rarity, plus: plus || 0,
      costumes: ['base_' + charId], activeCostume: 'base_' + charId,
      equip: { weapon: null, armor: null, accessory: null, ex: null },
    };
  },
  teamPowerOf(list) { // list: [{char,level,plus}] 或 owned 数组
    let p = 0;
    list.forEach(e => {
      const ao = e.charId ? e : this.aiOwned(e.char, e.level, e.plus || 0);
      const st = this.computeStats(ao);
      p += st.maxHp * 0.25 + st.atk * 1.5 + st.def;
    });
    return Math.round(p);
  },
  playerPower() {
    return this.teamPowerOf(this.state.team.map(uid => this.getOwned(uid)).filter(Boolean));
  },
  // 账号等级（由进度估算：通关 + 角色数 + 角色等级 + 竞技积分）
  accountLevel() {
    const s = this.state;
    const lvSum = s.roster.reduce((a, o) => a + (o.level || 1), 0);
    return Math.max(1, Math.floor(s.cleared.length * 2 + s.roster.length + lvSum / 25 + ((s.arena && s.arena.points || 1000) - 1000) / 200));
  },

  // ---------- 邮箱（系统邮件 + 一键领取） ----------
  ensureMail() {
    if (!this.state.mail) {
      this.state.mail = [
        { id: 'welcome', title: '欢迎来到棕色尘埃 2', body: '指挥官，欢迎加入！这份新手礼包助你启程。', reward: { gem: 600, gold: 5000 }, claimed: false, ts: Date.now() },
        { id: 'starter_stam', title: '体力补给', body: '冒险离不开体力，先送你一些觉醒石与希望之粉。', reward: { stone: 5, powder: 50 }, claimed: false, ts: Date.now() },
        { id: 'maint', title: '版本更新公告', body: '新增：竞技场、资源副本、远征派遣、限时活动、好感与觉醒系统。祝游玩愉快！', reward: {}, claimed: false, ts: Date.now() },
      ];
      this.save();
    }
  },
  mailUnclaimed() { this.ensureMail(); return this.state.mail.filter(m => !m.claimed && m.reward && Object.keys(m.reward).length).length; },
  claimMail(id) {
    this.ensureMail();
    const m = this.state.mail.find(x => x.id === id);
    if (!m || m.claimed) return { ok: false };
    if (m.reward) this.applyReward(m.reward);
    m.claimed = true; this.save();
    return { ok: true, reward: m.reward };
  },
  claimAllMail() {
    this.ensureMail();
    const got = { gold: 0, gem: 0, stone: 0, powder: 0 };
    let n = 0;
    this.state.mail.forEach(m => {
      if (m.claimed || !m.reward || !Object.keys(m.reward).length) return;
      this.applyReward(m.reward); m.claimed = true; n++;
      for (const k in m.reward) if (got[k] != null) got[k] += m.reward[k];
    });
    this.save();
    return { n, got };
  },

  arenaTeamLevel() {
    const lv = this.state.team.map(uid => { const o = this.getOwned(uid); return o ? o.level : 0; }).filter(Boolean);
    return Math.max(5, Math.round(lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 8));
  },
  genArenaOpps() {
    const ids = Object.keys(window.GameData.CHARACTERS);
    const base = this.arenaTeamLevel();
    const pts = (this.state.arena && this.state.arena.points) || 1000;
    const opps = [];
    for (let i = 0; i < 5; i++) {
      const n = 3 + (Math.random() < 0.5 ? 0 : 1);
      const pool = ids.slice().sort(() => Math.random() - 0.5).slice(0, n);
      const team = pool.map(cid => ({ char: cid, level: Math.max(1, base + ((Math.random() * 8 - 3) | 0)), plus: Math.random() < 0.3 ? 1 : 0 }));
      const lead = window.GameData.CHARACTERS[pool[0]];
      opps.push({
        id: 'o' + i + '_' + (Date.now() % 100000) + i, name: lead.name + ' 的佣兵团',
        team, points: Math.max(800, Math.round(pts + (i - 2) * 45 + (Math.random() * 50 - 25))),
        power: this.teamPowerOf(team), beaten: false,
      });
    }
    return opps;
  },
  ensureArena() {
    if (!this.state.arena) this.state.arena = { points: 1000, date: null, attempts: this.ARENA_MAX_ATTEMPTS, opps: [] };
    const t = this.today();
    if (this.state.arena.date !== t) {
      this.state.arena.date = t;
      this.state.arena.attempts = this.ARENA_MAX_ATTEMPTS;
      this.state.arena.opps = this.genArenaOpps();
      this.save();
    } else if (!this.state.arena.opps || !this.state.arena.opps.length) {
      this.state.arena.opps = this.genArenaOpps(); this.save();
    }
  },
  arenaStartAttempt() {
    this.ensureArena();
    if (this.state.arena.attempts <= 0) return { ok: false, msg: '今日挑战次数已用完（明日重置）' };
    this.state.arena.attempts--; this.save(); return { ok: true };
  },
  arenaRefresh() { this.ensureArena(); this.state.arena.opps = this.genArenaOpps(); this.save(); },
  arenaResolve(oppId, win) {
    this.ensureArena();
    const a = this.state.arena;
    const opp = a.opps.find(o => o.id === oppId);
    const diff = opp ? (opp.points - a.points) : 0;
    if (win) {
      const pts = Math.max(8, Math.round(18 + diff * 0.05));
      a.points += pts;
      const gold = 600 + Math.round(Math.random() * 400), gem = 20;
      this.state.gold += gold; this.state.gem += gem;
      this.state.awakenStone += 2;
      if (opp) opp.beaten = true;
      this.incQuest('win', 1);
      this.save();
      return { win: true, pts, gold, gem, points: a.points };
    }
    const pts = Math.min(-5, Math.round(-12 + diff * 0.04));
    a.points = Math.max(0, a.points + pts);
    this.save();
    return { win: false, pts, points: a.points };
  },

  // ============================================================
  //  限时活动（活动本 + 活动商店，活动币兑换）
  // ============================================================
  EVENT: {
    name: '限时活动 · 褐尘的回响',
    desc: '讨伐受褐尘侵蚀的魔物，赚取活动币，在活动商店兑换稀有资源。',
    stages: [
      { id: 'ev1', name: '回响 · 初级', icon: '🌫️', daily: 6, coin: 20, gold: 500, exp: 250,
        enemies: [{ id: 'goblin', level: 8, pos: 'front' }, { id: 'wolf', level: 8, pos: 'front' }, { id: 'goblin_archer', level: 8, pos: 'back' }] },
      { id: 'ev2', name: '回响 · 中级', icon: '🌪️', daily: 6, coin: 36, gold: 1000, exp: 480,
        enemies: [{ id: 'ogre', level: 12, pos: 'front' }, { id: 'wolf', level: 12, pos: 'front' }, { id: 'dark_mage', level: 12, pos: 'back' }, { id: 'dark_mage', level: 12, pos: 'back' }] },
      { id: 'ev3', name: '回响 · 精英 BOSS', icon: '👹', daily: 3, coin: 70, gold: 2000, exp: 1000,
        enemies: [{ id: 'troll_king', level: 16, pos: 'front' }, { id: 'ogre', level: 15, pos: 'front' }, { id: 'dark_mage', level: 15, pos: 'back' }] },
    ],
    shop: [
      { id: 's_gem', icon: '💎', name: '宝石 ×300', cost: 120, stock: 3, give: { gem: 300 } },
      { id: 's_stone', icon: '🔮', name: '觉醒石 ×5', cost: 100, stock: 6, give: { stone: 5 } },
      { id: 's_powder', icon: '✨', name: '希望之粉 ×100', cost: 80, stock: 5, give: { powder: 100 } },
      { id: 's_gear', icon: '⚒️', name: 'UR 装备宝箱', cost: 150, stock: 2, give: { gearScale: 10 } },
      { id: 's_gold', icon: '🪙', name: '金币 ×5000', cost: 40, stock: 8, give: { gold: 5000 } },
    ],
  },
  ensureEvent() {
    if (!this.state.event) this.state.event = { date: null, runs: {}, coin: 0, stock: {} };
    const t = this.today();
    if (this.state.event.date !== t) {
      this.state.event.date = t;
      this.state.event.runs = {};
      this.state.event.stock = {};
      this.EVENT.shop.forEach(s => { this.state.event.stock[s.id] = s.stock; });
      this.save();
    }
  },
  eventRunsLeft(stage) { this.ensureEvent(); return stage.daily - (this.state.event.runs[stage.id] || 0); },
  eventStartRun(id) {
    this.ensureEvent();
    const s = this.EVENT.stages.find(x => x.id === id);
    if (!s) return { ok: false, msg: '关卡不存在' };
    if (this.eventRunsLeft(s) <= 0) return { ok: false, msg: '今日次数已用完' };
    this.state.event.runs[id] = (this.state.event.runs[id] || 0) + 1;
    this.save();
    return { ok: true };
  },
  eventResolve(id, win) {
    this.ensureEvent();
    const s = this.EVENT.stages.find(x => x.id === id);
    if (!s || !win) return { win: false };
    this.state.event.coin += s.coin;
    this.state.gold += s.gold;
    this.state.team.forEach(uid => { const o = this.getOwned(uid); if (o) this.addExp(o, s.exp); });
    this.incQuest('win', 1);
    this.save();
    return { win: true, coin: s.coin, gold: s.gold, exp: s.exp };
  },
  eventBuy(itemId) {
    this.ensureEvent();
    const it = this.EVENT.shop.find(x => x.id === itemId);
    if (!it) return { ok: false, msg: '商品不存在' };
    const left = this.state.event.stock[itemId] != null ? this.state.event.stock[itemId] : it.stock;
    if (left <= 0) return { ok: false, msg: '已售罄' };
    if (this.state.event.coin < it.cost) return { ok: false, msg: '活动币不足' };
    this.state.event.coin -= it.cost;
    this.state.event.stock[itemId] = left - 1;
    if (it.give.gearScale) this.rollGear(it.give.gearScale);
    else this.applyReward(it.give);
    this.save();
    return { ok: true };
  },

  // ---------- 成就系统 ----------
  // metric(s) 返回当前进度值；达到 target 即可领取 reward（一次性）
  ACHIEVEMENTS: [
    { id: 'collect3',  icon: '👥', name: '初入佣兵团',   desc: '收集 3 名角色',          target: 3,  reward: { gem: 100 }, metric: s => s.roster.length },
    { id: 'collect6',  icon: '👥', name: '佣兵团扩编',   desc: '收集 6 名角色',          target: 6,  reward: { gem: 200 }, metric: s => s.roster.length },
    { id: 'collect10', icon: '🎖️', name: '群英荟萃',     desc: '收集 10 名角色',         target: 10, reward: { gem: 300 }, metric: s => s.roster.length },
    { id: 'collect16', icon: '👑', name: '全员集结',     desc: '收集全部 16 名角色',     target: 16, reward: { gem: 600 }, metric: s => s.roster.length },
    { id: 'cos5',      icon: '👗', name: '时装收藏家',   desc: '累计拥有 5 套服装',      target: 5,  reward: { gem: 150 }, metric: s => s.roster.reduce((n, o) => n + (o.costumes ? o.costumes.length : 0), 0) },
    { id: 'cos12',     icon: '🧥', name: '衣橱满载',     desc: '累计拥有 12 套服装',     target: 12, reward: { gem: 300 }, metric: s => s.roster.reduce((n, o) => n + (o.costumes ? o.costumes.length : 0), 0) },
    { id: 'ex3',       icon: '🗡️', name: '神兵入库',     desc: '拥有 3 件专属武器',      target: 3,  reward: { gem: 200 }, metric: s => s.inventory.filter(g => { const t = Game.getGearTpl(g.tpl); return t && t.type === 'ex'; }).length },
    { id: 'ex8',       icon: '⚔️', name: '军械库',       desc: '拥有 8 件专属武器',      target: 8,  reward: { gem: 400 }, metric: s => s.inventory.filter(g => { const t = Game.getGearTpl(g.tpl); return t && t.type === 'ex'; }).length },
    { id: 'win10',     icon: '🔰', name: '初战告捷',     desc: '累计胜利 10 场',         target: 10, reward: { gold: 500 }, metric: s => s.stats.wins },
    { id: 'win50',     icon: '🏅', name: '百战之师',     desc: '累计胜利 50 场',         target: 50, reward: { gem: 200 }, metric: s => s.stats.wins },
    { id: 'win150',    icon: '🏆', name: '征服者',       desc: '累计胜利 150 场',        target: 150, reward: { gem: 400 }, metric: s => s.stats.wins },
    { id: 'story5',    icon: '🗺️', name: '主线推进',     desc: '通关 5 个主线关卡',      target: 5,  reward: { gem: 150 }, metric: s => s.cleared.filter(id => typeof id === 'number' && id < 100).length },
    { id: 'story7',    icon: '🌟', name: '魔王讨伐',     desc: '通关全部主线关卡',       target: 7,  reward: { gem: 300 }, metric: s => s.cleared.filter(id => typeof id === 'number' && id < 100).length },
    { id: 'trial3',    icon: '🗼', name: '登塔者',       desc: '试炼之塔通关 3 层',      target: 3,  reward: { gem: 200 }, metric: s => s.trialMax || 0 },
    { id: 'trial6',    icon: '🌌', name: '通天塔',       desc: '试炼之塔登顶',           target: 6,  reward: { gem: 500 }, metric: s => s.trialMax || 0 },
    { id: 'pull10',    icon: '🎴', name: '招募新手',     desc: '累计招募 10 次',         target: 10, reward: { gem: 100 }, metric: s => s.stats.pulls },
    { id: 'pull50',    icon: '🎰', name: '招募狂热',     desc: '累计招募 50 次',         target: 50, reward: { gem: 200 }, metric: s => s.stats.pulls },
    { id: 'plus5',     icon: '⭐', name: '极限突破',     desc: '任一角色突破至 +5',      target: 5,  reward: { gem: 200 }, metric: s => s.roster.reduce((m, o) => Math.max(m, o.plus || 0), 0) },
  ],

  achValue(a) { return a.metric(this.state); },

  /** 可领取（已达成且未领）的成就数量，用于红点 */
  achClaimable() {
    return this.ACHIEVEMENTS.filter(a => !this.state.achClaimed[a.id] && this.achValue(a) >= a.target).length;
  },

  grantReward(r) {
    if (!r) return;
    if (r.gold) this.state.gold += r.gold;
    if (r.gem) this.state.gem += r.gem;
    if (r.powder) this.state.powder += r.powder;
    if (r.spark) this.state.spark += r.spark;
    if (r.gear) this.addGear(r.gear);
    if (r.stone) this.state.awakenStone = (this.state.awakenStone || 0) + r.stone;
  },

  claimAch(id) {
    const a = this.ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return { ok: false };
    if (this.state.achClaimed[id]) return { ok: false, msg: '已领取' };
    if (this.achValue(a) < a.target) return { ok: false, msg: '未达成' };
    this.grantReward(a.reward);
    this.state.achClaimed[id] = true;
    this.save();
    return { ok: true, reward: a.reward };
  },
};

window.Game = Game;
