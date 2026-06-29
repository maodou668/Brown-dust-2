// 运行需: NODE_PATH=<repo>/node_modules node scripts/gnorm.js ...
// Generic field-sprite normalizer: node gnorm.js <charId> <extractedCharDir>
// Produces art/05_pixellab/<charId>_field with idle(8)/run(8,drop frame0)/cast(north),
// mirror E->W, NE->NW, SE->SW, fit to Lecliss bbox (uniform size).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const charId = process.argv[2], EX = process.argv[3];
const ROT = path.join(EX, 'rotations'), AN = path.join(EX, 'animations');
const OUT = `/home/user/Maodou/art/05_pixellab/${charId}_field`;
// 固定归一基准（64 画布、脚线 53）。**不要**读 lecliss manifest——它已被 uniformsize 改成
// v2(72 画布/脚线64)，会污染 gnorm 让新角色脚线错位。gnorm 永远输出 64 画布 v1，
// 之后由 uniformsize 统一转 72 画布。
const LEC = { srcSize: { w: 64, h: 64 }, bbox: { x: 1, y: 7, w: 59, h: 46 } };
const BB = LEC.bbox, CAN = LEC.srcSize.w, baseY = BB.y + BB.h, cx = BB.x + BB.w / 2;
const DIRS = ['south','south-east','east','north-east','north','north-west','west','south-west'];
const folders = fs.readdirSync(AN);
const findAll = re => folders.filter(f => re.test(f));
// v3 splits a re-fired direction into a "<name>-<hash>" sibling folder, so a
// single anim can span multiple folders. Collect ALL matching folders and
// resolve per-direction across them (no manual merge needed).
// idle folders: v3 ("standing_idle...") OR template breathing-idle (folder named "animating")
const idleFs = findAll(/idle|standing|animating/i);
// Prefer the state-based walk (folder name contains "walking_cycle", merged from
// the mid-stride walk-state char) over any OLD "run" folder still on the main
// char. The old runs had wrong leg/head direction; the state-walk is the fix.
let runFs = findAll(/walking_cycle/i);
if(!runFs.length) runFs = findAll(/run|walk|march/i);
// cast folder is named after its action_description, which may not contain
// "cast". Match common spell verbs; else fall back to any leftover folder
// that is neither idle nor run (that's the cast).
// cast = any anim folder that is NOT idle/run/walk (robust to arbitrary skill verbs)
let castFs = folders.filter(f => !/idle|standing|breathing|animating|run|walk|march/i.test(f));
const pick = (list, dir) => list.find(f => countFrames(f, dir) > 0) || null;
function cbox(img){const c=createCanvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);
  const d=x.getImageData(0,0,img.width,img.height).data;let x0=img.width,y0=img.height,x1=-1,y1=-1;
  for(let y=0;y<img.height;y++)for(let X=0;X<img.width;X++){if(d[(y*img.width+X)*4+3]>16){if(X<x0)x0=X;if(y<y0)y0=y;if(X>x1)x1=X;if(y>y1)y1=y;}}
  return {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
function tf(cb){const s=Math.min(BB.w/cb.w,BB.h/cb.h);return{s,offX:cx-(cb.x+cb.w/2)*s,offY:baseY-(cb.y+cb.h)*s};}
function place(img,t,mirror){const o=createCanvas(CAN,CAN),c=o.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.drawImage(img,0,0,img.width,img.height,t.offX,t.offY,img.width*t.s,img.height*t.s);
  if(!mirror)return o;const m=createCanvas(CAN,CAN),mx=m.getContext('2d');mx.imageSmoothingEnabled=false;mx.translate(CAN,0);mx.scale(-1,1);mx.drawImage(o,0,0);return m;}
async function rotTf(d){const r=await loadImage(path.join(ROT,d+'.png'));return tf(cbox(r));}
function frameFile(folder,dir,i){ // frames are frame_000.png OR 0.png
  const a=path.join(AN,folder,dir,'frame_'+String(i).padStart(3,'0')+'.png');
  if(fs.existsSync(a))return a; return path.join(AN,folder,dir,i+'.png');
}
function countFrames(folder,dir){let n=0;while(fs.existsSync(frameFile(folder,dir,n)))n++;return n;}
// mirror map: outDir -> {src,mirror}
const MIR={south:['south',0],north:['north',0],east:['east',0],'north-east':['north-east',0],'south-east':['south-east',0],
  west:['east',1],'north-west':['north-east',1],'south-west':['south-east',1]};
// idle 专用镜像：north-east idle 的腿会乱动 → 改用 north-west 当源，north-east 镜像它。
const IMIR={south:['south',0],north:['north',0],east:['east',0],'north-west':['north-west',0],'south-east':['south-east',0],
  west:['east',1],'north-east':['north-west',1],'south-west':['south-east',1]};
(async()=>{
  if(fs.existsSync(OUT))fs.rmSync(OUT,{recursive:true,force:true});
  const man={srcSize:LEC.srcSize,bbox:BB,dirs:DIRS,fps:{idle:8,run:12,cast:12},anims:{},static:Object.fromEntries(DIRS.map(d=>[d,1]))};
  // IDLE: 8 dirs. If an idle animation exists use it; else fall back to the
  // static rotation as a single idle frame (saves 5 jobs/char on the batch).
  man.anims.idle={frames:{}};
  for(const d of DIRS){const [src,mir]=IMIR[d];const t=await rotTf(src);const idleF=pick(idleFs,src);
    const dir=path.join(OUT,'idle',d);fs.mkdirSync(dir,{recursive:true});
    if(idleF){const n=countFrames(idleF,src);
      for(let i=0;i<n;i++){const f=await loadImage(frameFile(idleF,src,i));fs.writeFileSync(path.join(dir,String(i).padStart(2,'0')+'.png'),place(f,t,mir).toBuffer('image/png'));}
      man.anims.idle.frames[d]=n;}
    else{const f=await loadImage(path.join(ROT,src+'.png'));fs.writeFileSync(path.join(dir,'00.png'),place(f,t,mir).toBuffer('image/png'));
      man.anims.idle.frames[d]=1;}}
  // RUN: 8 dirs, drop frame0 (idle ref) for smooth loop.
  // If a source dir's run is missing (backend stall), fall back to that dir's
  // static rotation (1 frame) so facing stays correct instead of empty.
  if(pick(runFs,'south')){man.anims.run={frames:{}};
    for(const d of DIRS){const [src,mir]=MIR[d];const t=await rotTf(src);const runF=pick(runFs,src);const n=runF?countFrames(runF,src):0;
      const dir=path.join(OUT,'run',d);fs.mkdirSync(dir,{recursive:true});
      if(n>=2){const out=n-1;
        for(let i=1;i<n;i++){const f=await loadImage(frameFile(runF,src,i));fs.writeFileSync(path.join(dir,String(i-1).padStart(2,'0')+'.png'),place(f,t,mir).toBuffer('image/png'));}
        man.anims.run.frames[d]=out;}
      else{const f=await loadImage(path.join(ROT,src+'.png'));fs.writeFileSync(path.join(dir,'00.png'),place(f,t,mir).toBuffer('image/png'));
        man.anims.run.frames[d]=1;}}}
  // CAST(s): north only. Optional 3rd CLI arg = JSON {animName: folderSubstring}
  // to emit MULTIPLE casts (one per skill). Without it, single 'cast' (first match).
  const CASTMAP = process.argv[4] ? JSON.parse(process.argv[4]) : { cast: null };
  async function writeCast(animName, folder){
    if(!folder || countFrames(folder,'north')<2) return false;
    const t=await rotTf('north'); const n=countFrames(folder,'north');
    const dir=path.join(OUT,animName,'north'); fs.mkdirSync(dir,{recursive:true});
    for(let i=0;i<n;i++){const f=await loadImage(frameFile(folder,'north',i));fs.writeFileSync(path.join(dir,String(i).padStart(2,'0')+'.png'),place(f,t,0).toBuffer('image/png'));}
    man.anims[animName]={frames:{north:n}}; return true;
  }
  // First pass: explicit substring matches (and null=first). Track claimed folders.
  // "*" means "the remaining cast folder not claimed by another entry".
  const claimed = new Set();
  const entries = Object.entries(CASTMAP);
  for(const [animName, sub] of entries){
    if(sub === '*') continue;
    const folder = sub ? castFs.find(f=>f.toLowerCase().includes(sub.toLowerCase())) : pick(castFs,'north');
    if(folder) claimed.add(folder);
    await writeCast(animName, folder);
  }
  for(const [animName, sub] of entries){
    if(sub !== '*') continue;
    const folder = castFs.find(f=>!claimed.has(f) && countFrames(f,'north')>=2);
    if(folder) claimed.add(folder);
    await writeCast(animName, folder);
  }
  fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(man,null,1));
  const castKeys=Object.keys(man.anims).filter(a=>a.startsWith('cast'));
  console.log(`${charId}_field: idleFs=${idleFs.length}(idle frames ${man.anims.idle.frames.south}) runFs=${runFs.length} | dirs ${DIRS.length}, run ${man.anims.run?man.anims.run.frames.south:'-'}, casts [${castKeys.map(k=>k+':'+man.anims[k].frames.north).join(', ')}]`);
})();
