// 把 PixelLab 火法师下载整理成 art/05_pixellab/lecliss_field/{idle,run,cast}/{dir}/NN.png
// + 8 向静帧 static/{dir}.png + manifest.json，供地图/战斗使用。
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const SRC = 'art/05_pixellab/fire_sorceress/Beautiful_anime-style_fire_sorceress_girl';
const OUT = 'art/05_pixellab/lecliss_field';
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const ANIM_SRC = {
  idle: 'The_character_stands_in_place_with_a_gentle_rhythm',
  run:  'The_character_runs_forward_toward_the_bottom_of_th',
  cast: 'The_character_stands_firmly_drawing_energy_from_wi',
};
const FPS = { idle: 6, run: 12, cast: 12 };

function frames(d) { try { return fs.readdirSync(d).filter(f => /\.png$/.test(f)).sort(); } catch (e) { return []; } }

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const man = { srcSize: null, bbox: null, dirs: DIRS, fps: FPS, anims: {}, static: {} };
  let MINX = 1e9, MINY = 1e9, MAXX = 0, MAXY = 0, W = 0, H = 0;
  const acc = (ctx) => { const d = ctx.getImageData(0, 0, W, H).data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 16) { if (x < MINX) MINX = x; if (x > MAXX) MAXX = x; if (y < MINY) MINY = y; if (y > MAXY) MAXY = y; } };

  // 动画
  for (const anim of Object.keys(ANIM_SRC)) {
    man.anims[anim] = { frames: {} };
    for (const d of DIRS) {
      const sdir = path.join(SRC, 'animations', ANIM_SRC[anim], d), fl = frames(sdir);
      if (!fl.length) { man.anims[anim].frames[d] = 0; continue; }
      const odir = path.join(OUT, anim, d); fs.mkdirSync(odir, { recursive: true });
      let n = 0;
      for (const f of fl) {
        const im = await loadImage(path.join(sdir, f)); W = im.width; H = im.height;
        const c = createCanvas(W, H), x = c.getContext('2d'); x.drawImage(im, 0, 0); acc(x);
        fs.copyFileSync(path.join(sdir, f), path.join(odir, String(n).padStart(2, '0') + '.png')); n++;
      }
      man.anims[anim].frames[d] = n;
    }
  }
  // 静帧
  const sdir = path.join(OUT, 'static'); fs.mkdirSync(sdir, { recursive: true });
  for (const d of DIRS) {
    const src = path.join(SRC, 'rotations', d + '.png');
    if (fs.existsSync(src)) {
      const im = await loadImage(src); W = im.width; H = im.height;
      const c = createCanvas(W, H), x = c.getContext('2d'); x.drawImage(im, 0, 0); acc(x);
      fs.copyFileSync(src, path.join(sdir, d + '.png')); man.static[d] = 1;
    }
  }
  const pad = 2;
  man.srcSize = { w: W, h: H };
  man.bbox = { x: Math.max(0, MINX - pad), y: Math.max(0, MINY - pad), w: Math.min(W, MAXX + pad) - Math.max(0, MINX - pad), h: Math.min(H, MAXY + pad) - Math.max(0, MINY - pad) };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(man, null, 1));
  console.log('打包完成', OUT, '帧尺寸', W + 'x' + H, '包围盒', JSON.stringify(man.bbox));
  for (const a in man.anims) console.log(' ', a, JSON.stringify(man.anims[a].frames));
})();
