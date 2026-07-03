// 全游戏美术全家福：所有资产类别一张图，不可遗漏
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/home/user/Maodou/assets/fonts/zpix.ttf', 'Zpix');
const A = '/home/user/Maodou/art/';
const W = 1560;
const FIELDS = fs.readdirSync(A + '05_pixellab').filter(d => d.endsWith('_field'));
const sections = [];
// 1 小人全员
sections.push({ title: '① 小人全员（' + FIELDS.length + ' 个，基准锚·不刷色）', bg: 'grass',
  items: FIELDS.map(d => ({ p: A + '05_pixellab/' + d + '/idle/south/00.png', l: d.replace('_field',''), s: 1 })) });
// 2 核心同框: 小人 + 新批(刷色后, 真实比例)
sections.push({ title: '② 小人+新场景物件同框（刷色后·真实比例）', bg: 'grass', items: [
  { p: A + '05_pixellab/teried_field/idle/south/00.png', l: '小人', s: 1 },
  { p: 'norm/new_house_td.png', l: '木屋', s: 1 }, { p: 'norm/new_stonehouse_td.png', l: '石屋', s: 1 },
  { p: 'norm/new_windmill_td.png', l: '磨坊', s: 0.85 }, { p: 'norm/new_oak_td.png', l: '橡树', s: 1 },
  { p: 'norm/new_hedge_td.png', l: '树篱', s: 1 }, { p: 'norm/new_bridge_td.png', l: '桥', s: 0.68 },
  { p: 'norm/new_flowerbed_td.png', l: '花坛', s: 0.44 }, { p: 'norm/new_mailbox_td3_dk.png', l: '信箱', s: 0.3 },
  { p: 'norm/new_firewood_td.png', l: '柴堆', s: 0.5 }, { p: 'norm/new_rocks_td.png', l: '石堆', s: 0.5 },
]});
// 3 视角待重做组（刷色后也放进来，标明）
sections.push({ title: '③ 新物件·视角错待重做组（已刷色·仅示色）', bg: 'grass', items: [
  { p: 'norm/new_deadtree2_td.png', l: '枯树✗', s: 0.83 }, { p: 'norm/new_haycart2_dk.png', l: '干草车✗', s: 0.64 },
  { p: 'norm/new_cratebarrel2_td.png', l: '木箱桶✗', s: 0.6 }, { p: 'norm/new_graves_td.png', l: '墓碑✗', s: 0.55 },
  { p: 'norm/new_well_td.png', l: '水井✗', s: 0.5 }, { p: 'norm/new_fence_td1_dk.png', l: '栅栏✗', s: 1 },
  { p: 'norm/new_decal_mud.png', l: '贴地泥斑', s: 0.5 }, { p: 'norm/new_decal_leaves.png', l: '贴地落叶', s: 0.4 },
]});
// 4 瓦片
sections.push({ title: '④ 地面瓦片（刷色后）', bg: 'dark', items: [
  { p: 'norm/tile_road_grass.png', l: '草地↔土路', s: 1 }, { p: 'norm/tile_water_grass.png', l: '草地↔水', s: 1 },
  { p: 'norm/tile_slabs_grass.png', l: '石板↔草(新)', s: 1 }, { p: 'norm/tile_grass_var.png', l: '草地变体', s: 1 },
]});
// 5 旧场景物件(现游戏在用, 刷色后)
sections.push({ title: '⑤ 旧场景物件（现游戏在用·刷色后·将被新版逐步替换）', bg: 'grass',
  items: fs.readdirSync(A + '06_story/props').filter(f => f.endsWith('.png')).map(f => ({ p: 'norm/old_' + f, l: f.replace('.png',''), s: f.includes('windmill_big') ? 0.5 : 0.8 })) });
// 6 NPC立绘+半身像
sections.push({ title: '⑥ 对话立绘 / 半身像 / 头像', bg: 'dark', items: [
  ...fs.readdirSync(A + '06_story/portraits').filter(f => f.endsWith('.png')).map(f => ({ p: A + '06_story/portraits/' + f, l: f.replace('.png',''), s: 0.5 })),
  { p: A + '01_splash/lecliss_bust.png', l: 'lecliss半身', s: 0.22 }, { p: A + '01_splash/seir_bust.png', l: 'seir半身', s: 0.22 },
  { p: A + '01_splash/lecliss_avatar.png', l: '头像', s: 0.5 },
]});
// 7 UI
sections.push({ title: '⑦ UI 套件（12件）', bg: 'dark',
  items: fs.readdirSync(A + '05_pixellab/ui').filter(f => f.endsWith('.png')).map(f => ({ p: A + '05_pixellab/ui/' + f, l: f.replace('.png',''), s: 0.6 })) });
