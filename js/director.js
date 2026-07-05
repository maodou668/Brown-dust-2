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
    this._bmInit();
    const m = this.st.map;
    if (this.bm) this.world = { w: this.bm.w, h: this.bm.h };
    else {
      const gsrc = m.grid || ((m.layers || []).map(l => l.grid).find(Boolean));
      this.world = { w: (gsrc[0].length - 1) * m.tile, h: (gsrc.length - 1) * m.tile };
    }
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
    if (this.bm) this._bmBuildMask();
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

  // ============ 大图铺底模式（js/bigmap.js 数据：手绘大图 2x 硬放大 + 掩码碰撞 + 原图回贴遮挡） ============
  _bmInit() {
    const st = this.st;
    this.bm = null; this._bmMaskData = null; this._crit = null;
    if (!st || !st.bigmap) return;
    const bm = this.bm = (typeof st.bigmap === 'string') ? (window.BIGMAPS || {})[st.bigmap] : st.bigmap;
    if (!bm) { console.warn('Diorama: 未知 bigmap', st.bigmap); return; }
    st.map = st.map || { tile: 32 };
    if (st.pxScale == null) st.pxScale = bm.pxScale || 2;
    if (st.actorScale == null) st.actorScale = bm.actorScale || 0.6;
    if (st.vignette == null && bm.vignette != null) st.vignette = bm.vignette;
    if (!st.parts && bm.parts) st.parts = bm.parts;
  },

  /** 把 walk/block 几何烘成半分辨率位图掩码（白=可走），blockedAt O(1) 采样 */
  _bmBuildMask() {
    const bm = this.bm, s = 0.5;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(bm.w * s); cv.height = Math.ceil(bm.h * s);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    const poly = p => { ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)); ctx.closePath(); ctx.fill(); };
    ctx.fillStyle = ctx.strokeStyle = '#fff';
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const stk of (bm.walk || {}).strokes || []) {
      ctx.lineWidth = stk.w * s;
      ctx.beginPath();
      stk.pts.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s));
      ctx.stroke();
    }
    ((bm.walk || {}).polys || []).forEach(poly);
    ctx.fillStyle = '#000';
    for (const [x, y, r] of (bm.block || {}).circles || []) { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, 7); ctx.fill(); }
    for (const [x, y, w, h] of (bm.block || {}).rects || []) ctx.fillRect(x * s, y * s, w * s, h * s);
    ((bm.block || {}).polys || []).forEach(poly);
    // 用户手绘掩码覆盖图（红=挡 绿=通 透明=不改）叠在几何掩码之上——精修碰撞无需改代码
    const ov = bm.maskImg && this._imgs[bm.maskImg];
    if (ov && ov.width) {
      const oc = document.createElement('canvas');
      oc.width = cv.width; oc.height = cv.height;
      const octx = oc.getContext('2d', { willReadFrequently: true });
      octx.drawImage(ov, 0, 0, cv.width, cv.height);
      const od = octx.getImageData(0, 0, cv.width, cv.height).data;
      const id = ctx.getImageData(0, 0, cv.width, cv.height);
      for (let i = 0; i < od.length; i += 4) {
        if (od[i + 3] < 100) continue;
        const red = od[i] > 140 && od[i + 1] < 110, green = od[i + 1] > 140 && od[i] < 110;
        if (red) id.data[i] = id.data[i + 1] = id.data[i + 2] = 0;
        else if (green) id.data[i] = id.data[i + 1] = id.data[i + 2] = 255;
      }
      ctx.putImageData(id, 0, 0);
    }
    this._bmMaskData = { w: cv.width, h: cv.height, d: ctx.getImageData(0, 0, cv.width, cv.height).data };
  },

  // ============ 自由行走探索模式（摇杆/WASD + 物件碰撞 + 相机跟随） ============
  async explore(opts) {
    const old = document.getElementById('scene-stage'); if (old) old.remove();
    const cfg = { stage: opts.stage, actors: { player: { sprite: opts.sprite || 'teried', x: opts.x, y: opts.y, dir: 'south', glow: opts.glow } } };
    this.cfg = cfg; this.st = cfg.stage;
    this._bmInit();
    const m = this.st.map;
    if (this.bm) this.world = { w: this.bm.w, h: this.bm.h };
    else {
      const gsrc = m.grid || ((m.layers || []).map(l => l.grid).find(Boolean));
      this.world = { w: (gsrc[0].length - 1) * m.tile, h: (gsrc.length - 1) * m.tile };
    }
    this.camera = { scale: opts.scale || 0.8, x: opts.x, y: opts.y };
    this.root = UI.el(`
      <div id="scene-stage">
        <canvas id="sc-canvas"></canvas>
        <div id="sc-bubbles"></div>
        <button class="btn secondary" id="explore-exit" style="position:absolute;top:10px;right:12px;z-index:6;">离开</button>
        <div class="joystick" id="explore-joy" style="position:absolute;left:26px;bottom:26px;z-index:6;"><div class="joy-knob" id="explore-knob"></div></div>
      </div>`);
    document.body.appendChild(this.root);
    this.cv = this.root.querySelector('#sc-canvas');
    this.ctx = this.cv.getContext('2d');
    if (window.Sound) Sound.bgm('story');
    await Promise.all([this.loadStage(), SceneStage.loadSprites.call(this, cfg)]);
    if (this.bm) this._bmBuildMask();
    this.placeActors(cfg);
    this.ctl = { input: { up: 0, down: 0, left: 0, right: 0 }, joy: { active: false, x: 0, y: 0 }, last: performance.now() };
    this._bindExplore(opts);
    this._raf = requestAnimationFrame(t => this.tick(t));
  },

  _bindExplore(opts) {
    const joy = this.root.querySelector('#explore-joy'), knob = this.root.querySelector('#explore-knob');
    const J = this.ctl.joy;
    const radius = () => joy.clientWidth / 2;
    const move = (e) => {
      if (!J.active) return; e.preventDefault();
      const t = (e.touches && e.touches[0]) || e;
      const r = joy.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
      const rad = radius(), len = Math.hypot(dx, dy);
      if (len > rad) { dx = dx / len * rad; dy = dy / len * rad; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      J.x = dx / rad; J.y = dy / rad;
    };
    const start = (e) => { J.active = true; move(e); };
    const end = () => { J.active = false; J.x = J.y = 0; knob.style.transform = ''; };
    joy.addEventListener('touchstart', start, { passive: false });
    joy.addEventListener('touchmove', move, { passive: false });
    joy.addEventListener('touchend', end); joy.addEventListener('touchcancel', end);
    joy.addEventListener('mousedown', start);
    this._exMouseMove = move; this._exMouseUp = end;
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    this._exKey = (e) => {
      const mp = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const dir = mp[e.key]; if (!dir) return;
      this.ctl.input[dir] = (e.type === 'keydown') ? 1 : 0; e.preventDefault();
    };
    window.addEventListener('keydown', this._exKey);
    window.addEventListener('keyup', this._exKey);
    this.root.querySelector('#explore-exit').onclick = () => {
      window.removeEventListener('keydown', this._exKey); window.removeEventListener('keyup', this._exKey);
      window.removeEventListener('mousemove', this._exMouseMove); window.removeEventListener('mouseup', this._exMouseUp);
      this.ctl = null;
      this.destroy();
      if (opts.onExit) opts.onExit();
    };
  },

  _dir8(vx, vy) {
    const names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    const i = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
    return names[((i % 8) + 8) % 8];
  },

  updatePlayer(now) {
    const act = this.actors.player; if (!act) return;
    const dt = Math.min(40, now - this.ctl.last); this.ctl.last = now;
    let dx = 0, dy = 0;
    const j = this.ctl.joy, k = this.ctl.input;
    if (j.active && Math.hypot(j.x, j.y) > 0.18) { dx = j.x; dy = j.y; }
    else { dx = k.right - k.left; dy = k.down - k.up; }
    const mag = Math.hypot(dx, dy);
    if (mag > 0.01) {
      const T = this.st.map.tile;
      const spTiles = 0.0045 * dt * Math.min(1, mag);   // ~4.3 瓦/秒
      const nx = act.x + (dx / mag) * spTiles * T / this.world.w * 100;
      const ny = act.y + (dy / mag) * spTiles * T / this.world.h * 100;
      const ox0 = act.x, oy0 = act.y;
      if (!this.blockedAt(nx, act.y)) act.x = nx;
      if (!this.blockedAt(act.x, ny)) act.y = ny;
      // 贴墙滑动：实际位移不足步长 35% 即视为顶死 → 沿"垂直于输入"的方向找 6 步内的绕行口，
      // 找到就朝那侧侧步一格（只侧步、不跳跃、绝不反向输入——反向会原地震荡）
      const movedPx = Math.hypot((act.x - ox0) / 100 * this.world.w, (act.y - oy0) / 100 * this.world.h);
      if (movedPx < spTiles * T * 0.35) {
        const sx = spTiles * T / this.world.w * 100, sy = spTiles * T / this.world.h * 100;
        const horiz = Math.abs(dx) >= Math.abs(dy);
        outer: for (let k = 1; k <= 6; k++) {
          const cands = horiz
            ? [[nx, act.y - k * sy, 0, -1], [nx, act.y + k * sy, 0, 1]]
            : [[act.x - k * sx, ny, -1, 0], [act.x + k * sx, ny, 1, 0]];
          for (const [tx2, ty2, ux, uy] of cands) {
            if (!this.blockedAt(tx2, ty2)) {
              // 先试贴墙侧步一格（平滑）；一步内仍被挡（墙鼓包）就直接跳到探到的自由点
              const px2 = act.x + ux * sx, py2 = act.y + uy * sy;
              if (!this.blockedAt(px2, py2)) { act.x = px2; act.y = py2; }
              else { act.x = tx2; act.y = ty2; }
              break outer;
            }
          }
        }
      }
      act.dir = this._dir8(dx, dy);
      act.anim = 'run';
    } else if (act.anim !== 'idle') act.anim = 'idle';
    this.camera.x = act.x; this.camera.y = act.y;   // tick 里已有地图边界钳制
  },

  // 碰撞：bigmap=掩码采样；瓦片模式=地图边缘 + 立体物件脚部椭圆（flat 贴地件不挡路）
  blockedAt(px, py) {
    const T = this.st.map.tile;
    const wx = px / 100 * this.world.w, wy = py / 100 * this.world.h;
    if (this.bm) {
      const mk = this._bmMaskData; if (!mk) return false;
      const mx = Math.round(wx * 0.5), my = Math.round(wy * 0.5);
      if (mx < 0 || my < 0 || mx >= mk.w || my >= mk.h) return true;
      // 阈值 96：半覆盖边界像素(≈127)判可走，给贴墙滑动留半像素余量
      return mk.d[(my * mk.w + mx) * 4] < 96;
    }
    if (wx < T * 0.6 || wx > this.world.w - T * 0.6 || wy < T * 0.6 || wy > this.world.h - T * 0.6) return true;
    for (const pr of this.st.props || []) {
      if (pr.flat) continue;
      const im = this._imgs[pr.img]; if (!im || !im.width) continue;
      const rx = im.width * (pr.s || 1) * 0.32 + T * 0.18, ry = rx * 0.42;
      const ddx = wx - pr.x * T, ddy = wy - pr.y * T + ry * 0.5;
      if ((ddx * ddx) / (rx * rx) + (ddy * ddy) / (ry * ry) < 1) return true;
    }
    return false;
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
    if (this.bm) { need(this.bm.img); if (this.bm.maskImg) need(this.bm.maskImg); }
    const m = this.st.map;
    need(m.sheet);
    for (const k in m.sheets || {}) need(m.sheets[k]);
    (m.layers || []).forEach(l => {
      need(l.sheet);
      if (typeof l.lut === 'string') jobs.push(fetch(l.lut + '?v=' + (window.ASSET_VER || ''))
        .then(r => r.json()).then(j => { l._lut = j.lut || j; }).catch(() => {}));
      else l._lut = l.lut;
    });
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
    if (this.ctl) this.updatePlayer(now);   // 探索模式：输入→移动→相机跟随
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

    // 大图铺底：整幅硬放大绘制（imageSmoothingEnabled=false 保笔触，2x 定档工艺）
    const bimg = this.bm && this._imgs[this.bm.img];
    if (this.bm && bimg && bimg.width) {
      ctx.drawImage(bimg, 0, 0, this.bm.w, this.bm.h, ox, oy, this.bm.w * S, this.bm.h * S);
    }

    // 可见格范围（多层/单层共用）
    const rowsAll = this.world.h / T, colsAll = this.world.w / T;
    const vc0 = Math.max(0, Math.floor((-ox) / (T * S))), vc1 = Math.min(colsAll - 1, Math.ceil((W - ox) / (T * S)));
    const vr0 = Math.max(0, Math.floor((-oy) / (T * S))), vr1 = Math.min(rowsAll - 1, Math.ceil((H - oy) / (T * S)));

    // 地面 v3：多层地形（每层各自 wang；坐标=图集像素偏移；无 grid 的层=基底整铺 fullVar）
    if (m.layers) {
      for (const l of m.layers) {
        const sh = this._imgs[l.sheet]; if (!sh || !sh.width) continue;
        const grid = l.grid, lut = l._lut || l.lut || {};
        for (let r = vr0; r <= vr1; r++) for (let c = vc0; c <= vc1; c++) {
          let t = null;
          if (!grid) t = l.fullVar[(c * 7 + r * 13) % l.fullVar.length];
          else {
            const mask = (grid[r][c] === '1' ? 1 : 0) + (grid[r][c + 1] === '1' ? 2 : 0)
                       + (grid[r + 1][c] === '1' ? 4 : 0) + (grid[r + 1][c + 1] === '1' ? 8 : 0);
            if (mask === 0) t = l.emptyVar ? l.emptyVar[(c * 11 + r * 17) % l.emptyVar.length] : null;
            else if (mask === 15 && l.fullVar) t = l.fullVar[(c * 7 + r * 13) % l.fullVar.length];
            else t = lut[mask];
          }
          if (t) ctx.drawImage(sh, t[0], t[1], T, T, ox + c * T * S, oy + r * T * S, T * S, T * S);
        }
      }
      // 装饰覆盖层（legend 坐标=图集像素偏移）
      if (m.decor) {
        const L = m.decor.legend || {};
        (m.decor.rows || []).forEach((row, r) => {
          if (r < vr0 || r > vr1) return;
          for (let c = Math.max(0, vc0); c <= Math.min(row.length - 1, vc1); c++) {
            const e = L[row[c]]; if (!e) continue;
            const sh = this._imgs[(m.sheets || {})[e[0]]];
            if (sh && sh.width) ctx.drawImage(sh, e[1], e[2], T, T, ox + c * T * S, oy + r * T * S, T * S, T * S);
          }
        });
      }
    }

    // 地面 v2 兼容：单层双地形 wang + 全格变体（坐标=瓦格）
    const sheet = this._imgs[m.sheet];
    if (!m.layers && sheet && sheet.width) {
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

    // 溪流流动光效（大图）：波光沿中心线滚动 + 明暗双色 + 微闪，画在底图之上、实体之下
    if (this.bm && this.bm.water) {
      for (let wi = 0; wi < this.bm.water.length; wi++) {
        const wtr = this.bm.water[wi];
        if (!wtr._len) {   // 缓存分段长度
          wtr._seg = []; wtr._len = 0;
          for (let i = 1; i < wtr.pts.length; i++) {
            const dx2 = wtr.pts[i][0] - wtr.pts[i - 1][0], dy2 = wtr.pts[i][1] - wtr.pts[i - 1][1];
            const L = Math.hypot(dx2, dy2);
            wtr._seg.push({ x: wtr.pts[i - 1][0], y: wtr.pts[i - 1][1], dx: dx2 / L, dy: dy2 / L, l0: wtr._len, L });
            wtr._len += L;
          }
        }
        ctx.lineCap = 'round';
        for (let i = 0; i < 30; i++) {
          const t = ((i * 0.1373 + wi * 0.41) + now * 0.00009 * (1 + (i % 3) * 0.25)) % 1;
          let d = t * wtr._len, seg = wtr._seg[0];
          for (const sgm of wtr._seg) { if (d >= sgm.l0 && d <= sgm.l0 + sgm.L) { seg = sgm; break; } }
          const along = d - seg.l0;
          const off = (((i * 0.618) % 1) - 0.5) * wtr.w * 0.62;
          const px2 = seg.x + seg.dx * along - seg.dy * off, py2 = seg.y + seg.dy * along + seg.dx * off;
          const len = 5 + (i % 4) * 4;
          const tw = 0.5 + 0.5 * Math.sin(now * 0.005 + i * 2.7);
          ctx.strokeStyle = (i % 5 === 4)
            ? `rgba(8,12,16,${(0.14 + 0.07 * tw).toFixed(3)})`
            : `rgba(205,224,234,${(0.09 + 0.14 * tw).toFixed(3)})`;
          ctx.lineWidth = (1.2 + (i % 3) * 0.8) * S * 0.6;
          ctx.beginPath();
          ctx.moveTo(ox + px2 * S, oy + py2 * S);
          ctx.lineTo(ox + (px2 + seg.dx * len) * S, oy + (py2 + seg.dy * len) * S);
          ctx.stroke();
        }
      }
    }

    // 物件 + 小人：按脚线 y 排序（纯俯视 → 统一比例，无近大远小）
    const ents = [], glows = [];   // glows 统一画在夜色之后

    // 活物（大图）：鸡圈散养鸡——圈内游走/啄食/怕人惊跑，参与 y 排序
    if (this.bm && this.bm.critters) {
      if (!this._crit) {
        this._crit = []; this._critT = now;
        const inPoly = (p, x, y) => {
          let c = false;
          for (let a = 0, b = p.length - 1; a < p.length; b = a++)
            if ((p[a][1] > y) !== (p[b][1] > y) && x < (p[b][0] - p[a][0]) * (y - p[a][1]) / (p[b][1] - p[a][1]) + p[a][0]) c = !c;
          return c;
        };
        const randIn = (p) => {
          let x0 = 9e9, y0 = 9e9, x1 = -9e9, y1 = -9e9;
          for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
          for (let k = 0; k < 16; k++) {
            const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
            if (inPoly(p, x, y)) return [x, y];
          }
          return [(x0 + x1) / 2, (y0 + y1) / 2];
        };
        this._critIn = inPoly; this._critRand = randIn;
        for (const grp of this.bm.critters) {
          for (let i = 0; i < grp.n; i++) {
            const [cx2, cy2] = randIn(grp.area);
            this._crit.push({ grp, img: this.img('art/06_story/bigmap/critters/' + grp.sprites[i % grp.sprites.length] + '.png'),
              x: cx2, y: cy2, tx: cx2, ty: cy2, face: 1, state: 'peck', t: 800 + Math.random() * 2000, ph: Math.random() * 9 });
          }
        }
      }
      const cdt = Math.min(60, now - this._critT); this._critT = now;
      const plc = this.actors.player;
      const plx = plc ? plc.x / 100 * this.world.w : -9e9, ply = plc ? plc.y / 100 * this.world.h : -9e9;
      for (const c of this._crit) {
        // 怕人：玩家靠近 44px 内 → 逃向圈内远离点
        const pd = Math.hypot(plx - c.x, ply - c.y);
        if (pd < 44 && c.state !== 'flee') {
          c.tx = c.x + (c.x - plx) * 1.6; c.ty = c.y + (c.y - ply) * 1.6;
          if (!this._critIn(c.grp.area, c.tx, c.ty)) { const r2 = this._critRand(c.grp.area); c.tx = r2[0]; c.ty = r2[1]; }
          c.state = 'flee';
        }
        if (c.state === 'walk' || c.state === 'flee') {
          const dx2 = c.tx - c.x, dy2 = c.ty - c.y, dd = Math.hypot(dx2, dy2);
          const sp = (c.state === 'flee' ? 26 : 9) * cdt / 1000;
          if (dd < 2.5) { c.state = 'peck'; c.t = 900 + Math.random() * 2400; }
          else { c.x += dx2 / dd * sp; c.y += dy2 / dd * sp; c.face = dx2 < 0 ? -1 : 1; }
        } else {
          c.t -= cdt;
          if (c.t <= 0) {
            let nx2 = c.x + (Math.random() - 0.5) * 70, ny2 = c.y + (Math.random() - 0.5) * 50;
            if (Math.random() > 0.6 || !this._critIn(c.grp.area, nx2, ny2)) { const r2 = this._critRand(c.grp.area); nx2 = r2[0]; ny2 = r2[1]; }
            c.tx = nx2; c.ty = ny2; c.state = 'walk';
          }
        }
        const cc = c;
        ents.push({ y: cc.y, draw: () => {
          const im = cc.img; if (!im || !im.width) return;
          const s2 = (cc.grp.scale || 0.5) * S;
          const w2 = im.width * s2, h2 = im.height * s2;
          const moving = cc.state === 'walk' || cc.state === 'flee';
          const bob = moving ? Math.abs(Math.sin(now * (cc.state === 'flee' ? 0.02 : 0.011) + cc.ph)) * 2.2 * S : 0;
          const tilt = (!moving && Math.sin(now * 0.006 + cc.ph) > 0.3) ? 0.30 : 0;
          const px2 = ox + cc.x * S, py2 = oy + cc.y * S;
          ctx.fillStyle = 'rgba(0,0,0,.22)';
          ctx.beginPath(); ctx.ellipse(px2, py2, w2 * 0.26, w2 * 0.09, 0, 0, 7); ctx.fill();
          ctx.save();
          ctx.translate(px2, py2 - bob);
          if (cc.face < 0) ctx.scale(-1, 1);
          if (tilt) ctx.rotate(tilt);
          ctx.drawImage(im, -w2 / 2, -h2 * 0.86, w2, h2);
          ctx.restore();
        } });
      }
    }

    // 大图遮挡件：把原图区域按脚线 baseY 参与排序回贴（人在物后即被盖住）
    // 玩家被挡住时该件半透明（0.55）——既保留前后关系又不至于找不到人
    if (this.bm && bimg && bimg.width) {
      const pl = this.actors.player || this.actors.teried;
      const pw = pl ? pl.x / 100 * this.world.w : -9e9, ph2 = pl ? pl.y / 100 * this.world.h : -9e9;
      for (const o of this.bm.occ || []) {
        const hide = pl && ph2 < o[4] && pw > o[0] - 14 && pw < o[0] + o[2] + 14 && ph2 > o[1] && ph2 < o[4] + 46;
        ents.push({ y: o[4], draw: () => {
          if (hide) ctx.globalAlpha = 0.55;
          ctx.drawImage(bimg, o[0], o[1], o[2], o[3],
            Math.round(ox + o[0] * S), Math.round(oy + o[1] * S), o[2] * S, o[3] * S);
          if (hide) ctx.globalAlpha = 1;
        } });
      }
      for (const g of this.bm.glows || [])
        glows.push({ x: ox + g[0] * S, y: oy + g[1] * S, r: g[2] * S, color: g[3], flick: true });
    }
    (st.props || []).forEach(pr => {
      const im = this._imgs[pr.img]; if (!im || !im.width) return;
      const fx = pr.x * T, fy = pr.y * T;
      ents.push({ y: fy, draw: () => {
        const s = (pr.s || 1) * S;
        // 接地影：所有立体物脚下椭圆影（flat=true 的贴地件除外）——把物件"焊"在地上
        if (!pr.flat) {
          ctx.fillStyle = 'rgba(0,0,0,.28)';
          ctx.beginPath();
          ctx.ellipse(ox + fx * S, oy + fy * S, im.width * s * 0.32, Math.max(2, im.width * s * 0.09), 0, 0, 7);
          ctx.fill();
        }
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
        // 大图白天模式提灯减弱上移（全强度会把小人洗白）
        if (act.glow) glows.push(this.bm
          ? { x: px, y: py - dh * 0.62, r: dw * 1.6, color: 'rgba(255,180,95,.34)', flick: true }
          : { x: px, y: py - dh * 0.45, r: dw * 2.4 });
        ctx.drawImage(im, bb.x, bb.y, bb.w, bb.h, Math.round(px - dw / 2), Math.round(py - dh), dw, dh);
        act.el.style.left = (px / dpr) + 'px';
        act.el.style.top = ((py - dh) / dpr) + 'px';
      } });
    }
    ents.sort((a, b) => a.y - b.y).forEach(e => e.draw());

    // 氛围粒子（st.parts）：烟囱烟/飘叶/萤火虫 —— 确定性时间驱动，无状态，参与后续调色
    for (const em of st.parts || []) {
      if (em.type === 'smoke') {
        // 烟囱烟 v2：细缕上升 + 摆动 + 微风右飘，px 锚点（大图）或 tile 锚点（瓦片场景）
        const bx = ox + (em.px ? em.px[0] : em.x * T) * S, by = oy + (em.px ? em.px[1] : em.y * T) * S;
        for (let i = 0; i < 9; i++) {
          const ph = (now * (0.010 + (i % 3) * 0.0013) + i * 29) % 130;   // 0-130 生命周期
          const px = bx + Math.sin(ph * 0.085 + i * 1.9) * (0.03 + ph * 0.0032) * T * S + ph * 0.007 * T * S;
          const py = by - ph * 0.026 * T * S;
          const r = (0.05 + ph * 0.0023) * T * S;
          const a = 0.20 * (1 - ph / 130) * Math.min(1, ph / 12);         // 淡入淡出
          ctx.fillStyle = `rgba(206,206,214,${a.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
        }
      } else if (em.type === 'leaves') {
        const n = em.n || 12;
        for (let i = 0; i < n; i++) {
          const sd = i * 271 + 13;
          const lx = ((sd * 7 + now * (0.026 + (i % 5) * 0.006)) % (W + 80)) - 40;
          const ly = ((sd * 13 + now * (0.011 + (i % 3) * 0.004) + Math.sin(now * 0.0016 + i) * 40) % (H + 60)) - 30;
          ctx.save(); ctx.translate(lx, ly); ctx.rotate(now * 0.0022 + i * 1.7);
          ctx.fillStyle = ['rgba(150,136,74,.42)', 'rgba(128,122,70,.38)', 'rgba(158,118,66,.35)'][i % 3];
          ctx.fillRect(-1.3 * S, -0.7 * S, 2.6 * S, 1.4 * S);
          ctx.restore();
        }
      } else if (em.type === 'fireflies') {
        const n = em.n || 10;
        for (let i = 0; i < n; i++) {
          const sd = i * 173 + 41;
          const fx2 = ox + (((sd * 5) % 90) / 90 * this.world.w + Math.sin(now * 0.0009 + i * 2.3) * 30) * S / 2 * 2;
          const fy2 = oy + (((sd * 11) % 90) / 90 * this.world.h + Math.cos(now * 0.0011 + i * 1.7) * 22) * S / 2 * 2;
          const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.004 + i * 2.9));
          glows.push({ x: fx2, y: fy2, r: 5 * S * tw, color: `rgba(190,230,120,${(0.5 * tw).toFixed(2)})` });
        }
      }
    }

    // 收集物件灯光（角色提灯在绘制闭包里收集）
    for (const pr of st.props || []) {
      if (!pr.glow) continue;
      glows.push({ x: ox + pr.x * T * S, y: oy + (pr.y - (pr.glow.dy || 1.2)) * T * S,
                   r: (pr.glow.r || 2.2) * T * S, color: pr.glow.color });
    }

    // 全局色调：降饱和(mute 0-1) + 色罩(tone) + 墨绿 gloom(multiply 压绿压暗，参考图基调)
    if (st.mute) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = `rgba(128,128,128,${st.mute})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (st.gloom) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = st.gloom === true ? 'rgb(152,188,168)' : st.gloom;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (st.tone) { ctx.fillStyle = st.tone; ctx.fillRect(0, 0, W, H); }

    // 雨幕（st.rain：斜细雨，确定性伪随机 + 时间滚动）
    if (st.rain) {
      ctx.strokeStyle = 'rgba(190,215,230,.16)'; ctx.lineWidth = Math.max(1, S / 3);
      const n = 90, t = now * 0.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = ((i * 379 + 61) % 977) / 977 * (W + 200) - 100 + (t * 0.9 % W) * ((i % 3) ? 1 : -1) * 0;
        const py = ((i * 613 + t) % (H + 260)) - 130;
        ctx.moveTo(px, py); ctx.lineTo(px - 7 * (S / 2), py + 26 * (S / 2));
      }
      ctx.stroke();
    }

    // 夜色
    if (st.night) { ctx.fillStyle = 'rgba(10,12,26,.42)'; ctx.fillRect(0, 0, W, H); }
    // 灯光（夜色之后 screen 叠加，穿透夜幕）
    if (glows.length) {
      ctx.globalCompositeOperation = 'screen';
      for (let gi = 0; gi < glows.length; gi++) {
        const g = glows[gi];
        let rr = g.r;
        // 烛火式闪烁：双频正弦 + 相位错开（确定性，无状态）
        if (g.flick) {
          const f = 0.87 + 0.09 * Math.sin(now * 0.0036 + gi * 2.13) + 0.05 * Math.sin(now * 0.0121 + gi * 5.31);
          rr = g.r * f;
          ctx.globalAlpha = Math.min(1, f + 0.06);
        }
        const rg = ctx.createRadialGradient(g.x, g.y, 3, g.x, g.y, rr);
        rg.addColorStop(0, g.color || 'rgba(255,190,105,.55)');
        rg.addColorStop(0.5, 'rgba(255,170,80,.20)');
        rg.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = rg; ctx.fillRect(g.x - rr, g.y - rr, rr * 2, rr * 2);
        if (g.flick) ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // 暗角（st.vignette 可调强度，默认 .42；白天场景建议 .24-.3）
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${st.vignette != null ? st.vignette : 0.42})`);
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
