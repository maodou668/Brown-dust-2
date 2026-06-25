// ============================================================
//  SpriteActor —— 单张静态精灵的"代码驱动"动效（零 AI / 零序列帧）
//  用整体变换(位移/缩放/旋转/挤压拉伸)+ 高光/受击染色，让一张定妆图"活"起来。
//  浏览器：window.SpriteActor    Node：module.exports
// ============================================================
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const easeOut = t => 1 - (1 - t) * (1 - t);
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  // 各动作：返回姿态 {dx,dy(占身高比例), sx,sy, rot, flash(白光0..1), hit(受击红0..1)}
  const ANIMS = {
    idle: { dur: 2.0, loop: true, pose(t) { const p = (t / 2.0) * TAU; return { dy: Math.sin(p) * -0.012, sx: 1 - Math.sin(p) * 0.013, sy: 1 + Math.sin(p) * 0.020 }; } },
    walk: { dur: 0.5, loop: true, pose(t) { const p = (t / 0.5) * TAU; return { dy: -Math.abs(Math.sin(p)) * 0.045, rot: Math.sin(p) * 0.05, sx: 1 + Math.cos(p * 2) * 0.02, sy: 1 - Math.cos(p * 2) * 0.02 }; } },
    run: { dur: 0.34, loop: true, pose(t) { const p = (t / 0.34) * TAU; return { dy: -Math.abs(Math.sin(p)) * 0.075, rot: Math.sin(p) * 0.08 + 0.04, sx: 1 + Math.cos(p * 2) * 0.03, sy: 1 - Math.cos(p * 2) * 0.03 }; } },
    attack: {
      dur: 0.5, loop: false, pose(t) {
        const k = t / 0.5;
        if (k < 0.28) { const a = easeOut(k / 0.28); return { dx: -0.045 * a, dy: 0.015 * a, sx: 1 + 0.05 * a, sy: 1 - 0.07 * a, rot: -0.07 * a }; }
        if (k < 0.5) { const a = easeOut((k - 0.28) / 0.22); return { dx: lerp(-0.045, 0.11, a), dy: lerp(0.015, -0.05, a), sx: 1 + 0.09 * (1 - a) * a * 4, sy: 1 - 0.03, rot: lerp(-0.07, 0.06, a), flash: a > 0.55 ? (a - 0.55) / 0.45 * 0.5 : 0 }; }
        const a = easeInOut((k - 0.5) / 0.5); return { dx: 0.11 * (1 - a), dy: -0.05 * (1 - a), rot: 0.06 * (1 - a) };
      }
    },
    skill: {
      dur: 1.2, loop: false, pose(t) {
        const k = t / 1.2;
        if (k < 0.42) { const a = easeInOut(k / 0.42); return { dy: 0.03 * a, sy: 1 - 0.08 * a, sx: 1 + 0.05 * a, flash: a * 0.25 + Math.sin(k * 40) * 0.05 }; }    // 蓄力下蹲微光
        if (k < 0.62) { const a = easeOut((k - 0.42) / 0.2); return { dy: lerp(0.03, -0.06, a), sy: lerp(0.92, 1.06, a), sx: lerp(1.05, 0.96, a), flash: lerp(0.2, 0.6, a) }; }  // 释放上拔+爆闪
        const a = easeInOut((k - 0.62) / 0.38); return { dy: -0.06 * (1 - a), flash: 0.6 * (1 - a) };
      }
    },
    hit: {
      dur: 0.42, loop: false, pose(t) {
        const k = t / 0.42;
        if (k < 0.22) { const a = easeOut(k / 0.22); return { dx: -0.05 * a, rot: 0.08 * a, sy: 1 - 0.04 * a, hit: a }; }
        const a = (k - 0.22) / 0.78; const sh = Math.sin(a * 34) * 0.02 * (1 - a);
        return { dx: -0.05 * (1 - a) + sh, rot: 0.08 * (1 - a), hit: (1 - a) * 0.6 };
      }
    },
    victory: { dur: 1.6, loop: true, pose(t) { const p = (t / 1.6) * TAU; return { dy: Math.abs(Math.sin(p)) * -0.03 - 0.005, rot: Math.sin(p * 0.5) * 0.04, sy: 1 + Math.sin(p) * 0.02 }; } },
  };

  function silhouette(img, color) {
    const w = img.width, h = img.height;
    const c = (typeof document !== 'undefined') ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : global.__mkCanvas(w, h);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    return c;
  }

  function SpriteActor(img, opts) {
    opts = opts || {};
    this.img = img;
    this.white = silhouette(img, '#ffffff');
    this.red = silhouette(img, '#ff3a3a');
    this.t = 0; this.anim = 'idle'; this.done = false;
    this.faceFlip = false;   // 朝左时水平镜像
  }
  SpriteActor.prototype.play = function (name) { if (!ANIMS[name]) return false; this.anim = name; this.t = 0; this.done = false; return true; };
  SpriteActor.prototype.update = function (dt) {
    const A = ANIMS[this.anim]; this.t += dt;
    if (!A.loop && this.t >= A.dur) { this.t = A.dur; this.done = true; }
  };
  SpriteActor.prototype.pose = function () {
    const A = ANIMS[this.anim]; const tt = A.loop ? (this.t % A.dur) : Math.min(this.t, A.dur);
    return A.pose(tt) || {};
  };
  // footX,footY = 脚底中心；targetH = 期望身高(px)
  SpriteActor.prototype.draw = function (ctx, footX, footY, targetH) {
    const p = this.pose();
    const s = targetH / this.img.height, w = this.img.width * s, h = targetH;
    const flip = this.faceFlip ? -1 : 1;
    ctx.save();
    ctx.translate(footX + (p.dx || 0) * h * flip, footY + (p.dy || 0) * h);
    ctx.rotate((p.rot || 0) * flip);
    ctx.scale((p.sx || 1) * flip, p.sy || 1);
    ctx.drawImage(this.img, -w / 2, -h, w, h);
    if (p.flash) { ctx.globalAlpha = p.flash; ctx.drawImage(this.white, -w / 2, -h, w, h); ctx.globalAlpha = 1; }
    if (p.hit) { ctx.globalAlpha = p.hit; ctx.drawImage(this.red, -w / 2, -h, w, h); ctx.globalAlpha = 1; }
    ctx.restore();
  };
  // 接地阴影（随起跳/蹲伏缩放），在 draw 前调用
  SpriteActor.prototype.drawShadow = function (ctx, footX, footY, targetH) {
    const p = this.pose();
    const lift = 1 + (p.dy || 0) * 2.2;             // 越高阴影越小越淡
    const rw = targetH * 0.22 * (p.sx || 1) * Math.max(0.4, lift);
    ctx.save(); ctx.translate(footX, footY); ctx.scale(1, 0.3);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
    g.addColorStop(0, 'rgba(0,0,0,' + (0.42 * Math.max(0.3, lift)) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rw, 0, TAU); ctx.fill(); ctx.restore();
  };
  SpriteActor.ANIMS = ANIMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SpriteActor;
  else global.SpriteActor = SpriteActor;
})(typeof window !== 'undefined' ? window : globalThis);
