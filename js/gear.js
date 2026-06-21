// ============================================================
//  装备系统数据（通用装备 + 专属武器 EX gear）
//  在 data.js 之后加载，挂到 window.GameData.GEAR
//  装备属性会在 game.js 的 computeStats 里实际计入战斗
// ============================================================

// 稀有度用 3/4/5 对应 R/SR/UR，复用既有 .r3/.r4/.r5 样式
const GEAR_RLABEL = { 3: 'R', 4: 'SR', 5: 'UR' };

// ---------- 通用装备模板 ----------
// type: weapon(武器·攻) / armor(防具·防+血) / accessory(饰品·血+暴击)
const GEAR_COMMON = {
  // 武器
  wpn_r:  { id: 'wpn_r',  type: 'weapon',    rarity: 3, name: '铁剑',     icon: '⚔️', stats: { atk: 30 } },
  wpn_sr: { id: 'wpn_sr', type: 'weapon',    rarity: 4, name: '精钢战刃', icon: '⚔️', stats: { atk: 72 } },
  wpn_ur: { id: 'wpn_ur', type: 'weapon',    rarity: 5, name: '秘银圣剑', icon: '⚔️', stats: { atk: 135, crit: 0.04 } },
  // 防具
  arm_r:  { id: 'arm_r',  type: 'armor',     rarity: 3, name: '皮甲',     icon: '🛡️', stats: { def: 18, hp: 160 } },
  arm_sr: { id: 'arm_sr', type: 'armor',     rarity: 4, name: '锁子甲',   icon: '🛡️', stats: { def: 42, hp: 380 } },
  arm_ur: { id: 'arm_ur', type: 'armor',     rarity: 5, name: '龙鳞铠',   icon: '🛡️', stats: { def: 80, hp: 720 } },
  // 饰品
  acc_r:  { id: 'acc_r',  type: 'accessory', rarity: 3, name: '护符',     icon: '💍', stats: { hp: 120, crit: 0.03 } },
  acc_sr: { id: 'acc_sr', type: 'accessory', rarity: 4, name: '魔力指环', icon: '💍', stats: { hp: 280, crit: 0.06 } },
  acc_ur: { id: 'acc_ur', type: 'accessory', rarity: 5, name: '贤者之冠', icon: '💍', stats: { hp: 520, crit: 0.10 } },
};

// 锻造概率（通用装备）
const GEAR_CRAFT = {
  goldCost: 300,
  // 随机部位 + 稀有度
  rarityWeight: { 3: 0.60, 4: 0.32, 5: 0.08 },
  types: ['weapon', 'armor', 'accessory'],
};

// ---------- 专属武器（每角色一件，UR 级，按职业定制） ----------
function exStatsByClass(cls) {
  switch (cls) {
    case 'warrior':  return { atk: 160, hp: 320, crit: 0.06 };
    case 'archer':   return { atk: 175, crit: 0.14 };
    case 'mage':     return { atk: 170, hp: 160 };
    case 'defender': return { def: 95, hp: 950 };
    case 'healer':   return { atk: 125, hp: 520 };
    default:         return { atk: 100, hp: 200 };
  }
}
const EX_NAME = {
  warrior: '专属战刃', archer: '专属弓', mage: '专属法器', defender: '专属巨盾', healer: '专属圣器',
};

const GEAR_EX = {};
if (window.GameData && window.GameData.CHARACTERS) {
  Object.values(window.GameData.CHARACTERS).forEach(c => {
    GEAR_EX['ex_' + c.id] = {
      id: 'ex_' + c.id,
      type: 'ex',
      rarity: 5,
      owner: c.id,
      name: `${c.name}·${EX_NAME[c.cls] || '专属武器'}`,
      icon: '🗡️',
      stats: exStatsByClass(c.cls),
      gemCost: 150,
      desc: `${c.name} 的专属武器，仅 ${c.name} 可装备，提供强力专属属性。`,
    };
  });
}

window.GameData.GEAR = { common: GEAR_COMMON, ex: GEAR_EX, RLABEL: GEAR_RLABEL, CRAFT: GEAR_CRAFT };
