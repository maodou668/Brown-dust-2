// PixelLab MCP 客户端（经 curl 走代理，绕开 node fetch 的代理问题）
// 用法:
//   node scripts/pixellab.js list                         列出工具
//   node scripts/pixellab.js call <tool> '<jsonArgs>'     调用工具
//   node scripts/pixellab.js raw <method> '<jsonParams>'  原始 JSON-RPC
const { execFileSync } = require('child_process');
const ENDPOINT = 'https://api.pixellab.ai/mcp';
const TOKEN = process.env.PIXELLAB_TOKEN || 'a166e207-7c0d-452e-aae2-f87371b47768';

function rpc(method, params, id) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: id || 1, method, params });
  const args = ['-sS', '-X', 'POST', ENDPOINT,
    '-H', 'Authorization: Bearer ' + TOKEN,
    '-H', 'Content-Type: application/json',
    '-H', 'Accept: application/json, text/event-stream',
    '--max-time', '120', '-d', body];
  const out = execFileSync('curl', args, { maxBuffer: 64 * 1024 * 1024 }).toString();
  // 解析 SSE：取所有 data: 行，找带 id 的 JSON-RPC 响应
  const datas = out.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim());
  for (const d of datas) {
    try { const j = JSON.parse(d); if (j.jsonrpc) return j; } catch (e) {}
  }
  // 非 SSE：直接当 JSON
  try { return JSON.parse(out); } catch (e) { return { raw: out }; }
}

// 完整握手 + 调用
function session(method, params) {
  rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'maodou', version: '1.0' } }, 1);
  // initialized 通知（无 id）
  try {
    execFileSync('curl', ['-sS', '-X', 'POST', ENDPOINT, '-H', 'Authorization: Bearer ' + TOKEN,
      '-H', 'Content-Type: application/json', '-H', 'Accept: application/json, text/event-stream',
      '--max-time', '30', '-d', JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })], { maxBuffer: 1 << 20 });
  } catch (e) {}
  return rpc(method, params, 2);
}

const [, , cmd, a, b] = process.argv;
let res;
if (cmd === 'list') res = session('tools/list', {});
else if (cmd === 'call') res = session('tools/call', { name: a, arguments: JSON.parse(b || '{}') });
else if (cmd === 'raw') res = session(a, JSON.parse(b || '{}'));
else { console.error('usage: list | call <tool> <json> | raw <method> <json>'); process.exit(1); }
console.log(JSON.stringify(res, null, 2));