// 8 VFX
sections.push({ title: '⑧ 技能特效（22套抽4帧·豁免刷色）', bg: 'dark', items: [
  { p: A + '05_pixellab/fx/fire_arrow/frame_002.png', l: 'fire_arrow', s: 1 },
  { p: A + '05_pixellab/fx/ice_nova/frame_002.png', l: 'ice_nova', s: 1 },
  { p: A + '05_pixellab/fx/heal_bloom/frame_002.png', l: 'heal_bloom', s: 1 },
  { p: A + '05_pixellab/fx/shadow_burst/frame_002.png', l: 'shadow_burst', s: 1 },
]});
// 9 整图场景背景 + CG
sections.push({ title: '⑨ 整图场景背景（旧路线5张）+ 剧情CG', bg: 'dark', items: [
  ...fs.readdirSync(A + '06_story/scenes').filter(f => f.endsWith('.png')).map(f => ({ p: A + '06_story/scenes/' + f, l: f.replace('.png',''), s: 0.16 })),
  ...fs.readdirSync(A + '06_story/cg').filter(f => f.endsWith('.png')).map(f => ({ p: A + '06_story/cg/' + f, l: 'CG:' + f.replace('.png',''), s: 0.16 })),
]});
// 10 历史遗留
sections.push({ title: '⑩ 历史遗留（早期路线，疑似已弃用，待确认删除）', bg: 'dark', items: [
  { p: A + '02_dragonbones/lecliss_tex.png', l: '骨骼拼图(旧)', s: 0.2 },
  { p: A + '03_sprite/lecliss_chibi.webp', l: 'chibi(旧)', s: 0.5 },
  { p: A + '04_rig/lecliss_atlas.png', l: 'rig图集(旧)', s: 0.2 },
  ...fs.readdirSync(A + '06_story/stage').filter(f => f.endsWith('.png')).map(f => ({ p: A + '06_story/stage/' + f, l: 'v225:' + f.replace('.png','').replace('prop_',''), s: 0.3 })),
]});
(async () => {
  const bg = await loadImage(__dirname + '/grass_bg.png');
  // 先量高度
  const PADX = 16, LABH = 30, TITLEH = 40, GAPY = 14;
  const panels = [];
  for (const sec of sections) {
    const imgs = [];
    for (const it of sec.items) {
      try { imgs.push({ im: await loadImage(it.p.startsWith('/') ? it.p : __dirname + '/' + it.p), ...it }); }
      catch (e) { console.log('MISS', it.p); }
    }
    // 流式排布
    let x = PADX, rowH = 0, y = 0;
    const pos = [];
    for (const it of imgs) {
      const w = Math.round(it.im.width * it.s), h = Math.round(it.im.height * it.s);
      if (x + w > W - PADX) { x = PADX; y += rowH + LABH + 8; rowH = 0; }
      pos.push({ ...it, x, y, w, h });
      x += w + 26; rowH = Math.max(rowH, h);
    }
    const ph = y + rowH + LABH + 16;
    panels.push({ sec, pos, ph });
  }
  const totalH = panels.reduce((s, p) => s + p.ph + TITLEH + GAPY, 60);
  const cv = createCanvas(W, totalH), ctx = cv.getContext('2d');
  ctx.fillStyle = '#17191c'; ctx.fillRect(0, 0, W, totalH);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffd97a'; ctx.font = 'bold 22px Zpix';
  ctx.fillText('全游戏美术全家福（刷色预览版）—— 按 8 条一致性标准挑毛病', PADX, 36);
  let Y = 56;
  for (const { sec, pos, ph } of panels) {
    ctx.fillStyle = sec.title.includes('✗') ? '#e0a860' : '#9fd08a';
    ctx.font = 'bold 16px Zpix'; ctx.fillText(sec.title, PADX, Y + 24);
    const py = Y + TITLEH - 6;
    if (sec.bg === 'grass') { for (let yy = 0; yy < ph; yy += 192) for (let xx = 0; xx < W; xx += 192) { ctx.save(); ctx.beginPath(); ctx.rect(0, py, W, ph); ctx.clip(); ctx.drawImage(bg, xx, py + yy, 192, 192); ctx.restore(); } }
    else { ctx.fillStyle = '#2b2f33'; ctx.fillRect(0, py, W, ph); }
    for (const it of pos) {
      const baseY = py + it.y + 8;
      ctx.drawImage(it.im, it.x, baseY, it.w, it.h);
      ctx.fillStyle = '#e8e8e8'; ctx.font = '11px Zpix';
      ctx.fillText(it.l, it.x, baseY + it.h + 14);
    }
    ctx.strokeStyle = '#484c50'; ctx.strokeRect(0, py, W, ph);
    Y += ph + TITLEH + GAPY;
  }
  fs.writeFileSync(__dirname + '/family_photo.png', cv.toBuffer('image/png'));
  console.log('全家福 ok', W + 'x' + totalH);
})();
