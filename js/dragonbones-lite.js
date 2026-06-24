// ============================================================
//  DragonBones Lite —— 轻量 2D 骨骼运行时（Canvas2D）
//  支持 DragonBones 格式子集：骨骼层级 + 图片插槽 + 旋转/位移关键帧
//  （不含 mesh / IK / ffd；占位骨骼与「刚性部件」导出可直接播放）
//  浏览器：window.DBLite     Node：module.exports
// ============================================================
(function (global) {
  'use strict';

  // ---- 2D 仿射矩阵 {a,b,c,d,tx,ty} ----
  function mat(a, b, c, d, tx, ty) { return { a, b, c, d, tx, ty }; }
  function fromTransform(x, y, rotDeg, scX, scY) {
    const r = (rotDeg || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    return mat(cs * scX, sn * scX, -sn * scY, cs * scY, x || 0, y || 0);
  }
  function mul(p, l) {
    return mat(
      p.a * l.a + p.c * l.b,
      p.b * l.a + p.d * l.b,
      p.a * l.c + p.c * l.d,
      p.b * l.c + p.d * l.d,
      p.a * l.tx + p.c * l.ty + p.tx,
      p.b * l.tx + p.d * l.ty + p.ty
    );
  }

  // ---- 解析 ske + tex 为可播放的 armature 数据 ----
  function parse(ske, tex) {
    const arm = ske.armature[0];
    const frameRate = arm.frameRate || ske.frameRate || 24;
    const bones = arm.bone.map(b => ({
      name: b.name, parent: b.parent || null,
      x: (b.transform && b.transform.x) || 0,
      y: (b.transform && b.transform.y) || 0,
      skX: (b.transform && b.transform.skX) || 0,
      scX: (b.transform && b.transform.scX != null) ? b.transform.scX : 1,
      scY: (b.transform && b.transform.scY != null) ? b.transform.scY : 1,
    }));
    const boneIndex = {}; bones.forEach((b, i) => boneIndex[b.name] = i);
    // 插槽
    const slots = arm.slot.map(s => ({ name: s.name, parent: s.parent, z: s.z || 0 }));
    // 蒙皮：插槽 → 显示图片 + 锚点
    const skinSlots = {};
    (arm.skin[0].slot || []).forEach(ss => {
      const d = ss.display[0];
      skinSlots[ss.name] = {
        tex: d.name,
        ax: (d.transform && d.transform.x) || 0,   // 锚点（图片像素，相对左上）
        ay: (d.transform && d.transform.y) || 0,
        rot: (d.transform && d.transform.skX) || 0,
      };
    });
    // 图集子图
    const sub = {};
    (tex.SubTexture || []).forEach(t => { sub[t.name] = t; });
    // 动画
    const anims = {};
    (arm.animation || []).forEach(a => {
      anims[a.name] = {
        duration: a.duration || 1,
        loop: (a.playTimes === 0 || a.playTimes == null),
        bones: (a.bone || []).map(ba => ({
          name: ba.name,
          rotate: ba.rotateFrame || null,
          translate: ba.translateFrame || null,
        })),
      };
    });
    return { frameRate, bones, boneIndex, slots, skinSlots, sub, anims, imagePath: tex.imagePath };
  }

  // ---- 关键帧采样（ft：帧时间，已取模到 [0,total)）----
  function sampleFrames(frames, ft, fields) {
    const out = {}; fields.forEach(f => out[f] = 0);
    if (!frames || !frames.length) return out;
    let start = 0, i = 0;
    for (; i < frames.length; i++) {
      const d = frames[i].duration || 0;
      if (ft < start + d || i === frames.length - 1) break;
      start += d;
    }
    const f0 = frames[i], f1 = frames[(i + 1) % frames.length];
    const dur = f0.duration || 0;
    let t = dur > 0 ? (ft - start) / dur : 0;
    if (t < 0) t = 0; if (t > 1) t = 1;
    if (f0.tweenEasing === null || f0.tweenEasing === undefined) t = 0; // 步进
    fields.forEach(f => {
      const a = f0[f] || 0, b = f1[f] || 0;
      out[f] = a + (b - a) * t;
    });
    return out;
  }

  // ---- 播放器 ----
  function Player(data, atlasImage) {
    this.data = data;
    this.atlas = atlasImage;
    this.time = 0;
    this.anim = null;
    this.onceDone = false;
    this._sortedSlots = data.slots.slice().sort((s1, s2) => s1.z - s2.z);
  }
  Player.prototype.play = function (name) {
    if (!this.data.anims[name]) return false;
    this.anim = name; this.time = 0; this.onceDone = false; return true;
  };
  Player.prototype.update = function (dt) { this.time += dt; };
  Player.prototype._localOf = function (bone, animBones, ft) {
    let rx = 0, tx = 0, ty = 0;
    const ab = animBones && animBones[bone.name];
    if (ab) {
      if (ab.rotate) rx = sampleFrames(ab.rotate, ft, ['rotate']).rotate;
      if (ab.translate) { const s = sampleFrames(ab.translate, ft, ['x', 'y']); tx = s.x; ty = s.y; }
    }
    return fromTransform(bone.x + tx, bone.y + ty, bone.skX + rx, bone.scX, bone.scY);
  };
  Player.prototype._worldMats = function () {
    const d = this.data;
    const a = this.anim ? d.anims[this.anim] : null;
    let ft = 0;
    if (a) {
      const fr = a.duration;
      let frame = this.time * d.frameRate;
      if (a.loop) frame = ((frame % fr) + fr) % fr;
      else if (frame >= fr) { frame = fr - 0.0001; this.onceDone = true; }
      ft = frame;
    }
    const animBones = {};
    if (a) a.bones.forEach(b => animBones[b.name] = b);
    const world = {};
    d.bones.forEach(b => {
      const local = this._localOf(b, animBones, ft);
      world[b.name] = b.parent && world[b.parent] ? mul(world[b.parent], local) : local;
    });
    return world;
  };
  // 将骨骼绘制到 ctx；外部 ctx 已设好屏幕位置/缩放
  Player.prototype.draw = function (ctx) {
    const d = this.data, world = this._worldMats();
    for (const slot of this._sortedSlots) {
      const sk = d.skinSlots[slot.name]; if (!sk) continue;
      const st = d.sub[sk.tex]; if (!st) continue;
      const w = world[slot.parent]; if (!w) continue;
      ctx.save();
      ctx.transform(w.a, w.b, w.c, w.d, w.tx, w.ty);
      if (sk.rot) ctx.rotate(sk.rot * Math.PI / 180);
      ctx.drawImage(this.atlas, st.x, st.y, st.width, st.height, -sk.ax, -sk.ay, st.width, st.height);
      ctx.restore();
    }
  };

  const DBLite = { parse, Player, fromTransform, mul };
  if (typeof module !== 'undefined' && module.exports) module.exports = DBLite;
  else global.DBLite = DBLite;
})(typeof window !== 'undefined' ? window : globalThis);
