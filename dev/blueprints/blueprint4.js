// 烛河村施工图 v4：与 town4_def.js 坐标一一对应（此图=给投资人确认的平面图）
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/home/user/Maodou/assets/fonts/zpix.ttf', 'Zpix');
const CW = 44, CH = 26, U = 26;
const cv = createCanvas(CW * U + 40, CH * U + 150);
const ctx = cv.getContext('2d');
ctx.fillStyle = '#1c1f22'; ctx.fillRect(0, 0, cv.width, cv.height);
const OX = 20, OY = 86;
const cell = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(OX + x * U, OY + y * U, w * U, h * U); };
const box = (x, y, w, h, c) => { ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.strokeRect(OX + x * U, OY + y * U, w * U, h * U); };
const label = (x, y, t, c = '#fff', s = 14) => { ctx.fillStyle = c; ctx.font = `bold ${s}px Zpix`; ctx.fillText(t, OX + x * U, OY + y * U); };
const spot = (x, y, c, r = 8) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(OX + x * U, OY + y * U, r, 0, 7); ctx.fill(); };
const door = (x, y) => { ctx.fillStyle = '#ffd97a'; ctx.beginPath(); ctx.moveTo(OX+x*U-6,OY+y*U); ctx.lineTo(OX+x*U+6,OY+y*U); ctx.lineTo(OX+x*U,OY+y*U+9); ctx.closePath(); ctx.fill(); };

// 底
cell(0, 0, CW, CH, '#3d5a3a');
cell(0, 0, CW, 2.2, '#22371f'); cell(0, 23.2, CW, 2.8, '#22371f');
cell(0, 2.2, 1.8, 21, '#22371f'); cell(42.2, 2.2, 1.8, 21, '#22371f');
// 路网(与 roadGrid 一致)
cell(3, 8, 38, 1, '#5a4a3c');                    // 北后巷 r8
cell(6, 9, 2, 5, '#5a4a3c');                     // 西巷
cell(17, 9, 11, 5, '#6b6255');                   // 广场(压主路北)
cell(37, 9, 2, 5, '#5a4a3c');                    // 磨坊支路
cell(0, 14, 42, 2, '#5a4a3c');                   // 主路 r14-15
cell(14, 16, 2, 6, '#5a4a3c');                   // 南巷
// 北排地块(脚线全部 y8.4-8.8, 门朝南)
box(4, 3, 6, 5.5, '#d8d8e0'); spot(7, 6, '#d8d8e0', 12); door(7, 8.4); label(4.3, 2.6, '石屋院', '#d8d8e0');
box(11, 4, 6, 4.2, '#b9a0d0'); spot(13.8, 6.2, '#b9a0d0', 9); label(11.3, 3.6, '坟场(枯树×2+围栏)', '#b9a0d0', 12);
box(18.5, 2, 7, 6.6, '#e8d8b0'); spot(22, 5.4, '#e8d8b0', 14); door(22, 8.6); label(18.8, 1.6, '村长家(正对广场轴)', '#e8d8b0');
box(27.5, 4, 6, 4.4, '#d8c8a0'); spot(30.5, 6.2, '#d8c8a0', 11); door(30.5, 8.4); label(27.8, 3.6, '木屋B', '#d8c8a0');
box(34.8, 1, 6.6, 7.8, '#c8c8d8'); spot(37.8, 4.6, '#c8c8d8', 13); door(37.8, 8.8); label(35, 0.7, '磨坊+披屋', '#c8c8d8');
// 广场家具
spot(24.5, 11.6, '#7ac0d8', 9);  label(23.2, 13.4, '井', '#7ac0d8', 13);
spot(18, 9.7, '#ffb060', 6); spot(26.5, 9.7, '#ffb060', 6); label(16.6, 9.4, '灯', '#ffb060', 11); label(27.1, 9.4, '灯', '#ffb060', 11);
spot(27.6, 12.4, '#c8a060', 6); label(28.1, 12.8, '箱桶', '#c8a060', 11);
// 主路北缘栅栏对
label(9.6, 13.6, '栅栏┃┃', '#a89070', 11); label(30, 13.6, '栅栏┃┃', '#a89070', 11);
// 南片
box(16, 17, 10.6, 5.8, '#e0a860'); label(16.3, 16.6, '农家院坝(北缘围栏·西口进)', '#e0a860', 12);
spot(18.7, 20.2, '#d8c8a0', 11); door(18.7, 21.2); label(17.2, 22.6, '贫户屋', '#d8c8a0', 12);
spot(24.2, 19.8, '#e0b880', 10); label(23, 22.6, '鸡圈+跑场', '#e0b880', 12);
box(3.6, 17, 6, 5.4, '#a8c088'); label(3.9, 16.6, '牧栏(围栏上下排+干草车)', '#a8c088', 12);
spot(6.5, 19.6, '#d0b060', 8);
// 动线
ctx.strokeStyle = '#ff8866'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]);
ctx.beginPath();
ctx.moveTo(OX + 1 * U, OY + 15 * U);
ctx.lineTo(OX + 20 * U, OY + 15 * U);
ctx.lineTo(OX + 22 * U, OY + 12 * U);
ctx.lineTo(OX + 22 * U, OY + 9.2 * U);
ctx.stroke(); ctx.setLineDash([]);
label(2, 15.8, '进村动线→广场→村长家', '#ff8866', 12);
// 标题
ctx.font = 'bold 20px Zpix'; ctx.fillStyle = '#ffd97a';
ctx.fillText('烛河村 施工图 v4 —— 北排四栋一条脚线 · 门全朝南(▼) · 广场居中对轴 · 南片农家院坝', OX, 30);
ctx.font = '13px Zpix'; ctx.fillStyle = '#a8b0a8';
ctx.fillText('▼=门位与朝向 · 圆点=建筑/家具落点 · 虚线=玩家动线 · 坐标与效果图/引擎共用同一份 town4_def.js', OX, 54);
ctx.fillText('北排脚线 y8.4-8.8 齐 | 主路宽2直贯 | 后巷宽1 | 广场11×5 | 南巷通农家院 | 树线四缘收边', OX, 74);
fs.writeFileSync('/home/user/Maodou/dev/blueprints/blueprint4.png', cv.toBuffer('image/png'));
console.log('blueprint4.png done');
