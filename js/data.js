// ============================================================
//  Brown Dust 2 风格游戏 — 静态数据层
//  角色、技能、敌人、关卡、抽卡池定义
// ============================================================

/**
 * 职业定义
 * 每个职业有不同的定位与站位偏好
 */
const CLASSES = {
  warrior:  { name: '战士',   icon: '⚔️', role: '前排物理输出' },
  defender: { name: '守护者', icon: '🛡️', role: '前排坦克' },
  mage:     { name: '法师',   icon: '🔮', role: '后排范围法术' },
  archer:   { name: '游侠',   icon: '🏹', role: '后排单体爆发' },
  healer:   { name: '治愈者', icon: '✨', role: '后排辅助治疗' },
};

/**
 * 技能目标类型
 *  - enemySingle : 单个敌人
 *  - enemyRow    : 敌方一排（前/后）
 *  - enemyAll    : 全体敌人
 *  - allySingle  : 单个友方
 *  - allyAll     : 全体友方
 *  - self        : 自身
 */

/**
 * 技能效果类型
 *  - damage : 造成伤害（power 为攻击力倍率）
 *  - heal   : 治疗（power 为攻击力倍率）
 *  - buffAtk / buffDef : 给目标加攻/加防（power 为百分比，duration 回合）
 *  - debuffDef : 降低敌方防御
 *  - shield : 护盾（power 为攻击力倍率，吸收伤害）
 */

// 元素克制：火 > 风 > 地 > 水 > 火（克制造成 1.3 倍伤害）
const ELEMENTS = {
  fire:  { name: '火', icon: '🔥', strong: 'wind'  },
  wind:  { name: '风', icon: '🌪️', strong: 'earth' },
  earth: { name: '地', icon: '⛰️', strong: 'water' },
  water: { name: '水', icon: '💧', strong: 'fire'  },
  light: { name: '光', icon: '☀️', strong: 'dark'  },
  dark:  { name: '暗', icon: '🌑', strong: 'light' },
};

/**
 * 角色图鉴
 * baseStats 为 1 级基础值，成长随等级线性提升
 */
