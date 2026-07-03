// 村庄蓝图 v3 整齐版：统一地块制（回应"太乱"）
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/home/user/Maodou/assets/fonts/zpix.ttf', 'Zpix');
const CW = 44, CH = 26, U = 26;
const cv = createCanvas(CW * U + 40, CH * U + 130);
const ctx = cv.getContext('2d');
ctx.fillStyle = '#1c1f22'; ctx.fillRect(0, 0, cv.width, cv.height);
const OX = 20, OY = 66;
const cell = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(OX + x * U, OY + y * U, w * U, h * U); };
const box = (x, y, w, h, c) => { ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.strokeRect(OX + x * U, OY + y * U, w * U, h * U); };
const label = (x, y, t, c = '#fff', s = 14) => { ctx.fillStyle = c; ctx.font = `bold ${s}px Zpix`; ctx.fillText(t, OX + x * U, OY + y * U); };
const spot = (x, y, c, r = 9) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(OX + x * U, OY + y * U, r, 0, 7); ctx.fill(); };
const gate = (x, y) => { ctx.fillStyle = '#ffd97a'; ctx.fillRect(OX + x * U - 4, OY + y * U - 4, 8, 8); };

// ---- 底与收边 ----
cell(0, 0, CW, CH, '#3d5a3a');                    // 草地
cell(0, 0, CW, 1.5, '#22371f'); cell(0, 24.5, CW, 1.5, '#22371f'); // 北/南树林收边
cell(0, 1.5, 1.5, 23, '#22371f');                  // 西树林
cell(41, 0, 3, 26, '#2c4a5e');                     // 溪（东缘）

// ---- 路网（横平竖直，全部对齐）----
cell(0, 14, 41, 2, '#5a4a3c');                     // 主路 rows14-15 直线贯穿
cell(3, 8, 35, 1, '#5a4a3c');                      // 北后巷 row8（宅基地门前巷）
cell(8, 9, 1, 5, '#5a4a3c');                       // 连接巷1（西）
cell(33, 9, 1, 5, '#5a4a3c');                      // 连接巷2（东）
cell(38.5, 9, 1, 5, '#5a4a3c');                    // 磨坊支路
cell(41, 13.7, 3, 1.6, '#7a5a38');                 // 木桥（主路对直出东）

// ---- 广场（正中，压主路北侧）----
cell(17, 9, 10, 5, '#6b6b70');                     // 石板 10×5
spot(22, 11.6, '#7ac0d8', 9);                      // 井（广场几何中心）
spot(18.2, 9.8, '#e0c060', 6);                     // 公告板（西北角）
spot(25.8, 9.8, '#ffb060', 6);                     // 烛龛①（东北角）

// ---- 北排宅基地（统一 rows 2-8，门全部朝南开向后巷）----
box(3, 2, 8, 6, '#8fce7a');   spot(7, 5, '#d8d8e0', 12);  gate(7, 8);    // N1 石屋院
box(12, 2, 4, 6, '#b9a0d0');  spot(14, 4.5, '#b9a0d0', 6); spot(15, 5.5, '#b9a0d0', 5); // 坟场（树篱围）
box(17, 2, 10, 6, '#8fce7a'); spot(22, 4.8, '#e8d8b0', 13); gate(22, 8);  // 村长家（正对广场轴线）
spot(25.5, 3, '#e08080', 7);                                              // 果树（村长院内）
box(29, 2, 6, 6, '#8fce7a');  spot(32, 5, '#d8c8a0', 11);  gate(32, 8);  // N2 民房
// 磨坊（溪边独立地块）
box(36, 1, 4.5, 7, '#c8c8d8'); spot(38.2, 4, '#c8c8d8', 15); gate(38.5, 8);
spot(36.8, 12, '#d0b060', 8);                                             // 干草车（磨坊支路口）

