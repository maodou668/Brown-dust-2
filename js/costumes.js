// ============================================================
//  服装系统（BD2 模型）— 服装是唯一收集单位
//  · 每套服装 = 自己的属性 + 一个专属招式 + 外观（元素/配色）
//  · 角色 = 拥有的服装集合；穿哪套用哪套属性
//  · 招募只抽服装；抽到即拥有对应角色
//  在 data.js 之后加载
// ============================================================

const CH = window.GameData.CHARACTERS;
const SK = window.GameData.SKILLS;

// ---- 通用普通攻击 + 服装专属新技能（追加到 SKILLS）----
const EXTRA_SKILLS = {
  basic_attack: {
    name: '普通攻击', target: 'enemySingle', effect: 'damage',
    power: 0.85, sp: 0, cd: 0, icon: '🗡️', basic: true,
    desc: '普通攻击：对前排单体造成 85% 攻击力的伤害，并回复 SP。',
  },
  brave_charge: {
    name: '勇者突击', target: 'enemyRow', effect: 'damage',
    power: 1.5, sp: 3, cd: 2, icon: '🐎', knockback: true,
    desc: '策马冲锋践踏敌方一排，造成 150% 攻击力的伤害并击退。',
  },
  frost_lance: {
    name: '冰霜枪', target: 'enemySingle', effect: 'damage',
    power: 1.9, sp: 2, cd: 2, icon: '🧊', pierce: true,
    desc: '投掷冰枪贯穿目标，造成 190% 攻击力的水属性伤害（无视前排）。',
  },
  radiant_judgment: {
    name: '圣裁', target: 'enemyAll', effect: 'damage',
    power: 1.45, sp: 4, cd: 3, icon: '⚜️',
    desc: '降下审判圣光，对敌方全体造成 145% 攻击力的光属性伤害。',
  },
  twin_fang: {
    name: '双牙连射', target: 'enemySingle', effect: 'damage',
    power: 2.1, sp: 2, cd: 2, icon: '🐺', pierce: true,
    desc: '瞬发两箭，对单个敌人造成 210% 攻击力的伤害（无视前排）。',
  },
  mending_song: {
    name: '治愈之歌', target: 'allyAll', effect: 'heal',
    power: 1.5, sp: 3, cd: 2, icon: '🎵',
    desc: '吟唱治愈旋律，为全体友方恢复 150% 攻击力的生命值。',
  },
  venom_shot: {
    name: '淬毒之箭', target: 'enemySingle', effect: 'damage',
    power: 1.7, sp: 2, cd: 2, icon: '🏹', pierce: true,
    inflict: { type: 'poison', turns: 3, power: 0.45 },
    desc: '射出淬毒之箭贯穿目标，造成 170% 伤害（无视前排），并使其中毒 3 回合。',
  },
  tidal_burst: {
    name: '怒涛', target: 'enemyAll', effect: 'damage',
    power: 1.6, sp: 4, cd: 3, icon: '🌊',
    desc: '掀起滔天巨浪冲击敌方全体，造成 160% 攻击力的水属性伤害。',
  },
  shield_bash: {
    name: '盾击', target: 'enemySingle', effect: 'damage',
    power: 1.3, sp: 2, cd: 2, icon: '🛡️',
    inflict: { type: 'stun', turns: 1 },
    desc: '以巨盾猛击单体，造成 130% 伤害并使其眩晕 1 回合（无法行动）。',
  },
  arcane_seal: {
    name: '奥术封印', target: 'enemySingle', effect: 'damage',
    power: 1.4, sp: 3, cd: 3, icon: '🔇', pierce: true,
    inflict: { type: 'silence', turns: 2 },
    desc: '封印目标，造成 140% 伤害并沉默 2 回合（只能普攻，无视前排）。',
  },
};
Object.assign(SK, EXTRA_SKILLS);

