// 编排 lecliss_v3 的动画：等空槽→依次发 walk/attack(每个8方向)→全部完成后下载整包zip并解压。
// idle 已发。用法: node scripts/pixellab-animate.js
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const CID = '26b91346-07cb-4b55-95de-2f948306f39f';
const TOKEN = 'a166e207-7c0d-452e-aae2-f87371b47768';
const QUEUE = [['walking', 'walk'], ['fireball', 'attack']];   // idle 已发
const outdir = 'art/05_pixellab/lecliss_v3_anim';
fs.mkdirSync(outdir, { recursive: true });

function gc() {
  const out = execFileSync('node', ['scripts/pixellab.js', 'call', 'get_character',
    JSON.stringify({ character_id: CID, include_preview: false })], { maxBuffer: 64 << 20 }).toString();
  try { return JSON.parse(out).result.content[0].text; } catch (e) { return out; }
}
function fire(tpl, name) {
  const out = execFileSync('node', ['scripts/pixellab.js', 'call', 'animate_character',
    JSON.stringify({ character_id: CID, template_animation_id: tpl, animation_name: name })], { maxBuffer: 64 << 20 }).toString();
  let t = ''; try { t = JSON.parse(out).result.content[0].text; } catch (e) { t = out; }
  console.log(`  fire ${name}(${tpl}): ${t.split('\n')[0]}`);
  return !/error/.test(t);
}
function pending(t) { const m = t.match(/pending jobs \((\d+)\)/); return m ? +m[1] : 0; }
function sleep(s) { try { execFileSync('sleep', [String(s)]); } catch (e) {} }

(async () => {
  for (let i = 0; i < 80; i++) {
    const t = gc();
    const p = pending(t);
    console.log(`[${i}] pending=${p} queue=${QUEUE.length}`);
    if (p === 0) {
      if (QUEUE.length) { const [tpl, name] = QUEUE.shift(); fire(tpl, name); sleep(8); continue; }
      // 全部完成 → 下载整包
      console.log('全部动画完成，下载整包...');
      const zip = path.join(outdir, 'character.zip');
      try {
        execFileSync('curl', ['-sS', '--fail', '-L', '--max-time', '180',
          '-H', 'Authorization: Bearer ' + TOKEN,
          '-o', zip, `https://api.pixellab.ai/mcp/characters/${CID}/download`], { maxBuffer: 256 << 20 });
        console.log('zip 下载完成:', fs.statSync(zip).size, 'bytes');
        try { execFileSync('unzip', ['-o', zip, '-d', outdir]); } catch (e) { console.log('unzip 失败(可能无unzip):', e.message); }
        console.log('解压内容:'); console.log(execFileSync('find', [outdir, '-type', 'f']).toString());
      } catch (e) { console.log('下载失败:', e.message, '\n保存meta以便取URL'); fs.writeFileSync(path.join(outdir, '_meta.txt'), t); }
      // 同时把 animations 段的 URL 也存下来兜底
      fs.writeFileSync(path.join(outdir, '_final_meta.txt'), t);
      console.log('DONE');
      return;
    }
    sleep(25);
  }
  console.log('超时');
})();
