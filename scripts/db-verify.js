const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const DBLite=require('../js/dragonbones-lite.js');
const DIR=path.resolve(__dirname,'..','art','02_dragonbones');
const ske=JSON.parse(fs.readFileSync(path.join(DIR,'char_template_ske.json')));
const tex=JSON.parse(fs.readFileSync(path.join(DIR,'char_template_tex.json')));
(async()=>{
  const atlas=await loadImage(path.join(DIR,'char_template_tex.png'));
  const data=DBLite.parse(ske,tex);
  const player=new DBLite.Player(data,atlas);
  // 渲染若干帧到一张对照图
  const shots=[
    ['idle',0.0],['idle',0.5],['idle',1.0],
    ['walk',0.0],['walk',0.2],['walk',0.4],
    ['attack_normal',0.10],['attack_normal',0.30],['attack_normal',0.55],
  ];
  const cw=150,ch=320,cols=shots.length;
  const sheet=createCanvas(cw*cols,ch);
  const sc=sheet.getContext('2d');
  sc.fillStyle='#1a1422'; sc.fillRect(0,0,cw*cols,ch);
  shots.forEach(([anim,t],i)=>{
    player.play(anim); player.time=0; player.update(t);
    sc.save();
    sc.translate(i*cw+cw/2, ch-40);   // root 放底部居中
    sc.scale(0.95,0.95);
    player.draw(sc);
    sc.restore();
    sc.fillStyle='#9d92ad'; sc.font='12px sans-serif';
    sc.fillText(anim+' '+t+'s', i*cw+8, 18);
    sc.strokeStyle='rgba(255,255,255,.08)'; sc.strokeRect(i*cw,0,cw,ch);
  });
  fs.mkdirSync(path.join(DIR,'preview'),{recursive:true});
  fs.writeFileSync(path.join(DIR,'preview','sheet.png'),sheet.toBuffer('image/png'));
  console.log('已渲染对照图 art/02_dragonbones/preview/sheet.png',cw*cols+'x'+ch);
  // 数值自检：root/head 世界变换有限值
  player.play('idle'); player.time=0; player.update(0.3);
  const w=player._worldMats();
  ['hip','head','hand_r','foot_l'].forEach(b=>{
    const m=w[b]; console.log('  bone',b,'->',m?('('+m.tx.toFixed(1)+','+m.ty.toFixed(1)+')'):'MISSING');
  });
})();