// ============================================================
//  专属招式（全部由数值平衡模型 Balance 求解威力，落在统一曲线上）
//  新增角色只需在此加规格（sp/target/effect/附带效果），威力自动算，不会崩盘。
// ============================================================
const B = window.Balance;
const pct = p => Math.round(p * 100);
const SIG_SPECS = {
  // —— 已有招式：纳入模型重算（基本贴近原值）——
  inferno:          { name: '炼狱业火', target: 'enemyAll', effect: 'damage', sp: 4, icon: '🔥', inflict: { type: 'burn', turns: 2, power: 0.5 }, d: p => `召唤业火对敌方全体造成 ${pct(p)}% 火焰伤害，并灼烧 2 回合。` },
  shadow_volley:    { name: '暗影连射', target: 'enemySingle', effect: 'damage', sp: 4, icon: '🌌', pierce: true, d: p => `倾泻暗影箭雨，对单体造成 ${pct(p)}% 攻击力的恐怖伤害（无视前排）。` },
  tempest_blade:    { name: '苍穹一闪', target: 'enemySingle', effect: 'damage', sp: 4, icon: '🌀', knockback: true, d: p => `极致剑速爆发，对单体造成 ${pct(p)}% 风属性伤害并击退。` },
  blazing_arrow:    { name: '红莲烈箭', target: 'enemySingle', effect: 'damage', sp: 3, icon: '🔥', pierce: true, d: p => `点燃箭矢射穿目标，造成 ${pct(p)}% 火焰伤害（无视前排）。` },
  earth_slam:       { name: '大地践踏', target: 'enemyAll', effect: 'damage', sp: 3, icon: '⛰️', knockback: true, d: p => `震动大地对全体造成 ${pct(p)}% 伤害并击退前排。` },
  grand_heal:       { name: '圣光普照', target: 'allyAll', effect: 'heal', sp: 4, icon: '🌈', d: p => `降下圣光为全体恢复 ${pct(p)}% 攻击力的大量生命。` },
  blessing:         { name: '祝福', target: 'allyAll', effect: 'buffAtk', sp: 3, duration: 3, icon: '🌟', d: p => `为全体提升 ${pct(p)}% 攻击力，持续 3 回合。` },
  radiant_judgment: { name: '圣裁', target: 'enemyAll', effect: 'damage', sp: 4, icon: '⚜️', d: p => `降下审判圣光，对全体造成 ${pct(p)}% 光属性伤害。` },
  frost_nova:       { name: '霜冻新星', target: 'enemyAll', effect: 'damage', sp: 4, icon: '❄️', d: p => `冰霜爆发对全体造成 ${pct(p)}% 水属性伤害。` },
  twin_fang:        { name: '双牙连射', target: 'enemySingle', effect: 'damage', sp: 2, icon: '🐺', pierce: true, d: p => `瞬发两箭对单体造成 ${pct(p)}% 伤害（无视前排）。` },
  brave_charge:     { name: '勇者突击', target: 'enemyRow', effect: 'damage', sp: 3, icon: '🐎', knockback: true, d: p => `策马冲锋践踏一排，造成 ${pct(p)}% 伤害并击退。` },
  mending_song:     { name: '治愈之歌', target: 'allyAll', effect: 'heal', sp: 3, icon: '🎵', d: p => `吟唱治愈旋律为全体恢复 ${pct(p)}% 生命。` },
  holy_smite:       { name: '圣光裁决', target: 'enemyRow', effect: 'damage', sp: 3, icon: '⚡', d: p => `降下圣光对一排造成 ${pct(p)}% 光属性伤害。` },
  tidal_burst:      { name: '怒涛', target: 'enemyAll', effect: 'damage', sp: 4, icon: '🌊', d: p => `滔天巨浪冲击全体，造成 ${pct(p)}% 水属性伤害。` },
  shield_bash:      { name: '盾击', target: 'enemySingle', effect: 'damage', sp: 2, icon: '🛡️', inflict: { type: 'stun', turns: 1 }, d: p => `巨盾猛击单体，造成 ${pct(p)}% 伤害并眩晕 1 回合。` },
  venom_shot:       { name: '淬毒之箭', target: 'enemySingle', effect: 'damage', sp: 2, icon: '🏹', pierce: true, inflict: { type: 'poison', turns: 3, power: 0.45 }, d: p => `淬毒之箭贯穿目标，造成 ${pct(p)}% 伤害（无视前排）并中毒 3 回合。` },
  // —— 9 个新专属招式（角色差异化）——
  oath_aegis:       { name: '誓约圣盾', target: 'allyAll', effect: 'shield', sp: 3, icon: '🛡️', extra: { type: 'taunt' }, d: p => `为全体张开等同 ${pct(p)}% 攻击力的护盾，并嘲讽敌人集火自身。` },
  mountain_bulwark: { name: '山岳壁垒', target: 'allyAll', effect: 'shield', sp: 4, icon: '🏔️', d: p => `以山岳之力为全体张开 ${pct(p)}% 攻击力的厚重护盾。` },
  abyssal_prison:   { name: '深渊水牢', target: 'enemyAll', effect: 'damage', sp: 4, icon: '🌀', extra: { type: 'debuffDef', power: 0.20, duration: 2 }, d: p => `深渊水牢封锁全体，造成 ${pct(p)}% 水属性伤害并降低 20% 防御。` },
  absolute_zero:    { name: '绝对零度', target: 'enemyAll', effect: 'damage', sp: 4, icon: '🧊', inflict: { type: 'stun', turns: 1 }, d: p => `绝对零度冻结全体，造成 ${pct(p)}% 水属性伤害并冻结 1 回合。` },
  galeblade_flurry: { name: '疾风连斩', target: 'enemyRow', effect: 'damage', sp: 2, icon: '🌪️', knockback: true, d: p => `疾风乱舞横扫一排，造成 ${pct(p)}% 风属性伤害并击退。` },
  flame_slash:      { name: '烈焰斩', target: 'enemySingle', effect: 'damage', sp: 2, icon: '🔥', inflict: { type: 'burn', turns: 2, power: 0.5 }, d: p => `烈焰附刃斩击单体，造成 ${pct(p)}% 伤害并灼烧 2 回合。` },
  rooting_shot:     { name: '缚地穿杨', target: 'enemySingle', effect: 'damage', sp: 3, icon: '🎯', pierce: true, inflict: { type: 'stun', turns: 1 }, d: p => `钉地之箭贯穿目标，造成 ${pct(p)}% 伤害（无视前排）并定身 1 回合。` },
  zephyr_mend:      { name: '微风治愈', target: 'allyAll', effect: 'heal', sp: 2, icon: '🍃', d: p => `微风拂过为全体恢复 ${pct(p)}% 攻击力的生命。` },
  dawnblade:        { name: '黎明之刃', target: 'enemySingle', effect: 'damage', sp: 2, icon: '🌅', knockback: true, d: p => `黎明之刃斩击单体，造成 ${pct(p)}% 光属性伤害并击退。` },
};
Object.entries(SIG_SPECS).forEach(([id, spec]) => {
  const sk = B.make(spec);
  sk.desc = spec.d ? spec.d(sk.power) : spec.desc;
  delete sk.d;
  SK[id] = sk;
});