// ---- 南排宅基地（统一 rows 17-23，门全部朝北开向主路）----
box(3, 17, 9, 6, '#c8b06a');                                              // 农田（围栏）
cell(4, 18, 7, 1.2, '#4d4030'); cell(4, 20, 7, 1.2, '#4d4030'); cell(4, 22, 7, 1.2, '#4d4030'); // 三畦
box(14, 17, 7, 6, '#8fce7a'); spot(17.5, 20.5, '#d8c8a0', 11); gate(17.5, 17); // S1 农户院
box(21.5, 17, 2.5, 2.5, '#e0a860'); label(21.6, 21, '鸡圈', '#e0a860', 12);    // 鸡圈（贴农户院东墙）
box(25, 17, 7, 6, '#8fce7a'); spot(28.5, 20.5, '#d8c8a0', 11); gate(28.5, 17); // S2 民房
box(33, 17, 7, 6, '#8fce7a'); spot(36.5, 20.5, '#d8d8e0', 11); gate(36.5, 17); // S3 民房
spot(2.5, 13.2, '#ffb060', 6);                                             // 烛龛②（村口）

// ---- 标注 ----
ctx.font = 'bold 20px Zpix'; ctx.fillStyle = '#ffd97a';
ctx.fillText('村庄蓝图 v3 整齐版 —— 统一地块制：两排宅基地夹一条直主路', OX, 30);
ctx.font = '14px Zpix'; ctx.fillStyle = '#a8b0a8';
ctx.fillText('北排地块统一高6格、门朝南开向后巷；南排统一高6格、门朝北开向主路；间距统一2格 · 黄方块=院门', OX, 52);
label(4.2, 1.2, '北排：石屋 | 坟场 | 村长家(正对广场) | 民房 | 磨坊(溪边)', '#9fd08a', 14);
label(13, 4.2, '坟场', '#d8c0ee', 13);
label(18, 3.2, '村长家', '#e8d8b0', 14);
label(36.2, 0.9, '磨坊', '#e0e0f0', 14);
label(4.2, 4.5, '石屋', '#e8e8f0', 13);
label(29.5, 4.2, '民房N2', '#d8c8a0', 13);
label(4, 9.8, '← 北后巷（宅基地门前，宽1）', '#d8b890', 13);
label(18.5, 12.4, '广场10×5+井', '#bfe0ee', 14);
label(1, 16.8, '主路（宽2·笔直贯穿·东出桥）', '#d8b890', 13);
label(4.5, 16.6, '', '#fff');
label(41.3, 13, '桥', '#e8c890', 14);
label(41.6, 2, '溪', '#7ac0d8', 15);
label(4.5, 19.6, '农田三畦', '#d8c890', 13);
label(14.5, 19.8, '农户S1', '#d8c8a0', 13);
label(25.5, 19.8, '民房S2', '#d8c8a0', 13);
label(33.5, 19.8, '民房S3', '#d8d8e0', 13);
label(35.2, 11.2, '干草车', '#d0b060', 12);
label(2.2, 12.6, '烛龛', '#ffb060', 11);
// 动线
ctx.strokeStyle = '#ff8866'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
ctx.beginPath();
ctx.moveTo(OX + 0.5 * U, OY + 15 * U);
ctx.lineTo(OX + 17 * U, OY + 15 * U);
ctx.lineTo(OX + 22 * U, OY + 12.5 * U);   // 进广场问话
ctx.lineTo(OX + 30 * U, OY + 15 * U);
ctx.lineTo(OX + 38.5 * U, OY + 14.5 * U);
ctx.lineTo(OX + 38.5 * U, OY + 8 * U);    // 拐上磨坊支路
ctx.stroke(); ctx.setLineDash([]);
label(24, 24.3, '—— 剧情动线：西口→广场问话→主路东行→磨坊支路（案发地）', '#ff8866', 14);
fs.writeFileSync(__dirname + '/blueprint3.png', cv.toBuffer('image/png'));
console.log('blueprint3 ok');
