// 主调色板抽取：16人物 idle south + 锚点瓦片集 → 加权中位切分到 48 色
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const R = '/home/user/Maodou/art/';
(async () => {
  const srcs = [];
  for (const d of fs.readdirSync(R + '05_pixellab')) {
    const p = R + '05_pixellab/' + d + '/idle/south/00.png';
    if (d.endsWith('_field') && fs.existsSync(p)) srcs.push(p);
  }
  srcs.push(R + '06_story/tiles/road_grass.png');
  srcs.push(R + '06_story/tiles/water_grass.png');
  console.log('采样源', srcs.length, '个');
  // 收集像素
  const px = [];
  for (const s of srcs) {
    const im = await loadImage(s);
    const cv = createCanvas(im.width, im.height), ctx = cv.getContext('2d');
    ctx.drawImage(im, 0, 0);
    const d = ctx.getImageData(0, 0, im.width, im.height).data;
    for (let k = 0; k < im.width * im.height; k++) {
      if (d[k * 4 + 3] < 128) continue;
      px.push([d[k * 4], d[k * 4 + 1], d[k * 4 + 2]]);
    }
  }
  console.log('像素', px.length);
  // 中位切分量化到 48 色
  function medianCut(pixels, n) {
    let boxes = [pixels];
    while (boxes.length < n) {
      boxes.sort((a, b) => {
        const range = box => Math.max(...[0,1,2].map(ch => Math.max(...box.map(p => p[ch])) - Math.min(...box.map(p => p[ch]))));
        return range(b) - range(a);
      });
      const box = boxes.shift();
      if (box.length < 2) { boxes.push(box); break; }
      let bestCh = 0, bestR = -1;
      for (const ch of [0,1,2]) {
        const vs = box.map(p => p[ch]);
        const r = Math.max(...vs) - Math.min(...vs);
        if (r > bestR) { bestR = r; bestCh = ch; }
      }
      box.sort((a, b) => a[bestCh] - b[bestCh]);
      const mid = box.length >> 1;
      boxes.push(box.slice(0, mid), box.slice(mid));
    }
    return boxes.map(box => {
      const m = [0,0,0];
      for (const p of box) { m[0]+=p[0]; m[1]+=p[1]; m[2]+=p[2]; }
      return m.map(v => Math.round(v / box.length));
    });
  }
  // 下采样加速
  const samp = [];
  for (let i = 0; i < px.length; i += Math.max(1, Math.floor(px.length / 60000))) samp.push(px[i]);
  const N = +(process.argv[2] || 48);
  const pal = medianCut(samp, N);
  // 保证有纯暗描边色
  pal.push([26, 22, 24]);
  fs.writeFileSync('/home/user/Maodou/art/_palette/master_palette.json', JSON.stringify(pal));
  // 可视化
  const cv = createCanvas(49 * 24, 40), ctx = cv.getContext('2d');
  pal.forEach((c, i) => { ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(i * 24, 0, 24, 40); });
  fs.writeFileSync('/home/user/Maodou/art/_palette/master_palette.png', cv.toBuffer('image/png'));
  console.log('主调色板', pal.length, '色 → master_palette.json/png');
})();
