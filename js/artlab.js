// ============================================================
//  artlab.js —— 美术检视台（QA 工具）
//  用法: index.html?artlab   （或战斗演武场条里的「美术台」按钮）
//  功能: 选任意角色×服装的 field sprite → 方向键/WASD 走动(idle/run 八向)
//        → 放各施法动作(cast_*) → 看立绘(半身像)。纯美术资源检视，不涉战斗。
//  资源: 复用 BattleUI.FIELD_SPRITE + loadBattleSprite() 加载的 sprite 缓存。
// ============================================================
const ArtLab = {
  open() {
    const D = window.GameData;
    if (!window.BattleUI) return;
    BattleUI.loadBattleSprite();                     // 复用战斗的 sprite 加载器（含全部服装 key）
    this.keys = Object.keys(BattleUI.FIELD_SPRITE);  // 16 角色 + 各服装整套 sprite
    this.idx = 0;
    this.pos = { x: 0, y: 0 };                        // 画布内位移
    this.dir = 'south'; this.moving = false;
    this.cast = null;                                 // {anim, start}
    this.held = {};                                   // 按下的方向键
    this.buildDOM();
    this.bindKeys();
    this.select(0);
    this._raf = requestAnimationFrame((t) => this.loop(t));
  },

  keyInfo(key) {
    const D = window.GameData;
    if (D.CHARACTERS[key]) return { charId: key, name: D.CHARACTERS[key].name, sub: '初始', elem: D.CHARACTERS[key].element };
    const cos = D.COSTUMES && D.COSTUMES[key];
    if (cos) return { charId: cos.charId, name: (D.CHARACTERS[cos.charId] || {}).name || cos.charName, sub: cos.costumeName, elem: cos.element };
    return { charId: key, name: key, sub: '', elem: '' };
  },

  buildDOM() {
    const old = document.getElementById('artlab'); if (old) old.remove();
    const elIcon = (e) => (window.GameData.ELEMENTS[e] && window.GameData.ELEMENTS[e].icon) || '';
    const listHtml = this.keys.map((k, i) => {
      const inf = this.keyInfo(k);
      return `<button class="al-item" data-i="${i}">${elIcon(inf.elem)} ${inf.name}<span class="al-sub"> · ${inf.sub}</span></button>`;
    }).join('');
    const root = document.createElement('div'); root.id = 'artlab';
    root.innerHTML = `
      <style>
        #artlab{position:fixed;inset:0;z-index:9000;background:#14141c;color:#e8e8f0;display:flex;font-family:sans-serif;}
        #artlab .al-list{width:210px;overflow-y:auto;background:#1c1c28;border-right:1px solid #333;padding:6px;flex:0 0 auto;}
        #artlab .al-item{display:block;width:100%;text-align:left;margin:2px 0;padding:7px 8px;border:1px solid #2c2c3a;border-radius:6px;background:#22222e;color:#cfd;font-size:13px;cursor:pointer;}
        #artlab .al-item.on{background:#3a3a5a;border-color:#7a7aff;color:#fff;}
        #artlab .al-sub{color:#89a;font-size:11px;}
        #artlab .al-stage{flex:1;position:relative;display:flex;flex-direction:column;}
        #artlab canvas{flex:1;width:100%;display:block;image-rendering:pixelated;background:radial-gradient(circle at 50% 40%,#20202e,#101018);}
        #artlab .al-hud{position:absolute;top:10px;left:14px;font-size:14px;line-height:1.5;text-shadow:0 1px 2px #000;pointer-events:none;}
        #artlab .al-ctrl{padding:10px;background:#1c1c28;border-top:1px solid #333;display:flex;gap:14px;align-items:center;flex-wrap:wrap;}
        #artlab .al-dpad{display:grid;grid-template-columns:repeat(3,34px);grid-template-rows:repeat(3,34px);gap:3px;}
        #artlab .al-dpad button{background:#2a2a3a;border:1px solid #444;border-radius:5px;color:#cfd;font-size:15px;cursor:pointer;}
        #artlab .al-dpad button:active,#artlab .al-dpad button.on{background:#5a5a8a;color:#fff;}
        #artlab .al-casts button,#artlab .al-top button{background:#2e2e44;border:1px solid #55557a;border-radius:6px;color:#dfe;padding:7px 11px;margin:2px;font-size:13px;cursor:pointer;}
        #artlab .al-casts button:active{background:#6a6aa0;}
        #artlab .al-top{position:absolute;top:8px;right:12px;}
        #artlab .al-hint{color:#89a;font-size:12px;max-width:260px;}
        #artlab .al-port{position:absolute;inset:0;background:rgba(8,8,14,.92);display:none;align-items:center;justify-content:center;cursor:pointer;z-index:5;}
        #artlab .al-port img{max-height:88%;max-width:70%;image-rendering:auto;border:2px solid #445;border-radius:8px;}
        #artlab .al-port .al-pmiss{color:#89a;font-size:16px;}
      </style>
      <div class="al-list">${listHtml}</div>
      <div class="al-stage">
        <div class="al-hud" id="al-hud"></div>
        <div class="al-top">
          <button id="al-prev">◀ 上一个</button><button id="al-next">下一个 ▶</button><button id="al-fs">⛶ 全屏</button><button id="al-close">✕ 关闭</button>
        </div>
        <canvas id="al-canvas"></canvas>
        <div class="al-port" id="al-port"><img id="al-portimg" alt=""><span class="al-pmiss" id="al-pmiss" style="display:none;">该角色暂无半身像</span></div>
        <div class="al-ctrl">
          <div class="al-dpad">
            <button data-d="north-west">↖</button><button data-d="north">▲</button><button data-d="north-east">↗</button>
            <button data-d="west">◀</button><span></span><button data-d="east">▶</button>
            <button data-d="south-west">↙</button><button data-d="south">▼</button><button data-d="south-east">↘</button>
          </div>
          <div class="al-casts" id="al-casts"></div>
          <button id="al-portrait" class="al-item" style="width:auto;">🖼 看立绘</button>
          <div class="al-hint">方向键/WASD 走动看八向 idle/run；点施法动作放招；点「看立绘」看半身像。</div>
        </div>
      </div>`;
    document.body.appendChild(root);
    this.canvas = root.querySelector('#al-canvas');
    this.ctx = this.canvas.getContext('2d');
    root.querySelectorAll('.al-item[data-i]').forEach(b => b.onclick = () => this.select(+b.dataset.i));
    root.querySelector('#al-prev').onclick = () => this.select((this.idx - 1 + this.keys.length) % this.keys.length);
    root.querySelector('#al-next').onclick = () => this.select((this.idx + 1) % this.keys.length);
    root.querySelector('#al-close').onclick = () => this.close();
    root.querySelector('#al-portrait').onclick = () => this.showPortrait();
    root.querySelector('#al-fs').onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else (root.requestFullscreen ? root.requestFullscreen() : document.documentElement.requestFullscreen());
    };
    root.querySelector('#al-port').onclick = () => { root.querySelector('#al-port').style.display = 'none'; };
    // dpad: press-and-hold to walk that way
    root.querySelectorAll('.al-dpad button[data-d]').forEach(b => {
      const d = b.dataset.d;
      const on = (e) => { e.preventDefault(); this.held[d] = true; };
      const off = () => { this.held[d] = false; };
      b.addEventListener('mousedown', on); b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off); b.addEventListener('touchend', off);
    });
    this.root = root;
  },

  bindKeys() {
    const map = { ArrowUp: 'north', ArrowDown: 'south', ArrowLeft: 'west', ArrowRight: 'east', w: 'north', s: 'south', a: 'west', d: 'east' };
    this._kd = (e) => { const k = map[e.key]; if (k) { this.held[k] = true; e.preventDefault(); } };
    this._ku = (e) => { const k = map[e.key]; if (k) this.held[k] = false; if (e.key === 'Escape') this.close(); };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
  },

  select(i) {
    this.idx = i; this.pos = { x: 0, y: 0 }; this.cast = null;
    if (this.root) {
      this.root.querySelectorAll('.al-item[data-i]').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
      const item = this.root.querySelector(`.al-item[data-i="${i}"]`); if (item) item.scrollIntoView({ block: 'nearest' });
    }
    this.buildCasts();
  },

  spriteOf(key) { return BattleUI.sprites && BattleUI.sprites[key]; },

  buildCasts() {
    const box = this.root && this.root.querySelector('#al-casts'); if (!box) return;
    const key = this.keys[this.idx]; const sp = this.spriteOf(key);
    // manifest 可能还没加载完 —— 加载后重建
    if (!sp || !sp.ready) { box.innerHTML = '<span class="al-hint">加载中…</span>'; setTimeout(() => this.buildCasts(), 250); return; }
    const casts = Object.keys(sp.man.anims).filter(a => a.indexOf('cast') === 0);
    box.innerHTML = casts.length ? casts.map(c => `<button data-cast="${c}">✦ ${c}</button>`).join('') : '<span class="al-hint">无施法动作</span>';
    box.querySelectorAll('button[data-cast]').forEach(b => b.onclick = () => { this.cast = { anim: b.dataset.cast, start: performance.now() }; });
  },

  showPortrait() {
    const inf = this.keyInfo(this.keys[this.idx]);
    const c = window.GameData.CHARACTERS[inf.charId] || {};
    const src = c.portrait || c.art;
    const img = this.root.querySelector('#al-portimg'), miss = this.root.querySelector('#al-pmiss'), port = this.root.querySelector('#al-port');
    if (src) { img.src = src + '?v=' + (window.ASSET_VER || '1'); img.style.display = ''; miss.style.display = 'none'; }
    else { img.style.display = 'none'; miss.style.display = ''; }
    port.style.display = 'flex';
  },

  // 由按下的方向键推出 8 向 + 是否移动
  resolveDir() {
    const h = this.held; const up = h['north'], dn = h['south'], lf = h['west'], rt = h['east'];
    let dx = (rt ? 1 : 0) - (lf ? 1 : 0), dy = (dn ? 1 : 0) - (up ? 1 : 0);
    if (h['north-east']) { dx = 1; dy = -1; } if (h['north-west']) { dx = -1; dy = -1; }
    if (h['south-east']) { dx = 1; dy = 1; } if (h['south-west']) { dx = -1; dy = 1; }
    if (!dx && !dy) return null;
    const dir = (dy < 0 ? 'north' : dy > 0 ? 'south' : '') + ((dy && dx) ? '-' : '') + (dx > 0 ? 'east' : dx < 0 ? 'west' : '');
    return { dir, dx, dy };
  },

  loop(now) {
    this._raf = requestAnimationFrame((t) => this.loop(t));
    const key = this.keys[this.idx]; const sp = this.spriteOf(key);
    const cv = this.canvas, ctx = this.ctx;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.clearRect(0, 0, W, H);
    // 移动
    const mv = this.resolveDir();
    if (mv && !this.cast) {
      this.dir = mv.dir; this.moving = true;
      const spd = 2.2; this.pos.x += mv.dx * spd; this.pos.y += mv.dy * spd;
      const lim = 160; this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x)); this.pos.y = Math.max(-lim, Math.min(lim, this.pos.y));
    } else this.moving = false;
    // 选动画
    let anim = this.moving ? 'run' : 'idle', dir = this.dir, frame = 0;
    if (this.cast && sp && sp.ready) {
      const ca = this.cast.anim, arr0 = sp.imgs[ca] && sp.imgs[ca].north;
      if (arr0 && arr0.length) {
        const fps = (sp.man.fps && (sp.man.fps[ca] || sp.man.fps.cast)) || 12;
        frame = Math.floor((now - this.cast.start) / 1000 * fps);
        if (frame >= arr0.length) { this.cast = null; } else { anim = ca; dir = 'north'; }
      } else this.cast = null;
    }
    // 绘制
    let hud = '';
    if (sp && sp.ready) {
      let arr = (sp.imgs[anim] && sp.imgs[anim][dir] && sp.imgs[anim][dir].length) ? sp.imgs[anim][dir]
        : (sp.imgs.idle && sp.imgs.idle[dir] && sp.imgs.idle[dir].length) ? sp.imgs.idle[dir]
          : (sp.imgs.idle && sp.imgs.idle.south) || [];
      if (anim !== dir && this.cast == null) frame = Math.floor(now / 1000 * ((sp.man.fps && sp.man.fps[anim]) || 8)) % Math.max(1, arr.length);
      const im = arr[Math.min(frame, arr.length - 1)];
      const bb = sp.man.bbox, scale = Math.min(8, (H * 0.6) / bb.h);
      const cx = W / 2 + this.pos.x, cy = H * 0.62 + this.pos.y;
      if (im && im.width) {
        ctx.imageSmoothingEnabled = false;
        const dw = im.width * scale, dh = im.height * scale;
        const feetSrcY = bb.y + bb.h;
        ctx.drawImage(im, 0, 0, im.width, im.height, cx - dw / 2, cy - feetSrcY * scale, dw, dh);
      }
      const inf = this.keyInfo(key);
      hud = `<b>${inf.name} · ${inf.sub}</b><br>key: ${key}<br>动作: ${anim} / ${dir}<br>动画: ${Object.keys(sp.man.anims).join(', ')}`;
    } else hud = '加载中…';
    const hudEl = this.root && this.root.querySelector('#al-hud'); if (hudEl) hudEl.innerHTML = hud;
  },

  close() {
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    if (this.root) this.root.remove(); this.root = null;
    if (window.UI && UI.renderHome) UI.renderHome();
  },
};
window.ArtLab = ArtLab;
