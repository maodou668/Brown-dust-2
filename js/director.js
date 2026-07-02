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
    this.root = UI.el(`
      <div id="scene-stage">
        <div class="sc-world" id="sc-world">
          <div class="story-bg bg-${cfg.bg || 'forest'}"></div>
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
      const el = UI.el(`<div class="sc-actor" data-actor="${id}"><div class="sc-bubble" style="display:none;"></div><img decoding="async"></div>`);
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
        case 'hide': if (act) act.el.style.display = 'none'; res(); break;
        case 'show': if (act) act.el.style.display = ''; res(); break;
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

window.Director = Director;
window.SceneStage = SceneStage;
