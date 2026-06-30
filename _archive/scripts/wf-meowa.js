#!/usr/bin/env node
/**
 * Meowa 工作流通用执行器（多视图/等距瓦片/贴图等）。
 * 用法：MEOWA_API_KEY=xxx node scripts/wf-meowa.js <workflow_id> <out_dir> <params.json>
 * params.json 里的 *_image / reference_image 字段若是本地文件路径，会自动转成 dataURL。
 * 安全：key 仅从环境变量读取，绝不写入文件/仓库。
 */
const fs = require('fs'), path = require('path'), https = require('https');
const KEY = process.env.MEOWA_API_KEY;
if (!KEY) { console.error('✗ 缺少 MEOWA_API_KEY'); process.exit(1); }
const BASE = 'https://api.meowa.ai';

function req(method, url, body) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const opt = { method, hostname: u.hostname, path: u.pathname + u.search, headers: { 'Authorization': 'Bearer ' + KEY }, timeout: 120000 };
    if (data) { opt.headers['Content-Type'] = 'application/json'; opt.headers['Content-Length'] = Buffer.byteLength(data); }
    const r = https.request(opt, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ s: x.statusCode, b })); });
    r.on('timeout', () => { r.destroy(); rej(new Error('timeout')); });
    r.on('error', rej); if (data) r.write(data); r.end();
  });
}
function dl(url, file) {
  return new Promise(resolve => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'Authorization': 'Bearer ' + KEY }, timeout: 90000 }, x => {
      if (x.statusCode !== 200) { x.resume(); return resolve(false); }
      const ch = []; x.on('data', c => ch.push(c)); x.on('end', () => { fs.writeFileSync(file, Buffer.concat(ch)); resolve(true); });
    }).on('error', () => resolve(false));
  });
}
const sleep = ms => new Promise(s => setTimeout(s, ms));

function toDataURL(p) {
  const ext = path.extname(p).slice(1).toLowerCase() || 'png';
  return 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + fs.readFileSync(p).toString('base64');
}
// 构造 multipart/form-data：图片路径字段 -> 文件块，其余 -> 文本块
function buildMultipart(params) {
  const boundary = '----meowa' + Math.random().toString(16).slice(2);
  const chunks = [];
  const isImgPath = v => typeof v === 'string' && /\.(png|jpg|jpeg|webp)$/i.test(v) && fs.existsSync(v);
  const addText = (k, val) => chunks.push(Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + val + '\r\n'));
  const addFile = (k, p) => {
    chunks.push(Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"; filename="' + path.basename(p) + '"\r\nContent-Type: image/png\r\n\r\n'));
    chunks.push(fs.readFileSync(p)); chunks.push(Buffer.from('\r\n'));
  };
  for (const k in params) {
    const v = params[k];
    if (Array.isArray(v)) { v.forEach(item => isImgPath(item) ? addFile(k, item) : addText(k, String(item))); }
    else if (isImgPath(v)) addFile(k, v);
    else addText(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  chunks.push(Buffer.from('--' + boundary + '--\r\n'));
  return { body: Buffer.concat(chunks), boundary };
}
function postMultipart(url, params) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const { body, boundary } = buildMultipart(params);
    const opt = { method: 'POST', hostname: u.hostname, path: u.pathname + u.search, timeout: 120000,
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length } };
    const r = https.request(opt, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ s: x.statusCode, b })); });
    r.on('timeout', () => { r.destroy(); rej(new Error('timeout')); });
    r.on('error', rej); r.write(body); r.end();
  });
}
// 收集 json 里所有图片 url
function collectUrls(o, acc, dep) {
  if (!o || dep > 9) return;
  if (typeof o === 'string') { if (/^https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i.test(o)) acc.push(o); return; }
  if (Array.isArray(o)) o.forEach(x => collectUrls(x, acc, dep + 1));
  else if (typeof o === 'object') for (const k in o) collectUrls(o[k], acc, dep + 1);
}

async function run(wf, outDir, params) {
  const sub = await postMultipart(BASE + '/api/workflows/' + wf + '/run', params);
  let job; try { const j = JSON.parse(sub.b); job = j.api_job_id || j.job_id || j.id; } catch (e) {}
  if (!job) { console.log('提交失败:', sub.b.slice(0, 400)); return false; }
  console.log('job', job);
  for (let i = 0; i < 100; i++) {
    await sleep(4000);
    const r = await req('GET', BASE + '/api/jobs/' + job);
    let j; try { j = JSON.parse(r.b); } catch (e) { continue; }
    if (['pending', 'queued', 'running', 'processing'].includes(j.status)) continue;
    if (['failure', 'error', 'failed'].includes(j.status)) { console.log('✗ 失败:', JSON.stringify(j).slice(0, 400)); return false; }
    const urls = []; collectUrls(j.output || j, urls, 0);
    const uniq = [...new Set(urls)];
    if (!uniq.length) { console.log('无输出:', JSON.stringify(j).slice(0, 400)); return false; }
    fs.mkdirSync(outDir, { recursive: true });
    let n = 0;
    for (const u of uniq) {
      const ext = (u.match(/\.(png|jpg|jpeg|webp|gif)/i) || ['.png'])[0];
      const ok = await dl(u, path.join(outDir, 'out_' + n + ext));
      console.log(ok ? '✓ out_' + n + ext : '✗ ' + u); n++;
    }
    return true;
  }
  console.log('✗ 超时'); return false;
}

if (require.main === module) {
  const [wf, outDir, paramsFile] = process.argv.slice(2);
  if (!wf || !outDir || !paramsFile) { console.error('用法: node wf-meowa.js <workflow_id> <out_dir> <params.json>'); process.exit(1); }
  const params = JSON.parse(fs.readFileSync(paramsFile, 'utf8'));
  run(wf, outDir, params).then(ok => process.exit(ok ? 0 : 1));
}
module.exports = { run };
