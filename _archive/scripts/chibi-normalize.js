// 为每个 SD clip 计算"统一渲染"参数并写回 json：
//   norm.scale  —— 把该 clip 的"代表帧角色身高"缩到统一目标(300)的缩放系数
//   norm.footY  —— 脚底在帧内的纵向比例(0..1)，用于脚底锚定
//   norm.cx     —— 角色水平中心在帧内的比例(0..1)
// 取所有帧的并集包围盒来定脚底/中心，取代表帧定身高，稳健。
const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const dir=path.resolve(__dirname,'../art/03_sprite');
const CL=['idle','walk_dr','walk_ur','attack','skill','hit'];
const TARGET=300;
function bb(ctx,fw,fh){const d=ctx.getImageData(0,0,fw,fh).data;let a=fw,b=0,c=fh,e=0;
 for(let y=0;y<fh;y++)for(let x=0;x<fw;x++)if(d[(y*fw+x)*4+3]>40){if(x<a)a=x;if(x>b)b=x;if(y<c)c=y;if(y>e)e=y;}
 return{minX:a,maxX:b,minY:c,maxY:e,w:b-a,h:e-c,cx:(a+b)/2};}
(async()=>{
 for(const k of CL){
  const mp=path.join(dir,`lecliss_sd_${k}.json`);
  const m=JSON.parse(fs.readFileSync(mp,'utf8'));
  const img=await loadImage(path.join(dir,m.sheet));
  // 并集包围盒（脚底/中心）+ 各帧最大身高（定缩放，避免某帧前缩短）
  let U={minX:m.fw,maxX:0,minY:m.fh,maxY:0}, maxH=0;
  for(let f=0;f<m.frames;f++){
   const sx=(f%m.cols)*m.fw, sy=Math.floor(f/m.cols)*m.fh;
   const t=createCanvas(m.fw,m.fh),tc=t.getContext('2d');
   tc.drawImage(img,sx,sy,m.fw,m.fh,0,0,m.fw,m.fh);
   const r=bb(tc,m.fw,m.fh);
   U.minX=Math.min(U.minX,r.minX);U.maxX=Math.max(U.maxX,r.maxX);
   U.minY=Math.min(U.minY,r.minY);U.maxY=Math.max(U.maxY,r.maxY);
   maxH=Math.max(maxH,r.h);
  }
  const scale=TARGET/maxH;
  const footY=U.maxY/m.fh;
  const cx=((U.minX+U.maxX)/2)/m.fw;
  m.norm={scale:+scale.toFixed(4),footY:+footY.toFixed(4),cx:+cx.toFixed(4),target:TARGET};
  fs.writeFileSync(mp,JSON.stringify(m,null,2));
  console.log(`${k.padEnd(9)} maxH=${maxH} scale=${scale.toFixed(3)} footY=${footY.toFixed(3)} cx=${cx.toFixed(3)}`);
 }
})();
