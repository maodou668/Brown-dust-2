const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const DBLite=require('../js/dragonbones-lite.js');
const DIR=path.resolve(__dirname,'..','art','02_dragonbones');
const ske=JSON.parse(fs.readFileSync(path.join(DIR,'lecliss_ske.json')));
const tex=JSON.parse(fs.readFileSync(path.join(DIR,'lecliss_tex.json')));
(async()=>{
  const atlas=await loadImage(path.join(DIR,'lecliss_tex.png'));
  const player=new DBLite.Player(DBLite.parse(ske,tex),atlas);
  const shots=[['idle',0.0,'静止'],['attack_normal',0.28,'普攻挥臂'],['walk',0.3,'行走']];
  const cw=420,ch=820;
  const sheet=createCanvas(cw*shots.length,ch),sc=sheet.getContext('2d');
  sc.fillStyle='#10141c'; sc.fillRect(0,0,cw*shots.length,ch);
  shots.forEach(([a,t,lbl],i)=>{
    player.play(a); player.time=0; player.update(t);
    sc.save(); sc.translate(i*cw+cw/2, ch-40); sc.scale(0.92,0.92); player.draw(sc); sc.restore();
    sc.fillStyle='#cdb27a'; sc.font='16px sans-serif'; sc.fillText(lbl, i*cw+12, 26);
    sc.strokeStyle='rgba(255,255,255,.1)'; sc.strokeRect(i*cw,0,cw,ch);
  });
  fs.writeFileSync(path.join(DIR,'preview','lecliss_big.png'),sheet.toBuffer('image/png'));
  console.log('big done');
})();
