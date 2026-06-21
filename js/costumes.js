// ============================================================
//  服装系统（一角多服）— BD2 核心收集机制
//  每套服装 = 不同的技能组 + 外观（元素/配色），可随时切换
//  在 data.js 之后加载：补充服装专属技能、定义 COSTUMES、挂到 GameData
// ============================================================

// 服装专属新技能（追加到 SKILLS）
const COSTUME_SKILLS = {
  brave_charge: {
    name: '勇者突击', target: 'enemyRow', effect: 'damage',
    power: 1.5, sp: 3, icon: '🐎', knockback: true,
    desc: '策马冲锋践踏敌方一排，造成 150% 攻击力的伤害并击退。',
  },
  frost_lance: {
    name: '冰霜枪', target: 'enemySingle', effect: 'damage',
    power: 1.9, sp: 2, icon: '🧊', pierce: true,
    desc: '投掷冰枪贯穿目标，造成 190% 攻击力的水属性伤害（无视前排）。',
  },
  radiant_judgment: {
    name: '圣裁', target: 'enemyAll', effect: 'damage',
    power: 1.45, sp: 4, icon: '⚜️',
    desc: '降下审判圣光，对敌方全体造成 145% 攻击力的光属性伤害。',
  },
  twin_fang: {
    name: '双牙连射', target: 'enemySingle', effect: 'damage',
    power: 2.1, sp: 2, icon: '🐺', pierce: true,
    desc: '瞬发两箭，对单个敌人造成 210% 攻击力的伤害（无视前排）。',
  },
  mending_song: {
    name: '治愈之歌', target: 'allyAll', effect: 'heal',
    power: 1.5, sp: 3, icon: '🎵',
    desc: '吟唱治愈旋律，为全体友方恢复 150% 攻击力的生命值。',
  },
};

// 服装定义（基础服装由角色本体自动派生，这里是「额外」服装）
const COSTUMES = {
  teried_knight: {
    id: 'teried_knight', charId: 'teried', name: '圣骑士 · 泰瑞德', rarity: 4,
    element: 'light', color: '#ffd97a', skills: ['slash', 'radiant_judgment'],
    desc: '泰瑞德受封圣骑士的礼装，挥剑间降下审判圣光。',
  },
  lecliss_frost: {
    id: 'lecliss_frost', charId: 'lecliss', name: '霜华 · 莉可莉丝', rarity: 5,
    element: 'water', color: '#5a9fff', skills: ['frost_lance', 'frost_nova'],
    desc: '反转属性的霜之魔女，以极寒取代烈焰。',
  },
  justia_blade: {
    id: 'justia_blade', charId: 'justia', name: '审判 · 贾丝蒂亚', rarity: 5,
    element: 'light', color: '#fff0a0', skills: ['holy_smite', 'radiant_judgment'],
    desc: '由守转攻的审判之姿，圣光化作裁决之刃。',
  },
  seir_twin: {
    id: 'seir_twin', charId: 'seir', name: '双牙 · 希尔', rarity: 5,
    element: 'dark', color: '#c08bff', skills: ['piercing_shot', 'twin_fang'],
    desc: '双弓在握的暗夜猎手，一息之间连射两箭。',
  },
  helena_storm: {
    id: 'helena_storm', charId: 'helena', name: '风暴 · 海莲娜', rarity: 4,
    element: 'wind', color: '#5ad1ff', skills: ['brave_charge', 'gale_strike'],
    desc: '披上战旗的疾风骑士，策马掀起风暴。',
  },
  refithea_song: {
    id: 'refithea_song', charId: 'refithea', name: '歌咏 · 蕾菲西亚', rarity: 5,
    element: 'light', color: '#ffe7a0', skills: ['mending_song', 'grand_heal'],
    desc: '以歌声治愈众人的圣女，旋律即是奇迹。',
  },
};

// 抽取池（服装招募）
const COSTUME_GACHA = {
  cost: 120,
  pool: Object.keys(COSTUMES),
};

// 追加技能 + 挂载
if (window.GameData) {
  Object.assign(window.GameData.SKILLS, COSTUME_SKILLS);
  window.GameData.COSTUMES = COSTUMES;
  window.GameData.COSTUME_GACHA = COSTUME_GACHA;
}
