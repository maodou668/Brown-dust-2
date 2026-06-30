// 将分散的 index.html + css + js 打包成单一自包含的 game.html
// 用法：node scripts/build.js          （加 --no-validate 跳过数值闸门，不建议）
// 构建前会先跑数值校验闸门：任何带数值内容越界则中止构建（未来加角色/道具的硬保障）。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// —— 数值闸门 ——
if (!process.argv.includes('--no-validate')) {
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'balance-validate.js'), '--quiet'], { stdio: 'inherit' });
  } catch (e) {
    console.error('\n⛔ 数值校验未通过，已中止构建。修正越界内容后重试（或 --no-validate 强制构建，不建议）。');
    process.exit(1);
  }
}

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const jsFiles = ['audio.js', 'data.js', 'balance.js', 'budget.js', 'lore.js', 'gear.js', 'costumes.js', 'game.js', 'battle.js', 'ui.js', 'story.js', 'comic.js', 'world.js', 'main.js'];
const js = jsFiles.map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n\n');

// 兼容资源引用上的 ?v= 版本号查询串
// 内联进根目录的 game.html 时, CSS 里相对 css/ 目录的 '../' 资源路径需改回相对根
const cssInline = css.replace(/url\((['"]?)\.\.\//g, 'url($1');
html = html.replace(/<link rel="stylesheet" href="css\/style\.css[^"]*">/, '<style>\n' + cssInline + '\n</style>');
html = html.replace(/\s*<script src="js\/[^"]+"><\/script>/g, '');
html = html.replace(/<\/body>/, '<script>\n' + js + '\n</script>\n</body>');

fs.writeFileSync(path.join(root, 'game.html'), html);
console.log('已生成 game.html，大小', (html.length / 1024).toFixed(1), 'KB');
