// 视频 → 透明序列帧精灵图（sprite sheet）
// 流程：ffmpeg 抽帧 → 抠背景(绿幕/白底)转透明 → 统一裁边 → 横向拼成精灵图 + meta.json
// 用法：node scripts/video-to-sheet.js <video> <outName> [--fps=15] [--key=green|white|RRGGBB] [--tol=0.32] [--max=24] [--outdir=art/02_video]
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const args = process.argv.slice(2);
const [video, outName] = args.filter(a => !a.startsWith('--'));
const opt = {};
args.filter(a => a.startsWith('--')).forEach(a => { const [k, v] = a.slice(2).split('='); opt[k] = v == null ? true : v; });
if (!video || !outName) { console.error('用法: node scripts/video-to-sheet.js <video> <outName> [--fps=15] [--key=green|white|RRGGBB] [--tol=0.32] [--max=24]'); process.exit(1); }

const FPS = parseInt(opt.fps || '15', 10);
const KEY = (opt.key || 'green').toLowerCase();
const TOL = parseFloat(opt.tol || '0.32');
const MAX = parseInt(opt.max || '24', 10);
const OUTDIR = path.resolve(__dirname, '..', opt.outdir || 'art/02_video');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
fs.mkdirSync(OUTDIR, { recursive: true });

// 1) 抽帧
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vframes-'));
execFileSync(FFMPEG, ['-y', '-i', video, '-vf', `fps=${FPS}`, '-frames:v', String(MAX), path.join(tmp, 'f%03d.png')], { stdio: 'ignore' });
let files = fs.readdirSync(tmp).filter(f => f.endsWith('.png')).sort();
if (!files.length) { console.error('✗ 未抽到帧'); process.exit(1); }
console.log('抽帧', files.length, '张 @', FPS, 'fps');

// 2) 抠背景：返回 alpha(0..1)；绿幕含去溢色(despill)
function keyer(r, g, b) {
  if (KEY === 'white') { const m = Math.min(r, g, b); return m > 238 ? 0 : (m > 215 ? (238 - m) / 23 : 1); }
  if (KEY === 'green') {
    // 绿占主导即背景
    const domin = g - Math.max(r, b);
    if (g > 90 && domin > 60) return 0;
    if (g > 80 && domin > 20) return Math.max(0, 1 - (domin - 20) / 40 * (1 - TOL));
    return 1;
  }
  // 指定色：欧氏距离
  const kr = parseInt(KEY.slice(0, 2), 16), kg = parseInt(KEY.slice(2, 4), 16), kb = parseInt(KEY.slice(4, 6), 16);
  const d = Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) / 441;
  return d < TOL ? 0 : (d < TOL * 1.5 ? (d - TOL) / (TOL * 0.5) : 1);
}
function despill(r, g, b) { if (KEY === 'green' && g > r && g > b) { const c = (r + b) / 2; if (g > c) g = c + (g - c) * 0.25; } return [r, g, b]; }

// 处理每帧 → 带 alpha 的 canvas，并求并集 bbox
const frames = [];
let X0 = 1e9, Y0 = 1e9, X1 = 0, Y1 = 0, W = 0, H = 0;
(async () => {
  for (const f of files) {
    const img = await loadImage(path.join(tmp, f));
    W = img.width; H = img.height;
    const c = createCanvas(W, H), x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const im = x.getImageData(0, 0, W, H), D = im.data;
    for (let p = 0; p < D.length; p += 4) {
      const a = keyer(D[p], D[p + 1], D[p + 2]);
      if (a <= 0) { D[p + 3] = 0; continue; }
      const [r, g, b] = despill(D[p], D[p + 1], D[p + 2]); D[p] = r; D[p + 1] = g; D[p + 2] = b;
      D[p + 3] = Math.round(D[p + 3] * a);
    }
    x.putImageData(im, 0, 0);
    // bbox
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { if (D[(yy * W + xx) * 4 + 3] > 16) { if (xx < X0) X0 = xx; if (xx > X1) X1 = xx; if (yy < Y0) Y0 = yy; if (yy > Y1) Y1 = yy; } }
    frames.push(c);
  }
  // 3) 裁边 + 拼图（横向一排）
  const pad = 2;
  const fw = Math.min(W, X1 - X0 + 1 + pad * 2), fh = Math.min(H, Y1 - Y0 + 1 + pad * 2);
  const cx0 = Math.max(0, X0 - pad), cy0 = Math.max(0, Y0 - pad);
  const sheet = createCanvas(fw * frames.length, fh), sc = sheet.getContext('2d');
  frames.forEach((c, i) => sc.drawImage(c, cx0, cy0, fw, fh, i * fw, 0, fw, fh));
  fs.writeFileSync(path.join(OUTDIR, outName + '_sheet.png'), sheet.toBuffer('image/png'));
  fs.writeFileSync(path.join(OUTDIR, outName + '.json'), JSON.stringify({ name: outName, frames: frames.length, fw, fh, fps: FPS, loop: true }, null, 2));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓', outName + '_sheet.png', `${frames.length} 帧 ${fw}x${fh} → 图 ${fw * frames.length}x${fh}`);
})();
