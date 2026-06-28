// Synthetic breathing idle: feet-pinned vertical squash from the static placed sprite.
// Guarantees correct colors (uses the real sprite) and zero leg flailing.
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs=require('fs'),path=require('path');
const ART='/home/user/Maodou/art/05_pixellab', char=process.argv[2];
const FD=path.join(ART,char+'_field'), man=JSON.parse(fs.readFileSync(path.join(FD,'manifest.json'),'utf8'));
const CAN=man.srcSize.w, baseY=man.bbox.y+man.bbox.h;
const DIRS=man.dirs, N=8;
// breathing scale: 1.0 -> 0.955 -> 1.0 (cosine), feet pinned. ~2px head dip.
const S=[]; for(let i=0;i<N;i++){S.push(1 - 0.045*(0.5-0.5*Math.cos(2*Math.PI*i/N)));}
(async()=>{
  for(const dir of DIRS){
    const srcFile=path.join(FD,'idle',dir,'00.png');
    if(!fs.existsSync(srcFile)) { console.log('skip',dir); continue; }
    const src=await loadImage(srcFile);
    const out=path.join(FD,'idle',dir); 
    for(let i=0;i<N;i++){const s=S[i];const c=createCanvas(CAN,CAN),x=c.getContext('2d');
      x.imageSmoothingEnabled=false; x.setTransform(1,0,0,s,0,baseY*(1-s)); x.drawImage(src,0,0);
      fs.writeFileSync(path.join(out,String(i).padStart(2,'0')+'.png'),c.toBuffer('image/png'));}
    man.anims.idle.frames[dir]=N;
  }
  fs.writeFileSync(path.join(FD,'manifest.json'),JSON.stringify(man,null,1));
  console.log(char,'synthetic idle:',N,'frames/dir, scale',S.map(s=>s.toFixed(3)).join(','));
})();
