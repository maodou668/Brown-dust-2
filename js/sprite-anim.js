// ============================================================
//  SpriteAnim —— 轻量序列帧播放器（视频路线）
//  吃 video-to-sheet.js 产出的 横向精灵图 + meta.json
//  浏览器：window.SpriteAnim    Node：module.exports
// ============================================================
(function (global) {
  'use strict';
  function SpriteAnim(image, meta) {
    this.img = image; this.meta = meta;
    this.t = 0; this.frame = 0; this.speed = 1; this.done = false;
  }
  SpriteAnim.prototype.reset = function () { this.t = 0; this.frame = 0; this.done = false; };
  SpriteAnim.prototype.update = function (dt) {
    this.t += dt * this.speed;
    const m = this.meta, f = Math.floor(this.t * m.fps);
    if (m.loop) this.frame = ((f % m.frames) + m.frames) % m.frames;
    else { if (f >= m.frames - 1) { this.frame = m.frames - 1; this.done = true; } else this.frame = f; }
  };
  // 以 (x,y) 为脚底中心绘制；scale 缩放
  SpriteAnim.prototype.draw = function (ctx, x, y, scale) {
    const m = this.meta, fw = m.fw, fh = m.fh, s = scale || 1;
    ctx.drawImage(this.img, this.frame * fw, 0, fw, fh, x - fw * s / 2, y - fh * s, fw * s, fh * s);
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SpriteAnim;
  else global.SpriteAnim = SpriteAnim;
})(typeof window !== 'undefined' ? window : globalThis);
