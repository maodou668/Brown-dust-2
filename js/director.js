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
//  Diorama —— SceneStage v2 立体舞台（画布渲染 · 纯俯视地图模式）
//  参考 Pixel Crawler 视角：地面铺满全屏、素材包瓦片 wang 自动拼接、
//  高密度装饰层、物件/小人按脚线 y 排序遮挡、整数像素缩放保持锐利。
//  cfg.stage = {
//    map: { tile:16, sheet:主地形图集url, grid:[角点行 '1'=上地形(路)],
//           fullVar:[[c,r]..全'1'格变体], emptyVar:[[c,r]..全'0'格变体],
//           sheets:{key:url}, decor:{ legend:{ch:[key,sx,sy(px)]}, rows:[..] } },
//    props: [{img, x, y}],   // x,y=瓦坐标(浮点)，y=脚线
//    cam:{x,y,scale}, pxScale:2, actorScale:1, night, mute, tone,
//  }
//  step API 与 v1 完全一致（move/say 坐标 = 世界百分比）。
// ============================================================
const Diorama = {
  root: null, cv: null, ctx: null, actors: {}, sprites: {},
  camera: { scale: 1, x: 50, y: 50 },
  _raf: 0, _imgs: {},

  // wang 角点 LUT（TilesetFloor 地形块内偏移，已校准）：mask = NW + NE*2 + SW*4 + SE*8，'1'=块内地形
  WANG: { 8: [11, 7], 4: [13, 7], 2: [11, 9], 1: [13, 9], 12: [12, 7], 3: [12, 9], 10: [11, 8], 5: [13, 8],
          7: [16, 8], 11: [17, 8], 13: [16, 9], 14: [17, 9], 6: [12, 8], 9: [12, 8] },

  async run(cfg, onDone) {
    const old = document.getElementById('scene-stage'); if (old) old.remove();
    this.cfg = cfg; this.st = cfg.stage;
    const m = this.st.map;
    this.world = { w: (m.grid[0].length - 1) * m.tile, h: (m.grid.length - 1) * m.tile };
    this.camera = { scale: 1, x: 50, y: 50, ...(this.st.cam || {}) };
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
    // 同一图片可被多处复用：去重 + addEventListener（onload 赋值会互相覆盖导致挂死）
    const need = src => {
      if (!src || seen.has(src)) return; seen.add(src);
      const im = this.img(src);
      jobs.push(new Promise(r => {
        if (im.complete) return r();
        im.addEventListener('load', r, { once: true });
        im.addEventListener('error', r, { once: true });
      }));
    };
    const m = this.st.map;
    need(m.sheet);
    for (const k in m.sheets || {}) need(m.sheets[k]);
    (this.st.props || []).forEach(pr => need(pr.img));
    return Promise.all(jobs);
  },

  placeActors(cfg) {
    this.actors = {};
    for (const id in cfg.actors || {}) {
      const a = cfg.actors[id];
      this.actors[id] = { ...a, id, anim: 'idle', moving: null, el: this.mkBubble(id) };
    }
  },
  mkBubble(id) {
    const el = UI.el(`<div class="sc-actor sc-actor-dom" data-actor="${id}" style="position:absolute;width:0;height:0;">
      <div class="sc-bubble" style="display:none;"></div></div>`);
    this.root.querySelector('#sc-bubbles').appendChild(el);
    return el;
  },
  position() {},   // v1 兼容空实现（气泡位置由 tick 投影）

  tick(now) {
    if (!this.root) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = this.root.clientWidth, chh = this.root.clientHeight;
    if (this.cv.width !== Math.round(cw * dpr)) { this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(chh * dpr); }
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const st = this.st, m = st.map, T = m.tile || 16;
    // 整数像素缩放：1 素材像素 = pxScale*camera.scale 个 css 像素
    const S = Math.max(1, Math.round((st.pxScale || 2) * (this.camera.scale || 1) * dpr));
    let cx = this.camera.x / 100 * this.world.w, cy = this.camera.y / 100 * this.world.h;
    // 镜头钳制在地图内（地图小于视口时居中）
    const vw = W / S, vh = H / S;
    cx = this.world.w > vw ? Math.min(Math.max(cx, vw / 2), this.world.w - vw / 2) : this.world.w / 2;
    cy = this.world.h > vh ? Math.min(Math.max(cy, vh / 2), this.world.h - vh / 2) : this.world.h / 2;
    const ox = Math.round(W / 2 - cx * S), oy = Math.round(H / 2 - cy * S);
    this._proj = { S, ox, oy, dpr };

    ctx.fillStyle = '#101014'; ctx.fillRect(0, 0, W, H);

    // 地面：wang 角点拼瓦 + 全格变体
    const sheet = this._imgs[m.sheet];
    if (sheet && sheet.width) {
      const grid = m.grid, rows = grid.length - 1, cols = grid[0].length - 1;
      const c0 = Math.max(0, Math.floor((-ox) / (T * S))), c1 = Math.min(cols - 1, Math.ceil((W - ox) / (T * S)));
      const r0 = Math.max(0, Math.floor((-oy) / (T * S))), r1 = Math.min(rows - 1, Math.ceil((H - oy) / (T * S)));
      const fullV = m.fullVar || [[12, 8]], emptyV = m.emptyVar || [[11, 12]];
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const mask = (grid[r][c] === '1' ? 1 : 0) + (grid[r][c + 1] === '1' ? 2 : 0)
                   + (grid[r + 1][c] === '1' ? 4 : 0) + (grid[r + 1][c + 1] === '1' ? 8 : 0);
        let t;
        if (mask === 15) t = fullV[(c * 7 + r * 13) % fullV.length];
        else if (mask === 0) t = emptyV[(c * 11 + r * 17) % emptyV.length];
        else t = this.WANG[mask];
        ctx.drawImage(sheet, t[0] * T, t[1] * T, T, T, ox + c * T * S, oy + r * T * S, T * S, T * S);
      }
      // 装饰覆盖层（透明底小件）
      if (m.decor) {
        const L = m.decor.legend || {};
        (m.decor.rows || []).forEach((row, r) => {
          if (r < r0 || r > r1) return;
          for (let c = Math.max(0, c0); c <= Math.min(row.length - 1, c1); c++) {
            const e = L[row[c]]; if (!e) continue;
            const sh = this._imgs[(m.sheets || {})[e[0]]] || sheet;
            if (sh && sh.width) ctx.drawImage(sh, e[1], e[2], T, T, ox + c * T * S, oy + r * T * S, T * S, T * S);
          }
        });
      }
    }

    // 物件 + 小人：按脚线 y 排序（纯俯视 → 统一比例，无近大远小）
    const ents = [];
    (st.props || []).forEach(pr => {
      const im = this._imgs[pr.img]; if (!im || !im.width) return;
      const fx = pr.x * T, fy = pr.y * T;
      ents.push({ y: fy, draw: () => {
        const s = (pr.s || 1) * S;
        ctx.drawImage(im, Math.round(ox + fx * S - im.width * s / 2), Math.round(oy + fy * S - im.height * s), im.width * s, im.height * s);
      } });
    });
    for (const id in this.actors) {
      const act = this.actors[id];
      const sp = this.sprites[act.sprite];
      if (act.moving) {
        const mv = act.moving, pgs = Math.min(1, (now - mv.t0) / mv.dur);
        act.x = mv.x0 + (mv.x1 - mv.x0) * pgs; act.y = mv.y0 + (mv.y1 - mv.y0) * pgs;
        if (pgs >= 1) { act.moving = null; act.anim = 'idle'; if (mv.res) mv.res(); }
      }
      if (act.hidden) continue;
      const wx = act.x / 100 * this.world.w, wy = act.y / 100 * this.world.h;
      ents.push({ y: wy, draw: () => {
        if (!sp || !sp.ready) return;
        const anims = sp.man.anims;
        let anim = act.anim;
        if (!anims[anim] || !anims[anim].frames[act.dir]) anim = 'idle';
        const frames = (sp.imgs[anim] && sp.imgs[anim][act.dir]) || [];
        if (!frames.length) return;
        const fps = (sp.man.fps && sp.man.fps[anim]) || 8;
        const f = Math.floor(now / 1000 * fps) % frames.length;
        const im = frames[f]; if (!im || !im.width) return;
        const bb = sp.man.bbox;
        const asc = (st.actorScale || 1) * S;
        const dw = bb.w * asc, dh = bb.h * asc;
        const px = ox + wx * S, py = oy + wy * S;
        ctx.fillStyle = 'rgba(0,0,0,.32)';
        ctx.beginPath(); ctx.ellipse(px, py, dw * 0.3, dh * 0.08, 0, 0, 7); ctx.fill();
        if (act.glow) {
          const rg = ctx.createRadialGradient(px, py - dh * 0.45, 4, px, py - dh * 0.45, dw * 2.2);
          rg.addColorStop(0, 'rgba(255,196,110,.38)'); rg.addColorStop(0.5, 'rgba(255,170,80,.15)'); rg.addColorStop(1, 'rgba(255,170,80,0)');
          ctx.fillStyle = rg; ctx.fillRect(px - dw * 2.2, py - dh * 0.45 - dw * 2.2, dw * 4.4, dw * 4.4);
        }
        ctx.drawImage(im, bb.x, bb.y, bb.w, bb.h, Math.round(px - dw / 2), Math.round(py - dh), dw, dh);
        act.el.style.left = (px / dpr) + 'px';
        act.el.style.top = ((py - dh) / dpr) + 'px';
      } });
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
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)');
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
