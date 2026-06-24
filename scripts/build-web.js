// 组装原生 App 用的 web 资源目录 www/（Capacitor 的 webDir）
// 只拷贝运行所需文件，不含 node_modules / 原生工程
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(root, src), dst);
}
function copyDir(dir) {
  const abs = path.join(root, dir);
  for (const name of fs.readdirSync(abs)) {
    const rel = path.join(dir, name);
    const st = fs.statSync(path.join(root, rel));
    if (st.isDirectory()) copyDir(rel);
    else copyFile(rel, path.join(out, rel));
  }
}

rmrf(out);
fs.mkdirSync(out, { recursive: true });

// 入口与清单
['index.html', 'manifest.webmanifest'].forEach(f => copyFile(f, path.join(out, f)));
// 资源目录
['css', 'js', 'icons'].forEach(d => { if (fs.existsSync(path.join(root, d))) copyDir(d); });

console.log('已生成 www/（原生 App web 资源）');
console.log('文件数：', countFiles(out));

function countFiles(p) {
  let n = 0;
  for (const name of fs.readdirSync(p)) {
    const st = fs.statSync(path.join(p, name));
    n += st.isDirectory() ? countFiles(path.join(p, name)) : 1;
  }
  return n;
}
