// ============================================================
//  Rig —— 轻量 2D 剪纸骨骼运行时（Canvas2D）
//  吃 rig-build.js 产出的 {bones, parts(挂 bone) , atlas}。
//  bone: {name,parent,rest:[x,y]}  pose: boneName->{rot(度),tx,ty,sx,sy}
//  浏览器：window.Rig    Node：module.exports
// ============================================================
(function (global) {
  'use strict';
  function mat(a, b, c, d, tx, ty) { return { a, b, c, d, tx, ty }; }
  function fromTRS(x, y, rotDeg, sx, sy) {
    const r = (rotDeg || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    sx = sx == null ? 1 : sx; sy = sy == null ? 1 : sy;
    return mat(cs * sx, sn * sx, -sn * sy, cs * sy, x || 0, y || 0);
  }
  function mul(p, l) {
    return mat(
      p.a * l.a + p.c * l.b, p.b * l.a + p.d * l.b,
      p.a * l.c + p.c * l.d, p.b * l.c + p.d * l.d,
      p.a * l.tx + p.c * l.ty + p.tx, p.b * l.tx + p.d * l.ty + p.ty);
  }

  function Rig(data, atlasImg) {
    this.data = data; this.atlas = atlasImg;
    this.boneMap = {}; data.bones.forEach(b => this.boneMap[b.name] = b);
    this.parts = data.parts.slice().sort((a, b) => a.z - b.z);
    this.pose = {};
  }
  Rig.prototype.setPose = function (p) { this.pose = p || {}; };
  Rig.prototype.world = function () {
    const w = {};
    for (const b of this.data.bones) {
      const ps = this.pose[b.name] || {};
      const local = fromTRS(b.rest[0] + (ps.tx || 0), b.rest[1] + (ps.ty || 0), ps.rot || 0, ps.sx, ps.sy);
      w[b.name] = (b.parent && w[b.parent]) ? mul(w[b.parent], local) : local;
    }
    return w;
  };
  // ctx 已设好屏幕变换(把源图坐标映射到目标位置)
  Rig.prototype.draw = function (ctx) {
    const w = this.world();
    for (const p of this.parts) {
      const m = w[p.bone]; if (!m) continue;
      ctx.save();
      ctx.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
      ctx.drawImage(this.atlas, p.atlas.x, p.atlas.y, p.atlas.w, p.atlas.h, p.off[0], p.off[1], p.atlas.w, p.atlas.h);
      ctx.restore();
    }
  };
  // 工具：把两个 pose 线性插值（关键帧用）
  Rig.lerpPose = function (A, B, t, boneNames) {
    const out = {};
    for (const n of boneNames) {
      const a = A[n] || {}, b = B[n] || {};
      out[n] = {
        rot: (a.rot || 0) + ((b.rot || 0) - (a.rot || 0)) * t,
        tx: (a.tx || 0) + ((b.tx || 0) - (a.tx || 0)) * t,
        ty: (a.ty || 0) + ((b.ty || 0) - (a.ty || 0)) * t,
        sx: (a.sx == null ? 1 : a.sx) + ((b.sx == null ? 1 : b.sx) - (a.sx == null ? 1 : a.sx)) * t,
        sy: (a.sy == null ? 1 : a.sy) + ((b.sy == null ? 1 : b.sy) - (a.sy == null ? 1 : a.sy)) * t,
      };
    }
    return out;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Rig;
  else global.Rig = Rig;
})(typeof window !== 'undefined' ? window : globalThis);
