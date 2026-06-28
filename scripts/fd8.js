const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs=require('fs'),path=require('path');
const ART='/home/user/Maodou/art/05_pixellab',char=process.argv[2],anim=process.argv[3]||'idle';
const DIRS=['south','south-east','east','north-east','north','north-west','west','south-west'];
(async()=>{const out=[];for(const dir of DIRS){const base=path.join(ART,char+'_field',anim,dir);
  const files=fs.readdirSync(base).filter(f=>/\.png$/.test(f)).sort();
  if(files.length<2){out.push(dir+':static');continue;}
  const cents=[];for(const f of files){const img=await loadImage(path.join(base,f));const c=createCanvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);
    const d=x.getImageData(0,0,img.width,img.height).data,H=img.height,W=img.width;let maxY=0;
    for(let y=0;y<H;y++)for(let X=0;X<W;X++)if(d[(y*W+X)*4+3]>40)if(y>maxY)maxY=y;
    const band=Math.max(0,maxY-Math.round(H*0.12));let sx=0,n=0;for(let y=band;y<=maxY;y++)for(let X=0;X<W;X++)if(d[(y*W+X)*4+3]>40){sx+=X;n++;}
    if(n)cents.push(sx/n);}
  out.push(dir+':'+(Math.max(...cents)-Math.min(...cents)).toFixed(1)+'px');}
  console.log(char,anim,out.join('  '));})();
