// 烛河村施工图 v6(等距·设定书全量): 与 town_v6_def.js 一一对应
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/home/user/Maodou/assets/fonts/zpix.ttf', 'Zpix');
const W = 1620, H = 940, OX = 700, OY = 130, UX = 13, UY = 6.5;
const cv = createCanvas(W, H); const ctx = cv.getContext('2d');
ctx.fillStyle = '#1c1f22'; ctx.fillRect(0, 0, W, H);
const pt = (x, y) => [OX + (x - y) * UX, OY + (x + y) * UY];
const zone = (x0, y0, x1, y1, fill, stroke) => {
  const c = [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
  ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke(); }
};
const label = (x, y, t, c = '#fff', s = 14) => { const [px, py] = pt(x, y); ctx.fillStyle = c; ctx.font = `bold ${s}px Zpix`; ctx.fillText(t, px, py); };
const spot = (x, y, c, r = 7) => { const [px, py] = pt(x, y); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); };
// 地
zone(0, 0, 51, 26, '#2d3f2b', '#1e3120');
// 溪 + 桥
zone(38, 0, 41, 26, '#22424a', '#2f5a64'); label(38.6, 1.6, '溪(黑水)', '#5a9aa8', 13);
zone(37.4, 14, 41.6, 16.6, '#7a5a38'); label(35, 18.2, '磨坊桥', '#c89a68', 13);
// 路网(湿泥)
zone(3, 8, 36, 10, '#4a4038'); zone(9, 10, 11, 14, '#4a4038'); zone(33, 10, 35, 14, '#4a4038');
zone(0, 14, 38, 17, '#4a4038'); zone(41, 14, 46, 17, '#4a4038');
zone(44, 9, 46, 15, '#4a4038'); zone(44, 8, 50, 10, '#4a4038');
zone(14, 17, 16, 23, '#4a4038'); zone(21, 17, 24, 23, '#5a4c3e');
// 广场(苔石板)
zone(17, 10, 28, 15, '#4e555a'); zone(24, 7, 27, 10, '#4e555a');
spot(22.5, 12, '#7ac0d8', 8); label(20.8, 14.2, '井(新·苔石)', '#7ac0d8', 12);
spot(18, 10.4, '#ffb060', 5); spot(27, 10.4, '#ffb060', 5);
// 北排
zone(4, 3.5, 10, 8.4, null, '#d8d8e0'); spot(7, 6, '#d8d8e0', 10); label(1.5, 3, '石屋', '#d8d8e0', 13);
zone(11, 3.5, 16.5, 8, null, '#b9a0d0'); spot(13.8, 5.8, '#b9a0d0', 7); label(9.5, 1.6, '坟场(新土伏笔)', '#b9a0d0', 12);
zone(18.5, 2.5, 25.5, 8.6, null, '#e8d8b0'); spot(22, 5.5, '#e8d8b0', 12); label(19, 1, '村长家(对广场轴)', '#e8d8b0', 13);
zone(26.6, 4, 32.4, 8.4, null, '#d8c8a0'); spot(29.5, 6.2, '#d8c8a0', 9); label(27.5, 2.8, '木屋B', '#d8c8a0', 12);
zone(32.6, 4.5, 37.6, 8.4, null, '#c8b890'); spot(35, 6.4, '#c8b890', 9); label(34.2, 3, '民房D(新)', '#c8b890', 12);
// 南片
zone(8.4, 17, 13.6, 21.2, null, '#c8b890'); spot(11, 19.4, '#c8b890', 9); label(4.5, 22.8, '民房F(新·门朝南巷)', '#c8b890', 12);
zone(16, 17.2, 21.4, 21.2, null, '#d8c8a0'); spot(18.7, 19.4, '#d8c8a0', 9); label(15.5, 23.6, '贫户屋', '#d8c8a0', 12);
zone(23.1, 17.5, 28.5, 21, null, '#e0b880'); spot(25.8, 19.2, '#e0b880', 8); label(22.5, 22.8, '鸡圈', '#e0b880', 12);
zone(28.9, 17.2, 34.7, 21.2, null, '#c8b890'); spot(31.8, 19.4, '#c8b890', 9); label(30, 23.4, '民房E(新·二层)', '#c8b890', 12);
// 牧栏+农田
zone(3.6, 17.2, 9.6, 22.4, null, '#a8c088'); spot(6.5, 19.6, '#d0b060', 7); label(0.2, 19.4, '牧栏+枯田', '#a8c088', 12);
// 村栅门
spot(2.2, 15.8, '#e8c890', 9); label(0.2, 12.6, '村栅门(西口)', '#e8c890', 13);
// 坡上磨坊
zone(43.5, 4.5, 51, 9.5, null, '#c8c8d8'); spot(47.5, 7, '#c8c8d8', 12); label(45.5, 2.6, '磨坊(坡上·孤立)', '#c8c8d8', 13);
label(42.5, 12.4, '之字坡道', '#b8a888', 12);
// 动线
ctx.strokeStyle = '#ff8866'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]);
ctx.beginPath(); ctx.moveTo(...pt(1, 15.5));
[[20, 15.5], [22, 12], [24.5, 8.4]].forEach(q => ctx.lineTo(...pt(...q)));
ctx.stroke();
ctx.beginPath(); ctx.moveTo(...pt(24, 15.5));
[[39.5, 15.5], [45, 15.5], [45, 9.5], [47.5, 8.8]].forEach(q => ctx.lineTo(...pt(...q)));
ctx.stroke(); ctx.setLineDash([]);
label(5, 17.6, '动线①进村→广场→村长家', '#ff8866', 12);
label(33.5, 20.4, '动线②→桥→坡上磨坊', '#ff8866', 12);
ctx.font = 'bold 20px Zpix'; ctx.fillStyle = '#ffd97a';
ctx.fillText('烛河村 施工图 v6 · 等距终版 —— 设定书全量: 溪+磨坊桥+坡上磨坊 | 十户+栅门 | 苔石板广场 | 坟场伏笔', 24, 34);
ctx.font = '13px Zpix'; ctx.fillStyle = '#a8b0a8';
ctx.fillText('地面: 病态草D2 / 湿泥路 / 苔石板 / 枯田 / 黑水溪 · 圆点=落点 · 虚线=动线 · 坐标源=town_v6_def.js', 24, 58);
fs.writeFileSync('/home/user/Maodou/dev/blueprints/blueprint6.png', cv.toBuffer('image/png'));
console.log('blueprint6 done');
