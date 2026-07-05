// ============================================================
//  bigmap-assemble.def.js —— 新烛河村拼装布局（地台 ground.png 2744×1568 坐标）
//  objects: {img, ax, ay, foot?}  锚点=脚底中心; foot 覆盖自动脚印(如墓园整体禁入)
//  decals:  {img, ax, ay}         贴地面片, 锚点=中心, 无碰撞
//  mirror:  img 加后缀 _m 表示水平镜像(拼装器自动烘焙)
// ============================================================
module.exports = {
  decals: [
    { img: 'plaza_big', ax: 1150, ay: 640 },     // 中央广场铺石
    { img: 'field_big', ax: 1520, ay: 1290 },    // 东南菜园
  ],
  objects: [
    // —— 地标 ——
    { img: 'graveyard', ax: 470, ay: 638, foot: [[[-290, -368], [290, -368], [290, -8], [-290, -8]]] },  // 墓园整组(v1 禁入)
    { img: 'manor',     ax: 1240, ay: 495 },
    { img: 'well',      ax: 1155, ay: 668 },
    { img: 'windmill',  ax: 2330, ay: 500 },
    { img: 'maingate',  ax: 585, ay: 1180 },     // 门洞在其塔楼下方
    { img: 'shrine',    ax: 250, ay: 1310 },
    { img: 'watchtower', ax: 1540, ay: 1498 },
    { img: 'bridge',    ax: 1790, ay: 938 },
    // —— 民房环广场 ——
    { img: 'house_b',  ax: 870,  ay: 600 },
    { img: 'house_a',  ax: 640,  ay: 770 },
    { img: 'house_cl', ax: 810,  ay: 950 },
    { img: 'house_c',  ax: 1440, ay: 560 },
    { img: 'house_d',  ax: 1500, ay: 820 },
    { img: 'house_e',  ax: 1230, ay: 950 },
    { img: 'barnhouse', ax: 940, ay: 1120 },
    // —— 鸡圈农家角(南) ——
    { img: 'barn',  ax: 855, ay: 1185 },
    { img: 'hay2',  ax: 1015, ay: 1185, s: 0.62 },
    // —— 栅墙链(西臂镜像 + 东南臂) ——
    { img: 'pal_b_m', ax: 245, ay: 905 },
    { img: 'pal_a_m', ax: 135, ay: 715 },
    { img: 'pal_b', ax: 1110, ay: 1395 },
    { img: 'pal_b', ax: 1430, ay: 1510 },
    // —— 树/杂件 ——
    { img: 'dtree_0', ax: 350, ay: 1455 },
    { img: 'dtree_2', ax: 130, ay: 870 },
    { img: 'dtree_3', ax: 1660, ay: 360 },
    { img: 'dtree_4', ax: 2480, ay: 890 },
    { img: 'dtree_1', ax: 2120, ay: 1190 },
    { img: 'dtree_3', ax: 2620, ay: 1370 },
    { img: 'dtree_1', ax: 940, ay: 330 },
    { img: 'cart_a', ax: 1450, ay: 890 },
    { img: 'cart_b', ax: 705, ay: 905 },
    { img: 'logs_a', ax: 1010, ay: 1085 },
    { img: 'logs_b', ax: 1355, ay: 610 },
    // —— 灯具(带光晕锚) ——
    { img: 'lamp_4', ax: 1045, ay: 585, glow: [0, -120, 60] },
    { img: 'lamp_2', ax: 1290, ay: 748, glow: [0, -115, 55] },
    { img: 'lamp_1', ax: 665, ay: 1012, glow: [0, -110, 55] },
    { img: 'lamp_3', ax: 1215, ay: 508, glow: [0, -125, 58] },
    { img: 'lamp_0', ax: 305, ay: 1245, glow: [0, -120, 55] },
  ],
  // 烟囱烟(只挂有烟囱的住宅——用户定规): [参照物件序号无关, 直接绝对坐标]
  smoke: [
    [1128, 152], [1338, 150],    // 领主宅双烟囱
    [925, 352],                  // house_b
    [878, 705],                  // house_cl
    [1262, 720],                 // house_e
    [1622, 600],                 // house_d
  ],
  // 额外光晕(门窗/烛火)
  glows: [
    [1240, 400, 62], [1150, 430, 44], [1330, 430, 44],   // 领主宅门窗
    [250, 1215, 42, 'rgba(255,190,110,.5)'],             // 烛龛烛火
    [2330, 415, 55],                                     // 磨坊门
    [880, 500, 40], [640, 705, 40], [810, 880, 40], [1500, 500, 40], [1580, 745, 40], [1230, 885, 40],  // 民房门窗
  ],
  critters: [
    { sprites: ['hen_brown_a', 'hen_brown_b', 'hen_white_a', 'hen_white_b', 'hen_brown_a'],
      n: 5, scale: 0.62,
      area: [[890, 1095], [1090, 1105], [1150, 1195], [1000, 1255], [880, 1220]] },
  ],
};
