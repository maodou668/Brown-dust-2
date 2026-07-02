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
    power: 0.85, sp: 0, cd: 0, icon: I('sk_slash'), basic: true,
    desc: '普通攻击：对前排单体造成 85% 攻击力的伤害，并回复 SP。',
  },
  brave_charge: {
    name: '勇者突击', target: 'enemyRow', effect: 'damage',
    power: 1.5, sp: 3, cd: 2, icon: I('sk_power'), knockback: true,
    desc: '策马冲锋践踏敌方一排，造成 150% 攻击力的伤害并击退。',
  },
  frost_lance: {
    name: '冰霜枪', target: 'enemySingle', effect: 'damage',
    power: 1.9, sp: 2, cd: 2, icon: I('sk_frost'), pierce: true,
    desc: '投掷冰枪贯穿目标，造成 190% 攻击力的水属性伤害（无视前排）。',
  },
  radiant_judgment: {
    name: '圣裁', target: 'enemyAll', effect: 'damage',
    power: 1.45, sp: 4, cd: 3, icon: I('sk_smite'),
    desc: '降下审判圣光，对敌方全体造成 145% 攻击力的光属性伤害。',
  },
  twin_fang: {
    name: '双牙连射', target: 'enemySingle', effect: 'damage',
    power: 2.1, sp: 2, cd: 2, icon: I('sk_pierce'), pierce: true,
    desc: '瞬发两箭，对单个敌人造成 210% 攻击力的伤害（无视前排）。',
  },
  mending_song: {
    name: '治愈之歌', target: 'allyAll', effect: 'heal',
    power: 1.5, sp: 3, cd: 2, icon: I('sk_healwave'),
    desc: '吟唱治愈旋律，为全体友方恢复 150% 攻击力的生命值。',
  },
  venom_shot: {
    name: '淬毒之箭', target: 'enemySingle', effect: 'damage',
    power: 1.7, sp: 2, cd: 2, icon: I('sk_pierce'), pierce: true,
    inflict: { type: 'poison', turns: 3, power: 0.45 },
    desc: '射出淬毒之箭贯穿目标，造成 170% 伤害（无视前排），并使其中毒 3 回合。',
  },
  tidal_burst: {
    name: '怒涛', target: 'enemyAll', effect: 'damage',
    power: 1.6, sp: 4, cd: 3, icon: I('sk_waterlance'),
    desc: '掀起滔天巨浪冲击敌方全体，造成 160% 攻击力的水属性伤害。',
  },
  shield_bash: {
    name: '盾击', target: 'enemySingle', effect: 'damage',
    power: 1.3, sp: 2, cd: 2, icon: I('sk_rockguard'),
    inflict: { type: 'stun', turns: 1 },
    desc: '以巨盾猛击单体，造成 130% 伤害并使其眩晕 1 回合（无法行动）。',
  },
  arcane_seal: {
    name: '奥术封印', target: 'enemySingle', effect: 'damage',
    power: 1.4, sp: 3, cd: 3, icon: I('sk_shadow'), pierce: true,
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
  inferno:          { name: '炼狱业火', target: 'enemyAll', effect: 'damage', sp: 4, icon: I('sk_inferno'), inflict: { type: 'burn', turns: 2, power: 0.5 }, d: p => `召唤业火对敌方全体造成 ${pct(p)}% 火焰伤害，并灼烧 2 回合。` },
  shadow_volley:    { name: '暗影连射', target: 'enemySingle', effect: 'damage', sp: 4, icon: I('sk_shadow'), pierce: true, d: p => `倾泻暗影箭雨，对单体造成 ${pct(p)}% 攻击力的恐怖伤害（无视前排）。` },
  tempest_blade:    { name: '苍穹一闪', target: 'enemySingle', effect: 'damage', sp: 4, icon: I('sk_tempest'), knockback: true, d: p => `极致剑速爆发，对单体造成 ${pct(p)}% 风属性伤害并击退。` },
  blazing_arrow:    { name: '红莲烈箭', target: 'enemySingle', effect: 'damage', sp: 3, icon: I('sk_blazing'), pierce: true, d: p => `点燃箭矢射穿目标，造成 ${pct(p)}% 火焰伤害（无视前排）。` },
  earth_slam:       { name: '大地践踏', target: 'enemyAll', effect: 'damage', sp: 3, icon: I('sk_earthslam'), knockback: true, d: p => `震动大地对全体造成 ${pct(p)}% 伤害并击退前排。` },
  grand_heal:       { name: '圣光普照', target: 'allyAll', effect: 'heal', sp: 4, icon: I('sk_grandheal'), d: p => `降下圣光为全体恢复 ${pct(p)}% 攻击力的大量生命。` },
  blessing:         { name: '祝福', target: 'allyAll', effect: 'buffAtk', sp: 3, duration: 3, icon: I('sk_blessing'), d: p => `为全体提升 ${pct(p)}% 攻击力，持续 3 回合。` },
  radiant_judgment: { name: '圣裁', target: 'enemyAll', effect: 'damage', sp: 4, icon: I('sk_smite'), d: p => `降下审判圣光，对全体造成 ${pct(p)}% 光属性伤害。` },
  frost_nova:       { name: '霜冻新星', target: 'enemyAll', effect: 'damage', sp: 4, icon: I('sk_frost'), d: p => `冰霜爆发对全体造成 ${pct(p)}% 水属性伤害。` },
  twin_fang:        { name: '双牙连射', target: 'enemySingle', effect: 'damage', sp: 2, icon: I('sk_pierce'), pierce: true, d: p => `瞬发两箭对单体造成 ${pct(p)}% 伤害（无视前排）。` },
  brave_charge:     { name: '勇者突击', target: 'enemyRow', effect: 'damage', sp: 3, icon: I('sk_power'), knockback: true, d: p => `策马冲锋践踏一排，造成 ${pct(p)}% 伤害并击退。` },
  mending_song:     { name: '治愈之歌', target: 'allyAll', effect: 'heal', sp: 3, icon: I('sk_healwave'), d: p => `吟唱治愈旋律为全体恢复 ${pct(p)}% 生命。` },
  holy_smite:       { name: '圣光裁决', target: 'enemyRow', effect: 'damage', sp: 3, icon: I('sk_smite'), d: p => `降下圣光对一排造成 ${pct(p)}% 光属性伤害。` },
  tidal_burst:      { name: '怒涛', target: 'enemyAll', effect: 'damage', sp: 4, icon: I('sk_waterlance'), d: p => `滔天巨浪冲击全体，造成 ${pct(p)}% 水属性伤害。` },
  shield_bash:      { name: '盾击', target: 'enemySingle', effect: 'damage', sp: 2, icon: I('sk_rockguard'), inflict: { type: 'stun', turns: 1 }, d: p => `巨盾猛击单体，造成 ${pct(p)}% 伤害并眩晕 1 回合。` },
  venom_shot:       { name: '淬毒之箭', target: 'enemySingle', effect: 'damage', sp: 2, icon: I('sk_pierce'), pierce: true, inflict: { type: 'poison', turns: 3, power: 0.45 }, d: p => `淬毒之箭贯穿目标，造成 ${pct(p)}% 伤害（无视前排）并中毒 3 回合。` },
  // —— 9 个新专属招式（角色差异化）——
  oath_aegis:       { name: '誓约圣盾', target: 'allyAll', effect: 'shield', sp: 3, icon: I('sk_taunt'), extra: { type: 'taunt' }, d: p => `为全体张开等同 ${pct(p)}% 攻击力的护盾，并嘲讽敌人集火自身。` },
  mountain_bulwark: { name: '山岳壁垒', target: 'allyAll', effect: 'shield', sp: 4, icon: I('sk_rockguard'), d: p => `以山岳之力为全体张开 ${pct(p)}% 攻击力的厚重护盾。` },
  abyssal_prison:   { name: '深渊水牢', target: 'enemyAll', effect: 'damage', sp: 4, icon: I('sk_waterlance'), extra: { type: 'debuffDef', power: 0.20, duration: 2 }, d: p => `深渊水牢封锁全体，造成 ${pct(p)}% 水属性伤害并降低 20% 防御。` },
  absolute_zero:    { name: '绝对零度', target: 'enemyAll', effect: 'damage', sp: 4, icon: I('sk_frost'), inflict: { type: 'stun', turns: 1 }, d: p => `绝对零度冻结全体，造成 ${pct(p)}% 水属性伤害并冻结 1 回合。` },
  galeblade_flurry: { name: '疾风连斩', target: 'enemyRow', effect: 'damage', sp: 2, icon: I('sk_gale'), knockback: true, d: p => `疾风乱舞横扫一排，造成 ${pct(p)}% 风属性伤害并击退。` },
  flame_slash:      { name: '烈焰斩', target: 'enemySingle', effect: 'damage', sp: 2, icon: I('sk_blazing'), inflict: { type: 'burn', turns: 2, power: 0.5 }, d: p => `烈焰附刃斩击单体，造成 ${pct(p)}% 伤害并灼烧 2 回合。` },
  rooting_shot:     { name: '缚地穿杨', target: 'enemySingle', effect: 'damage', sp: 3, icon: I('sk_pierce'), pierce: true, inflict: { type: 'stun', turns: 1 }, d: p => `钉地之箭贯穿目标，造成 ${pct(p)}% 伤害（无视前排）并定身 1 回合。` },
  zephyr_mend:      { name: '微风治愈', target: 'allyAll', effect: 'heal', sp: 2, icon: I('sk_healwave'), d: p => `微风拂过为全体恢复 ${pct(p)}% 攻击力的生命。` },
  dawnblade:        { name: '黎明之刃', target: 'enemySingle', effect: 'damage', sp: 2, icon: I('sk_smite'), knockback: true, d: p => `黎明之刃斩击单体，造成 ${pct(p)}% 光属性伤害并击退。` },
};
Object.entries(SIG_SPECS).forEach(([id, spec]) => {
  const sk = B.make(spec);
  sk.desc = spec.d ? spec.d(sk.power) : spec.desc;
  delete sk.d;
  SK[id] = sk;
});

