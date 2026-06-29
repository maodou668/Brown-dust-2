const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs=require('fs'),path=require('path');
const G='/tmp/claude-0/-home-user-Maodou/ec2893cb-4d1d-5ee5-a770-feb89679eb2f/scratchpad/dia_ws/Transform_into_Beau_5';
const SRC=path.join(G,'animations/walking_cycle_loop_in_pure_side-profile_view_facin/east');
const ROT=path.join(G,'rotations/east.png');
const OUT='/home/user/Maodou/art/05_pixellab/diana_field';
const LEC=JSON.parse(fs.readFileSync('/home/user/Maodou/art/05_pixellab/lecliss_field/manifest.json','utf8'));
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
  const rot=await loadImage(ROT); const t=tf(cbox(rot));
  let n=0; while(fs.existsSync(ff(SRC,n))) n++;   // total frames incl ref(0)
  const out=n-1; // drop frame0 (idle ref) for smooth loop
  for(const [dir,mir] of [['east',0],['west',1]]){
    const d=path.join(OUT,'run',dir); fs.rmSync(d,{recursive:true,force:true}); fs.mkdirSync(d,{recursive:true});
    for(let i=1;i<n;i++){const f=await loadImage(ff(SRC,i));
      fs.writeFileSync(path.join(d,String(i-1).padStart(2,'0')+'.png'),place(f,t,mir).toBuffer('image/png'));}
  }
  const man=JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'),'utf8'));
  man.anims.run.frames.east=out; man.anims.run.frames.west=out;
  fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(man,null,1));
  console.log('rebuilt run east(direct)+west(mirror) from side-profile walk,',out,'frames');
})();
