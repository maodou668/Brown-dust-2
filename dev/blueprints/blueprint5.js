// 烛河村施工图 v5(等距版): 与 town5_def.js 坐标一一对应
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/home/user/Maodou/assets/fonts/zpix.ttf', 'Zpix');
const W = 1500, H = 900, OX = 750, OY = 120, UX = 15, UY = 7.5;
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
const door = (x, y) => { const [px, py] = pt(x, y); ctx.fillStyle = '#ffd97a'; ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 7); ctx.lineTo(px + 11, py + 1); ctx.closePath(); ctx.fill(); };
const spot = (x, y, c, r = 7) => { const [px, py] = pt(x, y); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); };
// 地
zone(0, 0, 44, 26, '#33502f', '#22371f');
// 路网
zone(3, 8, 41, 10, '#5a4a3c'); zone(9, 10, 11, 14, '#5a4a3c');
zone(17, 10, 28, 14, '#6b6255'); zone(24, 7, 27, 10, '#6b6255');
zone(33, 10, 35, 14, '#5a4a3c'); zone(41, 4, 43, 10, '#5a4a3c');
zone(0, 14, 44, 17, '#5a4a3c'); zone(14, 17, 16, 23, '#5a4a3c');
zone(21, 17, 24, 23, '#7a6a50');
// 地块
zone(4, 3.5, 10, 8.4, null, '#d8d8e0'); spot(7, 6, '#d8d8e0', 11); door(9.4, 7.2); label(2, 2.6, '石屋(门→门前径)', '#d8d8e0');
zone(11, 3.5, 16.5, 8, null, '#b9a0d0'); spot(13.8, 5.8, '#b9a0d0', 8); label(10.4, 2, '坟场(围栏+枯树把守)', '#b9a0d0', 12);
zone(18.5, 2.5, 25.5, 8.6, null, '#e8d8b0'); spot(22, 5.5, '#e8d8b0', 13); door(24.9, 7.4); label(19.5, 1, '村长家(门→广场北伸场)', '#e8d8b0');
zone(27.5, 4, 33.5, 8.4, null, '#d8c8a0'); spot(30.5, 6.2, '#d8c8a0', 10); door(33.3, 7.2); label(29.5, 2.6, '木屋B(门→门前径)', '#d8c8a0');
zone(34.5, 1.5, 41.5, 8.8, null, '#c8c8d8'); spot(37.8, 4.8, '#c8c8d8', 12); door(41.2, 7.6); label(38, 0.4, '磨坊(门→东院)', '#c8c8d8');
spot(22.5, 12, '#7ac0d8', 8); label(21.4, 13.8, '井(广场锚)', '#7ac0d8', 12);
spot(18, 10.4, '#ffb060', 5); spot(27, 10.4, '#ffb060', 5); label(15.2, 10, '灯', '#ffb060', 11); label(27.6, 9.6, '灯', '#ffb060', 11);
zone(17.5, 17, 27.5, 23.5, null, '#e0a860'); spot(18.7, 20, '#d8c8a0', 10); door(21.2, 19.8); spot(25.8, 19.6, '#e0b880', 9);
label(15.5, 24.6, '农家院坝(贫户屋·门→院坝 | 鸡圈)', '#e0a860', 12);
zone(3.6, 17.2, 9.6, 22, null, '#a8c088'); spot(6.5, 19.4, '#d0b060', 7); label(1, 20.6, '牧栏(围栏+干草车)', '#a8c088', 12);
// 树带示意
label(5, 0.2, '─林缘树带(四缘包边)─', '#7fae6a', 12); label(30, 25.4, '─林缘树带─', '#7fae6a', 12);
// 动线
ctx.strokeStyle = '#ff8866'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]);
ctx.beginPath();
let p0 = pt(1, 15.5); ctx.moveTo(...p0);
[[20, 15.5], [22, 12], [24.5, 8.2]].forEach(q => ctx.lineTo(...pt(...q)));
ctx.stroke(); ctx.setLineDash([]);
label(4, 17.2, '动线:主路→广场→村长家', '#ff8866', 12);
// 标题
ctx.font = 'bold 20px Zpix'; ctx.fillStyle = '#ffd97a';
ctx.fillText('烛河村 施工图 v5 · 等距版 —— 摆放语法全量执行(归属/门前净空/围栏成圈/树三位置/广场锚)', 24, 34);
ctx.font = '13px Zpix'; ctx.fillStyle = '#a8b0a8';
ctx.fillText('▶=门位(等距下门脸=grid东,屏幕右下) · 每栋门前接 径/场/院 · 圆点=落点 · 虚线=动线 · 坐标源=town5_def.js(效果图/引擎同源)', 24, 58);
fs.writeFileSync('/home/user/Maodou/dev/blueprints/blueprint5.png', cv.toBuffer('image/png'));
console.log('blueprint5.png done');