// 职业通用技已废弃（用户确认不再使用）：每套服装各带 2 个专属技，见文件末尾 buildKits 的 KIT 表。


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
// signature = 该服装主技（贵、大招）；second = 该服装第二技（配套另一招）。每套服装 = 2 技 + 普攻。
const ALTS = {
  teried_knight: { charId: 'teried', costumeName: '圣骑士', rarity: 4, element: 'light', color: '#ffd97a',
    mul: { hp: 1.1, atk: 1.0, def: 1.15 }, signature: 'radiant_judgment', second: 'dawnblade',
    portrait: 'art/05_pixellab/ui/portraits/teried_knight.png',
    desc: '受封圣骑士的礼装，挥剑间降下审判圣光。' },
  lecliss_frost: { charId: 'lecliss', costumeName: '霜华', rarity: 5, element: 'water', color: '#5a9fff',
    mul: { hp: 1.12, atk: 0.96, def: 1.0 }, signature: 'frost_nova', second: 'water_lance',
    portrait: 'art/05_pixellab/ui/portraits/lecliss_frost.png',
    desc: '反转属性的霜之魔女，以极寒取代烈焰。' },
  justia_blade: { charId: 'justia', costumeName: '审判', rarity: 5, element: 'light', color: '#fff0a0',
    mul: { hp: 0.9, atk: 1.35, def: 0.85 }, signature: 'radiant_judgment', second: 'dawnblade',
    portrait: 'art/05_pixellab/ui/portraits/justia_blade.png',
    desc: '由守转攻的审判之姿，圣光化作裁决之刃。' },
  seir_twin: { charId: 'seir', costumeName: '双牙', rarity: 5, element: 'dark', color: '#c08bff',
    mul: { hp: 0.85, atk: 1.18, def: 0.95 }, signature: 'twin_fang', second: 'shadow_volley',
    desc: '双弓在握的暗夜猎手，一息之间连射两箭。' },
  helena_storm: { charId: 'helena', costumeName: '风暴', rarity: 4, element: 'wind', color: '#5ad1ff',
    mul: { hp: 1.05, atk: 1.1, def: 1.0 }, signature: 'brave_charge', second: 'galeblade_flurry',
    desc: '披上战旗的疾风骑士，策马掀起风暴。' },
  refithea_song: { charId: 'refithea', costumeName: '歌咏', rarity: 5, element: 'light', color: '#ffe7a0',
    mul: { hp: 1.1, atk: 1.05, def: 1.0 }, signature: 'mending_song', second: 'grand_heal',
    desc: '以歌声治愈众人的圣女，旋律即是奇迹。' },
  // —— 第二批服装 ——
  rou_battle: { charId: 'rou', costumeName: '战旗', rarity: 4, element: 'light', color: '#ffd97a',
    mul: { hp: 0.95, atk: 1.28, def: 0.9 }, signature: 'holy_smite', second: 'blessing',
    desc: '执战旗的祭司，以圣光化作进攻的号角。' },
  diana_tide: { charId: 'diana', costumeName: '怒涛', rarity: 5, element: 'water', color: '#3a7add',
    mul: { hp: 1.05, atk: 1.12, def: 1.0 }, signature: 'tidal_burst', second: 'water_lance',
    desc: '掌控潮汐的深海法师，怒涛之下无人幸免。' },
  garcia_iron: { charId: 'garcia', costumeName: '钢铁', rarity: 4, element: 'earth', color: '#a8a8b0',
    mul: { hp: 1.12, atk: 1.05, def: 1.15 }, signature: 'shield_bash', second: 'earth_slam',
    desc: '披挂钢铁全装的壁垒，以盾击震慑并眩晕来犯之敌。' },
  mina_combat: { charId: 'mina', costumeName: '战斗药剂', rarity: 4, element: 'wind', color: '#7affc4',
    mul: { hp: 0.9, atk: 1.32, def: 0.95 }, signature: 'venom_shot', second: 'zephyr_mend',
    desc: '改良配方的米娜，把药剂调成了攻击武器。' },
  lia_twin: { charId: 'lia', costumeName: '疾风猎手', rarity: 4, element: 'wind', color: '#9ad15a',
    mul: { hp: 0.92, atk: 1.18, def: 0.95 }, signature: 'twin_fang', second: 'rooting_shot',
    desc: '换上轻装的猎手，箭矢快如疾风。' },
  loen_paladin: { charId: 'loen', costumeName: '圣殿骑士', rarity: 4, element: 'light', color: '#ffe07a',
    mul: { hp: 1.08, atk: 1.05, def: 1.12 }, signature: 'radiant_judgment', second: 'dawnblade',
    desc: '晋升圣殿骑士的罗恩，肩负审判之责。' },
  rigenette_sword: { charId: 'rigenette', costumeName: '剑圣', rarity: 5, element: 'wind', color: '#5ad1ff',
    mul: { hp: 1.0, atk: 1.18, def: 1.05 }, signature: 'brave_charge', second: 'tempest_blade',
    desc: '剑技臻至化境的剑圣，一骑当千。' },
  olstein_holy: { charId: 'olstein', costumeName: '圣盾', rarity: 5, element: 'light', color: '#ffe7b0',
    mul: { hp: 1.05, atk: 1.1, def: 1.1 }, signature: 'radiant_judgment', second: 'mountain_bulwark',
    portrait: 'art/05_pixellab/ui/portraits/olstein_holy.png',
    desc: '受圣光加护的不动壁垒，攻守兼备。' },
  // —— 补齐第二套服装（格蕾西亚 / 莉亚特丽丝，原先缺失，导致技能数不齐）——
  glacia_blizzard: { charId: 'glacia', costumeName: '暴雪', rarity: 5, element: 'water', color: '#bfe6ff',
    mul: { hp: 1.05, atk: 1.12, def: 1.0 }, signature: 'blizzard', second: 'frost_arrow',
    desc: '召唤极北暴雪、冰封万物的霜雪女王。' },
  liatris_scorch: { charId: 'liatris', costumeName: '焦土', rarity: 5, element: 'fire', color: '#ff6a3a',
    mul: { hp: 0.95, atk: 1.18, def: 0.95 }, signature: 'scorch_rain', second: 'oil_arrow',
    desc: '所过之处尽成焦土的烈焰游猎。' },
};

