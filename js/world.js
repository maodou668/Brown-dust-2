// ============================================================
//  斜俯视角 45°（等距）探索引擎 + 引导式章节推进
//  - 关卡以「节点」形式融入场景；到达当前目标节点自动触发剧情/战斗
//  - 完成后引导至下一目标，形成连贯沉浸的章节流程
//  - 瓦片程序化绘制（占位美术），结构优先，真实瓦片集可后续替换
// ============================================================

const World = {
  root: null, canvas: null, ctx: null, raf: 0,
  HW: 36, HH: 18,                 // 等距瓦片半宽/半高（菱形）—— 对应 72px 像素瓦片顶面
  chapter: null, grid: null, w: 0, h: 0, theme: null,
  cam: { x: 0, y: 0 }, vw: 0, vh: 0, dpr: 1,
  player: { x: 0, y: 0, dir: 'down', step: 0, color: '#b06bff' },
  input: { up: false, down: false, left: false, right: false },
  nodes: [], cur: null, busyTrigger: false, active: false,

  // 像素美术资源（统一 16-bit 风格，透明 PNG，2× 存储保证高 DPR 清晰）。
  // 资源源文件 144px 宽瓦片 / 96px 高小人，渲染按 CSS 尺寸缩放，统一比例。
  ART: {
    // 地面用无缝可平铺纹理（裁菱形填充，零接缝），而非带边框的菱形瓦片
    tex: { grass: 'assets/world/tex_grass.png', dirt: 'assets/world/tex_dirt.png', water: 'assets/world/tex_water.png' },
    props: { tree: 'assets/world/prop_tree.png', rock: 'assets/world/prop_rock.png' },
    // charId -> { down, up, left }（right 由 left 水平镜像）
    chars: { lecliss: { down: 'assets/world/lecliss_down.png', up: 'assets/world/lecliss_up.png', left: 'assets/world/lecliss_left.png' } },
  },
  TILE_W: 72,        // 瓦片顶面 CSS 宽度（= HW*2）
  imgCache: {},      // path -> Image
  patterns: {},      // 地面纹理 CanvasPattern
  artReady: false,   // 全部贴图就绪
  curChar: null,     // 当前主角方向贴图集

  // 节点在地图中的预设槽位（从下往上推进，制造「前进」感）
  SLOTS: [
    { x: 7.5, y: 11.5 }, { x: 5.5, y: 9.5 }, { x: 9.5, y: 8.5 },
    { x: 5.5, y: 6.5 }, { x: 10.5, y: 5.5 }, { x: 7.5, y: 3.5 },
  ],
  START: { x: 7.5, y: 13.2 },

  // ---------- 章节数据：关卡 = 节点 ----------
  CHAPTERS: [
    {
      id: 'ch1', name: '第一章 · 艾尔玛森林', theme: 'forest',
      desc: '初出茅庐的佣兵团，从森林边缘启程。',
      steps: [
        { type: 'story', story: 'stage1', label: '查看森林入口' },
        { type: 'npc', label: '与老猎人交谈', icon: '🧓',
          text: '老猎人：「森林里的哥布林最近不太安分。年轻人，先帮我清掉它们，深处的狼群就交给你了。」' },
        { type: 'battle', stage: 1, label: '击退哥布林群' },
        { type: 'story', story: 'stage2', label: '深入森林' },
        { type: 'battle', stage: 2, label: '讨伐暗影狼群' },
      ],
    },
    {
      id: 'ch2', name: '第二章 · 矿洞与山脊', theme: 'cave',
      desc: '循着魔物的踪迹，深入废弃矿洞与诅咒山脊。',
      steps: [
        { type: 'story', story: 'stage3', label: '进入废弃矿洞' },
        { type: 'battle', stage: 3, label: '击败食人魔' },
        { type: 'story', story: 'stage4', label: '登上诅咒山脊' },
        { type: 'battle', stage: 4, label: '讨伐巨魔王' },
      ],
    },
    {
      id: 'ch3', name: '第三章 · 魔王城', theme: 'castle',
      desc: '一切罪恶的源头，魔王巴尔的王座。',
      steps: [
        { type: 'story', story: 'stage5', label: '闯入魔王城' },
        { type: 'battle', stage: 5, label: '决战魔王巴尔' },
      ],
    },
    {
      id: 'ch4', name: '第四章 · 永夜降临', theme: 'castle',
      desc: '魔王虽除，永夜未散。真正的黑暗仍在等待。',
      steps: [
        { type: 'story', story: 'stage6', label: '踏入破碎边境' },
        { type: 'battle', stage: 6, label: '扫荡亡魂' },
        { type: 'story', story: 'stage7', label: '深入永夜回廊' },
        { type: 'battle', stage: 7, label: '终结暗影女皇' },
      ],
    },
  ],

  getChapter(id) { return this.CHAPTERS.find(c => c.id === id); },
  progress(id) { return Game.state.chapterProgress[id] || 0; },
  isChapterUnlocked(idx) {
    if (idx === 0) return true;
    const prev = this.CHAPTERS[idx - 1];
    return this.progress(prev.id) >= prev.steps.length;
  },
  isChapterDone(c) { return this.progress(c.id) >= c.steps.length; },

  // ---------- 打开章节 ----------
  openChapter(id) {
    const ch = this.getChapter(id);
    if (!ch) return;
    if (Game.state.team.length === 0) { UI.toast('请先在「佣兵」页编入出战队伍'); Main.switchScreen('roster'); return; }
    this.chapter = ch; this.theme = ch.theme; this.w = 15; this.h = 15;
    this.buildDOM();
    this.buildMap(ch);
    this.active = true; this.busyTrigger = false;
    this.start();
    this.announceObjective(false);
  },

  buildDOM() {
    const old = document.getElementById('world-screen');
    if (old) old.remove();
    this.root = UI.el(`
      <div id="world-screen">
        <div class="world-top">
          <span id="world-title">🗺️ ${this.chapter.name}</span>
          <button class="ghost-btn" id="world-exit" title="离开">✕</button>
        </div>
        <div class="world-obj" id="world-obj"></div>
        <canvas id="world-canvas"></canvas>
        <div class="world-ctrl">
          <div class="dpad">
            <button class="dbtn up"    data-dir="up">▲</button>
            <button class="dbtn left"  data-dir="left">◀</button>
            <button class="dbtn right" data-dir="right">▶</button>
            <button class="dbtn down"  data-dir="down">▼</button>
          </div>
          <button class="act-btn" id="world-act" disabled>互动</button>
        </div>
      </div>`);
    document.body.appendChild(this.root);
    this.canvas = this.root.querySelector('#world-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.root.querySelector('#world-exit').onclick = () => this.close();
    this.root.querySelector('#world-act').onclick = () => this.tryTrigger(true);
    this.root.querySelectorAll('.dbtn').forEach(b => {
      const dir = b.dataset.dir;
      const on = (e) => { e.preventDefault(); this.input[dir] = true; };
      const off = (e) => { e.preventDefault(); this.input[dir] = false; };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
      b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
    });
    this._keyHandler = (e) => {
      const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const dir = m[e.key];
      if (!dir) { if ((e.key === ' ' || e.key === 'Enter') && e.type === 'keydown') this.tryTrigger(true); return; }
      this.input[dir] = (e.type === 'keydown'); e.preventDefault();
    };
    window.addEventListener('keydown', this._keyHandler);
    window.addEventListener('keyup', this._keyHandler);
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = rect.width; this.vh = rect.height;
    this.canvas.width = Math.floor(this.vw * this.dpr);
    this.canvas.height = Math.floor(this.vh * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  buildMap(ch) {
    // 网格：边界树 + 草地 + 稀疏装饰障碍
    const grid = [];
    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) {
        row.push((x === 0 || y === 0 || x === this.w - 1 || y === this.h - 1) ? 'tree' : 'grass');
      }
      grid.push(row);
    }
    const deco = [[2,2],[12,2],[3,11],[12,11],[2,7],[12,8],[6,12],[9,2]];
    deco.forEach(([x, y], i) => { grid[y][x] = (i % 3 === 0) ? 'rock' : 'tree'; });
    // 池塘
    [[11,3],[12,3],[11,4]].forEach(([x, y]) => grid[y][x] = 'water');
    this.grid = grid;

    // 花装饰
    this.flowers = [];
    for (let i = 0; i < 40; i++) {
      const x = (i * 7) % this.w, y = (i * 11) % this.h;
      if (grid[y][x] === 'grass' && i % 4 === 0) this.flowers.push([x + 0.5, y + 0.5, i % 3]);
    }

    // 节点 = 步骤
    const prog = this.progress(ch.id);
    this.nodes = ch.steps.map((st, i) => {
      const slot = this.SLOTS[i] || this.SLOTS[this.SLOTS.length - 1];
      const icon = st.icon || (st.type === 'battle' ? '⚔️' : st.type === 'story' ? '💬' : '❔');
      // 确保节点格可走
      const gx = Math.floor(slot.x), gy = Math.floor(slot.y);
      if (this.isSolid(grid[gy][gx])) grid[gy][gx] = 'grass';
      return { ...st, idx: i, x: slot.x, y: slot.y, icon, done: i < prog };
    });
    this.cur = this.nodes[prog] || null;

    // 剧情叙事：一条从森林边缘（起点）蜿蜒通往深处的「路」（呼应剧情「守的不是地方——是路」）
    const route = [this.START, ...this.nodes.map(n => ({ x: n.x, y: n.y }))];
    for (let i = 0; i < route.length - 1; i++) this.markPath(grid, route[i], route[i + 1]);

    // 主角
    this.player.x = this.START.x; this.player.y = this.START.y; this.player.dir = 'up';
    const lead = Game.state.team[0] && Game.getOwned(Game.state.team[0]);
    this.player.color = lead ? window.GameData.CHARACTERS[lead.charId].color : '#b06bff';
    this.loadArt(lead && lead.charId);
  },

  // 把两点之间的草地格标记为「路」（dirt），构成叙事化的森林小径
  markPath(grid, a, b) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 3);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
      for (const [ox, oy] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
        const gx = Math.floor(cx + ox), gy = Math.floor(cy + oy);
        if (gx > 0 && gy > 0 && gx < this.w - 1 && gy < this.h - 1 && grid[gy][gx] === 'grass') grid[gy][gx] = 'path';
      }
    }
  },

  // 统一加载像素美术（纹理/道具/主角）。异步，未就绪时回退矢量占位。
  loadArt(charId) {
    const ver = (window.ASSET_VER || '');
    const get = (path) => {
      if (this.imgCache[path]) return this.imgCache[path];
      const img = new Image();
      img.src = path + (ver ? '?v=' + ver : '');
      this.imgCache[path] = img;
      return img;
    };
    // 主角方向贴图：没有专属的角色暂时统一用 lecliss 作占位
    const cc = (charId && this.ART.chars[charId]) || this.ART.chars.lecliss;
    this.curChar = { down: get(cc.down), up: get(cc.up), left: get(cc.left) };
    // 预加载地面纹理与道具
    const texImgs = Object.fromEntries(Object.entries(this.ART.tex).map(([k, p]) => [k, get(p)]));
    const all = [
      ...Object.values(texImgs),
      ...Object.values(this.ART.props).map(get),
      ...Object.values(this.curChar),
    ];
    const check = () => {
      if (!all.every(i => i.complete && i.naturalWidth)) return;
      this.artReady = true;
      // 构建地面纹理 pattern（一次）
      if (!Object.keys(this.patterns).length) {
        for (const k in texImgs) { try { this.patterns[k] = this.ctx.createPattern(texImgs[k], 'repeat'); } catch (e) {} }
      }
    };
    all.forEach(i => { i.onload = check; });
    check();
  },

  img(path) { return this.imgCache[path]; },

  isSolid(t) { return t === 'tree' || t === 'rock' || t === 'water'; },

  // ---------- 坐标变换 ----------
  worldToIso(wx, wy) { return { x: (wx - wy) * this.HW, y: (wx + wy) * this.HH }; },

  // ---------- 主循环 ----------
  start() {
    cancelAnimationFrame(this.raf);
    let last = performance.now();
    const loop = (ts) => {
      if (!this.active) return;
      const dt = Math.min(40, ts - last); last = ts;
      this.update(dt); this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  stop() { this.active = false; cancelAnimationFrame(this.raf); },
  resume() { if (this.root) { this.active = true; this.busyTrigger = false; this.start(); } },

  update(dt) {
    const p = this.player; this._dustDt = dt;
    let dx = 0, dy = 0;
    if (this.input.up) { dx -= 1; dy -= 1; }
    if (this.input.down) { dx += 1; dy += 1; }
    if (this.input.left) { dx -= 1; dy += 1; }
    if (this.input.right) { dx += 1; dy -= 1; }
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const sp = 0.062 * (dt / 16.67);
      const nx = p.x + (dx / len) * sp, ny = p.y + (dy / len) * sp;
      if (!this.blockedWorld(nx, p.y)) p.x = nx;
      if (!this.blockedWorld(p.x, ny)) p.y = ny;
      // 朝向按「屏幕方向」判定（等距下世界 dx/dy 始终等量，必须换算到屏幕速度）
      const sdx = (dx - dy) * this.HW, sdy = (dx + dy) * this.HH;
      p.dir = Math.abs(sdx) >= Math.abs(sdy) ? (sdx > 0 ? 'right' : 'left') : (sdy > 0 ? 'down' : 'up');
      p.step += dt;
    } else p.step = 0;

    // 镜头
    const iso = this.worldToIso(p.x, p.y);
    const minX = -this.h * this.HW, maxX = this.w * this.HW, maxY = (this.w + this.h) * this.HH;
    this.cam.x = this.clamp(iso.x - this.vw / 2, minX - 40, maxX + 40 - this.vw);
    this.cam.y = this.clamp(iso.y - this.vh / 2, -40, maxY + 60 - this.vh);

    // 到达当前目标 → 自动触发
    if (this.cur && !this.busyTrigger) {
      const d = Math.hypot(this.cur.x - p.x, this.cur.y - p.y);
      const act = this.root.querySelector('#world-act');
      const replayable = this.nodes.filter(n => n.done && n.type === 'battle');
      // 当前目标范围内
      if (d < 0.7) { this.tryTrigger(false); }
      // 互动按钮：当前目标 或 可重打的已完成战斗
      let near = (d < 1.0) ? this.cur : null;
      if (!near) {
        for (const n of replayable) { if (Math.hypot(n.x - p.x, n.y - p.y) < 1.0) { near = n; break; } }
      }
      this._near = near;
      if (act) { act.disabled = !near; act.textContent = near && near.type === 'battle' ? '战斗' : '互动'; }
    }
  },

  clamp(v, lo, hi) { if (lo > hi) return (lo + hi) / 2; return Math.max(lo, Math.min(hi, v)); },

  blockedWorld(wx, wy) {
    const r = 0.28;
    const pts = [[wx - r, wy - r], [wx + r, wy - r], [wx - r, wy + r], [wx + r, wy + r]];
    return pts.some(([x, y]) => {
      const tx = Math.floor(x), ty = Math.floor(y);
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
      return this.isSolid(this.grid[ty][tx]);
    });
  },

  // ---------- 触发 ----------
  tryTrigger(manual) {
    if (this.busyTrigger) return;
    const n = manual ? (this._near || this.cur) : this.cur;
    if (!n) return;
    // 已完成的可重打战斗
    if (n.done && n.type === 'battle') {
      if (!manual) return;
      this.busyTrigger = true; this.stop();
      const stage = window.GameData.STAGES.find(s => s.id === n.stage);
      BattleUI.start(stage, () => this.resume());
      return;
    }
    if (n !== this.cur) return;
    this.busyTrigger = true; this.stop();
    if (n.type === 'story') {
      Story.play(n.story, () => this.completeStep());
    } else if (n.type === 'npc') {
      this.npcDialog(n, () => this.completeStep());
    } else if (n.type === 'battle') {
      const stage = window.GameData.STAGES.find(s => s.id === n.stage);
      BattleUI.start(stage, () => {
        if (Battle.result === 'win') this.completeStep();
        else this.resume(); // 失败/撤退：留在当前目标重试
      });
    }
  },

  completeStep() {
    const id = this.chapter.id;
    const prog = this.progress(id);
    if (this.cur && this.cur.idx === prog) {
      Game.state.chapterProgress[id] = prog + 1;
      // 里程碑奖励（首次完成该步骤）：作为「累计 100 抽」的主线发放部分
      const gem = this.cur.type === 'battle' ? 600 : this.cur.type === 'story' ? 300 : 200;
      Game.state.gem += gem;
      Game.save();
      this.cur.done = true;
      UI.updateResources();
      UI.toast(`🎯 里程碑奖励：💎${gem}`);
    }
    const next = this.nodes[this.progress(id)];
    this.cur = next || null;
    if (next) { this.resume(); this.announceObjective(true); }
    else { this.chapterCompleteReward(); this.chapterComplete(); }
  },

  /** 章节通关额外奖励 */
  chapterCompleteReward() {
    Game.state.gem += 600;
    Game.save();
    UI.updateResources();
  },

  announceObjective(isNew) {
    const obj = this.root && this.root.querySelector('#world-obj');
    if (!obj) return;
    if (this.cur) {
      obj.innerHTML = `<span class="obj-tag">目标</span> ${this.cur.label}`;
      if (isNew) { obj.classList.remove('flash'); void obj.offsetWidth; obj.classList.add('flash'); }
    } else obj.textContent = '';
  },

  chapterComplete() {
    this.stop();
    const m = UI.openModal(`
      <div class="result-modal">
        <div class="result-title win" style="font-size:24px;">章节完成！</div>
        <p class="muted">${this.chapter.name}</p>
        <p style="margin-top:8px;">恭喜通关本章节，新的征程已经解锁。</p>
      </div>
      <div class="close-row" style="justify-content:center;"><button class="btn" id="cc-ok">返回</button></div>`,
      { noBackdropClose: true });
    m.querySelector('#cc-ok').onclick = () => { UI.closeModal(m); this.close(); };
  },

  npcDialog(n, onDone) {
    const m = UI.openModal(`
      <h2>${n.icon} ${n.label.replace('与', '').replace('交谈', '')}</h2>
      <p style="line-height:1.7;margin:10px 0;">${n.text}</p>
      <div class="close-row"><button class="btn" id="npc-ok">好的</button></div>`, { noBackdropClose: true });
    m.querySelector('#npc-ok').onclick = () => { UI.closeModal(m); if (onDone) onDone(); };
  },

  // ---------- 渲染（等距） ----------
  render() {
    const ctx = this.ctx, pal = this.palette();
    ctx.imageSmoothingEnabled = false;   // 像素锐利
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, this.vw, this.vh);

    const ready = this.artReady && Object.keys(this.patterns).length;
    const terrainTex = t => t === 'water' ? 'water' : t === 'path' ? 'dirt' : 'grass';
    // 纹理锚定到世界坐标（随相机平移），避免地面纹理「漂移」
    if (ready && typeof DOMMatrix !== 'undefined') {
      const m = new DOMMatrix().translateSelf(-Math.round(this.cam.x), -Math.round(this.cam.y));
      for (const k in this.patterns) { try { this.patterns[k].setTransform(m); } catch (e) {} }
    }

    // 地面：无缝纹理裁菱形填充（相邻格共享连续纹理 → 零接缝）
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.grid[y][x];
        const iso = this.worldToIso(x + 0.5, y + 0.5);
        const sx = iso.x - this.cam.x, sy = iso.y - this.cam.y;
        if (sx < -this.HW * 2 || sx > this.vw + this.HW * 2 || sy < -this.HH * 4 || sy > this.vh + this.HH * 4) continue;
        if (ready) {
          this.fillDiamondTex(sx, sy, this.patterns[terrainTex(t)]);
        } else {
          const ground = (t === 'water') ? pal.water : ((x + y) % 2 === 0 ? pal.grass : pal.grass2);
          this.diamond(sx, sy, ground);
        }
      }
    }

    // 立面物体（树/石/节点/主角）按深度排序
    const objs = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const t = this.grid[y][x];
      if (t === 'tree' || t === 'rock') objs.push({ d: x + y, wx: x + 0.5, wy: y + 0.5, kind: t });
    }
    this.nodes.forEach(n => objs.push({ d: n.x + n.y, wx: n.x, wy: n.y, kind: 'node', node: n }));
    objs.push({ d: this.player.x + this.player.y, wx: this.player.x, wy: this.player.y, kind: 'player' });
    objs.sort((a, b) => a.d - b.d);
    objs.forEach(o => {
      const iso = this.worldToIso(o.wx, o.wy);
      const sx = iso.x - this.cam.x, sy = iso.y - this.cam.y;
      if (sx < -80 || sx > this.vw + 80 || sy < -160 || sy > this.vh + 80) return;
      if (o.kind === 'tree') this.drawProp(sx, sy, 'tree', 48);
      else if (o.kind === 'rock') this.drawProp(sx, sy, 'rock', 52);
      else if (o.kind === 'node') this.drawNode(sx, sy, o.node);
      else this.drawPlayer(sx, sy);
    });

    // 纵深氛围：越往森林深处（屏上方）越阴冷，叠一层冷色渐变
    const g = ctx.createLinearGradient(0, 0, 0, this.vh);
    g.addColorStop(0, 'rgba(12,18,32,0.34)');
    g.addColorStop(0.55, 'rgba(12,18,32,0.05)');
    g.addColorStop(1, 'rgba(40,30,18,0.0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);

    // 飘落的褐尘（呼应剧情：尘落之后森林再无安宁）
    this.drawDust();

    // 离屏目标的边缘指引箭头
    this.drawGuideArrow();
  },

  // 纹理裁菱形填充（轻微外扩 0.6px 防止相邻菱形出现发丝缝）
  fillDiamondTex(cx, cy, pattern) {
    if (!pattern) return;
    const ctx = this.ctx, hw = this.HW + 0.6, hh = this.HH + 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath();
    ctx.fillStyle = pattern; ctx.fill();
  },

  // 褐尘粒子（屏幕空间，循环飘落）
  drawDust() {
    const ctx = this.ctx;
    if (!this.dust) {
      this.dust = [];
      for (let i = 0; i < 46; i++) this.dust.push({ x: Math.random() * this.vw, y: Math.random() * this.vh, s: 0.6 + Math.random() * 1.6, v: 6 + Math.random() * 14, d: Math.random() * 6.28 });
    }
    const dt = this._dustDt || 16;
    ctx.save();
    for (const p of this.dust) {
      p.y += p.v * dt / 1000; p.x += Math.sin((performance.now() / 900) + p.d) * 0.25;
      if (p.y > this.vh + 4) { p.y = -4; p.x = Math.random() * this.vw; }
      ctx.globalAlpha = 0.28 + (p.s / 2.2) * 0.4;
      ctx.fillStyle = '#9c7a4e';
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.restore();
  },

  // 像素道具（底部贴地，立绘式 billboard）
  drawProp(sx, sy, kind, w) {
    const ctx = this.ctx;
    if (!this.artReady) { this.bill(sx, sy, kind === 'tree' ? '🌲' : '🪨', 26); return; }
    const im = this.img(this.ART.props[kind]);
    const h = im.naturalHeight * (w / im.naturalWidth);
    // 软阴影
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + this.HH * 0.35, w * 0.32, w * 0.16, 0, 0, 7); ctx.fill();
    ctx.drawImage(im, Math.round(sx - w / 2), Math.round(sy + this.HH * 0.4 - h), w, h);
  },

  diamond(cx, cy, color) {
    const ctx = this.ctx, hw = this.HW, hh = this.HH;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1; ctx.stroke();
  },

  bill(sx, sy, emoji, size) {
    const ctx = this.ctx;
    ctx.font = size + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(emoji, sx, sy + this.HH);
  },

  drawNode(sx, sy, n) {
    const ctx = this.ctx;
    const locked = false;
    ctx.save();
    if (n.done && n.type !== 'battle') ctx.globalAlpha = 0.4;
    // 当前目标光环
    if (n === this.cur) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 280);
      ctx.beginPath(); ctx.arc(sx, sy, 18 + pulse * 4, 0, 7);
      ctx.fillStyle = 'rgba(255,220,120,' + (0.15 + pulse * 0.18) + ')'; ctx.fill();
    }
    ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(n.done ? (n.type === 'battle' ? n.icon : '✓') : n.icon, sx, sy + 6);
    if (n === this.cur) {
      // 跳动箭头
      const bob = Math.sin(performance.now() / 200) * 3;
      ctx.font = '16px serif'; ctx.fillStyle = '#ffd35a';
      ctx.fillText('▼', sx, sy - 22 + bob);
    }
    ctx.restore();
  },

  drawPlayer(sx, sy) {
    const ctx = this.ctx, p = this.player;
    const moving = p.step > 0;
    // 动画：移动=走路（较快上下踏步+左右轻摆+触地挤压），静止=呼吸（缓慢起伏）
    const now = performance.now();
    let bob, sway = 0, squash = 1;
    if (moving) {
      const phase = p.step / 95;
      bob = Math.abs(Math.sin(phase)) * 3.2;          // 踏步起伏
      sway = Math.sin(phase) * 1.2;                    // 身体左右轻摆
      squash = 1 - Math.abs(Math.sin(phase)) * 0.05;   // 触地轻微压缩
    } else {
      bob = (Math.sin(now / 620) * 0.5 + 0.5) * 1.6;   // 呼吸
      squash = 1 + Math.sin(now / 620) * 0.012;
    }
    // 地面阴影（移动时随踏步缩放）
    const shScale = moving ? (0.85 + Math.abs(Math.sin(p.step / 95)) * 0.2) : 1;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath();
    ctx.ellipse(sx, sy + this.HH * 0.35, 13 * shScale, 5.5 * shScale, 0, 0, 7); ctx.fill();

    if (this.curChar) {
      const flip = (p.dir === 'right');
      const im = flip ? this.curChar.left : (this.curChar[p.dir] || this.curChar.down);
      if (im && im.complete && im.naturalWidth) {
        const H = 52 * squash, W = (52) * (im.naturalWidth / im.naturalHeight);
        const dx = Math.round(sx - W / 2 + sway), dy = Math.round(sy + this.HH * 0.4 - H - bob);
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (flip) { ctx.translate(dx + W, dy); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, W, H); }
        else ctx.drawImage(im, dx, dy, W, H);
        ctx.restore();
        return;
      }
    }
    // 占位（贴图未就绪时）
    ctx.fillStyle = p.color; this.rr(sx - 8, sy - 18 - bob, 16, 18, 5); ctx.fill();
    ctx.fillStyle = '#ffe0c0'; ctx.beginPath(); ctx.arc(sx, sy - 22 - bob, 7, 0, 7); ctx.fill();
  },

  rr(x, y, w, h, r) {
    const ctx = this.ctx; ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  },

  drawGuideArrow() {
    if (!this.cur) return;
    const iso = this.worldToIso(this.cur.x, this.cur.y);
    const sx = iso.x - this.cam.x, sy = iso.y - this.cam.y;
    if (sx >= 20 && sx <= this.vw - 20 && sy >= 20 && sy <= this.vh - 20) return; // 在屏内不画
    const cx = this.vw / 2, cy = this.vh / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const ex = cx + Math.cos(ang) * (Math.min(this.vw, this.vh) / 2 - 28);
    const ey = cy + Math.sin(ang) * (Math.min(this.vw, this.vh) / 2 - 28);
    const ctx = this.ctx; ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  palette() {
    return ({
      forest: { bg: '#16241a', grass: '#2e5a34', grass2: '#356b3c', water: '#2a6aa0' },
      cave:   { bg: '#130f0c', grass: '#3a2f28', grass2: '#46382f', water: '#3a6a8a' },
      castle: { bg: '#160a12', grass: '#3a2436', grass2: '#46304a', water: '#5a3a6a' },
    })[this.theme] || { bg: '#181818', grass: '#3a3a3a', grass2: '#444', water: '#2a6aa0' };
  },

  close() {
    this.stop();
    if (this._keyHandler) { window.removeEventListener('keydown', this._keyHandler); window.removeEventListener('keyup', this._keyHandler); }
    if (this.root) { this.root.remove(); this.root = null; }
    Main.refreshCurrent();
  },
};

window.World = World;
