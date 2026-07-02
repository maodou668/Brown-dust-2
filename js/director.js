// ============================================================
//  Director —— 剧情演出导演器（圣经 v2 §5 / 说明书剧情演出章）
//  执行剧本 DSL：一段剧情 = op 序列，跨五个演出层自由混排：
//    adv(对白) / scene(场景演出) / battle(战斗+插话) / comic(条漫) / (cg 走 adv 的 beat)
//  剧本数据在 js/story2.js 的 window.SCRIPTS。
// ============================================================

const Director = {
  running: false,

  seen(id) { return Story.seen(id); },

  async play(id, onDone) {
    const script = (window.SCRIPTS || {})[id];
    if (!script || !script.length) { if (onDone) onDone(); return; }
    this.running = true;
    for (const op of script) {
      if (!this.running) break;
      await this.exec(op);
    }
    this.running = false;
    Story.markSeen(id);
    if (onDone) onDone();
  },

  stop() { this.running = false; },

  exec(op) {
    return new Promise(res => {
      switch (op.op) {
        case 'adv':    Story.playBeats(op.beats, res); break;
        case 'scene':  SceneStage.run(op, res); break;
        case 'comic':  Comic.openEp(op.ep, res); break;
        case 'battle': this.runBattle(op, res); break;
        case 'wait':   setTimeout(res, op.ms || 500); break;
        default: console.warn('Director: 未知 op', op.op); res();
      }
    });
  },

  /** 战斗（输了自动重开，直到打赢才推进剧情） */
  runBattle(op, done) {
    const go = () => {
      BattleUI.start(op.stage, () => {
        if (Battle.result === 'win') done();
        else { UI.toast('再试一次。灯还没灭。'); setTimeout(go, 600); }
      });
    };
    go();
  },

  /** 剧情 flag（choice 写入；跨 op / 跨章可查） */
  setFlag(k, v) {
    Game.state.storyFlags = Game.state.storyFlags || {};
    Game.state.storyFlags[k] = v === undefined ? true : v;
    Game.save();
  },
  flag(k) { return (Game.state.storyFlags || {})[k]; },
};

