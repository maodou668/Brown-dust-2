#!/usr/bin/env node
/**
 * Meowa /api/animate —— 给单张角色图生成动画（待机/行走/技能等）。
 * 用法：MEOWA_API_KEY=xxx node scripts/anim-meowa.js <src.png> <out.gif> "<prompt>" [animation_type] [frames]
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
function findUrl(o, dep, ext) {
  if (!o || dep > 8) return null;
  if (typeof o === 'string') { return new RegExp('^https?://\\S+\\.(' + ext + ')', 'i').test(o) ? o : null; }
  if (Array.isArray(o)) { for (const x of o) { const r = findUrl(x, dep + 1, ext); if (r) return r; } }
  else if (typeof o === 'object') { for (const k in o) { const r = findUrl(o[k], dep + 1, ext); if (r) return r; } }
  return null;
}

async function animate(src, out, prompt, type, frames) {
  const b64 = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');
  const body = { image: b64, prompt, animation_type: type || 'idle', output_frames: frames || 8, output_format: 'gif' };
  const sub = await req('POST', BASE + '/api/animate', body);
  let job; try { const j = JSON.parse(sub.b); job = j.api_job_id || j.job_id || j.id; } catch (e) {}
  if (!job) { console.log('提交失败:', sub.b.slice(0, 300)); return false; }
  console.log('job', job);
  for (let i = 0; i < 80; i++) {
    await sleep(4000);
    const r = await req('GET', BASE + '/api/jobs/' + job);
    let j; try { j = JSON.parse(r.b); } catch (e) { continue; }
    if (['pending', 'queued', 'running', 'processing'].includes(j.status)) continue;
    if (['failure', 'error', 'failed'].includes(j.status)) { console.log('✗ 失败:', JSON.stringify(j).slice(0, 300)); return false; }
    // 优先取动画输出（透明 gif），不要误取 source_static
    const out2 = j.output || {};
    const tu = out2.transparent_output_urls || {};
    const url = tu.gif || tu.webp || out2.url || findUrl(j, 0, 'gif|webp|mp4');
    if (url) { fs.mkdirSync(path.dirname(out), { recursive: true }); const ok = await dl(url, out); console.log(ok ? '✓ ' + out : '✗ 下载失败 ' + url); return ok; }
    console.log('无输出:', JSON.stringify(j).slice(0, 300)); return false;
  }
  console.log('✗ 超时'); return false;
}

if (require.main === module) {
  const [src, out, prompt, type, frames] = process.argv.slice(2);
  if (!src || !out || !prompt) { console.error('用法: node anim-meowa.js <src.png> <out.gif> "<prompt>" [type] [frames]'); process.exit(1); }
  animate(src, out, prompt, type, frames ? +frames : 8).then(ok => process.exit(ok ? 0 : 1));
}
module.exports = { animate };