// ---- 生成全部服装：每角色「初始服装」+ 额外服装 ----
const COSTUMES = {};
Object.values(CH).forEach(ch => {
  const sig = BASE_SIG[ch.id] || pickSignature(ch.skills);
  COSTUMES['base_' + ch.id] = {
    id: 'base_' + ch.id, charId: ch.id, charName: ch.name, costumeName: '初始',
    name: ch.name + ' · 初始', rarity: ch.rarity, cls: ch.cls,
    element: ch.element, color: ch.color,
    stats: { ...ch.base }, grow: { ...ch.grow },
    signature: sig,
    skills: [sig],   // 占位；真正的 2 技由文件末尾 buildKits 的 KIT 表写入
    base: true,
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
    signature: a.signature,
    skills: [a.signature, a.second].filter(Boolean),   // 该套 2 技：专属大招 + 第二技
    portrait: a.portrait,   // 服装专属半身像（可选；无则 UI 回退角色基础半身像）
    desc: a.desc,
  };
});

// 招募池（按稀有度）
const COSTUME_POOL = { 5: [], 4: [], 3: [] };
Object.values(COSTUMES).forEach(c => { (COSTUME_POOL[c.rarity] || (COSTUME_POOL[c.rarity] = [])).push(c.id); });

window.GameData.COSTUMES = COSTUMES;
window.GameData.COSTUME_POOL = COSTUME_POOL;

