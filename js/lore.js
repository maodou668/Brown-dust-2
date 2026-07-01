// ============================================================
//  角色背景故事 / 台词（扩充「人物」深度）
//  在 data.js 之后加载，将 lore / quotes 挂到角色图鉴上
//  side 字段指向该角色的支线剧情 id（见 story.js 的 STORY）
//
//  ⚠️ 内容已清空 —— 等待新的人物设定重写后填入。
//  格式（喂料时照这个给我）：
//    lecliss: {
//      lore:  '一段人物背景介绍……',
//      quotes: ['台词1', '台词2', '台词3'],
//      side:  'side_lecliss',   // 该角色羁绊小故事的 id，对应 STORY 里的一段
//    },
//  角色代号见 story/剧本喂料模板.md 的技术清单。
// ============================================================

const CHAR_LORE = {};

// 挂载到角色图鉴（CHAR_LORE 为空时不做任何改动，游戏照常运行）
if (window.GameData && window.GameData.CHARACTERS) {
  Object.keys(CHAR_LORE).forEach(id => {
    if (window.GameData.CHARACTERS[id]) {
      Object.assign(window.GameData.CHARACTERS[id], CHAR_LORE[id]);
    }
  });
}
