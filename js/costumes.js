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
    desc: '射出淬毒之箭贯穿目标，造成 170% 攻击力的伤害（无视前排）。',
  },
  tidal_burst: {
    name: '怒涛', target: 'enemyAll', effect: 'damage',
    power: 1.6, sp: 4, cd: 3, icon: '🌊',
    desc: '掀起滔天巨浪冲击敌方全体，造成 160% 攻击力的水属性伤害。',
  },
};
Object.assign(SK, EXTRA_SKILLS);

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
    mul: { hp: 1.12, atk: 1.0, def: 1.15 }, signature: 'taunt_shield',
    desc: '披挂钢铁全装的壁垒，以身躯铸成防线。' },
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
    signature: pickSignature(ch.skills), base: true,
    desc: ch.desc,
  };
});
Object.entries(ALTS).forEach(([id, a]) => {
  const ch = CH[a.charId];
  COSTUMES[id] = {
    id, charId: a.charId, charName: ch.name, costumeName: a.costumeName,
    name: ch.name + ' · ' + a.costumeName, rarity: a.rarity, cls: ch.cls,
    element: a.element, color: a.color,
    stats: {
      hp: Math.round(ch.base.hp * (a.mul.hp || 1)),
      atk: Math.round(ch.base.atk * (a.mul.atk || 1)),
      def: Math.round(ch.base.def * (a.mul.def || 1)),
      spd: ch.base.spd, crit: ch.base.crit,
    },
    grow: { ...ch.grow }, signature: a.signature, desc: a.desc,
  };
});

// 招募池（按稀有度）
const COSTUME_POOL = { 5: [], 4: [], 3: [] };
Object.values(COSTUMES).forEach(c => { (COSTUME_POOL[c.rarity] || (COSTUME_POOL[c.rarity] = [])).push(c.id); });

window.GameData.COSTUMES = COSTUMES;
window.GameData.COSTUME_POOL = COSTUME_POOL;
