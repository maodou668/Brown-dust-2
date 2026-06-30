const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const dir='art/05_pixellab/lecliss';
const labels=['south(朝下)','east(朝右)','north(朝上)','west(朝左)','south-east','north-east','north-west','south-west'];
(async()=>{
 const scale=4, cols=4, rows=2, cell=92*scale, lab=22, pad=8;
 const W=cols*(cell+pad)+pad, H=rows*(cell+lab+pad)+pad;
 const cv=createCanvas(W,H),g=cv.getContext('2d');
 g.fillStyle='#202028';g.fillRect(0,0,W,H);
 g.imageSmoothingEnabled=false;
 for(let i=0;i<8;i++){
  const im=await loadImage(path.join(dir,`img_0${i}.png`));
  const c=i%cols,r=Math.floor(i/cols),ox=pad+c*(cell+pad),oy=pad+r*(cell+lab+pad);
  // 棋盘格背景
  for(let y=0;y<cell;y+=16)for(let x=0;x<cell;x+=16){g.fillStyle=((x/16+y/16)%2)?'#2c2c36':'#363641';g.fillRect(ox+x,oy+lab+y,16,16);}
  g.imageSmoothingEnabled=false;
  g.drawImage(im,0,0,im.width,im.height,ox,oy+lab,cell,cell);
  g.fillStyle='#000';g.fillRect(ox,oy,cell,lab);
  g.fillStyle='#ffd86b';g.font='bold 13px sans-serif';g.fillText(labels[i],ox+4,oy+15);
 }
 fs.writeFileSync('/tmp/sheets/_pl_lecliss.png',cv.toBuffer('image/png'));
 console.log('img sizes:'); for(let i=0;i<9;i++){const im=await loadImage(path.join(dir,`img_0${i}.png`));console.log('img_0'+i,im.width+'x'+im.height);}
})();