// ============================================================
//  职业通用技（每个职业一个 sp2「节奏技」）——让每个单位都有
//  「普攻蓄能 / 便宜节奏技 / 昂贵专属大招」三档真实抉择，而非只有 2 个按钮。
//  威力同样由 Balance 模型求解，落在统一曲线上，不会数值崩盘。
// ============================================================
const CLASS_SKILL_SPECS = {
  warrior:  { id: 'cls_cleave',  name: '横扫',     target: 'enemyRow',    effect: 'damage', sp: 2, icon: '⚔️', knockback: true, d: p => `横扫敌方一排，造成 ${pct(p)}% 攻击力的伤害并击退。` },
  archer:   { id: 'cls_aimshot', name: '瞄准射击', target: 'enemySingle', effect: 'damage', sp: 2, icon: '🏹', pierce: true,    d: p => `瞄准要害射击单体，造成 ${pct(p)}% 攻击力的伤害（无视前排）。` },
  mage:     { id: 'cls_arcane',  name: '奥术弹',   target: 'enemySingle', effect: 'damage', sp: 2, icon: '🔮', pierce: true,    d: p => `凝聚奥术弹贯穿目标，造成 ${pct(p)}% 攻击力的伤害（无视前排）。` },
  defender: { id: 'cls_guard',   name: '守护姿态', target: 'allyAll',     effect: 'shield', sp: 2, icon: '🛡️',                  d: p => `进入守护姿态，为全体张开 ${pct(p)}% 攻击力的护盾。` },
  healer:   { id: 'cls_mend',    name: '治愈术',   target: 'allySingle',  effect: 'heal',   sp: 2, icon: '💚',                  d: p => `集中治愈单个友方，恢复 ${pct(p)}% 攻击力的生命。` },
};
const CLASS_SKILL_OF = {};
Object.entries(CLASS_SKILL_SPECS).forEach(([cls, spec]) => {
  const { id, d, ...rest } = spec;
  const sk = B.make(rest);
  sk.desc = d(sk.power);
  sk.classSkill = true;
  SK[id] = sk;
  CLASS_SKILL_OF[cls] = id;
});
window.GameData.CLASS_SKILL_OF = CLASS_SKILL_OF;


