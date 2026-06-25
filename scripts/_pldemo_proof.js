const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const OUT='art/05_pixellab/lecliss_demo';
const man=JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'),'utf8'));
const bb=man.bbox, DIRS=man.dirs, ACTS=['idle','walk','attack'];
(async()=>{
 const cw=Math.round(bb.w*1.7),ch=Math.round(bb.h*1.7),lab=18,pad=5;
 const cols=DIRS.length;
 const cv=createCanvas(pad+cols*(cw+pad)+70, ACTS.length*(ch+lab+pad)+pad),g=cv.getContext('2d');
 g.fillStyle='#1c1c24';g.fillRect(0,0,cv.width,cv.height);g.imageSmoothingEnabled=false;
 for(let a=0;a<ACTS.length;a++){
  const act=ACTS[a];
  g.fillStyle='#ffd86b';g.font='bold 13px sans-serif';g.fillText(act,4,a*(ch+lab+pad)+ch/2);
  for(let d=0;d<cols;d++){
   const dir=DIRS[d], n=man.anims[act].frames[dir]; if(!n)continue;
   const mid=Math.floor(n/2);
   const im=await loadImage(path.join(OUT,act,dir,String(mid).padStart(2,'0')+'.png'));
   const ox=70+d*(cw+pad),oy=a*(ch+lab+pad)+lab;
   for(let y=0;y<ch;y+=14)for(let x=0;x<cw;x+=14){g.fillStyle=((x/14+y/14)%2)?'#2a2a34':'#34343f';g.fillRect(ox+x,oy+y,14,14);}
   g.imageSmoothingEnabled=false;g.drawImage(im,bb.x,bb.y,bb.w,bb.h,ox,oy,cw,ch);
   if(a===0){g.fillStyle='#8fd6ff';g.font='10px sans-serif';g.fillText(dir,ox+2,oy-4);}
  }
 }
 fs.writeFileSync('/tmp/sheets/_pl_demo_proof.png',cv.toBuffer('image/png'));console.log('ok');
})();
