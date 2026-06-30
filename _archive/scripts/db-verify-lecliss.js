const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const DBLite=require('../js/dragonbones-lite.js');
const DIR=path.resolve(__dirname,'..','art','02_dragonbones');
const ske=JSON.parse(fs.readFileSync(path.join(DIR,'lecliss_ske.json')));
const tex=JSON.parse(fs.readFileSync(path.join(DIR,'lecliss_tex.json')));
(async()=>{
  const atlas=await loadImage(path.join(DIR,'lecliss_tex.png'));
  const data=DBLite.parse(ske,tex);
  const player=new DBLite.Player(data,atlas);
  const shots=[['idle',0.0],['idle',0.75],['idle',1.5],['walk',0.1],['walk',0.35],['attack_normal',0.1],['attack_normal',0.3],['attack_normal',0.5]];
  const cw=240,ch=520,cols=shots.length;
  const sheet=createCanvas(cw*cols,ch),sc=sheet.getContext('2d');
  sc.fillStyle='#10141c'; sc.fillRect(0,0,cw*cols,ch);
  shots.forEach(([anim,t],i)=>{
    player.play(anim); player.time=0; player.update(t);
    sc.save(); sc.translate(i*cw+cw/2, ch-30); sc.scale(0.58,0.58); player.draw(sc); sc.restore();
    sc.fillStyle='#9d92ad'; sc.font='13px sans-serif'; sc.fillText(anim+' '+t+'s', i*cw+8, 20);
    sc.strokeStyle='rgba(255,255,255,.08)'; sc.strokeRect(i*cw,0,cw,ch);
  });
  fs.writeFileSync(path.join(DIR,'preview','lecliss_sheet.png'),sheet.toBuffer('image/png'));
  console.log('已渲染 lecliss 对照图');
})();
