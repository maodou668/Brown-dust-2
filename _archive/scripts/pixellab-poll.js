// 轮询一个 character 直到完成，下载所有方向图 + 预览到 art/05_pixellab/<name>/
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const CID = process.argv[2];
const OUTNAME = process.argv[3] || CID.slice(0,8);
const outdir = path.join('art/05_pixellab', OUTNAME);
fs.mkdirSync(outdir, { recursive: true });
function call(tool, args){
  const out = execFileSync('node',['scripts/pixellab.js','call',tool,JSON.stringify(args)],{maxBuffer:64<<20}).toString();
  const j = JSON.parse(out); return j.result&&j.result.content&&j.result.content[0]&&j.result.content[0].text || JSON.stringify(j.result||j);
}
function sleep(ms){ execFileSync('sleep',[String(ms/1000)]); }
(async()=>{
  for(let i=0;i<30;i++){
    const txt = call('get_character',{character_id:CID,include_preview:false});
    const status = (txt.match(/status:\s*(\w+)/)||[])[1] || (txt.includes('completed')?'completed':'?');
    console.log(`[poll ${i}] status=${status}`);
    if(/completed/i.test(txt)){
      fs.writeFileSync(path.join(outdir,'_meta.txt'), txt);
      // 抓所有 URL
      const urls = [...txt.matchAll(/https?:\/\/[^\s"')]+/g)].map(m=>m[0]);
      console.log('URLs:', urls.length);
      let n=0;
      for(const u of urls){
        const ext = (u.match(/\.(png|gif|webp|jpg)/i)||[])[1] || 'png';
        const name = `img_${String(n).padStart(2,'0')}.${ext}`;
        try{ execFileSync('curl',['-sS','-L','--max-time','60','-o',path.join(outdir,name),u],{maxBuffer:64<<20}); n++; }catch(e){}
      }
      console.log(`下载 ${n} 个文件 → ${outdir}`);
      console.log('META:\n'+txt.slice(0,1500));
      return;
    }
    if(/failed/i.test(txt)){ console.log('FAILED:\n'+txt); return; }
    sleep(25000);
  }
  console.log('超时未完成');
})();