// ============================================================
//  SceneStage —— 场景演出层：地图小人走位/转向/对话泡/低语/镜头
//  actor 用 field sprite（与战斗/大世界同一套资源）。
//  cfg = { bg, night, actors:{id:{sprite,x,y,dir}}, steps:[...] }
//  step: {t:'move',who,to:[x,y],dur} {t:'face',who,dir} {t:'wait',ms}
//        {t:'say',who,text} {t:'whisper',who} {t:'narr',text}
//        {t:'camera',scale,x,y,dur} {t:'hide',who} {t:'show',who}
// ============================================================
const SceneStage = {
  root: null, actors: {}, _raf: 0, camera: { scale: 1, x: 50, y: 50 },

  async run(cfg, onDone) {
    if (cfg.stage) { await Diorama.run(cfg, onDone); return; }   // v2 立体舞台
    this.build(cfg);
    await this.loadSprites(cfg);
    this.placeActors(cfg);
    this._raf = requestAnimationFrame(t => this.tick(t));
    for (const step of cfg.steps || []) await this.step(step);
    this.destroy();
    if (onDone) setTimeout(onDone, 250);
  },

  build(cfg) {
    const old = document.getElementById('scene-stage'); if (old) old.remove();
    this.camera = { scale: 1, x: 50, y: 50 };
    const V = window.ASSET_VER || '';
    this.root = UI.el(`
      <div id="scene-stage">
        <div class="sc-world" id="sc-world">
          <div class="story-bg bg-${cfg.bg || 'forest'}"></div>
          ${cfg.bgImg ? `<img class="sc-bgimg" src="${cfg.bgImg}?v=${V}" decoding="async">` : ''}
          ${cfg.night ? '<div class="sc-night"></div>' : ''}
          <div class="bfx-particles" id="sc-fx"></div>
          <div id="sc-actors"></div>
        </div>
        <div class="sc-narr" id="sc-narr" style="display:none;"></div>
        <div class="sc-tap" id="sc-tap" style="display:none;"></div>
      </div>`);
    document.body.appendChild(this.root);
    if (window.Story && Story.spawnParticles) {
      const fx = this.root.querySelector('#sc-fx');
      // 复用剧情层的氛围粒子样式（雪/叶/尘按 bg 选型在 story.css 已有）
      try { Story.spawnParticles.call({ root: this.root }, cfg.bg); } catch (e) {}
    }
    if (window.Sound) Sound.bgm('story');
  },

  loadSprites(cfg) {
    const reg = (window.BattleUI && BattleUI.FIELD_SPRITE) || {};
    this.sprites = {};
    const keys = [...new Set(Object.values(cfg.actors || {}).map(a => a.sprite))];
    const V = window.ASSET_VER || '1';
    return Promise.all(keys.map(key => new Promise(resolve => {
      const BASE = reg[key];
      if (!BASE) { console.warn('SceneStage: 无 sprite', key); resolve(); return; }
      const sp = this.sprites[key] = { ready: false, man: null, imgs: {} };
      fetch(BASE + '/manifest.json?v=' + V).then(r => r.json()).then(man => {
        sp.man = man;
        let pend = 0, done = 0; const fin = () => { if (++done >= pend) { sp.ready = true; resolve(); } };
        for (const anim in man.anims) {
          sp.imgs[anim] = {};
          for (const d in man.anims[anim].frames) {
            const n = man.anims[anim].frames[d];
            sp.imgs[anim][d] = [];
            for (let i = 0; i < n; i++) {
              pend++;
              const im = new Image();
              im.onload = im.onerror = fin;
              im.src = `${BASE}/${anim}/${d}/${String(i).padStart(2, '0')}.png?v=${V}`;
              sp.imgs[anim][d].push(im);
            }
          }
        }
        if (!pend) { sp.ready = true; resolve(); }
      }).catch(() => resolve());
    })));
  },

  placeActors(cfg) {
    this.actors = {};
    const box = this.root.querySelector('#sc-actors');
    for (const id in cfg.actors || {}) {
      const a = cfg.actors[id];
      // glow=提灯光晕（掌灯人核心视觉）；所有 actor 带地面椭圆影
      const el = UI.el(`<div class="sc-actor" data-actor="${id}">
        ${a.glow ? '<div class="sc-glow"></div>' : ''}
        <div class="sc-shadow"></div>
        <div class="sc-bubble" style="display:none;"></div><img decoding="async"></div>`);
      box.appendChild(el);
      this.actors[id] = { ...a, id, el, anim: 'idle', frame: 0, moving: null };
      this.position(this.actors[id]);
    }
  },

  position(act) {
    act.el.style.left = act.x + '%';
    act.el.style.top = act.y + '%';
  },

  dirOf(dx, dy) {
    const a = Math.atan2(dy, dx) * 180 / Math.PI; // 0=东
    const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    return dirs[Math.round(((a + 360) % 360) / 45) % 8];
  },

  tick(now) {
    for (const id in this.actors) {
      const act = this.actors[id];
      const sp = this.sprites[act.sprite];
      if (!sp || !sp.ready) continue;
      // 移动插值
      if (act.moving) {
        const m = act.moving, p = Math.min(1, (now - m.t0) / m.dur);
        act.x = m.x0 + (m.x1 - m.x0) * p;
        act.y = m.y0 + (m.y1 - m.y0) * p;
        this.position(act);
        if (p >= 1) { act.moving = null; act.anim = 'idle'; if (m.res) m.res(); }
      }
      // 帧动画：anim 缺该向时回退 idle，idle 缺时用首个可用向（静帧兜底由 gnorm 保证每向至少 1 帧）
      const anims = sp.man.anims;
      let anim = act.anim;
      if (!anims[anim] || !anims[anim].frames[act.dir]) anim = 'idle';
      const frames = (sp.imgs[anim] && sp.imgs[anim][act.dir]) || [];
      if (frames.length) {
        const fps = (sp.man.fps && sp.man.fps[anim]) || 8;
        const f = Math.floor(now / 1000 * fps) % frames.length;
        const img = act.el.querySelector('img');
        if (img.dataset.f !== anim + act.dir + f) { img.src = frames[f].src; img.dataset.f = anim + act.dir + f; }
      }
    }
    // 镜头
    const w = this.root && this.root.querySelector('#sc-world');
    if (w) w.style.transform = `scale(${this.camera.scale}) translate(${50 - this.camera.x}%, ${50 - this.camera.y}%)`;
    if (this.root) this._raf = requestAnimationFrame(t => this.tick(t));
  },

  step(s) {
    return new Promise(res => {
      const act = s.who ? this.actors[s.who] : null;
      switch (s.t) {
        case 'wait': setTimeout(res, s.ms || 600); break;
        case 'face': if (act) act.dir = s.dir; setTimeout(res, 120); break;
        case 'hide': if (act) { act.hidden = true; act.el.style.display = 'none'; } res(); break;
        case 'show': if (act) { act.hidden = false; act.el.style.display = ''; } res(); break;
        case 'move': {
          if (!act) { res(); return; }
          const [x1, y1] = s.to;
          act.dir = s.dirLock || this.dirOf(x1 - act.x, y1 - act.y);
          act.anim = 'run';
          act.moving = { x0: act.x, y0: act.y, x1, y1, t0: performance.now(), dur: s.dur || 1600, res };
          break;
        }
        case 'say': {
          if (!act) { res(); return; }
          this.bubble(act, s.text, false, res);
          break;
        }
        case 'whisper': {
          // 低语：气泡只出「…………」，逐字 1/3 速，无名牌（圣经 W2）
          if (!act) { res(); return; }
          this.bubble(act, '…………', true, res);
          break;
        }
        case 'narr': {
          const bar = this.root.querySelector('#sc-narr');
          bar.style.display = '';
          bar.textContent = s.text;
          this.tapOnce(() => { bar.style.display = 'none'; res(); });
          break;
        }
        case 'camera': {
          const c0 = { ...this.camera }, c1 = { scale: s.scale || 1, x: s.x != null ? s.x : 50, y: s.y != null ? s.y : 50 };
          const t0 = performance.now(), dur = s.dur || 800;
          const step = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            this.camera.scale = c0.scale + (c1.scale - c0.scale) * p;
            this.camera.x = c0.x + (c1.x - c0.x) * p;
            this.camera.y = c0.y + (c1.y - c0.y) * p;
            if (p < 1) requestAnimationFrame(step); else res();
          };
          requestAnimationFrame(step);
          break;
        }
        default: res();
      }
    });
  },

  /** 头顶对话泡；slow=低语（逐字 1/3 速 + 40Hz 低频音） */
  bubble(act, text, slow, done) {
    const b = act.el.querySelector('.sc-bubble');
    b.style.display = '';
    b.classList.toggle('whisper', !!slow);
    b.textContent = '';
    if (slow && window.Sound && Sound.sfx) { try { Sound.sfx('whisper'); } catch (e) {} }
    let i = 0;
    const iv = setInterval(() => {
      b.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(iv);
        this.tapOnce(() => { b.style.display = 'none'; done(); });
      }
    }, slow ? 200 : 40);
  },

  tapOnce(cb) {
    const tap = this.root.querySelector('#sc-tap');
    tap.style.display = '';
    const h = () => { tap.style.display = 'none'; tap.removeEventListener('click', h); cb(); };
    tap.addEventListener('click', h);
  },

  destroy() {
    cancelAnimationFrame(this._raf); this._raf = 0;
    if (this.root) {
      const r = this.root; this.root = null;
      r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280 }).onfinish = () => r.remove();
    }
  },
};



