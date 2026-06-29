const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const NEDIR = '/tmp/claude-0/-home-user-Maodou/ec2893cb-4d1d-5ee5-a770-feb89679eb2f/scratchpad/rou_recheck/Transform_into_Beau_3/animations/standing_still_both_feet_firmly_planted_flat_on_th-f6897931/north-east';
const NEROT = '/tmp/claude-0/-home-user-Maodou/ec2893cb-4d1d-5ee5-a770-feb89679eb2f/scratchpad/rou_recheck/Transform_into_Beau_3/rotations/north-east.png';
const OUT = '/home/user/Maodou/art/05_pixellab/rou_field';
const LEC = JSON.parse(fs.readFileSync('/home/user/Maodou/art/05_pixellab/lecliss_field/manifest.json','utf8'));
const BB=LEC.bbox, CAN=LEC.srcSize.w, baseY=BB.y+BB.h, cx=BB.x+BB.w/2;
function cbox(img){const c=createCanvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);
  const d=x.getImageData(0,0,img.width,img.height).data;let x0=img.width,y0=img.height,x1=-1,y1=-1;
  for(let y=0;y<img.height;y++)for(let X=0;X<img.width;X++){if(d[(y*img.width+X)*4+3]>16){if(X<x0)x0=X;if(y<y0)y0=y;if(X>x1)x1=X;if(y>y1)y1=y;}}
  return {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
function tf(cb){const s=Math.min(BB.w/cb.w,BB.h/cb.h);return{s,offX:cx-(cb.x+cb.w/2)*s,offY:baseY-(cb.y+cb.h)*s};}
function place(img,t,mirror){const o=createCanvas(CAN,CAN),c=o.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.drawImage(img,0,0,img.width,img.height,t.offX,t.offY,img.width*t.s,img.height*t.s);
  if(!mirror)return o;const m=createCanvas(CAN,CAN),mx=m.getContext('2d');mx.imageSmoothingEnabled=false;mx.translate(CAN,0);mx.scale(-1,1);mx.drawImage(o,0,0);return m;}
const ff=(d,i)=>path.join(d,'frame_'+String(i).padStart(3,'0')+'.png');
(async()=>{
  const r=await loadImage(NEROT);
  const t=tf(cbox(r));
  let n=0; while(fs.existsSync(ff(NEDIR,n))) n++;
  for(const [dir,mir] of [['north-east',0],['north-west',1]]){
    const d=path.join(OUT,'idle',dir); fs.rmSync(d,{recursive:true,force:true}); fs.mkdirSync(d,{recursive:true});
    for(let i=0;i<n;i++){const f=await loadImage(ff(NEDIR,i));
      fs.writeFileSync(path.join(d,String(i).padStart(2,'0')+'.png'),place(f,t,mir).toBuffer('image/png'));}
  }
  const man=JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'),'utf8'));
  man.anims.idle.frames['north-east']=n; man.anims.idle.frames['north-west']=n;
  fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(man,null,1));
  console.log('rebuilt NE(source)+NW(mirror) idle with',n,'frames');
})();
