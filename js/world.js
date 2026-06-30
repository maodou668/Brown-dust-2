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
  player: { x: 0, y: 0, dir: 'down', face: 'south', step: 0, color: '#b06bff' },
  input: { up: false, down: false, left: false, right: false },
  nodes: [], cur: null, busyTrigger: false, active: false,
  sprite: null, _spriteT: 0,    // PixelLab 主角序列帧（地图）

  // 顶视角占位渲染（纯色地块 + emoji 道具，无外接美术）
  TILE: 16, SCALE: 3,            // 屏上 48px / 格
  COL: { grass: '#4f7a3a', grass2: '#578544', path: '#8a6a3a', water: '#2f6aa0' },
  EMO: { tree: '🌲', rock: '🪨', bush: '🌿', mush: '🍄', mon: ['👹', '👺', '💀'] },

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
        { type: 'npc', label: '与老猎人交谈', icon: I('npc_hunter'),
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
    this.loadFieldSprite();
    this.buildDOM();
    this.buildMap(ch);
    this.buildParty();
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
          <div class="joystick" id="world-joy"><div class="joy-knob" id="joy-knob"></div></div>
          <button class="act-btn" id="world-act" disabled>互动</button>
        </div>
      </div>`);
    document.body.appendChild(this.root);
    this.canvas = this.root.querySelector('#world-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.root.querySelector('#world-exit').onclick = () => this.close();
    this.root.querySelector('#world-act').onclick = () => this.tryTrigger(true);
    // —— 虚拟摇杆（轮盘）：输出连续向量，实现自然 8 方向移动 ——
    const joy = this.root.querySelector('#world-joy'), knob = this.root.querySelector('#joy-knob');
    this.joy = { active: false, x: 0, y: 0 };
    const radius = () => joy.clientWidth / 2;
    const setKnob = (kx, ky) => { knob.style.transform = `translate(${kx}px,${ky}px)`; };
    const move = (e) => {
      if (!this.joy.active) return; e.preventDefault();
      const t = (e.touches && e.touches[0]) || e;
      const r = joy.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
      const rad = radius(), len = Math.hypot(dx, dy);
      if (len > rad) { dx = dx / len * rad; dy = dy / len * rad; }
      setKnob(dx, dy);
      this.joy.x = dx / rad; this.joy.y = dy / rad;   // [-1,1]
    };
    const start = (e) => { this.joy.active = true; move(e); };
    const end = () => { this.joy.active = false; this.joy.x = this.joy.y = 0; setKnob(0, 0); };
    joy.addEventListener('touchstart', start, { passive: false });
    joy.addEventListener('touchmove', move, { passive: false });
    joy.addEventListener('touchend', end); joy.addEventListener('touchcancel', end);
    joy.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
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
      const idx = (this.vrand(n.x | 0, n.y | 0) * 3) | 0;
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

  loadArt() { /* 占位渲染，无需加载外部美术 */ },

  // 确定性伪随机（按格选变体，保证每次渲染一致）
  vrand(x, y) { let h = ((x | 0) * 73856093) ^ ((y | 0) * 19349663); h = (h ^ (h >>> 13)) >>> 0; return h / 4294967295; },

  // emoji 立绘式贴地绘制（底部中心对齐格底）
  emoji(ch, sx, sy, size) {
    const ctx = this.ctx, TS = this.TILE * this.SCALE;
    ctx.font = size + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(ch, sx + TS / 2, sy + TS * 0.92);
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
    this._spriteT += dt;
    let dx = 0, dy = 0;
    // 摇杆优先（连续向量 → 自然 8 方向 + 模拟力度）；否则键盘
    if (this.joy && this.joy.active && Math.hypot(this.joy.x, this.joy.y) > 0.18) {
      dx = this.joy.x; dy = this.joy.y;
    } else {
      if (this.input.left) dx -= 1;
      if (this.input.right) dx += 1;
      if (this.input.up) dy -= 1;
      if (this.input.down) dy += 1;
    }
    const mag = Math.hypot(dx, dy);
    if (mag > 0.01) {
      const sp = 0.075 * (dt / 16.67) * Math.min(1, mag);   // 力度影响速度（摇杆轻推=慢走）
      const nx = p.x + (dx / mag) * sp, ny = p.y + (dy / mag) * sp;
      if (!this.blockedWorld(nx, p.y)) p.x = nx;
      if (!this.blockedWorld(p.x, ny)) p.y = ny;
      p.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); // 4 向(兼容)
      p.face = this.dir8(dx, dy);   // 8 向朝向（贴图用）
      p.step += dt;
    } else p.step = 0;

    this.updateParty(dt);   // 队员沿队长足迹跟随

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

  // ---------- 渲染（顶视角 · 占位）----------
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = this.COL.grass; ctx.fillRect(0, 0, this.vw, this.vh);

    const TS = this.TILE * this.SCALE;
    const x0 = Math.max(0, ((this.cam.x / TS) | 0) - 1), x1 = Math.min(this.w - 1, (((this.cam.x + this.vw) / TS) | 0) + 1);
    const y0 = Math.max(0, ((this.cam.y / TS) | 0) - 1), y1 = Math.min(this.h - 1, (((this.cam.y + this.vh) / TS) | 0) + 2);

    // 1) 地面层（纯色地块：草/路/水）
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const sx = Math.round(x * TS - this.cam.x), sy = Math.round(y * TS - this.cam.y);
        const t = this.grid[y][x];
        ctx.fillStyle = t === 'water' ? this.COL.water : t === 'path' ? this.COL.path
          : ((x + y) & 1 ? this.COL.grass2 : this.COL.grass);
        ctx.fillRect(sx, sy, TS + 1, TS + 1);
      }
    }

    // 2) 物体层（树/灌木/节点/小怪/主角）按 y 排序，后画的盖前面
    const objs = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const t = this.grid[y][x];
      if (t === 'tree' || t === 'rock') objs.push({ sy: y + 0.9, kind: 'deco', tt: t, gx: x, gy: y });
    }
    (this.scatter || []).forEach(s => objs.push({ sy: s.y, kind: 'scatter', s }));
    this.nodes.forEach(n => objs.push({ sy: n.y, kind: 'node', node: n }));
    (this.mons || []).forEach(m => objs.push({ sy: m.y, kind: 'mon', m }));
    (this.party || [this.player]).forEach(m => objs.push({ sy: m.y, kind: 'player', m }));
    objs.sort((a, b) => a.sy - b.sy);
    for (const o of objs) {
      if (o.kind === 'deco') this.drawDeco(o.gx, o.gy, o.tt);
      else if (o.kind === 'scatter') this.drawScatter(o.s);
      else if (o.kind === 'node') this.drawNodeTD(o.node);
      else if (o.kind === 'mon') this.drawMon(o.m);
      else this.drawPlayer(o.m);
    }

    // 纵深氛围：越往森林深处（屏上方）越阴冷
    const g = ctx.createLinearGradient(0, 0, 0, this.vh);
    g.addColorStop(0, 'rgba(12,18,32,0.30)'); g.addColorStop(0.55, 'rgba(12,18,32,0.04)'); g.addColorStop(1, 'rgba(40,30,18,0.0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);

    this.drawDust();
    this.drawGuideArrow();
  },

  // 树/石（emoji 占位）
  drawDeco(x, y, tt) {
    const TS = this.TILE * this.SCALE;
    const sx = x * TS - this.cam.x, sy = y * TS - this.cam.y;
    this.emoji(tt === 'tree' ? this.EMO.tree : this.EMO.rock, sx, sy, tt === 'tree' ? 40 : 32);
  },

  // 散布装饰（小树/灌木/蘑菇，emoji 占位）
  drawScatter(s) {
    const TS = this.TILE * this.SCALE;
    const sx = s.gx * TS - this.cam.x, sy = s.gy * TS - this.cam.y;
    const ch = s.kind === 'tree' ? this.EMO.tree : s.kind === 'bush' ? this.EMO.bush : this.EMO.mush;
    this.emoji(ch, sx, sy, s.kind === 'tree' ? 34 : 22);
  },

  // 小怪（emoji + 轻微浮动）
  drawMon(m) {
    const TS = this.TILE * this.SCALE;
    const sx = m.x * TS - this.cam.x, sy = m.y * TS - this.cam.y;
    const bob = Math.sin(performance.now() / 500 + m.ph) * 3;
    this.emoji(this.EMO.mon[m.idx % this.EMO.mon.length], sx, sy - bob, 28);
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

  // 移动向量 → 8 向贴图名（屏幕坐标 y 向下）
  dir8(vx, vy) {
    const names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    const i = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
    return names[((i % 8) + 8) % 8];
  },

  // 载入 PixelLab 序列帧（地图用）——出战队每个有 field sprite 的角色都载入
  loadFieldSprite() {
    const reg = (window.BattleUI && window.BattleUI.FIELD_SPRITE) || { lecliss: 'art/05_pixellab/lecliss_field' };
    const team = (window.Game && Game.state && Game.state.team) || [];
    const ids = [];
    team.forEach(uid => { const o = Game.getOwned && Game.getOwned(uid); if (o && reg[o.charId] && !ids.includes(o.charId)) ids.push(o.charId); });
    if (!ids.length) ids.push(reg.lecliss ? 'lecliss' : Object.keys(reg)[0]);
    this._leaderCharId = ids[0];
    this.sprites = this.sprites || {};
    const V = window.ASSET_VER || '1';
    ids.forEach(charId => {
      if (this.sprites[charId]) return;
      const BASE = reg[charId]; const sp = this.sprites[charId] = { ready: false, man: null, imgs: {} };
      fetch(BASE + '/manifest.json?v=' + V).then(r => r.json()).then(man => {
        sp.man = man;
        const mk = src => { const im = new Image(); im.src = src; return im; };
        for (const anim in man.anims) {
          sp.imgs[anim] = {};
          for (const d of man.dirs) {
            const n = man.anims[anim].frames[d] || 0, arr = [];
            for (let i = 0; i < n; i++) arr.push(mk(`${BASE}/${anim}/${d}/${String(i).padStart(2, '0')}.png?v=${V}`));
            sp.imgs[anim][d] = arr;
          }
        }
        sp.ready = true;
      }).catch(() => { this.sprites[charId] = null; });
    });
  },

  // 组建队伍：队长(team[0])可操作，其余成员沿队长足迹跟随
  buildParty() {
    const team = (window.Game && Game.state && Game.state.team) || [];
    const members = [];
    team.forEach(uid => { const o = Game.getOwned && Game.getOwned(uid); if (o) members.push(o.charId); });
    if (!members.length) members.push(this._leaderCharId || 'lecliss');
    this.player.charId = members[0];                  // 队长 = 复用现有 player（移动/镜头/触发都基于它）
    this.party = [this.player];
    for (let i = 1; i < members.length; i++)
      this.party.push({ charId: members[i], x: this.player.x, y: this.player.y, face: 'south', dir: 'down', step: 0, color: '#b06bff' });
    this.trail = [{ x: this.player.x, y: this.player.y }];
  },

  // 跟随更新：队长走过的位置做面包屑，后续成员各落后若干面包屑
  updateParty(dt) {
    if (!this.party || this.party.length < 2) return;
    const p = this.player, head = this.trail[0];
    if (!head || Math.hypot(p.x - head.x, p.y - head.y) >= 0.16) {
      this.trail.unshift({ x: p.x, y: p.y });
      const maxLen = 8 * this.party.length + 8;
      if (this.trail.length > maxLen) this.trail.length = maxLen;
    }
    const PER = 6;   // 每名成员间隔的面包屑数（≈0.96 格）
    for (let i = 1; i < this.party.length; i++) {
      const f = this.party[i], idx = Math.min(this.trail.length - 1, i * PER);
      const tp = this.trail[idx]; if (!tp) continue;
      const ahead = this.trail[Math.max(0, idx - 1)];   // 朝队长方向的前一个面包屑
      f.x = tp.x; f.y = tp.y;
      const fdx = ahead.x - tp.x, fdy = ahead.y - tp.y;
      if (Math.hypot(fdx, fdy) > 0.001) { f.face = this.dir8(fdx, fdy); f.dir = Math.abs(fdx) >= Math.abs(fdy) ? (fdx > 0 ? 'right' : 'left') : (fdy > 0 ? 'down' : 'up'); }
      f.step = p.step > 0 ? f.step + dt : 0;
    }
  },

  drawPlayer(p) {
    p = p || this.player;
    const ctx = this.ctx;
    const TS = this.TILE * this.SCALE;
    const cx = p.x * TS - this.cam.x, cy = p.y * TS - this.cam.y;
    const moving = p.step > 0;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx, cy + TS * 0.34, TS * 0.26, TS * 0.11, 0, 0, 7); ctx.fill();

    // —— PixelLab 序列帧 ——
    const sp = (this.sprites && this.sprites[p.charId]) || null;
    if (sp && sp.ready) {
      const dir = p.face || 'south';
      const anim = moving ? 'run' : 'idle';
      const arr = (sp.imgs[anim] && sp.imgs[anim][dir] && sp.imgs[anim][dir].length) ? sp.imgs[anim][dir] : sp.imgs.idle.south;
      const fps = (sp.man.fps && sp.man.fps[anim]) || 8;
      const im = arr[Math.floor(this._spriteT / 1000 * fps) % arr.length];
      const bb = sp.man.bbox;
      const targetH = TS * 1.55, scale = targetH / bb.h;     // 身体比例不变（仍以 bbox 高为准）
      const bob = moving ? Math.abs(Math.sin(p.step / 95)) * 3 : 0;
      if (im && im.width) {
        ctx.imageSmoothingEnabled = false;
        // 画**整幅**而非只裁 bbox：脚(bbox 底)对齐地线，头顶以上(抬头/光环)不再被裁。
        const groundY = cy + TS * 0.30 - bob, feetSrcY = bb.y + bb.h;
        ctx.drawImage(im, 0, 0, im.width, im.height,
          cx - (im.width * scale) / 2, groundY - feetSrcY * scale, im.width * scale, im.height * scale);
        ctx.imageSmoothingEnabled = true;
      }
      return;
    }

    // —— 占位主角（序列帧未就绪时）——
    const bob = moving ? Math.abs(Math.sin(p.step / 95)) * 4 : (Math.sin(performance.now() / 620) * 0.5 + 0.5) * 2;
    const bx = cx, by = cy + TS * 0.18 - bob;
    ctx.fillStyle = p.color || '#b06bff';
    this.rr(bx - 9, by - 18, 18, 20, 6); ctx.fill();
    ctx.fillStyle = '#ffe0c0'; ctx.beginPath(); ctx.arc(bx, by - 22, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a2a';
    const off = { up: [0, -3], down: [0, 2], left: [-3, 0], right: [3, 0] }[p.dir] || [0, 2];
    ctx.beginPath(); ctx.arc(bx + off[0], by - 22 + off[1], 1.8, 0, 7); ctx.fill();
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
