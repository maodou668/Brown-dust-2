// ============================================================
//  斜俯视角 45°（等距）探索引擎 + 引导式章节推进
//  - 关卡以「节点」形式融入场景；到达当前目标节点自动触发剧情/战斗
//  - 完成后引导至下一目标，形成连贯沉浸的章节流程
//  - 瓦片程序化绘制（占位美术），结构优先，真实瓦片集可后续替换
// ============================================================

const World = {
  root: null, canvas: null, ctx: null, raf: 0,
  chapter: null, grid: null, w: 0, h: 0, theme: null,
  cam: { x: 0, y: 0 }, vw: 0, vh: 0, dpr: 1,
  player: { x: 0, y: 0, dir: 'down', step: 0, color: '#b06bff' },
  input: { up: false, down: false, left: false, right: false },
  nodes: [], cur: null, busyTrigger: false, active: false,

  // 顶视角 tilemap —— Kenney「Tiny」系列 CC0 图集（16px 格，统一风格的成套美术）
  ATLAS: { town: 'assets/world/kenney/town.png', dungeon: 'assets/world/kenney/dungeon.png' },
  TILE: 16, SCALE: 3,            // 屏上 48px / 格
  TIDX: {
    grass: [0, 1], flower: 2,
    dirt9: [12, 13, 14, 24, 25, 26, 36, 37, 38],   // 3×3 自动拼接（草地上的土路）
    pines: [{ top: 3, bot: 15 }, { top: 4, bot: 16 }],
    bush: [5, 27, 28], mush: 29,
    hero: { atlas: 'dungeon', idx: 84 },           // 紫袍法师（契合炽焰魔女）
    mon: { atlas: 'dungeon', idx: [108, 110, 121] },
  },
  atlasImg: {}, atlasReady: false,

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
    // 在战斗节点附近散布几只小怪（叙事点缀：森林里的哥布林/魔物）
    this.mons = [];
    this.nodes.filter(n => n.type === 'battle').forEach(n => {
      const idx = this.TIDX.mon.idx[(this.vrand(n.x | 0, n.y | 0) * 3) | 0];
      this.mons.push({ x: n.x + 0.85, y: n.y + 0.5, idx, ph: this.vrand(n.x, n.y) * 6.28 });
    });
    this.buildScatter();
    this.loadArt();
  },

  // 把两点之间的草地格标记为「路」（dirt），构成叙事化的森林小径（约 2 格宽）
  markPath(grid, a, b) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
      for (const [ox, oy] of [[0, 0], [0.5, 0]]) {
        const gx = Math.floor(cx + ox), gy = Math.floor(cy + oy);
        if (gx > 0 && gy > 0 && gx < this.w - 1 && gy < this.h - 1 && grid[gy][gx] === 'grass') grid[gy][gx] = 'path';
      }
    }
  },

  // 在空地上确定性散布装饰（灌木/蘑菇/小树），让场景丰富不单一；纯装饰不阻挡
  buildScatter() {
    this.scatter = [];
    const free = (x, y) => this.grid[y] && this.grid[y][x] === 'grass'
      && !this.nodes.some(n => Math.abs(n.x - x) < 1.5 && Math.abs(n.y - y) < 1.5)
      && Math.abs(this.START.x - x) > 1.5;
    for (let y = 2; y < this.h - 2; y++) {
      for (let x = 2; x < this.w - 2; x++) {
        if (!free(x, y)) continue;
        const r = this.vrand(x * 3 + 1, y * 5 + 2);
        let kind = null;
        if (r > 0.92) kind = 'tree';
        else if (r > 0.78) kind = 'bush';
        else if (r > 0.66) kind = 'mush';
        if (kind) this.scatter.push({ x: x + 0.5, y: y + 0.5, kind, gx: x, gy: y });
      }
    }
  },

  // 加载图集（异步，未就绪时回退占位）
  loadArt() {
    const ver = (window.ASSET_VER || '');
    this.atlasImg = {}; const all = [];
    for (const k in this.ATLAS) {
      const img = new Image(); img.src = this.ATLAS[k] + (ver ? '?v=' + ver : '');
      this.atlasImg[k] = img; all.push(img);
    }
    const check = () => { this.atlasReady = all.every(i => i.complete && i.naturalWidth); };
    all.forEach(i => { i.onload = check; }); check();
  },

  // 确定性伪随机（按格选变体，保证每次渲染一致）
  vrand(x, y) { let h = ((x | 0) * 73856093) ^ ((y | 0) * 19349663); h = (h ^ (h >>> 13)) >>> 0; return h / 4294967295; },

  // 画图集某格到屏幕（dx,dy 屏幕左上角；scale 默认整图缩放）
  blit(atlasKey, idx, dx, dy, scale) {
    const a = this.atlasImg[atlasKey]; if (!a || !a.naturalWidth) return;
    const cols = (a.naturalWidth / this.TILE) | 0;
    const sx = (idx % cols) * this.TILE, sy = ((idx / cols) | 0) * this.TILE;
    const w = this.TILE * (scale || this.SCALE);
    this.ctx.drawImage(a, sx, sy, this.TILE, this.TILE, Math.round(dx), Math.round(dy), Math.round(w), Math.round(w));
  },

  isSolid(t) { return t === 'tree' || t === 'rock' || t === 'water'; },

  // ---------- 坐标变换（顶视角正交）----------
  worldToScreen(wx, wy) { const t = this.TILE * this.SCALE; return { x: wx * t, y: wy * t }; },

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
    if (this.input.left) dx -= 1;
    if (this.input.right) dx += 1;
    if (this.input.up) dy -= 1;
    if (this.input.down) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const sp = 0.075 * (dt / 16.67);
      const nx = p.x + (dx / len) * sp, ny = p.y + (dy / len) * sp;
      if (!this.blockedWorld(nx, p.y)) p.x = nx;
      if (!this.blockedWorld(p.x, ny)) p.y = ny;
      p.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      p.step += dt;
    } else p.step = 0;

    // 镜头（顶视角，限制在地图范围内）
    const TS = this.TILE * this.SCALE;
    this.cam.x = this.clamp(p.x * TS - this.vw / 2, 0, Math.max(0, this.w * TS - this.vw));
    this.cam.y = this.clamp(p.y * TS - this.vh / 2, 0, Math.max(0, this.h * TS - this.vh));

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

  // ---------- 渲染（顶视角 tilemap）----------
  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#4f7a3a'; ctx.fillRect(0, 0, this.vw, this.vh);   // 草地底色
    if (!this.atlasReady) { this.drawPlayer(); return; }

    const TS = this.TILE * this.SCALE;
    const x0 = Math.max(0, ((this.cam.x / TS) | 0) - 1), x1 = Math.min(this.w - 1, (((this.cam.x + this.vw) / TS) | 0) + 1);
    const y0 = Math.max(0, ((this.cam.y / TS) | 0) - 1), y1 = Math.min(this.h - 1, (((this.cam.y + this.vh) / TS) | 0) + 2);

    // 1) 地面层（草地 + 自动拼接土路 + 偶发花）
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const sx = x * TS - this.cam.x, sy = y * TS - this.cam.y;
        this.blit('town', this.vrand(x, y) > 0.86 ? this.TIDX.grass[1] : this.TIDX.grass[0], sx, sy);
        const t = this.grid[y][x];
        if (t === 'path') this.blit('town', this.dirtAuto(x, y), sx, sy);
        else if (t === 'grass' && this.vrand(x + 7, y + 3) > 0.88) this.blit('town', this.TIDX.flower, sx, sy);
      }
    }

    // 2) 物体层（树/灌木/节点/小怪/主角）按 y 排序，后画的盖前面
    const objs = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const t = this.grid[y][x];
      if (t === 'tree' || t === 'rock' || t === 'water') objs.push({ sy: y + 0.9, kind: 'deco', tt: t, gx: x, gy: y });
    }
    (this.scatter || []).forEach(s => objs.push({ sy: s.y, kind: 'scatter', s }));
    this.nodes.forEach(n => objs.push({ sy: n.y, kind: 'node', node: n }));
    (this.mons || []).forEach(m => objs.push({ sy: m.y, kind: 'mon', m }));
    objs.push({ sy: this.player.y, kind: 'player' });
    objs.sort((a, b) => a.sy - b.sy);
    for (const o of objs) {
      if (o.kind === 'deco') this.drawDeco(o.gx, o.gy, o.tt);
      else if (o.kind === 'scatter') this.drawScatter(o.s);
      else if (o.kind === 'node') this.drawNodeTD(o.node);
      else if (o.kind === 'mon') this.drawMon(o.m);
      else this.drawPlayer();
    }

    // 纵深氛围：越往森林深处（屏上方）越阴冷
    const g = ctx.createLinearGradient(0, 0, 0, this.vh);
    g.addColorStop(0, 'rgba(12,18,32,0.30)'); g.addColorStop(0.55, 'rgba(12,18,32,0.04)'); g.addColorStop(1, 'rgba(40,30,18,0.0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);

    this.drawDust();        // 飘落褐尘（呼应剧情）
    this.drawGuideArrow();
  },

  // 土路 3×3 自动拼接（按四邻是否为路选角/边/中）
  dirtAuto(x, y) {
    const P = (xx, yy) => xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && this.grid[yy][xx] === 'path';
    const col = !P(x - 1, y) ? 0 : !P(x + 1, y) ? 2 : 1;
    const row = !P(x, y - 1) ? 0 : !P(x, y + 1) ? 2 : 1;
    return this.TIDX.dirt9[row * 3 + col];
  },

  // 树（两格高松树）/ 灌木（石、水占位）
  drawDeco(x, y, tt) {
    const TS = this.TILE * this.SCALE;
    const sx = x * TS - this.cam.x, sy = y * TS - this.cam.y;
    if (tt === 'tree') {
      const p = this.TIDX.pines[this.vrand(x, y) > 0.5 ? 1 : 0];
      this.blit('town', p.bot, sx, sy);
      this.blit('town', p.top, sx, sy - TS);
    } else {
      this.blit('town', this.TIDX.bush[(this.vrand(x, y) * 3) | 0], sx, sy);
    }
  },

  // 散布装饰（小树/灌木/蘑菇）
  drawScatter(s) {
    const TS = this.TILE * this.SCALE;
    const sx = s.gx * TS - this.cam.x, sy = s.gy * TS - this.cam.y;
    if (s.kind === 'tree') {
      const p = this.TIDX.pines[this.vrand(s.gx, s.gy) > 0.5 ? 1 : 0];
      this.blit('town', p.bot, sx, sy); this.blit('town', p.top, sx, sy - TS);
    } else if (s.kind === 'bush') {
      this.blit('town', this.TIDX.bush[(this.vrand(s.gx + 2, s.gy) * 3) | 0], sx, sy);
    } else {
      this.blit('town', this.TIDX.mush, sx, sy);
    }
  },

  // 小怪（图集精灵 + 轻微浮动）
  drawMon(m) {
    const TS = this.TILE * this.SCALE;
    const sx = m.x * TS - this.cam.x, sy = m.y * TS - this.cam.y;
    const bob = Math.sin(performance.now() / 500 + m.ph) * 2.5;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + TS * 0.36, TS * 0.24, TS * 0.1, 0, 0, 7); ctx.fill();
    const w = this.TILE * this.SCALE * 0.85;
    this.blit(this.TIDX.mon.atlas, m.idx, sx - w / 2, sy + TS * 0.36 - w - bob, this.SCALE * 0.85);
  },

  // 节点标记（顶视角）
  drawNodeTD(n) {
    const ctx = this.ctx, TS = this.TILE * this.SCALE;
    const sx = n.x * TS - this.cam.x, sy = n.y * TS - this.cam.y;
    ctx.save();
    if (n.done && n.type !== 'battle') ctx.globalAlpha = 0.45;
    if (n === this.cur) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 280);
      ctx.beginPath(); ctx.arc(sx, sy, 20 + pulse * 5, 0, 7);
      ctx.fillStyle = 'rgba(255,220,120,' + (0.13 + pulse * 0.16) + ')'; ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(sx, sy + 13, 16, 7, 0, 0, 7); ctx.fill();
    ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.done ? (n.type === 'battle' ? n.icon : '✓') : n.icon, sx, sy);
    if (n === this.cur) {
      const bob = Math.sin(performance.now() / 200) * 3;
      ctx.font = '18px serif'; ctx.fillStyle = '#ffd35a'; ctx.fillText('▼', sx, sy - 28 + bob);
    }
    ctx.restore();
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
      ctx.fillStyle = '#9c7a4e'; ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.restore();
  },

  drawPlayer() {
    const ctx = this.ctx, p = this.player;
    const TS = this.TILE * this.SCALE;
    const sx = p.x * TS - this.cam.x, sy = p.y * TS - this.cam.y;
    const moving = p.step > 0;
    const bob = moving ? Math.abs(Math.sin(p.step / 95)) * 4 : (Math.sin(performance.now() / 620) * 0.5 + 0.5) * 2;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sx, sy + TS * 0.38, TS * 0.28, TS * 0.12, 0, 0, 7); ctx.fill();
    const a = this.atlasImg[this.TIDX.hero.atlas];
    if (a && a.naturalWidth) {
      const cols = (a.naturalWidth / this.TILE) | 0, idx = this.TIDX.hero.idx;
      const tx = (idx % cols) * this.TILE, ty = ((idx / cols) | 0) * this.TILE;
      const w = this.TILE * this.SCALE * 1.15;
      const dx = sx - w / 2, dy = sy + TS * 0.38 - w - bob;
      const flip = (p.dir === 'right');
      ctx.save(); ctx.imageSmoothingEnabled = false;
      if (flip) { ctx.translate(Math.round(dx + w), Math.round(dy)); ctx.scale(-1, 1); ctx.drawImage(a, tx, ty, 16, 16, 0, 0, w, w); }
      else ctx.drawImage(a, tx, ty, 16, 16, Math.round(dx), Math.round(dy), w, w);
      ctx.restore();
      return;
    }
    ctx.fillStyle = p.color; this.rr(sx - 8, sy - 18 - bob, 16, 18, 5); ctx.fill();
  },

  rr(x, y, w, h, r) {
    const ctx = this.ctx; ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  },

  drawGuideArrow() {
    if (!this.cur) return;
    const s = this.worldToScreen(this.cur.x, this.cur.y);
    const sx = s.x - this.cam.x, sy = s.y - this.cam.y;
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
