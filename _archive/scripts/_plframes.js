const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const base='art/05_pixellab/lecliss_v3_anim/Lecliss-v3/animations';
const rows=[
 ['idle/south','animating/south'],
 ['walk/south','walking/south'],
 ['attack/south','casting_a_fireball/south'],
];
(async()=>{
 let maxF=0; const data=[];
 for(const [lab,p] of rows){const dir=path.join(base,p);const fs2=fs.readdirSync(dir).filter(f=>/frame_\d+\.png/.test(f)).sort();maxF=Math.max(maxF,fs2.length);data.push({lab,dir,fs2});}
 const im0=await loadImage(path.join(data[0].dir,data[0].fs2[0]));const W=im0.width,H=im0.height;console.log('frame size',W+'x'+H);
 const scale=1.6,cell=Math.round(H*scale),cw=Math.round(W*scale),lab=18,pad=4;
 const cv=createCanvas(pad+maxF*(cw+pad)+120,pad+rows.length*(cell+lab+pad)),g=cv.getContext('2d');
 g.fillStyle='#1c1c24';g.fillRect(0,0,cv.width,cv.height);g.imageSmoothingEnabled=false;
 for(let r=0;r<data.length;r++){
  g.fillStyle='#ffd86b';g.font='bold 13px sans-serif';g.fillText(data[r].lab,4,pad+r*(cell+lab+pad)+13);
  for(let f=0;f<data[r].fs2.length;f++){
   const im=await loadImage(path.join(data[r].dir,data[r].fs2[f]));
   const ox=120+f*(cw+pad),oy=pad+r*(cell+lab+pad)+lab;
   for(let y=0;y<cell;y+=14)for(let x=0;x<cw;x+=14){g.fillStyle=((x/14+y/14)%2)?'#2a2a34':'#34343f';g.fillRect(ox+x,oy+y,14,14);}
   g.imageSmoothingEnabled=false;g.drawImage(im,0,0,W,H,ox,oy,cw,cell);
  }
 }
 fs.writeFileSync('/tmp/sheets/_pl_frames.png',cv.toBuffer('image/png'));console.log('ok');
})();
