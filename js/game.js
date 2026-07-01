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
    if (this.state.abyssMax == null) this.state.abyssMax = 0;
    if (!this.state.stats) this.state.stats = { pulls: 0, wins: 0 };
    if (!this.state.achClaimed) this.state.achClaimed = {};
    if (this.state.achExp == null) this.state.achExp = 0;
    if (!this.state.achLvClaimed) this.state.achLvClaimed = {};
    if (!this.state.title) this.state.title = 'commander';
    if (!this.state.titlesOwned) this.state.titlesOwned = [];
    if (!this.state.daily) this.state.daily = { lastClaim: null, streak: 0 };
    if (!this.state.quests) this.state.quests = { date: null, progress: { win: 0, pull: 0, levelup: 0 }, claimed: {} };
    if (!this.state.shop) this.state.shop = { date: null, slots: [], bought: {} };
    if (!this.state.shop2) this.state.shop2 = { bought: {} };
    if (!this.state.mayhem) this.state.mayhem = { best: 0 };
    if (!this.state.restaurant) this.state.restaurant = { staff: [null, null, null], ts: Date.now(), level: 1 };
    if (this.state.stamina == null) { this.state.stamina = 120; this.state.staminaTs = Date.now(); }
    if (!this.state.dispatch) this.state.dispatch = { slots: [null, null, null] };
    if (this.state.awakenStone == null) this.state.awakenStone = 0;
    if (!this.state.event) this.state.event = { date: null, runs: {}, coin: 0, stock: {} };
    if (this.state.goldSpent == null) this.state.goldSpent = 0;
    if (this.state.enhanceCount == null) this.state.enhanceCount = 0;
    if (!this.state.actClaimed) this.state.actClaimed = {};
    if (!this.state.actDraw) this.state.actDraw = { tickets: 3, drawn: 0 };
    if (!this.state.actBingo) this.state.actBingo = { revealed: [], clears: 0 };
    if (!this.state.actLogin) this.state.actLogin = {};
    this.state.roster.forEach(o => { if (o.aff == null) o.aff = 0; if (o.awaken == null) o.awaken = 0; });
    this.state.roster.forEach(o => {
      if (!o.equip) o.equip = { weapon: null, armor: null, accessory: null, ex: null };
      if (o.plus == null) o.plus = 0;
      // 服装：补齐 + 把老的 'base' 规范化为 'base_<charId>'
      if (!o.costumes || !o.costumes.length) o.costumes = ['base_' + o.charId];
      o.costumes = o.costumes.map(c => (c === 'base' ? 'base_' + o.charId : c));
      if (!o.activeCostume || o.activeCostume === 'base') o.activeCostume = 'base_' + o.charId;
      // 双服装机制演示：默认补齐该角色全部服装（之后改成卡池获取时移除这段）
      const CS = window.GameData.COSTUMES || {};
      Object.keys(CS).forEach(cid => {
        if (CS[cid].charId === o.charId && !o.costumes.includes(cid)) o.costumes.push(cid);
      });
    });
    // 升星迁移：把同名角色的重复实例合并为突破等级
    this._mergeDuplicates();
    // 修复历史存档的 uid 冲突，并据此重建出战队伍（修复「佣兵有角色但出战不显示」）
    this._repairIds();
    // 初始化当日任务/商店
    this.ensureDaily();
    this.ensureTasks();
    // 预览模式（game.html?demo）：把已完成美术的角色直接塞进佣兵 + 出战队伍，
    // 方便在游戏里直接看 idle / 施法 / 技能 VFX（仅本次进入生效，不主动落盘）。
    try {
      if (typeof location !== 'undefined' && /[?&]demo\b/.test(location.search)) {
        const want = ['seir', 'lecliss', 'justia'];
        want.forEach(cid => {
          if (window.GameData && window.GameData.CHARACTERS[cid] && !this.state.roster.some(o => o.charId === cid))
            this.state.roster.push(this.makeOwned(cid, 40));
        });
        this.state.team = want
          .map(cid => { const o = this.state.roster.find(x => x.charId === cid); return o ? o.uid : null; })
          .filter(Boolean);
      }
    } catch (e) {}
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
      abyssMax: 0,     // 深渊已通关的最高层数
      stats: { pulls: 0, wins: 0 }, // 终身统计（成就用）
      achClaimed: {},  // 已领取的成就 id
      achExp: 0,       // 成就经验值（→ 成就等级）
      achLvClaimed: {},// 已领取的成就等级奖励
      title: 'commander', // 当前装备称号
      titlesOwned: [], // 已获得称号
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
    const D = window.GameData;
    // 机制演示：默认拥有该角色全部服装（初始 + 额外）；之后改成卡池获取时收回
    const costumes = ['base_' + charId];
    Object.keys(D.COSTUMES || {}).forEach(cid => {
      if (D.COSTUMES[cid].charId === charId && !costumes.includes(cid)) costumes.push(cid);
    });
    return {
      uid, charId, level, exp: 0,
      star: D.CHARACTERS[charId].rarity,
      plus: 0, // 突破等级 0~5
      costumes,                          // 拥有的服装 id 列表
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
    // 出战服装制（BD2）：普攻 + **当前出战服装**的 2 个专属技能（换套即换整套 kit）。
    // 要用别套的技能须把那套设为出战服装 —— 出战服装同时决定外观/属性/元素/技能。
    const cos = this.activeCostumeDef(owned);
    const skills = ['basic_attack'];
    ((cos && cos.skills) || (cos && cos.signature && [cos.signature]) || []).forEach(s => { if (s && !skills.includes(s)) skills.push(s); });
    return skills;
  },

  /** 某技能属于该角色的哪套服装（用于战斗里放技时切换形象/元素） */
  costumeOfSkill(owned, skillId) {
    const D = window.GameData;
    const ids = this.ownedCostumeIds(owned);
    for (const cid of ids) {
      const c = D.COSTUMES[cid];
      if (c && (c.skills || [c.signature]).includes(skillId)) return cid;
    }
    return owned.activeCostume;
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

  /** 根据「当前服装属性」+ 等级 + 突破 + 觉醒 + 好感 + 装备 + 珍藏集计算最终属性 */
  computeStats(owned) {
    const cos = this.activeCostumeDef(owned);
    const lv = owned.level - 1;
    const pm = this.plusMult(owned);
    const am = this.affMult(owned), wm = this.awakenMult(owned);
    const cm = this.collectionMult();           // 珍藏集增益（全队全属性）
    const g = this.gearBonus(owned);
    return {
      maxHp: Math.round((cos.stats.hp + cos.grow.hp * lv) * pm * am * wm * cm) + g.hp,
      atk:   Math.round((cos.stats.atk + cos.grow.atk * lv) * pm * am * wm * cm) + g.atk,
      def:   Math.round((cos.stats.def + cos.grow.def * lv) * pm * wm * cm) + g.def,
      spd:   cos.stats.spd + g.spd,
      crit:  cos.stats.crit + g.crit,
    };
  },

  // ============================================================
  //  阵容羁绊（Team Synergy）——让「带哪 5 个」成为真实抉择
  //  · 元素共鸣：同元素 2/3/4/5 个 → 该元素单位攻击 +8/15/22/30%（堆元素=爆发流）
  //  · 均衡阵：同时有 坦克+治疗+输出 → 全队 +10%生命 +8%防御（生存流）
  //  · 彩虹阵：5 个元素各不相同 → 全队 +6% 攻防血（灵活全能，与元素共鸣互斥）
  //  返回纯数据，供战斗结算与 UI 展示共用。
  // ============================================================
  ELEM_RESONANCE: { 2: 0.08, 3: 0.15, 4: 0.22, 5: 0.30 },
  teamSynergy(teamUids) {
    const D = window.GameData;
    const members = (teamUids || []).map(uid => this.getOwned(uid)).filter(Boolean);
    const els = {}, classes = {};
    members.forEach(o => {
      const el = this.activeCostumeDef(o).element;
      els[el] = (els[el] || 0) + 1;
      const cls = (D.CHARACTERS[o.charId] || {}).cls;
      classes[cls] = (classes[cls] || 0) + 1;
    });
    const elemBonus = {}, list = [];
    for (const e in els) {
      if (els[e] >= 2) {
        const b = this.ELEM_RESONANCE[Math.min(5, els[e])];
        elemBonus[e] = b;
        list.push({ kind: 'element', el: e, n: els[e], desc: `${D.ELEMENTS[e].icon}${D.ELEMENTS[e].name}共鸣 ×${els[e]}：该元素攻击 +${Math.round(b * 100)}%` });
      }
    }
    const hasTank = (classes.defender || 0) >= 1;
    const hasHeal = (classes.healer || 0) >= 1;
    const hasDps = ((classes.warrior || 0) + (classes.archer || 0) + (classes.mage || 0)) >= 1;
    const balance = hasTank && hasHeal && hasDps && members.length >= 4;
    const rainbow = members.length >= 5 && Object.keys(els).length === 5;
    if (balance) list.push({ kind: 'balance', desc: '均衡阵（坦+奶+输出）：全队 +10% 生命、+8% 防御' });
    if (rainbow) list.push({ kind: 'rainbow', desc: '彩虹阵（五元素各异）：全队 +6% 攻防血' });
    return { elemBonus, balance, rainbow, list, els, classes, n: members.length };
  },

  /**
   * 队伍可触发的「元素反应」预览（战斗内：异色连击引爆爆发）。
   * 依据队伍现有的不同元素两两组合，列出命中的具名反应，教学玩家「混色轮转」打法。
   */
  teamReactions(teamUids) {
    const D = window.GameData;
    const R = D.REACTIONS || {}, E = D.ELEMENTS;
    const members = (teamUids || []).map(uid => this.getOwned(uid)).filter(Boolean);
    const elems = [...new Set(members.map(o => this.activeCostumeDef(o).element))];
    const out = [];
    for (let i = 0; i < elems.length; i++) {
      for (let j = i + 1; j < elems.length; j++) {
        const key = [elems[i], elems[j]].sort().join('+');
        const rx = R[key];
        if (rx) out.push({ key, icon: rx.icon, name: rx.name,
          desc: `${E[elems[i]].icon}+${E[elems[j]].icon} ${rx.icon}${rx.name}` });
      }
    }
    return out;
  },

  /** 一次性教学提示：某 id 的提示是否还没展示过（展示后落盘，永不重复） */
  onceTip(id) {
    if (!this.state._tips) this.state._tips = {};
    if (this.state._tips[id]) return false;
    this.state._tips[id] = true;
    this.save();
    return true;
  },

  // 好感（赠礼提升）
  GIFT_COST: 200, GIFT_AFF: 25, AFF_MAX: 1000,
  giveGift(uid) {
    const o = this.getOwned(uid); if (!o) return { ok: false };
    if ((o.aff || 0) >= this.AFF_MAX) return { ok: false, msg: '好感已满' };
    if (this.state.gold < this.GIFT_COST) return { ok: false, msg: '金币不足' };
    this.spendGold(this.GIFT_COST);
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
    this.state.awakenStone -= c.stone; this.spendGold(c.gold);
    o.awaken = lv + 1;
    this.save();
    return { ok: true, awaken: o.awaken };
  },

  // ============================================================
  //  珍藏集（Collection）——多门类收集进度 + 全队增益
  //  每个门类满收集 → +2% 全队全属性，合计最高 +14%
  // ============================================================
  COLLECT_BONUS_PER_CAT: 0.02,
  // 收集品 / 食谱 / 天赋 / 炼金 的具体藏品，解锁条件 req(s) 基于现有进度，% 随游玩真实变化
  COLLECTIBLES: [
    { id: 'rl_emblem', name: '佣兵团徽章', icon: I('emblem'),      req: s => s.roster.length >= 1 },
    { id: 'rl_map',    name: '艾尔玛地图', icon: I('map'),         req: s => s.cleared.length >= 1 },
    { id: 'rl_lamp',   name: '褐尘提灯',   icon: I('lantern'),     req: s => s.cleared.length >= 3 },
    { id: 'rl_horn',   name: '集结号角',   icon: I('horn'),        req: s => s.roster.length >= 6 },
    { id: 'rl_crown',  name: '魔王残冠',   icon: I('brokencrown'), req: s => (s.seenStory || []).includes('epilogue') },
    { id: 'rl_compass',name: '远征罗盘',   icon: I('expd'),        req: s => s.cleared.length >= 5 },
    { id: 'rl_medal',  name: '竞技场奖章', icon: I('arena'),       req: s => (s.arena && s.arena.points || 1000) >= 1100 },
    { id: 'rl_moon',   name: '永夜之钥',   icon: I('key'),         req: s => (s.seenStory || []).includes('epilogue2') },
  ],
  RECIPES: [
    { id: 'rc_bread',  name: '行军干粮',   icon: I('bread'),  req: s => s.cleared.length >= 1 },
    { id: 'rc_soup',   name: '篝火浓汤',   icon: I('stew'),   req: s => s.cleared.length >= 2 },
    { id: 'rc_skewer', name: '炭烤肉串',   icon: I('skewer'), req: s => s.cleared.length >= 4 },
    { id: 'rc_tea',    name: '醒神药茶',   icon: I('tea'),    req: s => (s.farmRuns || 0) >= 5 },
    { id: 'rc_cake',   name: '庆功蛋糕',   icon: I('cake'),   req: s => (s.seenStory || []).includes('epilogue') },
    { id: 'rc_wine',   name: '边境烈酒',   icon: I('wine'),   req: s => s.cleared.length >= 6 },
    { id: 'rc_honey',  name: '蜜渍野果',   icon: I('honey'),  req: s => s.roster.length >= 8 },
    { id: 'rc_feast',  name: '凯旋盛宴',   icon: I('bento'),  req: s => s.cleared.length >= 7 },
  ],
  // 天赋技能：每名角色一项，角色等级达 20 即点亮
  ALCHEMY: [
    { id: 'al_whet',  name: '砺刃之术',  icon: I('whet'),        req: (s, g) => g._gearSeen() >= 3 },
    { id: 'al_temper',name: '淬火之术',  icon: I('temper'),      req: (s, g) => g._gearSeen() >= 6 },
    { id: 'al_runic', name: '符文蚀刻',  icon: I('rune'),        req: (s, g) => g._gearSeen() >= 10 },
    { id: 'al_refine',name: '词条精炼',  icon: I('refine'),      req: s => s.inventory.some(x => (x.lvl || 0) >= 5) },
    { id: 'al_master',name: '强化大师',  icon: I('master'),      req: s => s.inventory.some(x => (x.lvl || 0) >= 10) },
    { id: 'al_ex',    name: '神兵铸造',  icon: I('divineforge'), req: (s, g) => s.inventory.some(x => { const t = g.getGearTpl(x.tpl); return t && t.type === 'ex'; }) },
  ],
  _gearSeen() {
    return new Set(this.state.inventory.map(g => g.tpl)).size;
  },
  /** 计算全部珍藏门类的收集进度（owned/total/pct + items） */
  collectionCats() {
    const s = this.state, G = window.GameData;
    const charIds = Object.keys(G.CHARACTERS);
    const ownedChars = new Set(s.roster.map(o => o.charId));
    // 角色
    const charItems = charIds.map(id => ({ name: G.CHARACTERS[id].name, icon: G.CLASSES[G.CHARACTERS[id].cls].icon, owned: ownedChars.has(id) }));
    // 服装（非基础装）
    const ownedCos = new Set(); s.roster.forEach(o => (o.costumes || []).forEach(c => { if (!c.startsWith('base_')) ownedCos.add(c); }));
    const cosIds = Object.keys(G.COSTUMES);
    const cosItems = cosIds.map(id => ({ name: G.COSTUMES[id].name, icon: I('costume'), owned: ownedCos.has(id) }));
    // 装备（图鉴：见过的模板）
    const seenGear = new Set(s.inventory.map(g => g.tpl));
    const gearAll = [...Object.keys(G.GEAR.common), ...Object.keys(G.GEAR.ex)];
    const gearItems = gearAll.map(id => { const t = this.getGearTpl(id); return { name: t ? t.name : id, icon: t ? (t.icon || '⚔️') : '⚔️', owned: seenGear.has(id) }; });
    // 天赋技能：角色等级 ≥20 点亮
    const talentItems = s.roster.length
      ? charIds.map(id => { const o = s.roster.find(x => x.charId === id); return { name: G.CHARACTERS[id].name + ' · 天赋', icon: '✨', owned: !!(o && o.level >= 20) }; })
      : charIds.map(id => ({ name: G.CHARACTERS[id].name + ' · 天赋', icon: '✨', owned: false }));
    // 谓词类门类
    const mapItems = arr => arr.map(it => ({ name: it.name, icon: it.icon, owned: !!it.req(s, this) }));
    const cats = [
      { id: 'char',    name: '角色',     icon: I('merc'), items: charItems },
      { id: 'costume', name: '服装',     icon: I('costume'), items: cosItems },
      { id: 'gear',    name: '装备',     icon: I('sword'), items: gearItems },
      { id: 'collect', name: '收集品',   icon: I('bag'), items: mapItems(this.COLLECTIBLES) },
      { id: 'recipe',  name: '食谱',     icon: I('bento'), items: mapItems(this.RECIPES) },
      { id: 'talent',  name: '天赋技能', icon: I('medal'), items: talentItems },
      { id: 'alchemy', name: '炼金术',   icon: I('refine'), items: mapItems(this.ALCHEMY) },
    ];
    cats.forEach(c => {
      c.total = c.items.length;
      c.owned = c.items.filter(i => i.owned).length;
      c.pct = c.total ? c.owned / c.total : 0;
    });
    return cats;
  },
  /** 珍藏集全队属性倍率：每门类完成度 × 2%，最高 +14% */
  collectionMult() {
    const cats = this.collectionCats();
    const sum = cats.reduce((n, c) => n + c.pct, 0);
    return 1 + sum * this.COLLECT_BONUS_PER_CAT;
  },
  /** 珍藏集增益概览（用于页面头部展示） */
  collectionBonus() {
    const cats = this.collectionCats();
    const sum = cats.reduce((n, c) => n + c.pct, 0);          // 0~7
    const totalOwned = cats.reduce((n, c) => n + c.owned, 0);
    const totalAll = cats.reduce((n, c) => n + c.total, 0);
    const bonus = sum * this.COLLECT_BONUS_PER_CAT;            // 0~0.14
    return {
      bonusPct: bonus * 100,                                  // 全属性增益百分比
      overallPct: totalAll ? totalOwned / totalAll * 100 : 0, // 总收集进度
      max: cats.every(c => c.pct >= 1),
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
    this.spendGold(cost);
    inst.lvl = (inst.lvl || 0) + 1;
    this.state.enhanceCount = (this.state.enhanceCount || 0) + 1;
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
    this.spendGold(C.goldCost);
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
    this.spendGold(cost);
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
    this.bumpTask(key, n);   // 同步任务板（win/pull/levelup）
    this.save();
  },

  applyReward(r) {
    if (r.gold) this.state.gold += r.gold;
    if (r.gem) this.state.gem += r.gem;
    if (r.powder) this.state.powder += r.powder;
    if (r.spark) this.state.spark += r.spark;
    if (r.gear) this.addGear(r.gear);
    if (r.gearRarity) this.addRandomGear(r.gearRarity);
    if (r.stone) this.state.awakenStone = (this.state.awakenStone || 0) + r.stone;
    if (r.stam) this.state.stamina = (this.state.stamina || 0) + r.stam;
    if (r.ticket) this.state.actDraw.tickets = (this.state.actDraw.tickets || 0) + r.ticket;
    if (r.coin) this.state.event.coin = (this.state.event.coin || 0) + r.coin;
  },
  /** 扣金币并累计「消耗金币」（活动任务用） */
  spendGold(n) {
    this.state.gold -= n;
    this.state.goldSpent = (this.state.goldSpent || 0) + n;
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

  // ============================================================
  //  任务板（每日 / 每周）—— 对照 BD2 任务面板
  //  日任务跨日重置，周任务跨周重置；含「区间奖励」里程碑
  // ============================================================
  TASKS_DAILY: [
    { id: 'd_login',  name: '每日登录',       desc: '登录游戏即可完成。',           icon: I('login'),   target: 1, reward: { gold: 1000 }, key: 'login' },
    { id: 'd_battle', name: '进行 3 场战斗',  desc: '在任意战斗或关卡中作战 3 次。', icon: I('atk'),     target: 3, reward: { gold: 500 },  key: 'win' },
    { id: 'd_farm',   name: '挑战资源副本',   desc: '在资源副本中完成 1 次战斗。',   icon: I('dungeon'), target: 1, reward: { gold: 300 },  key: 'farm',  go: 'dungeon' },
    { id: 'd_pull',   name: '进行 1 次招募',  desc: '在招募中抽取 1 次。',           icon: I('summon'),  target: 1, reward: { gold: 500 },  key: 'pull',  go: 'gacha' },
    { id: 'd_arena',  name: '竞技场出战',     desc: '在竞技场中进行 1 次对战。',     icon: I('arena'),   target: 1, reward: { gold: 300 },  key: 'arena', go: 'arena' },
    { id: 'd_level',  name: '升级佣兵 2 次',  desc: '提升佣兵等级 2 次。',           icon: I('buff_up'), target: 2, reward: { gem: 20 },    key: 'levelup' },
    { id: 'd_clear',  name: '通关主线 1 关',  desc: '通关任意主线关卡 1 次。',       icon: I('map'),     target: 1, reward: { stam: 30 },   key: 'clear', go: 'stages' },
  ],
  TASKS_WEEKLY: [
    { id: 'w_battle', name: '本周进行 20 场战斗', desc: '累计作战 20 次。',       icon: I('atk'),     target: 20, reward: { gem: 60 },    key: 'win' },
    { id: 'w_pull',   name: '本周招募 10 次',     desc: '累计招募 10 次。',       icon: I('summon'),  target: 10, reward: { gem: 80 },    key: 'pull' },
    { id: 'w_farm',   name: '本周资源副本 15 次', desc: '资源副本作战 15 次。',   icon: I('dungeon'), target: 15, reward: { gold: 3000 }, key: 'farm' },
    { id: 'w_clear',  name: '本周通关 8 关',      desc: '通关主线关卡 8 次。',     icon: I('map'),     target: 8,  reward: { gem: 60 },    key: 'clear' },
    { id: 'w_arena',  name: '本周竞技场 10 次',   desc: '竞技场对战 10 次。',     icon: I('arena'),   target: 10, reward: { gem: 80 },    key: 'arena' },
  ],
  // 区间奖励里程碑：完成 N 个任务可领（对照 BD2 顶部进度条节点）
  TASK_MILES: {
    daily:  [{ at: 3, reward: { stam: 60 } }, { at: 5, reward: { gear: 'arm_sr' } }, { at: 7, reward: { gem: 60 } }],
    weekly: [{ at: 2, reward: { gold: 5000 } }, { at: 4, reward: { gear: 'wpn_ur' } }, { at: 5, reward: { gem: 120 } }],
  },

  weekId() {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + 'W' + week;
  },
  freshTasks() {
    return { dDate: null, wWeek: null, d: {}, w: {}, dClaimed: {}, wClaimed: {}, dMile: {}, wMile: {}, login: false };
  },
  ensureTasks() {
    if (!this.state.tasks) this.state.tasks = this.freshTasks();
    const T = this.state.tasks, t = this.today(), w = this.weekId();
    if (T.dDate !== t) { T.dDate = t; T.d = {}; T.dClaimed = {}; T.dMile = {}; T.login = false; }
    if (T.wWeek !== w) { T.wWeek = w; T.w = {}; T.wClaimed = {}; T.wMile = {}; }
    if (!T.login) { T.login = true; T.d.login = 1; }
  },
  /** 累加任务计数（同时计入日 / 周） */
  bumpTask(key, n = 1) {
    this.ensureTasks();
    const T = this.state.tasks;
    T.d[key] = (T.d[key] || 0) + n;
    T.w[key] = (T.w[key] || 0) + n;
    this.save();
  },
  _taskDefs(tab) { return tab === 'weekly' ? this.TASKS_WEEKLY : this.TASKS_DAILY; },
  _taskProg(tab) { this.ensureTasks(); return tab === 'weekly' ? this.state.tasks.w : this.state.tasks.d; },
  _taskClaimed(tab) { this.ensureTasks(); return tab === 'weekly' ? this.state.tasks.wClaimed : this.state.tasks.dClaimed; },
  _taskMileState(tab) { this.ensureTasks(); return tab === 'weekly' ? this.state.tasks.wMile : this.state.tasks.dMile; },
  /** 某分页的任务清单（含进度 / 是否完成 / 是否已领） */
  taskList(tab) {
    const prog = this._taskProg(tab), claimed = this._taskClaimed(tab);
    return this._taskDefs(tab).map(d => {
      const cur = Math.min(d.target, prog[d.key] || 0);
      const done = cur >= d.target;
      return Object.assign({}, d, { cur, done, claimed: !!claimed[d.id] });
    });
  },
  /** 已完成任务数（用于区间奖励进度） */
  taskDoneCount(tab) { return this.taskList(tab).filter(t => t.done).length; },
  /** 区间奖励里程碑状态 */
  taskMiles(tab) {
    const done = this.taskDoneCount(tab), ms = this._taskMileState(tab);
    return (this.TASK_MILES[tab] || []).map((m, i) => ({ idx: i, at: m.at, reward: m.reward, reached: done >= m.at, claimed: !!ms[i] }));
  },
  claimTask(tab, id) {
    const t = this.taskList(tab).find(x => x.id === id);
    if (!t) return { ok: false };
    if (t.claimed) return { ok: false, msg: '已领取' };
    if (!t.done) return { ok: false, msg: '未完成' };
    this.applyReward(t.reward);
    this._taskClaimed(tab)[id] = true;
    this.save();
    return { ok: true, reward: t.reward };
  },
  claimTaskMile(tab, idx) {
    const m = this.taskMiles(tab)[idx];
    if (!m) return { ok: false };
    if (m.claimed) return { ok: false, msg: '已领取' };
    if (!m.reached) return { ok: false, msg: '进度不足' };
    this.applyReward(m.reward);
    this._taskMileState(tab)[idx] = true;
    this.save();
    return { ok: true, reward: m.reward };
  },
  /** 一键领取该分页全部可领任务 + 里程碑 */
  claimAllTasks(tab) {
    let n = 0;
    this.taskList(tab).forEach(t => { if (t.done && !t.claimed) { if (this.claimTask(tab, t.id).ok) n++; } });
    this.taskMiles(tab).forEach(m => { if (m.reached && !m.claimed) { if (this.claimTaskMile(tab, m.idx).ok) n++; } });
    return { ok: n > 0, n };
  },
  /** 该分页可领取数量（任务 + 里程碑），用于红点 */
  taskClaimable(tab) {
    let n = this.taskList(tab).filter(t => t.done && !t.claimed).length;
    n += this.taskMiles(tab).filter(m => m.reached && !m.claimed).length;
    return n;
  },
  tasksAnyClaimable() { return this.taskClaimable('daily') + this.taskClaimable('weekly'); },
  /** 距重置剩余文案 */
  taskResetText(tab) {
    const now = new Date();
    let target;
    if (tab === 'weekly') {
      target = new Date(now); const day = (now.getDay() + 6) % 7; // 周一为一周起点
      target.setDate(now.getDate() + (7 - day)); target.setHours(0, 0, 0, 0);
    } else {
      target = new Date(now); target.setHours(24, 0, 0, 0);
    }
    const ms = target - now, h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return tab === 'weekly' ? `${Math.floor(ms / 86400000)} 天 ${h % 24} 小时后重置` : `还剩 ${h} 小时 ${m} 分钟`;
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
    this.spendGold(slot.price);
    this.addGear(slot.tpl);
    this.state.shop.bought[idx] = true;
    this.save();
    return { ok: true, tpl: slot.tpl };
  },

  // ============================================================
  //  商店中心（Shop Hub）—— 对照 BD2 商店：左侧分类 + 商人 + 商品网格
  //  多货币 + 限购周期（日 / 周 / 月 / 永久）
  // ============================================================
  SHOP_HUB: [
    { id: 'item', name: '道具', icon: I('bag'), cur: 'gem', merchant: I('merchant_item'), cd: 0,
      npc: '这里出售各种有用的道具，也只有我才有能力找到这些物品。',
      items: [
        { id: 'it_stam',   name: '体力补给',     icon: I('stamina_potion'), price: 50,  cur: 'gem', limit: 5, period: 'day',  give: { stam: 60 } },
        { id: 'it_gold',   name: '金币袋',       icon: I('coin'), price: 80,  cur: 'gem', limit: 5, period: 'day',  give: { gold: 50000 } },
        { id: 'it_stone',  name: '觉醒石礼盒',   icon: I('awaken'), price: 100, cur: 'gem', limit: 5, period: 'week', give: { stone: 5 } },
        { id: 'it_powder', name: '希望之粉袋',   icon: I('hope_powder'), price: 150, cur: 'gem', limit: 5, period: 'week', give: { powder: 50 } },
        { id: 'it_spark',  name: '闪耀之星袋',   icon: I('star_spark'), price: 200, cur: 'gem', limit: 3, period: 'week', give: { spark: 30 } },
        { id: 'it_gearbox',name: '装备宝箱',     icon: I('equip_chest'), price: 120, cur: 'gem', limit: 3, period: 'week', give: { gearScale: 1.6 } },
        { id: 'it_contract',name:'高级招募契约', icon: I('scroll'), price: 10,  cur: 'gem', limit: 1, period: 'day',  give: { powder: 10 } },
      ] },
    { id: 'gold', name: '金币商店', icon: '🪙', cur: 'gold', merchant: I('merchant_gold'), daily: true, cd: 0,
      npc: '你想要装备？那你可算是找对地方啦！每日都有新货色。',
      items: [
        { id: 'gd_stam',   name: '体力补给',   icon: I('stamina_potion'), price: 8000,  cur: 'gold', limit: 3, period: 'day',  give: { stam: 30 } },
        { id: 'gd_powder', name: '希望之粉',   icon: '✨', price: 20000, cur: 'gold', limit: 3, period: 'week', give: { powder: 20 } },
        { id: 'gd_stone',  name: '觉醒石',     icon: I('awaken'), price: 30000, cur: 'gold', limit: 3, period: 'week', give: { stone: 3 } },
      ] },
    { id: 'points', name: '点数', icon: I('points_coin'), cur: 'coin', merchant: I('merchant_points'), cd: 8,
      npc: '这里有看见您希望但还没钱购买的物品，别光顾着参观，赶快购买吧！',
      items: [
        { id: 'pt_refine',  name: '精炼石',       icon: I('refine_crystal'), price: 50,  cur: 'coin', limit: 5, period: 'week',  give: { stone: 3 } },
        { id: 'pt_star3',   name: '3★升星之星',   icon: I('star_up'), price: 35,  cur: 'coin', limit: 5, period: 'month', give: { spark: 3 } },
        { id: 'pt_star4',   name: '4★升星之星',   icon: I('star_up'), price: 225, cur: 'coin', limit: 3, period: 'month', give: { spark: 5 } },
        { id: 'pt_goldbag', name: '金币袋',       icon: I('coin'), price: 90,  cur: 'coin', limit: 5, period: 'week',  give: { gold: 50000 } },
        { id: 'pt_powder',  name: '希望之粉',     icon: '✨', price: 200, cur: 'coin', limit: 2, period: 'month', give: { powder: 30 } },
        { id: 'pt_water',   name: '精炼水晶',     icon: I('refine_crystal'), price: 67,  cur: 'coin', limit: 3, period: 'week',  give: { stone: 4 } },
      ] },
    { id: 'recharge', name: '充值商店', icon: I('gem'), cur: 'gem', merchant: I('merchant_recharge'), cd: 0,
      npc: '欢迎光临！看看今天的超值特惠礼包吧，机会难得哦。',
      items: [
        { id: 'rc_ap',     name: 'AP 恢复礼盒',  icon: I('stamina_potion'), price: 170, cur: 'gem', limit: 5, period: 'day',  give: { stam: 120 } },
        { id: 'rc_gold',   name: '巨额金币袋',   icon: I('coin'), price: 200, cur: 'gem', limit: 2, period: 'week', give: { gold: 200000 } },
        { id: 'rc_stone',  name: '觉醒石礼包',   icon: I('awaken'), price: 280, cur: 'gem', limit: 2, period: 'week', give: { stone: 15 } },
        { id: 'rc_ur',     name: '专属装备箱',   icon: I('equip_chest'), price: 500, cur: 'gem', limit: 1, period: 'week', give: { gear: 'arm_ur' } },
      ] },
  ],
  CUR_ICON: { gold: '🪙', gem: '💎', coin: '🎟️' },
  getShopCat(id) { return this.SHOP_HUB.find(c => c.id === id); },
  curBalance(cur) { return cur === 'gold' ? this.state.gold : cur === 'gem' ? this.state.gem : cur === 'coin' ? (this.state.event.coin || 0) : 0; },
  shopPeriodKey(period) {
    if (period === 'day') return 'd' + this.today();
    if (period === 'week') return 'w' + this.weekId();
    if (period === 'month') { const d = new Date(); return 'm' + d.getFullYear() + '-' + (d.getMonth() + 1); }
    return 'none';
  },
  shopBoughtCount(item) {
    const rec = this.state.shop2.bought[item.id];
    if (!rec) return 0;
    if (rec.key !== this.shopPeriodKey(item.period)) return 0;
    return rec.n || 0;
  },
  shopLeft(item) { return item.limit ? item.limit - this.shopBoughtCount(item) : 999; },
  buyShop2(catId, itemId) {
    const cat = this.getShopCat(catId);
    const item = cat && cat.items.find(i => i.id === itemId);
    if (!item) return { ok: false };
    if (this.shopLeft(item) <= 0) return { ok: false, msg: '已达购买上限' };
    if (this.curBalance(item.cur) < item.price) return { ok: false, msg: (item.cur === 'gold' ? '金币' : item.cur === 'gem' ? '宝石' : '活动币') + '不足' };
    if (item.cur === 'gold') this.spendGold(item.price);
    else if (item.cur === 'gem') this.state.gem -= item.price;
    else if (item.cur === 'coin') this.state.event.coin -= item.price;
    if (item.give.gearRarity) this.addRandomGear(item.give.gearRarity);
    else if (item.give.gearScale) this.rollGear(item.give.gearScale);
    else this.applyReward(item.give || {});
    const key = this.shopPeriodKey(item.period);
    const rec = this.state.shop2.bought[itemId];
    if (rec && rec.key === key) rec.n++;
    else this.state.shop2.bought[itemId] = { n: 1, key };
    this.save();
    return { ok: true, give: item.give };
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
    this.bumpTask('clear', 1);
    if (firstClear && !this.state.cleared.includes(stage.id)) {
      this.state.cleared.push(stage.id);
    }
    // 装备掉落：主线首通必掉一件（前期不打资源副本也能攒装备过渡）；复刷 45% 概率。
    // 稀有度按推荐等级走曲线：前期多蓝、偶尔紫，金极少；越后期金渐多但始终最稀有。
    let drop = null;
    if (firstClear || Math.random() < 0.45) {
      drop = this.addRandomGear(this.rollGearRarity(this.gearTierOfStage(stage)));
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
    // 装备掉落（扫荡复刷：45% 概率，稀有度按推荐等级走曲线）
    let drop = null;
    if (Math.random() < 0.45) {
      drop = this.addRandomGear(this.rollGearRarity(this.gearTierOfStage(t)));
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

  // ============================================================
  //  装备掉落（统一稀有度曲线）——蓝(R) ≫ 紫(SR) > 金(UR)，金始终最稀有
  //  tier 0..1：越后期内容越容易出高稀有，但 UR 上限仅 ~15%，不会泛滥。
  //   tier 0   → R 78% / SR 20% / UR 2%
  //   tier 0.5 → R 61% / SR 30% / UR 8.5%
  //   tier 1   → R 45% / SR 40% / UR 15%
  // ============================================================
  GEAR_TYPES: ['weapon', 'armor', 'accessory'],
  rollGearRarity(tier) {
    tier = Math.max(0, Math.min(1, tier || 0));
    const ur = 0.02 + 0.13 * tier;
    const sr = 0.20 + 0.20 * tier;
    const rr = Math.random();
    if (rr < ur) return 5;
    if (rr < ur + sr) return 4;
    return 3;
  },
  // 关卡掉落档位：按推荐等级归一（Lv1→0，Lv50→1），与关卡 id 无关
  gearTierOfStage(stage) {
    const lv = (stage && stage.recommend) || 1;
    return Math.max(0, Math.min(1, (lv - 1) / 50));
  },
  // 新增一件「指定稀有度、随机部位」的通用装备，返回 tplId（用于掉落展示）
  addRandomGear(rarity) {
    const type = this.GEAR_TYPES[Math.floor(Math.random() * this.GEAR_TYPES.length)];
    const id = { weapon: 'wpn', armor: 'arm', accessory: 'acc' }[type] + '_' + { 3: 'r', 4: 'sr', 5: 'ur' }[rarity];
    this.addGear(id);
    return id;
  },
  // 通用装备掉落（scale 视作内容档位：farm/派遣/金币箱越高档越易出高稀有，但不泛滥 UR）
  rollGear(scale) {
    const tier = Math.max(0, Math.min(1, (scale || 0) / 12));
    return this.addRandomGear(this.rollGearRarity(tier));
  },

  // ============================================================
  //  资源副本（farm）—— 体力换金币/经验/装备，可多倍连刷
  // ============================================================
  FARM: [
    { id: 'gold',  icon: '🪙', name: '金币矿洞', desc: '稳定产出大量金币',     stam: 10, unlock: 1, reward: { gold: 1500 } },
    { id: 'exp',   icon: I('exp_book'), name: '修炼之地', desc: '出战队伍获得经验',     stam: 10, unlock: 2, reward: { exp: 800 } },
    { id: 'gear',  icon: '⚒️', name: '装备秘境', desc: '掉落装备 + 金币',      stam: 12, unlock: 4, reward: { gold: 500, gearScale: 6 } },
    { id: 'mixed', icon: I('gem'), name: '试炼回廊', desc: '综合产出（金/经/装）', stam: 15, unlock: 6, reward: { gold: 800, exp: 500, gearScale: 8 } },
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
    this.state.farmRuns = (this.state.farmRuns || 0) + times;
    this.bumpTask('farm', times);
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
    { id: 't1', name: '近郊巡逻', hours: 0.5, icon: I('boots'), reward: { gold: 600, exp: 200 } },
    { id: 't2', name: '商路护卫', hours: 2,   icon: I('def'), reward: { gold: 2000, exp: 700 } },
    { id: 't3', name: '远方探索', hours: 4,   icon: I('expd'), reward: { gold: 4200, exp: 1500, gem: 30 } },
    { id: 't4', name: '秘境远征', hours: 8,   icon: I('map'), reward: { gold: 9000, exp: 3200, gem: 80, stone: 3, gearScale: 6 } },
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
    { min: 0, name: '青铜', icon: I('medal_bronze') }, { min: 1100, name: '白银', icon: I('medal_silver') },
    { min: 1350, name: '黄金', icon: I('medal_gold') }, { min: 1650, name: '铂金', icon: I('medal_silver') },
    { min: 2000, name: '钻石', icon: I('gem') }, { min: 2500, name: '大师', icon: I('crown') },
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
    this.bumpTask('arena', 1);
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
      { id: 'ev1', name: '回响 · 初级', icon: I('event'), daily: 6, coin: 20, gold: 500, exp: 250,
        enemies: [{ id: 'goblin', level: 8, pos: 'front' }, { id: 'wolf', level: 8, pos: 'front' }, { id: 'goblin_archer', level: 8, pos: 'back' }] },
      { id: 'ev2', name: '回响 · 中级', icon: I('gale'), daily: 6, coin: 36, gold: 1000, exp: 480,
        enemies: [{ id: 'ogre', level: 12, pos: 'front' }, { id: 'wolf', level: 12, pos: 'front' }, { id: 'dark_mage', level: 12, pos: 'back' }, { id: 'dark_mage', level: 12, pos: 'back' }] },
      { id: 'ev3', name: '回响 · 精英 BOSS', icon: I('ogre'), daily: 3, coin: 70, gold: 2000, exp: 1000,
        enemies: [{ id: 'troll_king', level: 16, pos: 'front' }, { id: 'ogre', level: 15, pos: 'front' }, { id: 'dark_mage', level: 15, pos: 'back' }] },
    ],
    shop: [
      { id: 's_gem', icon: I('gem'), name: '宝石 ×300', cost: 120, stock: 3, give: { gem: 300 } },
      { id: 's_stone', icon: I('awaken'), name: '觉醒石 ×5', cost: 100, stock: 6, give: { stone: 5 } },
      { id: 's_powder', icon: '✨', name: '希望之粉 ×100', cost: 80, stock: 5, give: { powder: 100 } },
      { id: 's_gear', icon: I('hammer'), name: 'UR 装备宝箱', cost: 150, stock: 2, give: { gearRarity: 5 } },
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
    if (it.give.gearRarity) this.addRandomGear(it.give.gearRarity);
    else if (it.give.gearScale) this.rollGear(it.give.gearScale);
    else this.applyReward(it.give);
    this.save();
    return { ok: true };
  },

  // ============================================================
  //  活动中心（活动 Hub）—— 对照 BD2 活动面板
  //  左侧活动列表 + 右侧按类型切换（任务 / 登录 / 抽抽乐 / 宾果 / 赛季战斗）
  // ============================================================
  EVENT_HUB: [
    { id: 'season_battle', tab: '赛季活动 · 回响', cd: 8, type: 'battle', title: '限时回响', sub: '赛季活动', art: '🌫️', color: '#7a5cff' },
    { id: 'anniv_draw', tab: '幸运抽抽乐', cd: 8, type: 'draw', title: '幸运抽抽乐', sub: '3 周年纪念！', art: '🎡', color: '#d9434f',
      prizes: [
        { id: 'p1', name: '专属武器箱', icon: I('equip_chest'), count: 1, reward: { gear: 'arm_ur' } },
        { id: 'p2', name: '宝石礼包', icon: '💎', count: 1, reward: { gem: 300 } },
        { id: 'p3', name: '觉醒石', icon: '🔮', count: 2, reward: { stone: 10 } },
        { id: 'p4', name: '金币袋', icon: I('coin'), count: 5, reward: { gold: 20000 } },
        { id: 'p5', name: '希望之粉', icon: '✨', count: 11, reward: { powder: 30 } },
      ] },
    { id: 'login_1p1', tab: '登录活动 1+1', cd: 36, type: 'login', title: '登录活动 I', sub: '3 周年成长支援', art: '🎁', color: '#ff6b9d',
      days: [
        { gem: 50 }, { gem: 50 }, { gold: 20000 }, { stone: 5 }, { gem: 80 }, { powder: 30 }, { gem: 100 },
        { gold: 40000 }, { stone: 8 }, { gem: 120 }, { powder: 50 }, { gem: 150 }, { gear: 'wpn_sr' }, { gem: 200 },
      ] },
    { id: 'pickup_costume', tab: '服装 Pickup 活动任务', cd: 8, type: 'task', title: '活动任务', sub: '服装 Pickup · 海洋先锋', art: '🌊', color: '#5aa9e6',
      tasks: [
        { id: 'pc1', name: '获得 Pickup 服装', desc: '累计拥有 2 套服装。', target: 2, reward: { coin: 10 }, metric: s => s.roster.reduce((n, o) => n + (o.costumes ? o.costumes.length : 0), 0) },
        { id: 'pc2', name: '强化 Pickup 服装', desc: '强化装备 1 次。', target: 1, reward: { coin: 10 }, metric: s => s.enhanceCount || 0 },
        { id: 'pc3', name: '强化 Pickup 服装', desc: '强化装备 2 次。', target: 2, reward: { coin: 10 }, metric: s => s.enhanceCount || 0 },
        { id: 'pc4', name: '强化 Pickup 服装', desc: '强化装备 3 次。', target: 3, reward: { coin: 10 }, metric: s => s.enhanceCount || 0 },
      ] },
    { id: 'end_gamble', tab: 'End of Gamble · 助力任务', cd: 8, type: 'task', title: '助力任务', sub: 'End of Gamble', art: '🎆', color: '#b06bff',
      tasks: [
        { id: 'eg1', name: '进行赛季活动战斗', desc: '进行普通战斗或挑战 5 次。', target: 5, reward: { gem: 100 }, metric: s => s.stats.wins },
        { id: 'eg2', name: '进行赛季活动战斗', desc: '进行普通战斗或挑战 15 次。', target: 15, reward: { gem: 100 }, metric: s => s.stats.wins },
        { id: 'eg3', name: '进行赛季活动战斗', desc: '进行普通战斗或挑战 25 次。', target: 25, reward: { gem: 100 }, metric: s => s.stats.wins },
        { id: 'eg4', name: '消耗活动币兑换', desc: '累计获得 1000 活动币。', target: 1000, reward: { gem: 100 }, metric: s => (s.event && s.event.coin) || 0 },
      ] },
    { id: 'gold_payback', tab: 'Gold Payback · 助力任务', cd: 8, type: 'task', title: 'Gold Payback', sub: '使用金币 · 助力任务', art: '🏆', color: '#f0c674',
      tasks: [
        { id: 'gp1', name: '消耗金币', desc: '累计消耗金币 200,000。', target: 200000, reward: { gold: 100000 }, metric: s => s.goldSpent || 0 },
        { id: 'gp2', name: '消耗金币', desc: '累计消耗金币 400,000。', target: 400000, reward: { gold: 100000 }, metric: s => s.goldSpent || 0 },
        { id: 'gp3', name: '消耗金币', desc: '累计消耗金币 600,000。', target: 600000, reward: { gem: 200 }, metric: s => s.goldSpent || 0 },
        { id: 'gp4', name: '消耗金币', desc: '累计消耗金币 1,000,000。', target: 1000000, reward: { gem: 400 }, metric: s => s.goldSpent || 0 },
      ] },
    { id: 'my_pick', tab: 'MY PICK! · 活动任务', cd: 8, type: 'task', title: 'MY PICK!', sub: '活动任务 · 完成获取奖励', art: '🃏', color: '#e8a33d',
      tasks: [
        { id: 'mp1', name: '每日登录', desc: '登录游戏。', target: 1, reward: { gem: 20 }, metric: s => (s.tasks && s.tasks.d && s.tasks.d.login) || 0 },
        { id: 'mp2', name: '进行招募', desc: '累计招募 2 次。', target: 2, reward: { gem: 30 }, metric: s => s.stats.pulls },
        { id: 'mp3', name: '试玩抽抽乐', desc: '进行 1 次幸运抽抽乐。', target: 1, reward: { gem: 20 }, metric: s => (s.actDraw && s.actDraw.drawn) || 0 },
        { id: 'mp4', name: '通关主线', desc: '通关任意主线 1 关。', target: 1, reward: { gem: 20 }, metric: s => s.cleared.filter(id => typeof id === 'number' && id < 100).length },
      ] },
    { id: 'epic_bingo', tab: 'Epic Bingo Event · 宾果', cd: 8, type: 'bingo', title: 'Epic Bingo Event', sub: '宾果板通关奖励', art: '🎰', color: '#c98b3a',
      cells: [
        { gem: 20 }, { gold: 10000 }, { stone: 2 }, { gem: 30 }, { powder: 10 },
        { gold: 8000 }, { gem: 20 }, { stone: 1 }, { gem: 30 }, { gold: 10000 },
        { powder: 8 }, { gem: 20 }, { gem: 100 }, { stone: 2 }, { gem: 20 },
        { gold: 8000 }, { gem: 30 }, { stone: 1 }, { gem: 20 }, { powder: 10 },
        { gem: 20 }, { gold: 10000 }, { gem: 30 }, { stone: 2 }, { gem: 50 },
      ],
      lineRewards: [{ gold: 100000 }, { gear: 'arm_sr' }, { powder: 50 }, { stone: 10 }, { gem: 90 }] },
  ],
  REVEAL_COST: 1,   // 宾果每格揭示消耗活动币
  DRAW_COST: 1,     // 抽抽乐每抽消耗 1 抽抽乐券

  getEventHub(id) { return this.EVENT_HUB.find(e => e.id === id); },
  // ---- 任务型活动 ----
  eventTaskList(ev) {
    return ev.tasks.map(t => {
      const cur = Math.min(t.target, t.metric(this.state));
      const done = cur >= t.target;
      const key = ev.id + ':' + t.id;
      return Object.assign({}, t, { cur, done, claimed: !!this.state.actClaimed[key], key });
    });
  },
  claimEventTask(ev, taskId) {
    const t = this.eventTaskList(ev).find(x => x.id === taskId);
    if (!t) return { ok: false };
    if (t.claimed) return { ok: false, msg: '已领取' };
    if (!t.done) return { ok: false, msg: '未完成' };
    this.applyReward(t.reward);
    this.state.actClaimed[t.key] = true;
    this.save();
    return { ok: true, reward: t.reward };
  },
  claimAllEventTasks(ev) {
    let n = 0;
    this.eventTaskList(ev).forEach(t => { if (t.done && !t.claimed) { if (this.claimEventTask(ev, t.id).ok) n++; } });
    return { ok: n > 0, n };
  },
  // ---- 登录型活动 ----
  eventLoginClaimed(ev) { return this.state.actLogin[ev.id] || 0; },
  eventLoginCanClaim(ev) {
    const last = (this.state.actLogin[ev.id + ':date']) || null;
    return this.eventLoginClaimed(ev) < ev.days.length && last !== this.today();
  },
  claimEventLogin(ev) {
    if (!this.eventLoginCanClaim(ev)) return { ok: false, msg: '今日已领取或已领完' };
    const idx = this.eventLoginClaimed(ev);
    const reward = ev.days[idx];
    this.applyReward(reward);
    this.state.actLogin[ev.id] = idx + 1;
    this.state.actLogin[ev.id + ':date'] = this.today();
    this.save();
    return { ok: true, reward, day: idx + 1 };
  },
  // ---- 抽抽乐 ----
  drawTickets() { return this.state.actDraw.tickets || 0; },
  buyDrawTicket() {
    if (this.state.gem < 100) return { ok: false, msg: '宝石不足' };
    this.state.gem -= 100;
    this.state.actDraw.tickets = (this.state.actDraw.tickets || 0) + 1;
    this.save();
    return { ok: true };
  },
  eventDrawPool(ev) {
    const taken = this.state.actClaimed['draw:' + ev.id] || {};
    return ev.prizes.map(p => ({ id: p.id, name: p.name, icon: p.icon, left: p.count - (taken[p.id] || 0), reward: p.reward }));
  },
  doEventDraw(ev) {
    if ((this.state.actDraw.tickets || 0) < this.DRAW_COST) return { ok: false, msg: '抽抽乐券不足' };
    const pool = this.eventDrawPool(ev).filter(p => p.left > 0);
    if (!pool.length) return { ok: false, msg: '奖池已抽空' };
    this.state.actDraw.tickets -= this.DRAW_COST;
    this.state.actDraw.drawn = (this.state.actDraw.drawn || 0) + 1;
    const prize = pool[Math.floor(Math.random() * pool.length)];
    const taken = this.state.actClaimed['draw:' + ev.id] || {};
    taken[prize.id] = (taken[prize.id] || 0) + 1;
    this.state.actClaimed['draw:' + ev.id] = taken;
    this.applyReward(prize.reward);
    this.save();
    return { ok: true, prize };
  },
  // ---- 宾果 ----
  BINGO_LINES: [
    [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
    [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
    [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
  ],
  bingoRevealed(ev) { return this.state.actBingo.revealed || []; },
  bingoLinesCleared(ev) {
    const rev = new Set(this.bingoRevealed(ev));
    return this.BINGO_LINES.filter(line => line.every(i => rev.has(i))).length;
  },
  revealBingoCell(ev, idx) {
    const rev = this.state.actBingo.revealed || [];
    if (rev.includes(idx)) return { ok: false, msg: '已揭示' };
    if ((this.state.event.coin || 0) < this.REVEAL_COST) return { ok: false, msg: '活动币不足' };
    this.state.event.coin -= this.REVEAL_COST;
    const linesBefore = this.bingoLinesCleared(ev);
    rev.push(idx);
    this.state.actBingo.revealed = rev;
    this.applyReward(ev.cells[idx]);                 // 翻开即得格子奖励
    const linesAfter = this.bingoLinesCleared(ev);
    let lineReward = null;
    for (let l = linesBefore; l < linesAfter && l < ev.lineRewards.length; l++) {
      this.applyReward(ev.lineRewards[l]); lineReward = ev.lineRewards[l];   // 新连线奖励
    }
    this.save();
    return { ok: true, cell: ev.cells[idx], lineReward, lines: linesAfter };
  },
  // ---- 红点聚合 ----
  eventHubClaimable(ev) {
    if (ev.type === 'task') return this.eventTaskList(ev).filter(t => t.done && !t.claimed).length;
    if (ev.type === 'login') return this.eventLoginCanClaim(ev) ? 1 : 0;
    return 0;
  },
  eventHubAnyClaimable() { return this.EVENT_HUB.reduce((n, ev) => n + this.eventHubClaimable(ev), 0); },

  // ============================================================
  //  游戏卡 · 混战（Mayhem）—— 波次生存，越往后越强，刷新最高波数
  // ============================================================
  MAYHEM_POOL: ['goblin', 'goblin_archer', 'wolf', 'ogre', 'dark_mage', 'revenant', 'dark_knight'],
  MAYHEM_BOSS: ['troll_king', 'demon_lord', 'shadow_empress'],
  mayhemEnemies(wave) {
    const D = window.GameData;
    const level = 5 + wave * 3;
    if (wave % 5 === 0) {                       // 每 5 波一个 BOSS
      const id = this.MAYHEM_BOSS[(wave / 5 - 1) % this.MAYHEM_BOSS.length];
      const adds = wave >= 10 ? [{ id: this.MAYHEM_POOL[wave % this.MAYHEM_POOL.length], level, pos: 'front' }] : [];
      return [{ id, level: level + 4, pos: 'mid' }, ...adds];
    }
    const count = Math.min(5, 2 + Math.floor(wave / 2));
    const arr = [];
    const poss = ['front', 'front', 'mid', 'mid', 'back'];
    for (let i = 0; i < count; i++) {
      const id = this.MAYHEM_POOL[(wave + i) % this.MAYHEM_POOL.length];
      arr.push({ id, level, pos: poss[i] });
    }
    return arr;
  },
  mayhemWaveReward(wave) {
    return { gold: 400 * wave, gem: wave % 5 === 0 ? 20 : 0, exp: 200 + wave * 40 };
  },
  mayhemBest() { return (this.state.mayhem && this.state.mayhem.best) || 0; },
  recordMayhem(wave) {
    if (!this.state.mayhem) this.state.mayhem = { best: 0 };
    if (wave > this.state.mayhem.best) { this.state.mayhem.best = wave; this.save(); }
  },

  // ============================================================
  //  游戏卡 · 经营（格鲁菲餐厅）—— 派员工挂机产出营业额（金币）
  // ============================================================
  RESTAURANT: { baseRate: 1800, capHours: 8, slots: 3 },
  restaurantUpgradeCost() { return 20000 * (this.state.restaurant.level || 1); },
  restaurantRate() {
    const r = this.state.restaurant;
    const filled = (r.staff || []).filter(Boolean).length;
    return Math.round(this.RESTAURANT.baseRate * (r.level || 1) * (1 + 0.35 * filled));
  },
  restaurantPending() {
    const r = this.state.restaurant;
    const rate = this.restaurantRate();
    const hrs = Math.min(this.RESTAURANT.capHours, (Date.now() - (r.ts || Date.now())) / 3600000);
    return Math.floor(rate * hrs);
  },
  restaurantFull() {
    const r = this.state.restaurant;
    return (Date.now() - (r.ts || Date.now())) / 3600000 >= this.RESTAURANT.capHours;
  },
  claimRestaurant() {
    const g = this.restaurantPending();
    if (g <= 0) return { ok: false, msg: '暂无营业额可结算' };
    this.state.gold += g;
    this.state.restaurant.ts = Date.now();
    this.save();
    return { ok: true, gold: g };
  },
  assignRestaurantStaff(slot, uid) {
    const r = this.state.restaurant;
    if (!r.staff) r.staff = [null, null, null];
    // 同一人不可重复上岗
    r.staff = r.staff.map(u => u === uid ? null : u);
    r.staff[slot] = uid;
    // 调整人员即结算一次，避免速率跳变占便宜
    const g = this.restaurantPending();
    if (g > 0) { this.state.gold += g; }
    r.ts = Date.now();
    this.save();
    return { ok: true };
  },
  upgradeRestaurant() {
    const cost = this.restaurantUpgradeCost();
    if (this.state.gold < cost) return { ok: false, msg: '金币不足' };
    const g = this.restaurantPending();
    if (g > 0) this.state.gold += g;
    this.spendGold(cost);
    this.state.restaurant.level = (this.state.restaurant.level || 1) + 1;
    this.state.restaurant.ts = Date.now();
    this.save();
    return { ok: true, level: this.state.restaurant.level };
  },

  // ============================================================
  //  游戏卡珍藏集（Game Card Collection）—— 四大类卡片汇总
  // ============================================================
  gameCardCats() {
    const D = window.GameData;
    // 剧情游戏卡：按主线章节
    const storyCards = window.World.CHAPTERS.map((ch, i) => ({
      id: ch.id, name: ch.name, icon: { forest: I('loc_forest'), cave: I('loc_mine'), castle: I('loc_castle') }[ch.theme] || '🗺️',
      owned: window.World.isChapterUnlocked(i), done: window.World.isChapterDone(ch),
      go: 'stages', vol: i + 1,
    }));
    // 角色游戏卡：拥有的角色支线
    const seen = new Set(); const charCards = [];
    this.state.roster.forEach(o => {
      const c = D.CHARACTERS[o.charId];
      if (c.side && !seen.has(c.charId)) { seen.add(c.charId); charCards.push({ id: c.side, name: c.name, icon: D.CLASSES[c.cls].icon, owned: true, charId: o.charId, act: 'charstory', side: c.side, vol: charCards.length + 1 }); }
    });
    const charTotal = Object.values(D.CHARACTERS).filter(c => c.side).length;
    // 玩法游戏卡：5 种核心玩法
    const playCards = [
      { id: 'pvp', name: 'PvP · 竞技场', icon: I('arena'), owned: true, go: 'arena', tag: 'PvP' },
      { id: 'challenge', name: '挑战 · 试炼之塔', icon: I('tower'), owned: true, go: 'stages', tag: '挑战' },
      { id: 'growth', name: '成长 · 资源副本', icon: I('dungeon'), owned: true, go: 'dungeon', tag: '成长' },
      { id: 'mayhem', name: '混战 · 无尽波次', icon: I('gale'), owned: true, go: 'mayhem', tag: '混战' },
      { id: 'restaurant', name: '经营 · 格鲁菲餐厅', icon: I('bento'), owned: true, go: 'restaurant', tag: '经营' },
    ];
    // 活动游戏卡：活动中心
    const evCards = this.EVENT_HUB.map(ev => ({ id: ev.id, name: ev.title, icon: ev.art, owned: true, go: 'event', evSel: ev.id, vol: ev.cd }));
    return [
      { id: 'story', name: '剧情游戏卡', sub: '主线剧情游戏卡', owned: storyCards.filter(c => c.owned).length, total: storyCards.length, cards: storyCards },
      { id: 'char', name: '角色游戏卡', sub: '各角色的剧情/世界剧情游戏卡', owned: charCards.length, total: charTotal, cards: charCards },
      { id: 'play', name: '玩法游戏卡', sub: '可进行 PvP、挑战、成长等各种玩法', owned: playCards.length, total: playCards.length, cards: playCards },
      { id: 'event', name: '活动游戏卡', sub: '活动限定提供的相关游戏卡', owned: evCards.length, total: evCards.length, cards: evCards },
    ];
  },

  // ---------- 成就系统 ----------
  // metric(s) 返回当前进度值；达到 target 即可领取 reward（一次性）
  ACHIEVEMENTS: [
    { id: 'collect3',  icon: I('merc'), name: '初入佣兵团',   desc: '收集 3 名角色',          target: 3,  reward: { gem: 100 }, metric: s => s.roster.length },
    { id: 'collect6',  icon: I('merc'), name: '佣兵团扩编',   desc: '收集 6 名角色',          target: 6,  reward: { gem: 200 }, metric: s => s.roster.length },
    { id: 'collect10', icon: I('medal_gold'), name: '群英荟萃',     desc: '收集 10 名角色',         target: 10, reward: { gem: 300 }, metric: s => s.roster.length },
    { id: 'collect16', icon: I('crown'), name: '全员集结',     desc: '收集全部 16 名角色',     target: 16, reward: { gem: 600 }, metric: s => s.roster.length },
    { id: 'cos5',      icon: I('costume'), name: '时装收藏家',   desc: '累计拥有 5 套服装',      target: 5,  reward: { gem: 150 }, metric: s => s.roster.reduce((n, o) => n + (o.costumes ? o.costumes.length : 0), 0) },
    { id: 'cos12',     icon: I('costume'), name: '衣橱满载',     desc: '累计拥有 12 套服装',     target: 12, reward: { gem: 300 }, metric: s => s.roster.reduce((n, o) => n + (o.costumes ? o.costumes.length : 0), 0) },
    { id: 'ex3',       icon: I('sword'), name: '神兵入库',     desc: '拥有 3 件专属武器',      target: 3,  reward: { gem: 200 }, metric: s => s.inventory.filter(g => { const t = Game.getGearTpl(g.tpl); return t && t.type === 'ex'; }).length },
    { id: 'ex8',       icon: I('sword'), name: '军械库',       desc: '拥有 8 件专属武器',      target: 8,  reward: { gem: 400 }, metric: s => s.inventory.filter(g => { const t = Game.getGearTpl(g.tpl); return t && t.type === 'ex'; }).length },
    { id: 'win10',     icon: I('atk'), name: '初战告捷',     desc: '累计胜利 10 场',         target: 10, reward: { gold: 500 }, metric: s => s.stats.wins },
    { id: 'win50',     icon: I('medal_bronze'), name: '百战之师',     desc: '累计胜利 50 场',         target: 50, reward: { gem: 200 }, metric: s => s.stats.wins },
    { id: 'win150',    icon: I('arena'), name: '征服者',       desc: '累计胜利 150 场',        target: 150, reward: { gem: 400 }, metric: s => s.stats.wins },
    { id: 'story5',    icon: I('map'), name: '主线推进',     desc: '通关 5 个主线关卡',      target: 5,  reward: { gem: 150 }, metric: s => s.cleared.filter(id => typeof id === 'number' && id < 100).length },
    { id: 'story7',    icon: I('star_spark'), name: '魔王讨伐',     desc: '通关全部主线关卡',       target: 7,  reward: { gem: 300 }, metric: s => s.cleared.filter(id => typeof id === 'number' && id < 100).length },
    { id: 'trial3',    icon: I('tower'), name: '登塔者',       desc: '试炼之塔通关 3 层',      target: 3,  reward: { gem: 200 }, metric: s => s.trialMax || 0 },
    { id: 'trial6',    icon: I('tower'), name: '通天塔',       desc: '试炼之塔登顶',           target: 6,  reward: { gem: 500 }, metric: s => s.trialMax || 0 },
    { id: 'pull10',    icon: I('summon'), name: '招募新手',     desc: '累计招募 10 次',         target: 10, reward: { gem: 100 }, metric: s => s.stats.pulls },
    { id: 'pull50',    icon: I('summon'), name: '招募狂热',     desc: '累计招募 50 次',         target: 50, reward: { gem: 200 }, metric: s => s.stats.pulls },
    { id: 'plus5',     icon: I('star_up'), name: '极限突破',     desc: '任一角色突破至 +5',      target: 5,  reward: { gem: 200 }, metric: s => s.roster.reduce((m, o) => Math.max(m, o.plus || 0), 0) },
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
    if (r.gearRarity) this.addRandomGear(r.gearRarity);
    if (r.stone) this.state.awakenStone = (this.state.awakenStone || 0) + r.stone;
  },

  claimAch(id) {
    const a = this.ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return { ok: false };
    if (this.state.achClaimed[id]) return { ok: false, msg: '已领取' };
    if (this.achValue(a) < a.target) return { ok: false, msg: '未达成' };
    this.grantReward(a.reward);
    this.state.achExp = (this.state.achExp || 0) + this.achExpOf(a);  // 累积成就经验值 → 成就等级
    this.state.achClaimed[id] = true;
    this.save();
    return { ok: true, reward: a.reward, exp: this.achExpOf(a) };
  },
  /** 一键领取全部可领成就 */
  claimAllAch() {
    let n = 0;
    this.ACHIEVEMENTS.forEach(a => { if (!this.state.achClaimed[a.id] && this.achValue(a) >= a.target) { if (this.claimAch(a.id).ok) n++; } });
    return { ok: n > 0, n };
  },

  // ---------- 成就经验值 / 成就等级 ----------
  achExpOf(a) {
    if (a.achExp) return a.achExp;
    if (a.reward.gem) return Math.max(20, Math.round(a.reward.gem / 4));
    if (a.reward.gold) return Math.max(20, Math.round(a.reward.gold / 30));
    return 30;
  },
  achDoneCount() { return this.ACHIEVEMENTS.filter(a => this.achValue(a) >= a.target).length; },
  ACH_LV_NEED: 100,
  achTotalExp() { return this.state.achExp || 0; },
  achLevel() { return Math.floor(this.achTotalExp() / this.ACH_LV_NEED); },
  achLevelProg() { return this.achTotalExp() % this.ACH_LV_NEED; },
  achLevelReward(lv) {
    if (lv % 10 === 0) return { gem: 2000, gold: 80000, gear: 'arm_ur' };
    if (lv % 5 === 0) return { gem: 1000, gold: 50000 };
    return { gem: 600, gold: 8000 };
  },
  achLevelClaimable() {
    const top = this.achLevel(), cl = this.state.achLvClaimed || {};
    let n = 0;
    for (let lv = 1; lv <= top; lv++) if (!cl[lv]) n++;
    return n;
  },
  claimAchLevel(lv) {
    if (lv > this.achLevel()) return { ok: false, msg: '未达到' };
    if (!this.state.achLvClaimed) this.state.achLvClaimed = {};
    if (this.state.achLvClaimed[lv]) return { ok: false, msg: '已领取' };
    const r = this.achLevelReward(lv);
    this.grantReward(r);
    this.state.achLvClaimed[lv] = true;
    this.save();
    return { ok: true, reward: r };
  },
  claimAllAchLevels() {
    const top = this.achLevel();
    let n = 0;
    for (let lv = 1; lv <= top; lv++) if (this.claimAchLevel(lv).ok) n++;
    return { ok: n > 0, n };
  },

  // ---------- 称号 ----------
  TITLES: [
    { id: 'commander', name: '指挥官',     desc: '初始称号，与佣兵团一同启程。',  req: () => true },
    { id: 'leader',    name: '佣兵团长',   desc: '收集 10 名角色。',              req: s => s.roster.length >= 10 },
    { id: 'slayer',    name: '魔王讨伐者', desc: '通关全部主线关卡。',            req: s => s.cleared.filter(id => typeof id === 'number' && id < 100).length >= 7 },
    { id: 'champion',  name: '竞技场王者', desc: '竞技场积分达到 1200。',         req: s => (s.arena && s.arena.points || 1000) >= 1200 },
    { id: 'stylist',   name: '时装大师',   desc: '累计拥有 12 套服装。',          req: s => s.roster.reduce((n, o) => n + (o.costumes ? o.costumes.length : 0), 0) >= 12 },
    { id: 'mentor',    name: '觉醒导师',   desc: '任一角色觉醒至 5★。',           req: s => s.roster.some(o => (o.awaken || 0) >= 5) },
    { id: 'tycoon',    name: '黄金富豪',   desc: '持有金币达到 100000。',         req: s => s.gold >= 100000 },
    { id: 'veteran',   name: '百战老兵',   desc: '累计胜利 100 场。',             req: s => s.stats.wins >= 100 },
  ],
  titleUnlocked(t) { return !!t.req(this.state); },
  titleOwned(id) { return id === 'commander' || (this.state.titlesOwned && this.state.titlesOwned.includes(id)); },
  claimTitle(id) {
    const t = this.TITLES.find(x => x.id === id);
    if (!t) return { ok: false };
    if (this.titleOwned(id)) return { ok: false, msg: '已拥有' };
    if (!this.titleUnlocked(t)) return { ok: false, msg: '未解锁' };
    this.state.titlesOwned = this.state.titlesOwned || [];
    this.state.titlesOwned.push(id);
    this.save();
    return { ok: true };
  },
  equipTitle(id) {
    if (!this.titleOwned(id)) return { ok: false, msg: '未拥有该称号' };
    this.state.title = id;
    this.save();
    return { ok: true };
  },
  currentTitle() {
    const id = this.state.title || 'commander';
    return this.TITLES.find(t => t.id === id) || this.TITLES[0];
  },
  titlesClaimable() { return this.TITLES.filter(t => this.titleUnlocked(t) && !this.titleOwned(t.id)).length; },
  /** 成就板任意可领（成就 + 等级 + 称号），用于红点 */
  achAnyClaimable() { return this.achClaimable() + this.achLevelClaimable() + this.titlesClaimable(); },
};

window.Game = Game;