// 每个角色「初始服装」的专属招式（显式指定，16 个互不重复）
const BASE_SIG = {
  lecliss: 'inferno', justia: 'oath_aegis', seir: 'shadow_volley', rou: 'blessing',
  helena: 'galeblade_flurry', diana: 'abyssal_prison', garcia: 'earth_slam',
  teried: 'flame_slash', lia: 'rooting_shot', mina: 'zephyr_mend',
  refithea: 'grand_heal', rigenette: 'tempest_blade', olstein: 'mountain_bulwark',
  glacia: 'absolute_zero', liatris: 'blazing_arrow', loen: 'dawnblade',
};


// 选取一个角色 2 技能中作为「初始服装」专属招式（取更强的那个）
function pickSignature(skills) {
  return skills.reduce((b, s) => ((SK[s].sp || 0) >= (SK[b].sp || 0) ? s : b), skills[0]);
}

// ---- 额外服装定义（属性倍率 + 专属招式）----
const ALTS = {
  teried_knight: { charId: 'teried', costumeName: '圣骑士', rarity: 4, element: 'light', color: '#ffd97a',
    mul: { hp: 1.1, atk: 1.0, def: 1.15 }, signature: 'radiant_judgment',
    desc: '受封圣骑士的礼装，挥剑间降下审判圣光。' },
  lecliss_frost: { charId: 'lecliss', costumeName: '霜华', rarity: 5, element: 'water', color: '#5a9fff',
    mul: { hp: 1.12, atk: 0.96, def: 1.0 }, signature: 'frost_nova',
    desc: '反转属性的霜之魔女，以极寒取代烈焰。' },
  justia_blade: { charId: 'justia', costumeName: '审判', rarity: 5, element: 'light', color: '#fff0a0',
    mul: { hp: 0.9, atk: 1.35, def: 0.85 }, signature: 'radiant_judgment',
    desc: '由守转攻的审判之姿，圣光化作裁决之刃。' },
  seir_twin: { charId: 'seir', costumeName: '双牙', rarity: 5, element: 'dark', color: '#c08bff',
    mul: { hp: 0.85, atk: 1.18, def: 0.95 }, signature: 'twin_fang',
    desc: '双弓在握的暗夜猎手，一息之间连射两箭。' },
  helena_storm: { charId: 'helena', costumeName: '风暴', rarity: 4, element: 'wind', color: '#5ad1ff',
    mul: { hp: 1.05, atk: 1.1, def: 1.0 }, signature: 'brave_charge',
    desc: '披上战旗的疾风骑士，策马掀起风暴。' },
  refithea_song: { charId: 'refithea', costumeName: '歌咏', rarity: 5, element: 'light', color: '#ffe7a0',
    mul: { hp: 1.1, atk: 1.05, def: 1.0 }, signature: 'mending_song',
    desc: '以歌声治愈众人的圣女，旋律即是奇迹。' },
  // —— 第二批服装 ——
  rou_battle: { charId: 'rou', costumeName: '战旗', rarity: 4, element: 'light', color: '#ffd97a',
    mul: { hp: 0.95, atk: 1.28, def: 0.9 }, signature: 'holy_smite',
    desc: '执战旗的祭司，以圣光化作进攻的号角。' },
  diana_tide: { charId: 'diana', costumeName: '怒涛', rarity: 5, element: 'water', color: '#3a7add',
    mul: { hp: 1.05, atk: 1.12, def: 1.0 }, signature: 'tidal_burst',
    desc: '掌控潮汐的深海法师，怒涛之下无人幸免。' },
  garcia_iron: { charId: 'garcia', costumeName: '钢铁', rarity: 4, element: 'earth', color: '#a8a8b0',
    mul: { hp: 1.12, atk: 1.05, def: 1.15 }, signature: 'shield_bash',
    desc: '披挂钢铁全装的壁垒，以盾击震慑并眩晕来犯之敌。' },
  mina_combat: { charId: 'mina', costumeName: '战斗药剂', rarity: 4, element: 'wind', color: '#7affc4',
    mul: { hp: 0.9, atk: 1.32, def: 0.95 }, signature: 'venom_shot',
    desc: '改良配方的米娜，把药剂调成了攻击武器。' },
  lia_twin: { charId: 'lia', costumeName: '疾风猎手', rarity: 4, element: 'wind', color: '#9ad15a',
    mul: { hp: 0.92, atk: 1.18, def: 0.95 }, signature: 'twin_fang',
    desc: '换上轻装的猎手，箭矢快如疾风。' },
  loen_paladin: { charId: 'loen', costumeName: '圣殿骑士', rarity: 4, element: 'light', color: '#ffe07a',
    mul: { hp: 1.08, atk: 1.05, def: 1.12 }, signature: 'radiant_judgment',
    desc: '晋升圣殿骑士的罗恩，肩负审判之责。' },
  rigenette_sword: { charId: 'rigenette', costumeName: '剑圣', rarity: 5, element: 'wind', color: '#5ad1ff',
    mul: { hp: 1.0, atk: 1.18, def: 1.05 }, signature: 'brave_charge',
    desc: '剑技臻至化境的剑圣，一骑当千。' },
  olstein_holy: { charId: 'olstein', costumeName: '圣盾', rarity: 5, element: 'light', color: '#ffe7b0',
    mul: { hp: 1.05, atk: 1.1, def: 1.1 }, signature: 'radiant_judgment',
    desc: '受圣光加护的不动壁垒，攻守兼备。' },
};

