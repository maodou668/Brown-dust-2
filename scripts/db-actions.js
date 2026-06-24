const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const DBLite=require('../js/dragonbones-lite.js');
const DIR=path.resolve(__dirname,'..','art','02_dragonbones');
const ske=JSON.parse(fs.readFileSync(path.join(DIR,'lecliss_ske.json')));
const tex=JSON.parse(fs.readFileSync(path.join(DIR,'lecliss_tex.json')));
(async()=>{
  const atlas=await loadImage(path.join(DIR,'lecliss_tex.png'));
  const player=new DBLite.Player(DBLite.parse(ske,tex),atlas);
  // 每个动作取 3 帧，按动作分组
  const groups=[['walk',[0.0,0.25,0.5]],['run',[0.0,0.17,0.34]],['jump',[0.15,0.45,0.75]],['attack_normal',[0.1,0.3,0.5]]];
  const cw=200,ch=560; let cols=0; groups.forEach(g=>cols+=g[1].length);
  const sheet=createCanvas(cw*cols,ch),sc=sheet.getContext('2d');
  sc.fillStyle='#10141c'; sc.fillRect(0,0,cw*cols,ch);
  let i=0;
  groups.forEach(([anim,ts])=>{ ts.forEach(t=>{
    player.play(anim); player.time=0; player.update(t);
    sc.save(); sc.translate(i*cw+cw/2, ch-30); sc.scale(0.62,0.62); player.draw(sc); sc.restore();
    sc.fillStyle='#cdb27a'; sc.font='13px sans-serif'; sc.fillText(anim+' '+t, i*cw+8, 20);
    sc.strokeStyle='rgba(255,255,255,.08)'; sc.strokeRect(i*cw,0,cw,ch);
    i++;
  });});
  fs.writeFileSync(path.join(DIR,'preview','lecliss_actions.png'),sheet.toBuffer('image/png'));
  console.log('动作对照图完成, 动画:', player.data&&Object.keys(player.data.anims).join(','));
})();
