// 极限姿势测试：把各关节旋到极限，渲染检查肩/髋/肘/膝是否露缝。
const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const Rig=require('../js/rig.js');
(async()=>{
 const data=JSON.parse(fs.readFileSync('art/04_rig/lecliss_rig.json','utf8'));
 const atlas=await loadImage('art/04_rig/'+data.image);
 const rig=new Rig(data,atlas);
 const POSES=[
  ['rest',{}],
  ['抬双臂',{shoulderL:{rot:55},forearmL:{rot:25},shoulderR:{rot:-55},forearmR:{rot:-25}}],
  ['叉腰收臂',{shoulderL:{rot:-35},forearmL:{rot:60},shoulderR:{rot:35},forearmR:{rot:-60}}],
  ['迈腿',{thighL:{rot:28},shinL:{rot:-20},thighR:{rot:-22},shinR:{rot:10}}],
  ['扭身侧头',{spine:{rot:10},chest:{rot:8},neck:{rot:10},head:{rot:14},hair:{rot:10}}],
  ['攻击蓄力',{spine:{rot:-8},chest:{rot:-6},shoulderR:{rot:-80},forearmR:{rot:-50},shoulderL:{rot:20},head:{rot:-8},neck:{rot:-6}}],
 ];
 const {W,H}=data;
 const CW=Math.round(W*0.52),CH=Math.round(H*0.52),LAB=22,cols=3,rows=Math.ceil(POSES.length/cols);
 const cv=createCanvas(CW*cols,(CH+LAB)*rows),g=cv.getContext('2d');
 g.fillStyle='#202028';g.fillRect(0,0,cv.width,cv.height);
 const s=CW/W;
 POSES.forEach(([name,pose],i)=>{
  const c=i%cols,r=Math.floor(i/cols),ox=c*CW,oy=r*(CH+LAB);
  // 棋盘格便于看空洞
  for(let y=0;y<CH;y+=16)for(let x=0;x<CW;x+=16){g.fillStyle=((x/16+y/16)%2)?'#33333d':'#3c3c47';g.fillRect(ox+x,oy+LAB+y,16,16);}
  rig.setPose(pose);
  g.save(); g.beginPath();g.rect(ox,oy+LAB,CW,CH);g.clip();
  g.setTransform(s,0,0,s,ox,oy+LAB); rig.draw(g); g.setTransform(1,0,0,1,0,0);
  g.restore();
  g.fillStyle='#000';g.fillRect(ox,oy,CW,LAB);
  g.fillStyle='#ffd86b';g.font='bold 14px sans-serif';g.fillText(name,ox+6,oy+15);
  g.strokeStyle='rgba(255,255,255,.15)';g.strokeRect(ox,oy,CW,CH+LAB);
 });
 fs.mkdirSync('/tmp/sheets',{recursive:true});
 fs.writeFileSync('/tmp/sheets/_posetest.png',cv.toBuffer('image/png'));
 console.log('-> /tmp/sheets/_posetest.png');
})();
