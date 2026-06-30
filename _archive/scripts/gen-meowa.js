#!/usr/bin/env node
/**
 * Meowa 原生 Gemini 出图（Nano Banana 2）—— 立绘/插画用，自由控制姿势与画风。
 * 用法：MEOWA_API_KEY=xxx node scripts/gen-meowa.js "<prompt>" <out.png> [refImage1,refImage2]
 * 安全：key 仅从环境变量读取，绝不写入文件/仓库。
 */
const fs = require('fs'), path = require('path'), https = require('https');
const KEY = process.env.MEOWA_API_KEY;
if (!KEY) { console.error('✗ 缺少 MEOWA_API_KEY'); process.exit(1); }
const BASE = 'https://api.meowa.ai';

function req(method, url, body, raw) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const data = body ? (raw ? body : JSON.stringify(body)) : null;
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
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'Authorization': 'Bearer ' + KEY }, timeout: 60000 }, x => {
      if (x.statusCode !== 200) { x.resume(); return resolve(false); }
      const ch = []; x.on('data', c => ch.push(c)); x.on('end', () => { fs.writeFileSync(file, Buffer.concat(ch)); resolve(true); });
    }).on('error', () => resolve(false));
  });
}
const sleep = ms => new Promise(s => setTimeout(s, ms));
function findImg(o, dep) {
  if (!o || dep > 8) return null;
  if (typeof o === 'string') {
    if (/^https?:\/\/\S+\.(png|jpg|jpeg|webp)/i.test(o)) return { url: o };
    if (o.length > 800 && /^[A-Za-z0-9+/=]+$/.test(o.slice(0, 80))) return { b64: o };
    return null;
  }
  if (Array.isArray(o)) { for (const x of o) { const r = findImg(x, dep + 1); if (r) return r; } }
  else if (typeof o === 'object') { for (const k in o) { const r = findImg(o[k], dep + 1); if (r) return r; } }
  return null;
}

async function genImage(prompt, outPath, refs) {
  const parts = [{ text: prompt }];
  for (const rf of (refs || [])) {
    const b64 = fs.readFileSync(rf).toString('base64');
    parts.push({ inline_data: { mime_type: 'image/png', data: b64 } });
  }
  const body = { model: 'gemini-3.1-flash-image-preview', requestBody: { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'] } } };
  const sub = await req('POST', BASE + '/api/gemini/jobs', body);
  let job; try { job = JSON.parse(sub.b).api_job_id; } catch (e) {}
  if (!job) { console.log('提交失败:', sub.b.slice(0, 200)); return false; }
  for (let i = 0; i < 50; i++) {
    await sleep(3500);
    const r = await req('GET', BASE + '/api/jobs/' + job);
    let j; try { j = JSON.parse(r.b); } catch (e) { continue; }
    if (['queued', 'running', 'processing'].includes(j.status)) continue;
    if (j.status === 'failure' || j.status === 'error' || j.status === 'failed') { console.log('✗ 失败:', (j.error || '').slice(0, 200)); return false; }
    const img = findImg(j, 0);
    if (img && img.b64) { fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, Buffer.from(img.b64, 'base64')); console.log('✓', outPath); return true; }
    if (img && img.url) { fs.mkdirSync(path.dirname(outPath), { recursive: true }); const ok = await dl(img.url, outPath); console.log(ok ? '✓ ' + outPath : '✗ 下载失败'); return ok; }
    console.log('无图:', JSON.stringify(j).slice(0, 200)); return false;
  }
  console.log('✗ 超时'); return false;
}

if (require.main === module) {
  const [prompt, out, refsArg] = process.argv.slice(2);
  if (!prompt || !out) { console.error('用法: node gen-meowa.js "<prompt>" <out.png> [ref1,ref2]'); process.exit(1); }
  genImage(prompt, out, refsArg ? refsArg.split(',') : []).then(ok => process.exit(ok ? 0 : 1));
}
module.exports = { genImage };