const CHARACTERS = {
  // ---------- 5★ ----------
  lecliss: {
    id: 'lecliss', name: '莉可莉丝', title: '炽焰魔女',
    rarity: 5, cls: 'mage', element: 'fire', color: '#ff5a5a',
    base: { hp: 820, atk: 165, def: 60, spd: 95, crit: 0.20 },
    grow: { hp: 78, atk: 16, def: 5 },
    skills: ['fireball', 'inferno'],
    desc: '操纵烈焰的强大魔女，擅长对敌方全体造成毁灭性火焰伤害。',
  },
  justia: {
    id: 'justia', name: '贾丝蒂亚', title: '圣盾骑士',
    rarity: 5, cls: 'defender', element: 'light', color: '#ffd35a',
    base: { hp: 1500, atk: 100, def: 130, spd: 70, crit: 0.10 },
    grow: { hp: 140, atk: 9, def: 12 },
    skills: ['taunt_shield', 'holy_smite'],
    desc: '誓死守护同伴的圣骑士，能为全队提供护盾并吸引敌方火力。',
  },
  seir: {
    id: 'seir', name: '希尔', title: '暗夜游侠',
    rarity: 5, cls: 'archer', element: 'dark', color: '#a06bff',
    base: { hp: 900, atk: 180, def: 65, spd: 120, crit: 0.30 },
    grow: { hp: 82, atk: 18, def: 5 },
    skills: ['piercing_shot', 'shadow_volley'],
    desc: '行动迅捷的神射手，对单体目标拥有恐怖的暴击爆发力。',
  },
  // ---------- 4★ ----------
  rou: {
    id: 'rou', name: '萝', title: '光明祭司',
    rarity: 4, cls: 'healer', element: 'light', color: '#7affc4',
    base: { hp: 950, atk: 110, def: 70, spd: 100, crit: 0.10 },
    grow: { hp: 88, atk: 10, def: 6 },
    skills: ['heal_wave', 'blessing'],
    desc: '温柔的治愈者，能恢复全队生命并提升攻击力。',
  },
  helena: {
    id: 'helena', name: '海莲娜', title: '疾风剑士',
    rarity: 4, cls: 'warrior', element: 'wind', color: '#5ad1ff',
    base: { hp: 1100, atk: 150, def: 85, spd: 110, crit: 0.18 },
    grow: { hp: 105, atk: 14, def: 8 },
    skills: ['slash', 'gale_strike'],
    desc: '身法如风的剑士，能对敌方一排造成连续斩击。',
  },
  diana: {
    id: 'diana', name: '黛安娜', title: '碧水法师',
    rarity: 4, cls: 'mage', element: 'water', color: '#5a9fff',
    base: { hp: 800, atk: 145, def: 58, spd: 92, crit: 0.15 },
    grow: { hp: 76, atk: 14, def: 5 },
    skills: ['water_lance', 'frost_nova'],
    desc: '冷静的水系法师，水矛可降低敌人防御。',
  },
  garcia: {
    id: 'garcia', name: '加西亚', title: '岩石壁垒',
    rarity: 4, cls: 'defender', element: 'earth', color: '#c9a05a',
    base: { hp: 1400, atk: 95, def: 120, spd: 65, crit: 0.08 },
    grow: { hp: 132, atk: 9, def: 11 },
    skills: ['rock_guard', 'earth_slam'],
    desc: '坚如磐石的守护者，自身防御越高反击越强。',
  },
  // ---------- 3★ ----------
  teried: {
    id: 'teried', name: '泰瑞德', title: '见习剑士',
    rarity: 3, cls: 'warrior', element: 'fire', color: '#ff8b5a',
    base: { hp: 1000, atk: 130, def: 75, spd: 95, crit: 0.12 },
    grow: { hp: 95, atk: 12, def: 7 },
    skills: ['slash', 'power_strike'],
    desc: '怀抱梦想的见习剑士，攻守均衡。',
  },
  lia: {
    id: 'lia', name: '莉亚', title: '草原游侠',
    rarity: 3, cls: 'archer', element: 'earth', color: '#a0d15a',
    base: { hp: 820, atk: 140, def: 60, spd: 108, crit: 0.22 },
    grow: { hp: 78, atk: 13, def: 5 },
    skills: ['piercing_shot', 'power_strike'],
    desc: '草原出身的猎手，箭无虚发。',
  },
  mina: {
    id: 'mina', name: '米娜', title: '小小药剂师',
    rarity: 3, cls: 'healer', element: 'wind', color: '#7affe0',
    base: { hp: 880, atk: 100, def: 65, spd: 98, crit: 0.10 },
    grow: { hp: 82, atk: 9, def: 6 },
    skills: ['heal_wave', 'slash'],
    desc: '随身携带药剂的少女，治疗虽弱但可靠。',
  },

  // ========== 第二部新增角色 ==========
  // ---------- 5★ ----------
  refithea: {
    id: 'refithea', name: '蕾菲西亚', title: '圣光圣女',
    rarity: 5, cls: 'healer', element: 'light', color: '#ffe7a0',
    base: { hp: 1050, atk: 130, def: 72, spd: 102, crit: 0.10 },
    grow: { hp: 96, atk: 12, def: 6 },
    skills: ['grand_heal', 'holy_light'],
    desc: '降临人间的圣女，掌握足以逆转生死的奇迹圣光，是全队的生命线。',
  },
  rigenette: {
    id: 'rigenette', name: '莉洁奈特', title: '苍穹剑姬',
    rarity: 5, cls: 'warrior', element: 'wind', color: '#7ad6ff',
    base: { hp: 1200, atk: 175, def: 90, spd: 118, crit: 0.22 },
    grow: { hp: 112, atk: 17, def: 8 },
    skills: ['tempest_blade', 'gale_strike'],
    desc: '空骑士团团长，剑速快若苍穹疾风，对单体的爆发冠绝全军。',
  },
  olstein: {
    id: 'olstein', name: '奥尔斯坦', title: '不动壁垒',
    rarity: 5, cls: 'defender', element: 'earth', color: '#d4a85a',
    base: { hp: 1650, atk: 110, def: 140, spd: 68, crit: 0.08 },
    grow: { hp: 152, atk: 9, def: 13 },
    skills: ['taunt_shield', 'rock_guard'],
    desc: '号称「不动」的传奇守护者，他的盾后，是任何敌人都无法逾越的防线。',
  },
  // ---------- 4★ ----------
  glacia: {
    id: 'glacia', name: '格蕾西亚', title: '冰封术士',
    rarity: 4, cls: 'mage', element: 'water', color: '#9bd6ff',
    base: { hp: 830, atk: 150, def: 58, spd: 94, crit: 0.15 },
    grow: { hp: 78, atk: 14, def: 5 },
    skills: ['frost_nova', 'water_lance'],
    desc: '寡言的冰系术士，以霜冻封锁敌方全体，并削弱其防御。',
  },
  liatris: {
    id: 'liatris', name: '莉亚特丽丝', title: '红莲狙击手',
    rarity: 4, cls: 'archer', element: 'fire', color: '#ff7a5a',
    base: { hp: 880, atk: 165, def: 62, spd: 114, crit: 0.26 },
    grow: { hp: 82, atk: 16, def: 5 },
    skills: ['blazing_arrow', 'piercing_shot'],
    desc: '百发百中的红莲狙击手，一箭点燃，专破高血量目标。',
  },
  // ---------- 3★ ----------
  loen: {
    id: 'loen', name: '罗恩', title: '黎明骑士',
    rarity: 3, cls: 'warrior', element: 'light', color: '#ffd97a',
    base: { hp: 1050, atk: 128, def: 80, spd: 92, crit: 0.12 },
    grow: { hp: 98, atk: 12, def: 7 },
    skills: ['slash', 'holy_smite'],
    desc: '正直热血的黎明骑士，立志成为照亮黑暗的光。',
  },
};

