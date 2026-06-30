// 把 PixelLab 下载的零散动画整理成干净结构 + manifest，供 demo/游戏使用。
// idle←animating, attack←casting_a_fireball, walk←walking-b9d5edec(7向)+walking/south
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const SRC = 'art/05_pixellab/lecliss_v3_anim/Lecliss-v3/animations';
const OUT = 'art/05_pixellab/lecliss_demo';
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
// 每个逻辑动作：每个方向从哪个源目录取
const MAP = {
  idle:   d => path.join(SRC, 'animating', d),
  walk:   d => path.join(SRC, d === 'south' ? 'walking/south' : 'walking-b9d5edec/' + d),
  attack: d => path.join(SRC, 'casting_a_fireball', d),
};
const FPS = { idle: 7, walk: 10, attack: 12 };

function frames(dir){ try { return fs.readdirSync(dir).filter(f=>/frame_\d+\.png/.test(f)).sort(); } catch(e){ return []; } }

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const manifest = { srcSize: null, bbox: null, dirs: DIRS, fps: FPS, anims: {} };
  let MINX=1e9,MINY=1e9,MAXX=0,MAXY=0, W=0,H=0;
  // 第一遍：拷贝 + 求并集内容包围盒
  for (const anim of Object.keys(MAP)) {
    manifest.anims[anim] = { frames: {} };
    for (const d of DIRS) {
      const sdir = MAP[anim](d), fl = frames(sdir);
      if (!fl.length) { console.warn('缺帧', anim, d, sdir); manifest.anims[anim].frames[d]=0; continue; }
      const odir = path.join(OUT, anim, d); fs.mkdirSync(odir, { recursive: true });
      let n=0;
      for (const f of fl) {
        const im = await loadImage(path.join(sdir, f)); W=im.width; H=im.height;
        const c=createCanvas(W,H),x=c.getContext('2d'); x.drawImage(im,0,0);
        const dd=x.getImageData(0,0,W,H).data;
        for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){ if(dd[(y*W+xx)*4+3]>16){ if(xx<MINX)MINX=xx;if(xx>MAXX)MAXX=xx;if(y<MINY)MINY=y;if(y>MAXY)MAXY=y; } }
        fs.copyFileSync(path.join(sdir,f), path.join(odir, String(n).padStart(2,'0')+'.png')); n++;
      }
      manifest.anims[anim].frames[d]=n;
    }
  }
  // 内容包围盒加点边距
  const pad=6;
  manifest.srcSize={w:W,h:H};
  manifest.bbox={ x:Math.max(0,MINX-pad), y:Math.max(0,MINY-pad), w:Math.min(W,MAXX+pad)-Math.max(0,MINX-pad), h:Math.min(H,MAXY+pad)-Math.max(0,MINY-pad) };
  fs.writeFileSync(path.join(OUT,'manifest.json'), JSON.stringify(manifest,null,1));
  console.log('打包完成 →', OUT);
  console.log('源帧尺寸', W+'x'+H, '内容包围盒', JSON.stringify(manifest.bbox));
  for(const a in manifest.anims) console.log(' ', a, JSON.stringify(manifest.anims[a].frames));
})();
