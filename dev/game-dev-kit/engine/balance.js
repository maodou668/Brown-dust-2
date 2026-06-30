// ============================================================
//  数值平衡模型（全局）—— 技能威力由「SP + 目标范围 + 附带效果」算出
//  目的：所有技能落在同一性价比曲线上；新技能只填规格，威力自动求解，不会数值崩盘。
//  已按现有技能校准（套用后基本不改变当前手感）。
//  浏览器：window.Balance     Node：module.exports
// ============================================================
(function (global) {
  'use strict';
  const Balance = {
    // —— 可调常数（改这里即全局微调）——
    BASE: 0.85,        // 普攻威力（基准）
    SP_VALUE: 0.60,    // 每点 SP 的价值
    TF: { enemySingle: 1.0, enemyRow: 1.75, enemyAll: 2.1, allySingle: 1.0, allyAll: 2.1, self: 1.0 },
    HEAL_F: 0.85, SHIELD_F: 0.90, BUFF_F: 1.10,
    // 附带效果价值（换算成「威力」单位）
    DOT_F: 0.55,       // 灼烧/中毒：每跳威力 × 回合 × 此系数
    STUN_V: 0.80,      // 眩晕：每回合
    SILENCE_V: 0.30,   // 沉默：每回合
    DEBUFF_F: 1.20,    // 破防：破防量 × 此系数
    KNOCKBACK_V: 0.20, // 击退（每个目标）
    PIERCE_V: 0.15,    // 穿透（一次性）
    TAUNT_V: 0.60,     // 嘲讽

    budget(sp) { return this.BASE + this.SP_VALUE * (sp || 0); },
    tf(t) { return this.TF[t] || 1; },
    // 随目标数放大的效果（每个目标都吃到）
    _modPerTarget(s) {
      let v = 0;
      if (s.inflict) {
        const i = s.inflict;
        if (i.type === 'burn' || i.type === 'poison') v += (i.power || 0.45) * (i.turns || 1) * this.DOT_F;
        else if (i.type === 'stun') v += this.STUN_V * (i.turns || 1);
        else if (i.type === 'silence') v += this.SILENCE_V * (i.turns || 1);
      }
      if (s.extra && s.extra.type === 'debuffDef') v += (s.extra.power || 0) * this.DEBUFF_F;
      if (s.knockback) v += this.KNOCKBACK_V;
      return v;
    },
    _modFlat(s) { return s.pierce ? this.PIERCE_V : 0; },
    // 技能的实际「价值」（威力单位）
    value(s) {
      const tf = this.tf(s.target);
      if (s.effect === 'heal') return s.power * tf * this.HEAL_F;
      if (s.effect === 'shield') return s.power * tf * this.SHIELD_F + ((s.extra && s.extra.type === 'taunt') ? this.TAUNT_V : 0);
      if (s.effect === 'buffAtk' || s.effect === 'buffDef') return s.power * (s.duration || 1) * tf * this.BUFF_F;
      return (s.power + this._modPerTarget(s)) * tf + this._modFlat(s);
    },
    // 给定规格（不含 power），反解出应有的 power，使其正好落在预算线上
    idealPower(spec) {
      const tf = this.tf(spec.target), b = this.budget(spec.sp);
      let p;
      if (spec.effect === 'heal') p = b / (tf * this.HEAL_F);
      else if (spec.effect === 'shield') p = (b - ((spec.extra && spec.extra.type === 'taunt') ? this.TAUNT_V : 0)) / (tf * this.SHIELD_F);
      else if (spec.effect === 'buffAtk' || spec.effect === 'buffDef') p = b / ((spec.duration || 1) * tf * this.BUFF_F);
      else p = (b - this._modFlat(spec)) / tf - this._modPerTarget(spec);
      return Math.max(0.3, Math.round(p * 100) / 100);
    },
    // 平衡分：1.0 = 正好在线上；偏离 ±0.18 以内视为达标
    score(s) { return this.value(s) / this.budget(s.sp || 0); },
    // 用 idealPower 填好 power 后返回完整技能对象
    make(spec) { return Object.assign({}, spec, { power: this.idealPower(spec) }); },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Balance;
  else global.Balance = Balance;
})(typeof window !== 'undefined' ? window : globalThis);
