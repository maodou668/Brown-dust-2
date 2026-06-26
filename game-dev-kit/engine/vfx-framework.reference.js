// ============================================================
//  VFX 动画/逻辑「握手」框架 —— 参考实现（从 BattleUI 抽取）
//  这是 game.html 战斗控制器 BattleUI 的特效相关方法，整段挪到你的
//  战斗 UI 对象里即可。它依赖以下「宿主钩子」，接新项目时对接这几个：
//    this.root           战斗根 DOM（含 .battle-field / .unit[data-uid]）
//    this.busy           输入锁；this.speed/this.d(ms) 倍速
//    this.refresh()      整屏重绘；this.nextTurn()  进入下一回合
//    Battle.*            战斗内核（combatants/executeSkill/onEvent/finished）
//    UI.el(html)         建 DOM 辅助；window.Sound.sfx(name)
//    Game.onceTip(id)    一次性教学（可选）
//  原则：逻辑瞬时算完且权威；伤害视觉缓存，等特效 impactFrame 再 flush。
//  素材：art/.../fx/<effect>/frame_NNN.png + manifest{fps,frames,anchor,impactFrame,scale}
// ============================================================

// --- 1) 特效层 + SKILL_VFX 注册 + 播放器（main.js 行 238-442）---

  // ============================================================
  //  技能特效层（VFX）——动画与逻辑「握手」
  //  原则：逻辑瞬时算完且权威；伤害的视觉表现（掉血/飘字）缓存起来，
  //        等特效时间线走到「命中帧(impactFrame)」再 flush 放出，做到画面与扣血同步。
  //  素材：逐帧 PNG + manifest（art/05_pixellab/fx/<effect>/frame_NNN.png + manifest.json）
  //        manifest: { fps, frames, anchor, impactFrame, scale }
  //  没有素材时自动用内置 canvas 程序化特效（六芒星 / 烈焰爆炸）兜底，先跑通握手。
  // ============================================================
  FX_BASE: 'art/05_pixellab/fx/',
  // 技能 → 演出时间线（castMs 施法收招、telegraphMs 六芒星预警时长、star 预警特效、burst 爆炸特效）
  SKILL_VFX: {
    inferno: { castMs: 380, telegraphMs: 460, star: 'hexstar', burst: 'fire_explosion', tint: '#ff6a2a' },
    cls_arcane: { castMs: 340, telegraphMs: 240, star: 'hexstar', burst: 'arcane_burst', tint: '#a06bff' },
  },
  fxCache: {},
  _fxEmitters: null, _fxRaf: 0, _fxDefer: null, _fxFlushed: false, _fxDone: false, _fxSafety: 0,

  /** 懒加载某特效的逐帧 PNG + manifest；返回 { ready, failed, man, frames } */
  loadFx(effect) {
    if (this.fxCache[effect]) return this.fxCache[effect];
    const V = window.ASSET_VER || '1', base = this.FX_BASE + effect;
    const rec = this.fxCache[effect] = { ready: false, failed: false, man: null, frames: [] };
    fetch(base + '/manifest.json?v=' + V).then(r => { if (!r.ok) throw 0; return r.json(); }).then(man => {
      rec.man = man; let loaded = 0; const n = man.frames || 0;
      if (!n) { rec.failed = true; return; }
      for (let i = 0; i < n; i++) {
        const im = new Image();
        im.onload = () => { if (++loaded >= n) rec.ready = true; };
        im.onerror = () => { rec.failed = true; };
        im.src = `${base}/frame_${String(i).padStart(3, '0')}.png?v=${V}`;
        rec.frames.push(im);
      }
    }).catch(() => { rec.failed = true; });
    return rec;
  },
  /** 在战斗开始时预热已登记技能的特效素材 */
  preloadSkillFx() {
    Object.values(this.SKILL_VFX).forEach(v => { if (v.star) this.loadFx(v.star); if (v.burst) this.loadFx(v.burst); });
  },

  /** 单位在战场层(.battle-field)中的像素坐标；anchor=feet 取底部中点，center 取胸口 */
  unitStagePos(uid, anchor) {
    const el = this.root && this.root.querySelector(`.unit[data-uid="${uid}"]`);
    const field = this.root && this.root.querySelector('.battle-field');
    if (!el || !field) return null;
    const r = el.getBoundingClientRect(), f = field.getBoundingClientRect();
    return { x: r.left - f.left + r.width / 2,
             y: anchor === 'feet' ? (r.bottom - f.top - 4) : (r.top - f.top + r.height * 0.44),
             w: r.width, h: r.height };
  },

  ensureFxLayer() {
    const field = this.root && this.root.querySelector('.battle-field');
    if (!field) return null;
    let cv = field.querySelector('#battle-fx');
    if (!cv) { cv = UI.el('<canvas id="battle-fx"></canvas>'); field.appendChild(cv); }
    return cv;
  },

  /** 投放一个特效实例。spec:{effect,x,y,anchor,base,tint,onImpact,onDone} */
  spawnFx(spec) {
    const rec = this.loadFx(spec.effect);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const em = {
      x: spec.x, y: spec.y, anchor: spec.anchor || 'center', tint: spec.tint,
      base: spec.base || 64, start: performance.now(), impacted: false,
      onImpact: spec.onImpact, onDone: spec.onDone, effect: spec.effect,
    };
    if (rec.ready && rec.frames.length) {
      em.mode = 'frames'; em.rec = rec;
      const fps = rec.man.fps || 20;
      em.durMs = (rec.man.frames / fps) * 1000 / (this.speed || 1);
      em.impactMs = ((rec.man.impactFrame != null ? rec.man.impactFrame : Math.floor(rec.man.frames * 0.4)) / fps) * 1000 / (this.speed || 1);
      em.scale = rec.man.scale || 1;
    } else {
      // 程序化兜底：按特效名选画法
      em.mode = 'proc'; em.proc = spec.effect.indexOf('star') >= 0 ? 'hexstar' : (spec.effect.indexOf('explos') >= 0 || spec.effect.indexOf('burst') >= 0 || spec.effect.indexOf('fire') >= 0 ? 'explosion' : 'spark');
      const base = em.proc === 'hexstar' ? 520 : 600;
      em.durMs = base / (this.speed || 1);
      em.impactMs = (em.proc === 'explosion' ? 175 : (em.proc === 'spark' ? 90 : 1e9)) / (this.speed || 1);
    }
    em.dpr = dpr;
    (this._fxEmitters || (this._fxEmitters = [])).push(em);
    this.startFxLoop();
    return em;
  },

  startFxLoop() {
    if (this._fxRaf) return;
    const cv = this.ensureFxLayer(); if (!cv) return;
    const loop = (now) => {
      const field = this.root && this.root.querySelector('.battle-field');
      if (!field || !this._fxEmitters || !this._fxEmitters.length) { this._fxRaf = 0; if (cv) { const c = cv.getContext('2d'); c && c.clearRect(0, 0, cv.width, cv.height); } return; }
      const W = field.clientWidth, H = field.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const keep = [];
      for (const em of this._fxEmitters) {
        const t = now - em.start, p = Math.min(1, t / em.durMs);
        // 命中帧：到点触发一次 onImpact（伤害 flush）
        if (!em.impacted && t >= em.impactMs) { em.impacted = true; em.onImpact && em.onImpact(); }
        try { if (em.mode === 'frames') this.drawFxFrame(ctx, em, p); else this.drawFxProc(ctx, em, p); }
        catch (err) { /* 单帧绘制异常不应中断整个特效循环 */ }
        if (p < 1) keep.push(em); else { em.onDone && em.onDone(); }
      }
      this._fxEmitters = keep;
      this._fxRaf = requestAnimationFrame(loop);
    };
    this._fxRaf = requestAnimationFrame(loop);
  },

  drawFxFrame(ctx, em, p) {
    const fr = em.rec.frames, idx = Math.min(fr.length - 1, Math.floor(p * fr.length)), im = fr[idx];
    if (!im || !im.width) return;
    const size = em.base * 2.0 * em.scale, dw = size, dh = size * (im.height / im.width || 1);
    const ox = em.x - dw / 2, oy = em.anchor === 'feet' ? em.y - dh : em.y - dh / 2;
    // 尾部淡出：最后 28% 渐隐到 0，确保不会自然消散的素材也能优雅收尾（不会硬切）
    const fade = p > 0.72 ? Math.max(0, (1 - p) / 0.28) : 1;
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = fade; ctx.drawImage(im, ox, oy, dw, dh); ctx.globalAlpha = 1;
  },

  // —— 程序化兜底特效（在真 PNG 到位前用来跑通握手）——
  drawFxProc(ctx, em, p) {
    const base = Math.max(24, em.base || 48);   // 防止单位 rect 为 0 导致半径异常
    ctx.save(); ctx.translate(em.x, em.y);
    if (em.proc === 'hexstar') {
      const R = base * 0.62, grow = Math.max(0.001, Math.min(1, p / 0.3)), fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      ctx.globalAlpha = 0.85 * fade; ctx.rotate(p * Math.PI * 0.6);
      ctx.strokeStyle = em.tint || '#ff7a2a'; ctx.lineWidth = 2.5; ctx.shadowColor = em.tint || '#ff7a2a'; ctx.shadowBlur = 12;
      // 外圈
      ctx.beginPath(); ctx.arc(0, 0, R * grow, 0, Math.PI * 2); ctx.stroke();
      // 两个交叠三角 → 六芒星
      for (let s = 0; s < 2; s++) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + s * Math.PI / 3 + i * 2 * Math.PI / 3; const px = Math.cos(a) * R * grow, py = Math.sin(a) * R * grow; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.stroke();
      }
    } else if (em.proc === 'explosion') {
      const R = Math.max(1, base * (0.3 + p * 1.15)), flash = p < 0.22 ? 1 : Math.max(0, 1 - (p - 0.22) / 0.6);
      // 中心闪光
      ctx.globalAlpha = flash; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, '#fff7e0'); g.addColorStop(0.35, em.tint || '#ff8a2a'); g.addColorStop(0.7, '#e0431a'); g.addColorStop(1, 'rgba(180,40,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      // 四散火星
      ctx.globalAlpha = Math.max(0, 1 - p); ctx.fillStyle = '#ffd27a';
      const shards = 10;
      for (let i = 0; i < shards; i++) { const a = i / shards * Math.PI * 2 + p; const d = R * (0.7 + 0.5 * p); const sr = Math.max(0.5, base * 0.06 * (1 - p)); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, sr, 0, Math.PI * 2); ctx.fill(); }
    } else { // spark
      const R = Math.max(1, base * (0.2 + p * 0.5)); ctx.globalAlpha = Math.max(0, 1 - p); ctx.fillStyle = em.tint || '#ffd27a';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  /** flush：把缓存的伤害类视觉事件一次性放出（命中帧调用） */
  flushFxDefer() {
    if (!this._fxDefer || this._fxFlushed) return;
    this._fxFlushed = true;
    const buf = this._fxDefer;
    buf.forEach(e => this.renderEvent(e));
  },

  /** 技能演出收尾：确保已 flush，刷新并进入下一回合 */
  finishSkill() {
    if (this._fxDone) return; this._fxDone = true;
    clearTimeout(this._fxSafety);
    this.flushFxDefer();
    this._fxDefer = null;
    this.refresh();
    this.busy = false;
    if (!Battle.finished) this.nextTurn();
  },

  /** 跑某技能的特效时间线：施法 → 脚下六芒星 → 居中爆炸（命中帧 flush 伤害）→ 收尾 */
  runSkillVfx(caster, skillId, vfx) {
    this._fxFlushed = false; this._fxDone = false;
    // 从缓存的伤害事件推断「被命中的敌人」，特效就打在它们身上
    const hits = [...new Set((this._fxDefer || []).filter(e => e.type === 'damage' && e.target && e.target.side === 'enemy' && !e.dot).map(e => e.target.uid))];
    if (!hits.length) {   // 非伤害技（治疗/护盾等）：无需爆炸演出，稍后直接 flush 收尾
      setTimeout(() => this.finishSkill(), this.d(280));
      return;
    }
    const castMs = this.d(vfx.castMs || 380), telMs = this.d(vfx.telegraphMs || 460);
    const onImpact = () => this.flushFxDefer();
    // 1) 施法收招后，敌人脚下浮现六芒星
    setTimeout(() => {
      hits.forEach(uid => { const p = this.unitStagePos(uid, 'feet'); if (p) this.spawnFx({ effect: vfx.star, x: p.x, y: p.y, anchor: 'feet', base: p.w, tint: vfx.tint }); });
    }, castMs);
    // 2) 预警后，居中爆炸；爆炸命中帧 flush 伤害；最后一个爆炸结束 → 收尾
    let done = 0;
    setTimeout(() => {
      if (window.Sound) Sound.sfx && Sound.sfx('skill');
      hits.forEach(uid => {
        const p = this.unitStagePos(uid, 'center');
        if (!p) { if (++done >= hits.length) this.finishSkill(); return; }
        this.spawnFx({ effect: vfx.burst, x: p.x, y: p.y, anchor: 'center', base: p.w, tint: vfx.tint,
          onImpact, onDone: () => { if (++done >= hits.length) this.finishSkill(); } });
      });
    }, castMs + telMs);
    // 安全兜底：万一某帧/回调没触发，强制 flush + 收尾，绝不卡住战斗
    this._fxSafety = setTimeout(() => { this.flushFxDefer(); this.finishSkill(); }, castMs + telMs + this.d(1800));
  },


// --- 2) execute() 接入：有 vfx 则缓存伤害、跑时间线（main.js 行 782-809）---
  execute(c, skillId, target) {
    if (this.busy) return;
    this.busy = true;
    this.clearTargets();
    this.clearSkillBar();
    this.selectedSkill = null;

    this._lunged = false;
    this.triggerCast(c.uid);          // 我方序列帧单位：行动时播放放招动画

    const vfx = this.SKILL_VFX[skillId];
    if (vfx) {
      // 有技能特效：逻辑瞬时算完，但伤害视觉缓存，等爆炸命中帧再 flush（动画与扣血同步）
      this._fxDefer = [];
      Battle.executeSkill(c, skillId, target);
      this.runSkillVfx(c, skillId, vfx);
    } else {
      // 无特效：原行为（伤害即时演出）
      Battle.executeSkill(c, skillId, target);
      setTimeout(() => {
        this.refresh();
        this.busy = false;
        if (!Battle.finished) this.nextTurn();
      }, this.d(700));
    }
  },

  // ---------- 事件（演出、伤害飘字、结算） ----------

// --- 3) handleEvent 拆「即时/可延迟」+ renderEvent（main.js 行 810-883）---
  // 可延迟到特效「命中帧」才播放的视觉事件（伤害掉血、反应、控制、破防、击退、治疗、结算）
  FX_DEFERRABLE: { damage: 1, heal: 1, knockback: 1, status: 1, enrage: 1, break: 1, reaction: 1, end: 1 },
  handleEvent(e) {
    if (!this.root) return;
    const S = window.Sound;
    // 即时事件：连携 / 战斗日志横幅 —— 不延迟（在施法时就该出现）
    if (e.type === 'combo') { this.updateCombo(); return; }
    if (e.type === 'comboUnleash') { this.screenShake && this.screenShake(); if (S) S.sfx && S.sfx('crit'); return; }
    if (e.type === 'log') {
      const logEl = this.root.querySelector('#battle-log');
      if (logEl) logEl.textContent = e.msg;
      const mt = e.msg.match(/使用「(.+?)」/);
      if (mt) { this.showSkillBanner(mt[1]); if (S) S.sfx('skill'); }
      return;
    }
    // 特效握手：技能演出期间，把伤害类视觉事件缓存，等爆炸「命中帧」一次性放出。
    // DoT（持续伤害）发生在回合结算阶段，不属于本次技能演出，照常即时播放。
    if (this._fxDefer && this.FX_DEFERRABLE[e.type] && !(e.type === 'damage' && e.dot)) {
      this._fxDefer.push(e);
      return;
    }
    this.renderEvent(e);
  },

  /** 真正把一个视觉事件画出来（即时或 flush 时调用） */
  renderEvent(e) {
    const S = window.Sound;
    if (e.type === 'damage') {
      if (e.dot) {
        this.floatText(e.target, e.amount, 'dot', false);
      } else {
        if (e.attacker && !this._lunged) { this.lunge(e.attacker); this._lunged = true; }
        this.impactFlash(e.target, false);
        if (e.crit) this.screenShake();
        this.floatText(e.target, e.amount, 'damage', e.crit);
        if (S) S.sfx(e.crit ? 'crit' : 'hit');
      }
      this.updateUnitDom(e.target);
    } else if (e.type === 'heal') {
      this.impactFlash(e.target, true);
      this.floatText(e.target, e.amount, 'heal', false);
      if (S) S.sfx('heal');
      this.updateUnitDom(e.target);
    } else if (e.type === 'knockback') {
      this.knockFloat(e.target, e.kind === 'collide' ? '💥 撞击!' : '↩ 击退!');
      if (S) S.sfx('knock');
    } else if (e.type === 'status') {
      const nm = { poison: '☠️中毒', burn: '🔥灼烧', stun: '💫眩晕', silence: '🔇沉默' }[e.status] || '';
      this.knockFloat(e.target, nm);
      if (S) S.sfx('status');
      this.updateUnitDom(e.target);
    } else if (e.type === 'enrage') {
      this.showSkillBanner('狂暴!');
      this.screenShake();
      if (S) S.sfx('enrage');
      this.updateUnitDom(e.target);
    } else if (e.type === 'break') {
      this.showSkillBanner('破防!');
      this.screenShake();
      if (S) S.sfx('crit');
      this.updateUnitDom(e.target);
    } else if (e.type === 'reaction') {
      this.showSkillBanner(`${e.icon} ${e.name}!`);
      if (e.amount > 0) this.floatText(e.target, e.amount, 'reaction', true);
      this.knockFloat(e.target, `${e.icon}${e.name}`);
      this.screenShake();
      if (S) S.sfx('crit');
      this.updateUnitDom(e.target);
      if (Game.onceTip('reaction')) setTimeout(() => UI.toast('⚡ 元素反应！用不同元素连续命中同一敌人即可引爆爆发——敌人头顶的印记图标就是下一次引爆的元素。'), 400);
    } else if (e.type === 'end') {
      setTimeout(() => this.showResult(e.result), 700);
    }
  },