/**
 * 技能定义
 */
const SKILLS = {
  // ----- 攻击 -----
  slash: {
    name: '斩击', target: 'enemySingle', effect: 'damage',
    power: 1.2, sp: 0, icon: '🗡️',
    desc: '对单个敌人造成 120% 攻击力的伤害。',
  },
  power_strike: {
    name: '强力一击', target: 'enemySingle', effect: 'damage',
    power: 2.0, sp: 2, icon: '💥',
    desc: '蓄力后对单个敌人造成 200% 攻击力的伤害。',
  },
  gale_strike: {
    name: '疾风斩', target: 'enemyRow', effect: 'damage',
    power: 1.4, sp: 3, icon: '🌪️',
    desc: '对敌方一整排造成 140% 攻击力的风属性伤害。',
  },
  fireball: {
    name: '火球术', target: 'enemySingle', effect: 'damage',
    power: 1.8, sp: 0, icon: '☄️',
    desc: '投掷火球对单个敌人造成 180% 攻击力的火焰伤害。',
  },
  inferno: {
    name: '炼狱业火', target: 'enemyAll', effect: 'damage',
    power: 1.6, sp: 4, icon: '🔥',
    desc: '召唤业火对敌方全体造成 160% 攻击力的火焰伤害。',
  },
  water_lance: {
    name: '水矛', target: 'enemySingle', effect: 'damage',
    power: 1.5, sp: 0, icon: '🔱',
    desc: '凝聚水矛刺穿敌人，造成 150% 伤害并降低其 20% 防御。',
    extra: { type: 'debuffDef', power: 0.20, duration: 2 },
  },
  frost_nova: {
    name: '霜冻新星', target: 'enemyAll', effect: 'damage',
    power: 1.3, sp: 4, icon: '❄️',
    desc: '冰霜爆发对敌方全体造成 130% 攻击力的水属性伤害。',
  },
  piercing_shot: {
    name: '穿透射击', target: 'enemySingle', effect: 'damage',
    power: 1.6, sp: 0, icon: '🎯',
    desc: '精准射击单个敌人，造成 160% 攻击力的伤害。',
  },
  shadow_volley: {
    name: '暗影连射', target: 'enemySingle', effect: 'damage',
    power: 3.2, sp: 4, icon: '🌌',
    desc: '倾泻暗影箭雨，对单个敌人造成 320% 攻击力的恐怖伤害。',
  },
  holy_smite: {
    name: '圣光裁决', target: 'enemyRow', effect: 'damage',
    power: 1.5, sp: 3, icon: '⚡',
    desc: '降下圣光，对敌方一排造成 150% 攻击力的光属性伤害。',
  },
  earth_slam: {
    name: '大地践踏', target: 'enemyAll', effect: 'damage',
    power: 1.1, sp: 3, icon: '⛰️',
    desc: '震动大地，对敌方全体造成 110% 攻击力的伤害。',
  },
  rock_guard: {
    name: '磐石守护', target: 'self', effect: 'buffDef',
    power: 0.50, duration: 3, sp: 2, icon: '🪨',
    desc: '提升自身 50% 防御，持续 3 回合。',
  },
  // ----- 治疗 / 辅助 -----
  heal_wave: {
    name: '治愈波动', target: 'allyAll', effect: 'heal',
    power: 1.2, sp: 0, icon: '💚',
    desc: '为全体友方恢复 120% 攻击力的生命值。',
  },
  blessing: {
    name: '祝福', target: 'allyAll', effect: 'buffAtk',
    power: 0.30, duration: 3, sp: 3, icon: '🌟',
    desc: '为全体友方提升 30% 攻击力，持续 3 回合。',
  },
  taunt_shield: {
    name: '守护壁垒', target: 'allyAll', effect: 'shield',
    power: 0.80, sp: 2, icon: '🛡️',
    desc: '为全体友方提供等同于自身 80% 攻击力的护盾，并嘲讽敌人。',
    extra: { type: 'taunt' },
  },
  // ----- 第二部新增技能 -----
  grand_heal: {
    name: '圣光普照', target: 'allyAll', effect: 'heal',
    power: 1.9, sp: 4, icon: '🌈',
    desc: '降下圣光，为全体友方恢复 190% 攻击力的大量生命值。',
  },
  holy_light: {
    name: '愈光术', target: 'allySingle', effect: 'heal',
    power: 2.4, sp: 0, icon: '💗',
    desc: '为单个友方恢复 240% 攻击力的生命值。',
  },
  tempest_blade: {
    name: '苍穹一闪', target: 'enemySingle', effect: 'damage',
    power: 2.8, sp: 4, icon: '🌀',
    desc: '以极致剑速对单个敌人造成 280% 攻击力的风属性爆发伤害。',
  },
  blazing_arrow: {
    name: '红莲烈箭', target: 'enemySingle', effect: 'damage',
    power: 2.3, sp: 3, icon: '🔥',
    desc: '点燃箭矢射穿目标，造成 230% 攻击力的火焰伤害。',
  },
};

