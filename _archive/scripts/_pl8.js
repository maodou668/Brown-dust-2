const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const dir=process.argv[2]||'lecliss_v3';
const labels=['south','east','north','west','south-east','north-east','north-west','south-west'];
(async()=>{
 const cols=4,rows=2,cell=230,lab=20,pad=6;
 const cv=createCanvas(cols*(cell+pad)+pad,rows*(cell+lab+pad)+pad),g=cv.getContext('2d');
 g.fillStyle='#1c1c24';g.fillRect(0,0,cv.width,cv.height);
 for(let i=0;i<8;i++){
  const im=await loadImage(path.join('art/05_pixellab',dir,`img_0${i}.png`));
  const c=i%cols,r=Math.floor(i/cols),ox=pad+c*(cell+pad),oy=pad+r*(cell+lab+pad)+lab;
  for(let y=0;y<cell;y+=16)for(let x=0;x<cell;x+=16){g.fillStyle=((x/16+y/16)%2)?'#2a2a34':'#34343f';g.fillRect(ox+x,oy+y,16,16);}
  const s=Math.min(cell/im.width,cell/im.height),dw=im.width*s,dh=im.height*s;
  g.imageSmoothingEnabled=false;
  g.drawImage(im,0,0,im.width,im.height,ox+(cell-dw)/2,oy+cell-dh,dw,dh);
  g.fillStyle='#000';g.fillRect(ox,oy-lab,cell,lab);
  g.fillStyle='#ffd86b';g.font='bold 12px sans-serif';g.fillText(labels[i],ox+4,oy-6);
 }
 fs.writeFileSync('/tmp/sheets/_pl8_'+dir+'.png',cv.toBuffer('image/png'));console.log('ok '+dir);
})();
