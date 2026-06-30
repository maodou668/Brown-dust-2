// ============================================================
//  数值预算模型（角色/服装/敌人/装备）—— 与 balance.js（技能）配套
//  目的：任何「带数值」的新内容都有可校验的预算上限，新增角色/服装/装备
//        不会偷偷数值膨胀压过老内容（power creep），未来不必推翻重来。
//
//  核心思想（双轴预算）：
//   · O 进攻值 = atk × (1 + 0.6×crit) × 速度轻加权     —— 单位输出能力
//   · S 生存值 = hp × (1 + def/100)  （等效血量 EHP）   —— 单位扛伤能力
//   单一标量无法跨职业比较（坦克 EHP 极高、奶妈价值在技能），所以用「双轴 +
//   按 稀有度×职业 归一」：每个单位的 O/O_ref + S/S_ref ≈ 2.0（各轴 1.0）。
//   服装可在两轴间「换形」（牺牲防御换攻击），但两轴之和被预算封顶 → 不会既肉又秒。
//
//  浏览器：window.Budget    Node：module.exports
// ============================================================
(function (global) {
  'use strict';

  // —— 5★ 各职业 Lv60 参考属性（设计锚点，由现役角色校准）——
  const CLASS_REF60 = {
    mage:     { hp: 5400, atk: 1110, def: 355, spd: 95,  crit: 0.20 },
    archer:   { hp: 5740, atk: 1250, def: 360, spd: 118, crit: 0.28 },
    warrior:  { hp: 7800, atk: 1180, def: 560, spd: 115, crit: 0.20 },
    defender: { hp: 10200, atk: 640, def: 880, spd: 69,  crit: 0.09 },
    healer:   { hp: 6700, atk: 840,  def: 425, spd: 101, crit: 0.10 },
  };
  // 稀有度缩放：进攻随稀有度拉开，生存较平缓（低星也得能站场）
  const O_MULT = { 3: 0.72, 4: 0.86, 5: 1.00 };
  const S_MULT = { 3: 0.90, 4: 0.95, 5: 1.00 };

  // 校验阈值
  const BUDGET_LO = 1.65, BUDGET_HI = 2.25;   // 双轴预算之和（≈2.0 为标准）
  const AXIS_CAP = 1.70;                       // 单轴上限（不许把全部预算堆一轴）
  const AXIS_FLOOR = 0.45;                      // 单轴下限（不许某轴趋零的畸形数值）

  const Budget = {
    CLASS_REF60, O_MULT, S_MULT, BUDGET_LO, BUDGET_HI, AXIS_CAP, AXIS_FLOOR,

    O(s) { return s.atk * (1 + 0.6 * (s.crit || 0)) * (0.85 + 0.15 * (s.spd || 100) / 100); },
    S(s) { return s.hp * (1 + (s.def || 0) / 100); },
    atLevel(base, grow, lv) {
      grow = grow || {};
      return { hp: base.hp + (grow.hp || 0) * (lv - 1), atk: base.atk + (grow.atk || 0) * (lv - 1),
               def: base.def + (grow.def || 0) * (lv - 1), spd: base.spd, crit: base.crit };
    },

    // 某 职业×稀有度 的参考 O/S
    refOS(cls, rarity) {
      const r = CLASS_REF60[cls]; if (!r) return null;
      return { O: this.O(r) * (O_MULT[rarity] || 1), S: this.S(r) * (S_MULT[rarity] || 1) };
    },

    // 评估一个 Lv60 属性块的预算占用
    evalStats60(stats60, cls, rarity) {
      const ref = this.refOS(cls, rarity);
      if (!ref) return { ok: false, reason: '未知职业 ' + cls };
      const o = this.O(stats60) / ref.O, s = this.S(stats60) / ref.S;
      const sum = o + s;
      const ok = sum >= BUDGET_LO && sum <= BUDGET_HI &&
                 o <= AXIS_CAP && s <= AXIS_CAP && o >= AXIS_FLOOR && s >= AXIS_FLOOR;
      return { ok, oRatio: o, sRatio: s, sum,
               reason: ok ? '' :
                 (sum > BUDGET_HI ? `总预算超标 ${sum.toFixed(2)}>${BUDGET_HI}（数值膨胀）` :
                  sum < BUDGET_LO ? `总预算不足 ${sum.toFixed(2)}<${BUDGET_LO}（过弱）` :
                  o > AXIS_CAP ? `进攻轴超标 O=${o.toFixed(2)}>${AXIS_CAP}` :
                  s > AXIS_CAP ? `生存轴超标 S=${s.toFixed(2)}>${AXIS_CAP}` :
                  o < AXIS_FLOOR ? `进攻轴过低 O=${o.toFixed(2)}` :
                  `生存轴过低 S=${s.toFixed(2)}`) };
    },

    // 评估服装（含初始服装）：基于其 Lv60 属性
    evalCostume(cos) {
      const s60 = this.atLevel(cos.stats, cos.grow, 60);
      return this.evalStats60(s60, cos.cls, cos.rarity);
    },

    // —— 作者助手：按 稀有度×职业 生成「正好在线」的 base/grow ——
    // 返回 { base:{hp,atk,def,spd,crit}, grow:{hp,atk,def} }，预算 sum≈2.0。
    // shape 可选：在保持总预算不变的前提下微调形态 {atk:1.1,def:0.9,...}（换形）。
    makeCharStats(rarity, cls, shape) {
      const r = CLASS_REF60[cls]; if (!r) throw new Error('未知职业 ' + cls);
      shape = shape || {};
      const om = O_MULT[rarity] || 1, sm = S_MULT[rarity] || 1;
      const t60 = {
        hp:  Math.round(r.hp  * sm * (shape.hp  || 1)),
        atk: Math.round(r.atk * om * (shape.atk || 1)),
        def: Math.round(r.def * sm * (shape.def || 1)),
        spd: r.spd, crit: r.crit,
      };
      const bf = 0.15; // 1 级占满级 15%，其余靠成长
      const mk = v => Math.round(v * bf);
      const gr = (v) => Math.round((v - mk(v)) / 59 * 100) / 100;
      return {
        base: { hp: mk(t60.hp), atk: mk(t60.atk), def: mk(t60.def), spd: t60.spd, crit: t60.crit },
        grow: { hp: gr(t60.hp), atk: gr(t60.atk), def: gr(t60.def) },
      };
    },

    // —— 装备预算：单件 power 值不得超过同稀有度上限 ——
    // 把各属性折算成统一「装备分」：atk=1，def=1.2，hp=1/8，crit=800，spd=2
    GEAR_CAP: { 3: 170, 4: 230, 5: 320 },   // 模板分上限（强化前；按现役 EX/通用最强件校准 +30% 余量）
    gearScore(stats) {
      const s = stats || {};
      return (s.atk || 0) + (s.def || 0) * 1.2 + (s.hp || 0) / 8 + (s.crit || 0) * 800 + (s.spd || 0) * 2;
    },
    evalGear(tpl) {
      const sc = this.gearScore(tpl.stats);
      const cap = this.GEAR_CAP[tpl.rarity] || 1e9;
      return { ok: sc <= cap, score: Math.round(sc), cap, reason: sc <= cap ? '' : `装备分 ${Math.round(sc)}>${cap}` };
    },

    // —— 敌人理智带：非 BOSS / BOSS 各有 O、S 上限，防止小怪带 BOSS 数值 ——
    ENEMY_CAP: { normal: { O: 340, S: 5200 }, boss: { O: 720, S: 14000 } },
    evalEnemy(e) {
      const cap = e.isBoss ? this.ENEMY_CAP.boss : this.ENEMY_CAP.normal;
      const o = this.O(e.base), s = this.S(e.base);
      const ok = o <= cap.O && s <= cap.S;
      return { ok, O: Math.round(o), S: Math.round(s), cap,
               reason: ok ? '' : (o > cap.O ? `进攻 O=${Math.round(o)}>${cap.O}` : `生存 S=${Math.round(s)}>${cap.S}`) };
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Budget;
  else global.Budget = Budget;
})(typeof window !== 'undefined' ? window : globalThis);
