// Unify in-game BODY size across characters by rescaling existing _field frames.
// Body height (feet baseline 53 -> head-top via contiguous-run detector) is normalized
// to a common target; feet re-anchored on a taller canvas so halos/raised heads never clip.
// Works on the already-assembled _field frames (preserves all per-char fixes: east side-walk,
// synthetic NW/NE idle, etc.). Run: NODE_PATH=<repo>/node_modules node scripts/uniformsize.js
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const ART = '/home/user/Maodou/art/05_pixellab';
// 默认全员；传 char 参数则只处理该角色（新角色接入只跑它自己，避免把已归一的重复缩放）。
// 支持 `char:bodyPx` 显式覆盖体高（窄头盔角色 contiguous 检测会误判，用满幅内容高覆盖）。
const argv = process.argv.slice(2);
const override = {};
const chars = (argv.length ? argv : ['lecliss','justia','seir','rou','helena','diana']).map(a => {
  const [c, b] = a.split(':'); if (b != null) override[c] = parseInt(b, 10); return c;
});
const BASE_Y = 53;          // current gnorm feet baseline in 64-canvas
const NEW_W = 64, NEW_H = 72, NEW_FEET = 64, TARGET_BODY = 46;  // new canvas + uniform body
async function headTop(img, run){const c=createCanvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);
  const d=x.getImageData(0,0,img.width,img.height).data,W=img.width,H=img.height;
  let botY=-1;for(let y=H-1;y>=0;y--){let a=false;for(let X=0;X<W;X++)if(d[(y*W+X)*4+3]>16){a=true;break;}if(a){botY=y;break;}}
  let ht=botY;for(let y=0;y<=botY;y++){let cur=0,mx=0;for(let X=0;X<W;X++){if(d[(y*W+X)*4+3]>16){cur++;if(cur>mx)mx=cur;}else cur=0;}if(mx>=run){ht=y;break;}}
  return ht;}
(async()=>{
  for(const ch of chars){
    const FD=path.join(ART, ch+'_field'); const man=JSON.parse(fs.readFileSync(path.join(FD,'manifest.json'),'utf8'));
    const ref=await loadImage(path.join(FD,'idle','south','00.png'));
    // 体高检测：默认 contiguous-9 头顶检测(对带光环/普通角色准)。但**窄头盔角色**(如 Garcia)
    // 会被误判过矮→过度放大成"熊"。可用 `char:bodyPx` 显式覆盖(如 garcia:46 用满幅内容高=不缩放)。
    const ht=await headTop(ref,9); let body=BASE_Y-ht;
    if (override[ch] != null) body = override[ch];
    const f=TARGET_BODY/body;
    // transform: scale about (cx, BASE_Y), move feet BASE_Y -> NEW_FEET; center x kept at 32 -> 32
    const cx=NEW_W/2;
    const a=f, e=cx - cx*f, ff=NEW_FEET - BASE_Y*f;  // setTransform(f,0,0,f, e, ff)
    let count=0;
    for(const anim of Object.keys(man.anims)){
      for(const dir of Object.keys(man.anims[anim].frames)){
        const n=man.anims[anim].frames[dir]; const dd=path.join(FD,anim,dir);
        for(let i=0;i<n;i++){const p=path.join(dd,String(i).padStart(2,'0')+'.png'); if(!fs.existsSync(p))continue;
          const img=await loadImage(p); const o=createCanvas(NEW_W,NEW_H),x=o.getContext('2d');
          x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.setTransform(a,0,0,a,e,ff); x.drawImage(img,0,0);
          fs.writeFileSync(p,o.toBuffer('image/png')); count++; }
      }
    }
    man.srcSize={w:NEW_W,h:NEW_H};
    man.bbox={x:1,y:NEW_FEET-TARGET_BODY,w:NEW_W-2,h:TARGET_BODY};   // y=18,h=46 -> feet=64
    fs.writeFileSync(path.join(FD,'manifest.json'),JSON.stringify(man,null,1));
    console.log(ch.padEnd(9),'body',body,'scale',f.toFixed(3),'frames',count,'-> canvas',NEW_W+'x'+NEW_H,'feet',NEW_FEET);
  }
})();
