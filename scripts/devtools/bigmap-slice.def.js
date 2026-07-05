// ============================================================
//  bigmap-slice.def.js —— 灰底物件表切件定义（sheetA/sheetB → 物件库）
//  box: [x,y,w,h] 原图裁窗(宽松); split: 窗内连通域拆散件(墓碑/灯具);
//  decal: 贴地面片(不生成碰撞脚印, 引擎平铺层); skipFoot: 无碰撞(桥栏类)
// ============================================================
module.exports = {
  sheetA: [
    { name: 'hay2',        box: [40, 20, 430, 420] },
    { name: 'fence_a',     box: [540, 20, 360, 400] },      // 尖桩围栏·折角
    { name: 'fence_b',     box: [900, 40, 320, 320] },      // 尖桩围栏·直段
    { name: 'wall_corner', box: [20, 470, 780, 420] },      // 石墙·转角
    { name: 'plaza_big',   box: [810, 310, 950, 700], decal: true, largest: true },
    { name: 'plaza_small', box: [280, 520, 800, 730], decal: true, largest: true },
    { name: 'field_big',   box: [1140, 770, 1250, 680], decal: true, largest: true },
    { name: 'wall_arch',   box: [10, 990, 590, 560], largest: true },      // 石墙·带拱门
  ],
  sheetB: [
    { name: 'manor',      box: [95, 30, 545, 400] },
    { name: 'windmill',   box: [800, 20, 340, 420] },
    { name: 'maingate',   box: [1250, 40, 630, 440] },
    { name: 'graveyard',  box: [1990, 95, 600, 380] },
    { name: 'house_a',    box: [45, 545, 270, 280] },
    { name: 'house_cl',   box: [350, 565, 290, 310] },
    { name: 'house_b',    box: [630, 425, 250, 275] },
    { name: 'house_c',    box: [870, 510, 240, 265] },
    { name: 'well',       box: [1250, 655, 170, 195], largest: true },
    { name: 'farmstead',  box: [1435, 480, 400, 355] },
    { name: 'shrine',     box: [1865, 530, 160, 305] },
    { name: 'pal_a',      box: [2055, 460, 185, 190] },     // 栅墙短直段
    { name: 'pal_b',      box: [2225, 470, 290, 240] },     // 栅墙长斜段
    { name: 'watchtower', box: [2530, 480, 165, 395] },
    { name: 'bridge',     box: [2020, 750, 255, 150], skipFoot: true },
    { name: 'bridge2',    box: [1780, 855, 215, 150], skipFoot: true },
    { name: 'pal_c',      box: [2280, 800, 225, 225] },     // 栅墙转角束
    { name: 'house_d',    box: [1470, 840, 245, 215] },
    { name: 'house_e',    box: [1030, 830, 245, 245] },
    { name: 'barnhouse',  box: [635, 740, 285, 200] },
    { name: 'dtree',      box: [40, 950, 730, 600], split: true, minArea: 1400 },   // 枯树群拆棵
    { name: 'gtree2',     box: [755, 1125, 230, 420] },
    { name: 'graves',     box: [1030, 1125, 320, 420], split: true, minArea: 320 },  // 墓碑拆件
    { name: 'lamp',       box: [1340, 1120, 405, 425], split: true, minArea: 320 },  // 灯具拆件
    { name: 'tile_dirt',  box: [1735, 1090, 260, 165], decal: true, largest: true },
    { name: 'tile_cob',   box: [1995, 1090, 260, 165], decal: true, largest: true },
    { name: 'tile_field', box: [2255, 1090, 250, 165], decal: true, largest: true },
    { name: 'tile_stream',box: [2505, 1060, 230, 205], decal: true, largest: true },
    { name: 'cart_a',     box: [1780, 1340, 225, 165] },
    { name: 'cart_b',     box: [1995, 1340, 210, 155] },
    { name: 'logs_a',     box: [2205, 1360, 165, 135] },
    { name: 'logs_b',     box: [2360, 1350, 145, 140] },
    { name: 'barn',       box: [2530, 1270, 210, 255], largest: true },
  ],
};