// ============================================================
//  技能全独立化（审核通过设计表）：16 角色 × 4 技，全互不重复、无职业通用技。
//  每套服装 2 技（1 便宜节奏技 + 1 大招）。在 COSTUMES 建好后重写各套 skills，
//  注册全部 64 个技能 + 兜底 VFX（VFX 后补：先按元素/效果复用现有素材）。
// ============================================================
(function buildKits() {
  const iconOf = { fire: 'sk_inferno', water: 'sk_frost', wind: 'sk_gale', earth: 'sk_rockguard', light: 'sk_smite', dark: 'sk_shadow', heal: 'sk_healwave', shield: 'sk_taunt', buff: 'sk_blessing' };
  const tintOf = { fire: '#ff6a2a', water: '#5a9fff', wind: '#7ad6ff', earth: '#c9a05a', light: '#ffe7a0', dark: '#a06bff' };
  // 复用现有 22 个 fx：按 元素×形态(投射/单体/一排/全体 · 治疗/护盾/增益) 选最贴的一个，尽量拉开差异、零新生成
  function fxFor(el, target, effect, proj) {
    if (effect === 'heal') return target === 'allyAll' ? (el === 'wind' ? 'zephyr_heal' : 'grandheal_bloom') : 'heal_bloom';
    if (effect === 'shield') return el === 'light' ? 'aegis_holy' : (el === 'earth' ? 'stone_wall' : 'guard_barrier');
    if (effect === 'buffAtk') return 'blessing_aura';
    const aoe = target === 'enemyAll';
    const M = {
      fire:  proj ? 'fire_arrow'    : (aoe ? 'fire_explosion' : 'flame_slash'),
      water: proj ? 'water_lance'   : (aoe ? 'water_vortex'   : 'ice_nova'),
      wind:  proj ? 'tempest_slash' : (aoe ? 'gale_flurry'    : 'tempest_slash'),
      earth: proj ? 'root_snare'    : 'earth_slam',
      light: proj ? 'dawn_slash'    : (aoe ? 'aegis_holy'     : 'dawn_slash'),
      dark:  proj ? 'shadow_pierce' : (aoe ? 'shadow_burst'   : 'shadow_pierce'),
    };
    return M[el] || 'arcane_burst';
  }
  const tgtName = { enemySingle: '单体', enemyRow: '一排', enemyAll: '敌方全体', allySingle: '单个友方', allyAll: '全体友方', self: '自身' };
  const VFX = {};
  function descOf(p, target, effect, opts) {
    const pc = Math.round(p * 100), t = tgtName[target] || '目标';
    const rider = opts.inflict ? ({ burn: '并灼烧', poison: '并中毒', stun: '并眩晕', silence: '并沉默' }[opts.inflict.type] || '') : (opts.extra && opts.extra.type === 'taunt' ? '并嘲讽自身' : (opts.extra && opts.extra.type === 'debuffDef' ? '并降低其防御' : ''));
    if (effect === 'heal') return `为${t}恢复 ${pc}% 攻击力的生命。`;
    if (effect === 'shield') return `为${t}张开 ${pc}% 攻击力的护盾${opts.extra && opts.extra.type === 'taunt' ? '并嘲讽敌人' : ''}。`;
    if (effect === 'buffAtk') return `为${t}提升 ${pc}% 攻击力。`;
    return `对${t}造成 ${pc}% 攻击力的伤害${rider}。`;
  }
  function reg(id, name, target, effect, sp, element, opts) {
    opts = opts || {};
    const ik = (effect === 'heal') ? 'heal' : (effect === 'shield') ? 'shield' : (effect.indexOf('buff') === 0) ? 'buff' : element;
    const spec = { name, target, effect, sp, icon: I(iconOf[ik] || 'sk_slash') };
    if (opts.pierce) spec.pierce = true;
    if (opts.knockback) spec.knockback = true;
    if (opts.inflict) spec.inflict = opts.inflict;
    if (opts.extra) spec.extra = opts.extra;
    if (opts.duration) spec.duration = opts.duration;
    const sk = B.make(spec); sk.desc = descOf(sk.power, target, effect, opts); SK[id] = sk;
    VFX[id] = { castMs: 340, telegraphMs: 200, burst: fxFor(element, target, effect, !!opts.pierce), tint: tintOf[element] || '#ffffff' };
    if (opts.pierce) { VFX[id].projectile = true; VFX[id].spriteAngle = 0.785; }
    return id;
  }
  const D2 = { type: 'debuffDef', power: 0.2, duration: 2 };
  const KIT = {
    base_lecliss: [['flame_bolt', '烈焰弹', 'enemySingle', 'damage', 2, 'fire', { inflict: { type: 'burn', turns: 2, power: 0.4 } }], ['inferno', '炼狱业火', 'enemyAll', 'damage', 4, 'fire', { inflict: { type: 'burn', turns: 2, power: 0.5 } }]],
    lecliss_frost: [['ice_lance', '冰棱刺', 'enemySingle', 'damage', 2, 'water', { pierce: true }], ['frost_nova', '霜冻新星', 'enemyAll', 'damage', 4, 'water', { inflict: { type: 'stun', turns: 1 } }]],
    base_justia: [['shield_thrust', '盾突', 'enemySingle', 'damage', 2, 'light', { extra: { type: 'taunt' } }], ['oath_aegis', '誓约圣盾', 'allyAll', 'shield', 3, 'light', { extra: { type: 'taunt' } }]],
    justia_blade: [['verdict_slash', '裁决斩', 'enemySingle', 'damage', 2, 'light', { extra: D2 }], ['radiant_judgment', '圣裁光刃', 'enemyAll', 'damage', 4, 'light', {}]],
    base_seir: [['shadow_arrow', '暗影箭', 'enemySingle', 'damage', 2, 'dark', { pierce: true }], ['shadow_volley', '暗影连射', 'enemySingle', 'damage', 4, 'dark', { pierce: true }]],
    seir_twin: [['twin_fang', '双牙连射', 'enemySingle', 'damage', 2, 'dark', { pierce: true }], ['hunter_mark', '猎杀标记', 'enemySingle', 'damage', 3, 'dark', { extra: { type: 'debuffDef', power: 0.25, duration: 2 } }]],
    base_rou: [['mend_light', '愈光术', 'allySingle', 'heal', 2, 'light', {}], ['grand_heal', '圣光普照', 'allyAll', 'heal', 4, 'light', {}]],
    rou_battle: [['banner_thrust', '战旗突刺', 'enemyRow', 'damage', 2, 'light', {}], ['holy_smite', '圣光裁决', 'enemyRow', 'damage', 3, 'light', {}]],
    base_helena: [['galeblade_flurry', '疾风连斩', 'enemyRow', 'damage', 2, 'wind', { knockback: true }], ['wind_dance', '风刃乱舞', 'enemyAll', 'damage', 4, 'wind', {}]],
    helena_storm: [['dash_slash', '突进斩', 'enemySingle', 'damage', 2, 'wind', { knockback: true }], ['storm_charge', '风暴突击', 'enemyRow', 'damage', 3, 'wind', { knockback: true }]],
    base_diana: [['water_lance', '水矛', 'enemySingle', 'damage', 2, 'water', { pierce: true, extra: D2 }], ['abyssal_prison', '深渊水牢', 'enemyAll', 'damage', 4, 'water', { extra: D2 }]],
    diana_tide: [['tide_surge', '潮涌', 'enemyRow', 'damage', 2, 'water', {}], ['tidal_burst', '怒涛', 'enemyAll', 'damage', 4, 'water', {}]],
    base_garcia: [['rock_fist', '岩拳', 'enemySingle', 'damage', 2, 'earth', { inflict: { type: 'stun', turns: 1 } }], ['mountain_bulwark', '山岳壁垒', 'allyAll', 'shield', 4, 'earth', {}]],
    garcia_iron: [['steel_bash', '钢铁盾击', 'enemySingle', 'damage', 2, 'earth', { extra: D2 }], ['iron_roar', '铁壁怒吼', 'allyAll', 'shield', 3, 'earth', {}]],
    base_teried: [['flame_slash', '烈焰斩', 'enemySingle', 'damage', 2, 'fire', { inflict: { type: 'burn', turns: 2, power: 0.5 } }], ['breaker_strike', '破魔重斩', 'enemyRow', 'damage', 3, 'fire', { extra: D2 }]],
    teried_knight: [['dawn_thrust', '曙光刺', 'enemySingle', 'damage', 2, 'light', {}], ['dawn_judgment', '黎明审判', 'enemyRow', 'damage', 3, 'light', { knockback: true }]],
    base_lia: [['rooting_shot', '缚地穿杨', 'enemySingle', 'damage', 2, 'earth', { pierce: true, inflict: { type: 'stun', turns: 1 } }], ['earth_rain', '大地箭雨', 'enemyAll', 'damage', 4, 'earth', {}]],
    lia_twin: [['gale_shot', '疾风连射', 'enemySingle', 'damage', 2, 'wind', { pierce: true }], ['hunt_storm', '狩猎风暴', 'enemyRow', 'damage', 3, 'wind', {}]],
    base_mina: [['heal_potion', '治愈药剂', 'allySingle', 'heal', 2, 'wind', {}], ['zephyr_mend', '微风治愈', 'allyAll', 'heal', 3, 'wind', {}]],
    mina_combat: [['venom_shot', '淬毒之箭', 'enemySingle', 'damage', 2, 'wind', { pierce: true, inflict: { type: 'poison', turns: 3, power: 0.45 } }], ['blast_potion', '爆裂药剂', 'enemyAll', 'damage', 4, 'wind', { extra: D2 }]],
    base_refithea: [['holy_mend', '圣愈术', 'allySingle', 'heal', 2, 'light', {}], ['revive_light', '复苏之光', 'allyAll', 'heal', 4, 'light', {}]],
    refithea_song: [['mending_song', '治愈之歌', 'allyAll', 'heal', 3, 'light', {}], ['hymn_praise', '圣咏赞歌', 'allyAll', 'buffAtk', 3, 'light', { duration: 3 }]],
    base_rigenette: [['tempest_blade', '苍穹一闪', 'enemySingle', 'damage', 2, 'wind', { knockback: true }], ['sky_dance', '天翔剑舞', 'enemyRow', 'damage', 3, 'wind', {}]],
    rigenette_sword: [['iaido_slash', '居合斩', 'enemySingle', 'damage', 2, 'wind', {}], ['myriad_blades', '万剑归宗', 'enemyAll', 'damage', 4, 'wind', {}]],
    base_olstein: [['shield_hammer', '盾锤', 'enemySingle', 'damage', 2, 'earth', { inflict: { type: 'stun', turns: 1 } }], ['immovable_wall', '不动壁垒', 'allyAll', 'shield', 4, 'earth', {}]],
    olstein_holy: [['holy_charge', '圣盾突击', 'enemySingle', 'damage', 2, 'light', { extra: { type: 'taunt' } }], ['radiant_wall', '光辉护壁', 'allyAll', 'shield', 3, 'light', {}]],
    base_glacia: [['frost_spike', '冰锥术', 'enemySingle', 'damage', 2, 'water', { pierce: true }], ['absolute_zero', '绝对零度', 'enemyAll', 'damage', 4, 'water', { inflict: { type: 'stun', turns: 1 } }]],
    glacia_blizzard: [['frost_arrow', '寒霜箭', 'enemyRow', 'damage', 2, 'water', {}], ['blizzard', '暴风雪', 'enemyAll', 'damage', 4, 'water', { extra: D2 }]],
    base_liatris: [['blazing_arrow', '红莲烈箭', 'enemySingle', 'damage', 2, 'fire', { pierce: true, inflict: { type: 'burn', turns: 2, power: 0.4 } }], ['flame_volley', '烈焰爆矢', 'enemyAll', 'damage', 4, 'fire', {}]],
    liatris_scorch: [['oil_arrow', '火油箭', 'enemyRow', 'damage', 2, 'fire', { inflict: { type: 'burn', turns: 2, power: 0.4 } }], ['scorch_rain', '焦土箭雨', 'enemyAll', 'damage', 3, 'fire', { inflict: { type: 'burn', turns: 2, power: 0.4 } }]],
    base_loen: [['dawnblade', '黎明之刃', 'enemySingle', 'damage', 2, 'light', { knockback: true }], ['daybreak_slash', '破晓斩', 'enemyRow', 'damage', 3, 'light', {}]],
    loen_paladin: [['temple_thrust', '圣殿突刺', 'enemySingle', 'damage', 2, 'light', { extra: D2 }], ['divine_verdict', '神圣裁决', 'enemyAll', 'damage', 4, 'light', {}]],
  };
  Object.entries(KIT).forEach(([cid, pair]) => {
    const ids = pair.map(a => reg.apply(null, a));
    if (COSTUMES[cid]) { COSTUMES[cid].skills = ids; COSTUMES[cid].signature = ids[1]; }
  });
  window.GameData.SKILL_VFX_EXTRA = VFX;
})();