/**
 * 敌人定义（怪物可复用角色技能）
 */
const ENEMIES = {
  goblin: {
    id: 'goblin', name: '哥布林', element: 'earth', color: '#7a9b4a',
    base: { hp: 600, atk: 80, def: 40, spd: 90, crit: 0.05 },
    skills: ['slash'],
  },
  goblin_archer: {
    id: 'goblin_archer', name: '哥布林弓手', element: 'earth', color: '#9bab5a',
    base: { hp: 480, atk: 95, def: 30, spd: 105, crit: 0.10 },
    skills: ['piercing_shot'],
  },
  wolf: {
    id: 'wolf', name: '暗影狼', element: 'dark', color: '#5a5a7a',
    base: { hp: 700, atk: 110, def: 45, spd: 130, crit: 0.15 },
    skills: ['slash', 'power_strike'],
  },
  ogre: {
    id: 'ogre', name: '食人魔', element: 'fire', color: '#b85a3a',
    base: { hp: 1800, atk: 130, def: 80, spd: 60, crit: 0.08 },
    skills: ['power_strike', 'earth_slam'],
  },
  dark_mage: {
    id: 'dark_mage', name: '黑暗法师', element: 'dark', color: '#6a3a8a',
    base: { hp: 900, atk: 150, def: 50, spd: 95, crit: 0.12 },
    skills: ['fireball', 'frost_nova'],
  },
  // Boss
  demon_lord: {
    id: 'demon_lord', name: '魔王 · 巴尔', element: 'dark', color: '#8a1a3a',
    base: { hp: 6000, atk: 200, def: 110, spd: 100, crit: 0.20 },
    skills: ['shadow_volley', 'inferno', 'power_strike'],
    isBoss: true,
  },
  troll_king: {
    id: 'troll_king', name: '巨魔王', element: 'earth', color: '#4a7a3a',
    base: { hp: 4200, atk: 160, def: 130, spd: 70, crit: 0.10 },
    skills: ['earth_slam', 'power_strike'],
    isBoss: true,
  },
  // ---------- 第二部新增敌人 ----------
  revenant: {
    id: 'revenant', name: '亡魂骑士', element: 'dark', color: '#6a6a8a',
    base: { hp: 1300, atk: 160, def: 90, spd: 100, crit: 0.12 },
    skills: ['slash', 'power_strike'],
  },
  dark_knight: {
    id: 'dark_knight', name: '黑暗骑士', element: 'dark', color: '#4a3a6a',
    base: { hp: 2200, atk: 175, def: 120, spd: 88, crit: 0.14 },
    skills: ['power_strike', 'holy_smite'],
  },
  shadow_empress: {
    id: 'shadow_empress', name: '暗影女皇 · 涅夫提斯', element: 'dark', color: '#7a2a6a',
    base: { hp: 6800, atk: 235, def: 115, spd: 110, crit: 0.22 },
    skills: ['shadow_volley', 'frost_nova', 'inferno'],
    isBoss: true,
  },
};

