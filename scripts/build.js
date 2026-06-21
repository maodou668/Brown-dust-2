// 将分散的 index.html + css + js 打包成单一自包含的 game.html
// 用法：node scripts/build.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const jsFiles = ['data.js', 'lore.js', 'game.js', 'battle.js', 'ui.js', 'story.js', 'main.js'];
const js = jsFiles.map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n\n');

html = html.replace(/<link rel="stylesheet" href="css\/style.css">/, '<style>\n' + css + '\n</style>');
html = html.replace(/\s*<script src="js\/[a-z]+\.js"><\/script>/g, '');
html = html.replace(/<\/body>/, '<script>\n' + js + '\n</script>\n</body>');

fs.writeFileSync(path.join(root, 'game.html'), html);
console.log('已生成 game.html，大小', (html.length / 1024).toFixed(1), 'KB');