// ---- 生成全部服装：每角色「初始服装」+ 额外服装 ----
const COSTUMES = {};
Object.values(CH).forEach(ch => {
  COSTUMES['base_' + ch.id] = {
    id: 'base_' + ch.id, charId: ch.id, charName: ch.name, costumeName: '初始',
    name: ch.name + ' · 初始', rarity: ch.rarity, cls: ch.cls,
    element: ch.element, color: ch.color,
    stats: { ...ch.base }, grow: { ...ch.grow },
    signature: BASE_SIG[ch.id] || pickSignature(ch.skills), base: true,
    desc: ch.desc,
  };
});
// 稀有度缺口补偿：服装稀有度高于角色基础稀有度时，按预算模型把属性抬到服装应有的档位
// （否则「4★ 服装套在 3★ 角色基础上」会永远达不到 4★ 预算，价值虚低）。
const OM = (window.Budget && window.Budget.O_MULT) || { 3: 0.72, 4: 0.86, 5: 1.0 };
const SM = (window.Budget && window.Budget.S_MULT) || { 3: 0.90, 4: 0.95, 5: 1.0 };
Object.entries(ALTS).forEach(([id, a]) => {
  const ch = CH[a.charId];
  const oGap = (OM[a.rarity] || 1) / (OM[ch.rarity] || 1);   // 进攻轴（atk）补偿
  const sGap = (SM[a.rarity] || 1) / (SM[ch.rarity] || 1);   // 生存轴（hp/def）补偿
  COSTUMES[id] = {
    id, charId: a.charId, charName: ch.name, costumeName: a.costumeName,
    name: ch.name + ' · ' + a.costumeName, rarity: a.rarity, cls: ch.cls,
    element: a.element, color: a.color,
    stats: {
      hp: Math.round(ch.base.hp * (a.mul.hp || 1) * sGap),
      atk: Math.round(ch.base.atk * (a.mul.atk || 1) * oGap),
      def: Math.round(ch.base.def * (a.mul.def || 1) * sGap),
      spd: ch.base.spd, crit: ch.base.crit,
    },
    // 成长同步补偿，确保满级也落在该稀有度预算（仅在跨稀有度时偏离 1）
    grow: {
      hp: Math.round((ch.grow.hp || 0) * sGap * 100) / 100,
      atk: Math.round((ch.grow.atk || 0) * oGap * 100) / 100,
      def: Math.round((ch.grow.def || 0) * sGap * 100) / 100,
    },
    signature: a.signature, desc: a.desc,
  };
});

// 招募池（按稀有度）
const COSTUME_POOL = { 5: [], 4: [], 3: [] };
Object.values(COSTUMES).forEach(c => { (COSTUME_POOL[c.rarity] || (COSTUME_POOL[c.rarity] = [])).push(c.id); });

window.GameData.COSTUMES = COSTUMES;
window.GameData.COSTUME_POOL = COSTUME_POOL;