/**
 * 关卡定义
 * waves: 敌人波次，每个敌人含 {id, level, pos}（pos: front/back）
 */
const STAGES = [
  {
    id: 1, name: '艾尔玛森林 · 入口', recommend: 1,
    desc: '初出茅庐的冒险，森林边缘的哥布林正在游荡。',
    enemies: [
      { id: 'goblin', level: 2, pos: 'front' },
      { id: 'goblin', level: 2, pos: 'front' },
      { id: 'goblin_archer', level: 2, pos: 'back' },
    ],
    reward: { gold: 200, exp: 80, gem: 30 },
  },
  {
    id: 2, name: '艾尔玛森林 · 深处', recommend: 4,
    desc: '森林深处潜伏着饥饿的暗影狼群。',
    enemies: [
      { id: 'wolf', level: 4, pos: 'front' },
      { id: 'goblin', level: 4, pos: 'front' },
      { id: 'goblin_archer', level: 5, pos: 'back' },
      { id: 'goblin_archer', level: 5, pos: 'back' },
    ],
    reward: { gold: 350, exp: 140, gem: 30 },
  },
  {
    id: 3, name: '废弃矿洞', recommend: 7,
    desc: '矿洞中传来沉重的脚步声，似乎有强敌出没。',
    enemies: [
      { id: 'ogre', level: 7, pos: 'front' },
      { id: 'wolf', level: 7, pos: 'front' },
      { id: 'dark_mage', level: 7, pos: 'back' },
    ],
    reward: { gold: 500, exp: 220, gem: 40 },
  },
  {
    id: 4, name: '诅咒山脊 · BOSS', recommend: 10,
    desc: '盘踞山脊的巨魔王，是冒险者难以逾越的高墙。',
    enemies: [
      { id: 'troll_king', level: 10, pos: 'front' },
      { id: 'wolf', level: 9, pos: 'front' },
      { id: 'dark_mage', level: 9, pos: 'back' },
      { id: 'dark_mage', level: 9, pos: 'back' },
    ],
    reward: { gold: 800, exp: 400, gem: 60 },
    isBoss: true,
  },
  {
    id: 5, name: '魔王城 · 王座', recommend: 14,
    desc: '一切罪恶的源头。魔王巴尔在王座上等待着挑战者。',
    enemies: [
      { id: 'demon_lord', level: 14, pos: 'back' },
      { id: 'ogre', level: 13, pos: 'front' },
      { id: 'ogre', level: 13, pos: 'front' },
      { id: 'dark_mage', level: 13, pos: 'back' },
    ],
    reward: { gold: 1500, exp: 800, gem: 100 },
    isBoss: true,
    endStory: 'epilogue',
  },
  // ========== 第二部 · 永夜降临 ==========
  {
    id: 6, name: '破碎边境', recommend: 17,
    desc: '魔王虽除，黑暗却未散去。边境的亡魂在永夜中徘徊不去。',
    enemies: [
      { id: 'dark_knight', level: 17, pos: 'front' },
      { id: 'revenant', level: 17, pos: 'front' },
      { id: 'revenant', level: 17, pos: 'back' },
      { id: 'dark_mage', level: 16, pos: 'back' },
    ],
    reward: { gold: 1800, exp: 1000, gem: 60 },
  },
  {
    id: 7, name: '永夜回廊 · 女皇', recommend: 21,
    desc: '操纵永夜的暗影女皇涅夫提斯，才是这一切黑暗真正的源头。',
    enemies: [
      { id: 'shadow_empress', level: 21, pos: 'back' },
      { id: 'dark_knight', level: 20, pos: 'front' },
      { id: 'dark_knight', level: 20, pos: 'front' },
      { id: 'revenant', level: 20, pos: 'back' },
    ],
    reward: { gold: 3000, exp: 1600, gem: 120 },
    isBoss: true,
    endStory: 'epilogue2',
  },
];

/**
 * 抽卡池：概率与对应角色
 */
const GACHA = {
  cost: 100,          // 每次抽卡消耗宝石
  rates: { 5: 0.03, 4: 0.12, 3: 0.85 },
  pool: {
    5: ['lecliss', 'justia', 'seir', 'refithea', 'rigenette', 'olstein'],
    4: ['rou', 'helena', 'diana', 'garcia', 'glacia', 'liatris'],
    3: ['teried', 'lia', 'mina', 'loen'],
  },
};

// 暴露到全局
window.GameData = { CLASSES, ELEMENTS, CHARACTERS, SKILLS, ENEMIES, STAGES, GACHA };
