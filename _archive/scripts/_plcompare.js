const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const items=[
 ['原64标准','lecliss/img_00.png'],
 ['标准128chibi','lecliss_chibi128/img_00.png'],
 ['v3 128','lecliss_v3/img_00.png'],
 ['pro 128','lecliss_pro/img_00.png'],
];
(async()=>{
 // 先量尺寸
 const imgs=[];
 for(const [lab,p] of items){const im=await loadImage(path.join('art/05_pixellab',p));imgs.push({lab,im});console.log(lab,im.width+'x'+im.height);}
 const cellH=560, lab=24, pad=10;
 const cols=items.length;
 const cv=createCanvas(cols*(360+pad)+pad,cellH+lab+pad*2),g=cv.getContext('2d');
 g.fillStyle='#1c1c24';g.fillRect(0,0,cv.width,cv.height);
 imgs.forEach((it,i)=>{
  const ox=pad+i*(360+pad),oy=pad+lab;
  for(let y=0;y<cellH;y+=18)for(let x=0;x<360;x+=18){g.fillStyle=((x/18+y/18)%2)?'#2a2a34':'#34343f';g.fillRect(ox+x,oy+y,18,18);}
  // 等比放大(最近邻),底对齐
  const s=Math.min(360/it.im.width, cellH/it.im.height);
  const dw=it.im.width*s,dh=it.im.height*s;
  g.imageSmoothingEnabled=false;
  g.drawImage(it.im,0,0,it.im.width,it.im.height, ox+(360-dw)/2, oy+cellH-dh, dw,dh);
  g.fillStyle='#000';g.fillRect(ox,oy-lab,360,lab);
  g.fillStyle='#ffd86b';g.font='bold 15px sans-serif';g.fillText(it.lab+'  ('+it.im.width+'px)',ox+5,oy-7);
 });
 fs.writeFileSync('/tmp/sheets/_pl_compare.png',cv.toBuffer('image/png'));console.log('ok');
})();
