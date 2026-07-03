// 归一 v2：保色相钳带 + 软吸附(可调强度)。修 v1 "干草变土"的色相漂移。
// 用法: node palmap2.js <in> <out> [satBand=0.18,0.5] [vBand=0.22,0.52] [snap=0.35]
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const PAL = JSON.parse(fs.readFileSync(__dirname + '/master_palette.json'));
const rgb2hsv = (r,g,b) => { const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; let h=0;
  if(d){ if(mx===r)h=((g-b)/d)%6; else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; if(h<0)h+=360; }
  return [h, mx?d/mx:0, mx/255]; };
const hsv2rgb = (h,s,v) => { const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  const [r,g,b] = h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return [(r+m)*255,(g+m)*255,(b+m)*255]; };
(async () => {
  const [src, dst, satArg, vArg, snapArg] = process.argv.slice(2);
  const [sLo,sHi] = (satArg||'0.18,0.5').split(',').map(Number);
  const [vLo,vHi] = (vArg||'0.22,0.52').split(',').map(Number);
  const snap = +(snapArg||0.35);
  const im = await loadImage(src);
  const cv = createCanvas(im.width, im.height), ctx = cv.getContext('2d');
  ctx.drawImage(im, 0, 0);
  const img = ctx.getImageData(0,0,im.width,im.height), d = img.data;
  const clamp = (x,a,b)=>Math.min(b,Math.max(a,x));
  for (let k=0;k<im.width*im.height;k++){
    if (d[k*4+3]<8) continue;
    const [h,s,v] = rgb2hsv(d[k*4],d[k*4+1],d[k*4+2]);
    // 描边/极暗像素不动（保锐利）
    if (v < 0.16) continue;
    const s2 = s < 0.03 ? s : clamp(s, sLo, sHi);   // 灰色系不强拉饱和
    const v2 = clamp(v, vLo, vHi);
    let [r,g,b] = hsv2rgb(h, s2, v2);
    // 软吸附：向主调色板最近色走 snap 程度
    let best=1e9, bc=[r,g,b];
    for (const c of PAL){ const dd=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2; if(dd<best){best=dd;bc=c;} }
    r += (bc[0]-r)*snap; g += (bc[1]-g)*snap; b += (bc[2]-b)*snap;
    d[k*4]=Math.round(r); d[k*4+1]=Math.round(g); d[k*4+2]=Math.round(b);
  }
  ctx.putImageData(img,0,0);
  fs.writeFileSync(dst, cv.toBuffer('image/png'));
  console.log('palmap2 ok', dst.split('/').pop());
})();