// ============================================================
//  Diorama —— SceneStage v2 立体舞台（画布渲染）
//  斜俯视地面(瓦片自动拼接) + 独立物件按深度摆放 + 小人穿行(y排序遮挡+近大远小)
//  + 远景天幕视差 + 夜色/灯光层。step API 与 v1 完全一致（坐标=舞台百分比）。
//  cfg.stage = { w,h(世界px), ground:{sheet,tile,grid}, props:[{img,x,y,s}],
//                sky:[color,color], far:{img,y,s}, night }
//  ground.grid = 字符串数组角点网格('0'=下地形/'1'=上地形)，Wang 角点自动选瓦。
// ============================================================
const Diorama = {
  root: null, cv: null, ctx: null, actors: {}, camera: { x: 0.5, y: 0.5, zoom: 1 },
  _raf: 0, _imgs: {}, _tiles: null,

  async run(cfg, onDone) {
    const old = document.getElementById('scene-stage'); if (old) old.remove();
    this.cfg = cfg; this.st = cfg.stage;
    this.camera = { scale: this.st.zoom || 1, x: 50, y: 55 };
    this.root = UI.el(`
      <div id="scene-stage">
        <canvas id="sc-canvas"></canvas>
        <div id="sc-bubbles"></div>
        <div class="sc-narr" id="sc-narr" style="display:none;"></div>
        <div class="sc-tap" id="sc-tap" style="display:none;"></div>
      </div>`);
    document.body.appendChild(this.root);
    this.cv = this.root.querySelector('#sc-canvas');
    this.ctx = this.cv.getContext('2d');
    if (window.Sound) Sound.bgm('story');
    await Promise.all([this.loadStage(), SceneStage.loadSprites.call(this, cfg)]);
    this.placeActors(cfg);
    this._raf = requestAnimationFrame(t => this.tick(t));
    for (const step of cfg.steps || []) await SceneStage.step.call(this, step);
    this.destroy();
    if (onDone) setTimeout(onDone, 250);
  },

  img(src) {
    if (this._imgs[src]) return this._imgs[src];
    const im = new Image(); im.src = src + '?v=' + (window.ASSET_VER || '');
    return (this._imgs[src] = im);
  },

  loadStage() {
    const jobs = [], seen = new Set();
    // 同一图片可能被多个 props 复用：去重 + addEventListener（onload 赋值会互相覆盖导致挂死）
    const need = src => {
      if (seen.has(src)) return; seen.add(src);
      const im = this.img(src);
      jobs.push(new Promise(r => {
        if (im.complete) return r();
        im.addEventListener('load', r, { once: true });
        im.addEventListener('error', r, { once: true });
      }));
    };
    if (this.st.ground) {
      need(this.st.ground.sheet);
      if (this.st.ground.lut) jobs.push(fetch(this.st.ground.lut + '?v=' + (window.ASSET_VER || ''))
        .then(r => r.json()).then(j => { this._lut = j.lut; }).catch(() => {}));
    }
    (this.st.props || []).forEach(pr => need(pr.img));
    if (this.st.far && this.st.far.img) need(this.st.far.img);
    return Promise.all(jobs);
  },

  placeActors(cfg) {
    this.actors = {};
    for (const id in cfg.actors || {}) {
      const a = cfg.actors[id];
      this.actors[id] = { ...a, id, anim: 'idle', moving: null,
        el: this.mkBubble(id) };   // DOM 气泡挂点（与 v1 的 .sc-bubble 查询兼容）
    }
  },
  mkBubble(id) {
    const el = UI.el(`<div class="sc-actor sc-actor-dom" data-actor="${id}" style="position:absolute;width:0;height:0;">
      <div class="sc-bubble" style="display:none;"></div></div>`);
    this.root.querySelector('#sc-bubbles').appendChild(el);
    return el;
  },
  position() {},   // v1 兼容空实现（气泡位置由 tick 投影）

  // 世界坐标（舞台百分比）→ 屏幕像素（camera: {scale, x%, y%} 与 v1 step 同义）
  w2s(px, py) {
    const W = this.cv.width, H = this.cv.height;
    const st = this.st;
    const wx = px / 100 * st.w, wy = py / 100 * st.h;
    const cx = this.camera.x / 100 * st.w, cy = this.camera.y / 100 * st.h;
    const s = Math.max(W / st.w, H / st.h) * (this.camera.scale || 1);
    return { x: W / 2 + (wx - cx) * s, y: H / 2 + (wy - cy) * s, s };
  },

  // Wang 角点自动选瓦：LUT 来自瓦片集元数据（mask = NW + NE*2 + SW*4 + SE*8，upper=1）
  _lut: null,
  tileAt(mask) {
    if (this._lut && this._lut[mask]) { const [x, y] = this._lut[mask]; return { sx: x, sy: y }; }
    return { sx: (mask % 4) * 32, sy: Math.floor(mask / 4) * 32 };
  },

  tick(now) {
    if (!this.root) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = this.root.clientWidth, chh = this.root.clientHeight;
    if (this.cv.width !== Math.round(cw * dpr)) { this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(chh * dpr); }
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const st = this.st;

    // 天幕（视差 0.3×）
    const sky = st.sky || ['#2a2633', '#171420'];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (st.far && st.far.img) {
      const fim = this._imgs[st.far.img];
      if (fim && fim.width) {
        const p = this.w2s(50, st.far.y != null ? st.far.y : 18);
        const fs = p.s * (st.far.s || 1) * 0.35;
        const fw = fim.width * fs, fh = fim.height * fs;
        const parX = W / 2 + (p.x - W / 2) * 0.3;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(fim, parX - fw / 2, p.y - fh, fw, fh);
        ctx.globalAlpha = 1;
      }
    }

    // 地面（角点网格自动拼瓦）
    if (st.ground && st.ground.grid) {
      const sheet = this._imgs[st.ground.sheet];
      if (sheet && sheet.width) {
        const T = st.ground.tile || 32;
        const grid = st.ground.grid;              // (rows+1)×(cols+1) 角点
        const rows = grid.length - 1, cols = grid[0].length - 1;
        const gy0 = st.ground.y != null ? st.ground.y : 30;   // 地面带起始（舞台%）
        const cellW = 100 / cols, cellH = (100 - gy0) / rows;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const mask = (grid[r][c] === '1' ? 1 : 0) + (grid[r][c + 1] === '1' ? 2 : 0)
                     + (grid[r + 1][c] === '1' ? 4 : 0) + (grid[r + 1][c + 1] === '1' ? 8 : 0);
          const tp = this.tileAt(mask);
          const p0 = this.w2s(c * cellW, gy0 + r * cellH);
          const p1 = this.w2s((c + 1) * cellW, gy0 + (r + 1) * cellH);
          ctx.drawImage(sheet, tp.sx, tp.sy, T, T, p0.x, p0.y, Math.ceil(p1.x - p0.x), Math.ceil(p1.y - p0.y));
        }
      }
    }

    // 物件 + 小人：按脚线 y 排序（近大远小只作用于小人）
    const ents = [];
    (st.props || []).forEach(pr => ents.push({ y: pr.y, draw: () => {
      const im = this._imgs[pr.img]; if (!im || !im.width) return;
      const p = this.w2s(pr.x, pr.y);
      const sc = p.s * (pr.s || 1);
      ctx.drawImage(im, p.x - im.width * sc / 2, p.y - im.height * sc, im.width * sc, im.height * sc);
    }}));
    for (const id in this.actors) {
      const act = this.actors[id];
      const sp = this.sprites[act.sprite];
      // 移动插值（复用 v1 语义）
      if (act.moving) {
        const m = act.moving, pgs = Math.min(1, (now - m.t0) / m.dur);
        act.x = m.x0 + (m.x1 - m.x0) * pgs; act.y = m.y0 + (m.y1 - m.y0) * pgs;
        if (pgs >= 1) { act.moving = null; act.anim = 'idle'; if (m.res) m.res(); }
      }
      if (act.hidden) continue;
      ents.push({ y: act.y, draw: () => {
        if (!sp || !sp.ready) return;
        const p = this.w2s(act.x, act.y);
        const depth = 0.72 + 0.55 * (act.y / 100);            // 近大远小
        const sc = p.s * (st.actorScale || 1.15) * depth;
        const anims = sp.man.anims;
        let anim = act.anim;
        if (!anims[anim] || !anims[anim].frames[act.dir]) anim = 'idle';
        const frames = (sp.imgs[anim] && sp.imgs[anim][act.dir]) || [];
        if (!frames.length) return;
        const fps = (sp.man.fps && sp.man.fps[anim]) || 8;
        const f = Math.floor(now / 1000 * fps) % frames.length;
        const im = frames[f]; if (!im || !im.width) return;
        const bb = sp.man.bbox;
        const dw = bb.w * sc, dh = bb.h * sc;
        // 地影
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, dw * 0.32, dh * 0.09, 0, 0, 7); ctx.fill();
        // 提灯光晕
        if (act.glow) {
          const rg = ctx.createRadialGradient(p.x, p.y - dh * 0.45, 4, p.x, p.y - dh * 0.45, dw * 2.4);
          rg.addColorStop(0, 'rgba(255,196,110,.4)'); rg.addColorStop(0.5, 'rgba(255,170,80,.16)'); rg.addColorStop(1, 'rgba(255,170,80,0)');
          ctx.fillStyle = rg; ctx.fillRect(p.x - dw * 2.4, p.y - dh * 0.45 - dw * 2.4, dw * 4.8, dw * 4.8);
        }
        ctx.drawImage(im, bb.x, bb.y, bb.w, bb.h, p.x - dw / 2, p.y - dh, dw, dh);
        // 气泡挂点投影
        const bubbleHost = act.el;
        bubbleHost.style.left = (p.x / (window.devicePixelRatio > 1 ? Math.min(2, window.devicePixelRatio) : 1)) + 'px';
        bubbleHost.style.top = ((p.y - dh) / (window.devicePixelRatio > 1 ? Math.min(2, window.devicePixelRatio) : 1)) + 'px';
      }});
    }
    ents.sort((a, b) => a.y - b.y).forEach(e => e.draw());

    // 全局色调：降饱和(mute 0-1) + 色罩(tone)，统一瓦片/物件/小人的色感
    if (st.mute) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = `rgba(128,128,128,${st.mute})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (st.tone) { ctx.fillStyle = st.tone; ctx.fillRect(0, 0, W, H); }

    // 夜色 + 暗角
    if (st.night) { ctx.fillStyle = 'rgba(10,12,26,.42)'; ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    this._raf = requestAnimationFrame(t => this.tick(t));
  },

  // v1 兼容：step/bubble/tapOnce/destroy 直接借用 SceneStage 的实现（this 指向 Diorama）
  dirOf(dx, dy) { return SceneStage.dirOf(dx, dy); },
  bubble(act, text, slow, done) { return SceneStage.bubble.call(this, act, text, slow, done); },
  tapOnce(cb) { return SceneStage.tapOnce.call(this, cb); },
  destroy() {
    cancelAnimationFrame(this._raf); this._raf = 0;
    if (this.root) {
      const r = this.root; this.root = null;
      r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280 }).onfinish = () => r.remove();
    }
  },
};

window.Diorama = Diorama;

window.Director = Director;
window.SceneStage = SceneStage;
