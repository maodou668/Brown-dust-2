# 字体

`zpix-subset.woff2` —— Zpix（最像素）中文像素字体，已按游戏当前用字子集化（~68KB）。
全局通过 css/style.css 的 @font-face 应用（font-family: 'Zpix'）。

## 何时需要重新子集化
游戏新增了之前没出现过的汉字时（新角色名/剧情文案），需重生成，否则新字会回退到系统字体。

## 重新生成
```
curl -L https://github.com/SolidZORO/zpix-pixel-font/releases/download/v3.1.11/zpix.ttf -o /tmp/zpix.ttf
# 收集 js/*.js + index.html 里所有用字 → /tmp/glyphs.txt (见 scripts 历史)，然后：
pyftsubset /tmp/zpix.ttf --text-file=/tmp/glyphs.txt --flavor=woff2 \
  --output-file=assets/fonts/zpix-subset.woff2 --layout-features='*' --no-hinting
```
(需 `pip install fonttools brotli`)
