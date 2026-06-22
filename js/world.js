// ============================================================
//  斜俯视角 45°（等距）探索引擎 + 引导式章节推进
//  - 关卡以「节点」形式融入场景；到达当前目标节点自动触发剧情/战斗
//  - 完成后引导至下一目标，形成连贯沉浸的章节流程
//  - 瓦片程序化绘制（占位美术），结构优先，真实瓦片集可后续替换
// ============================================================

const World = {
  root: null, canvas: null, ctx: null, raf: 0,
  HW: 30, HH: 15,                 // 等距瓦片半宽/半高（菱形）
  chapter: null, grid: null, w: 0, h: 0, theme: null,
  cam: { x: 0, y: 0 }, vw: 0, vh: 0, dpr: 1,
  player: { x: 0, y: 0, dir: 'down', step: 0, color: '#b06bff' },
  input: { up: false, down: false, left: false, right: false },
  nodes: [], cur: null, busyTrigger: false, active: false,

  // 地图小人精灵图（横向帧条，透明背景）。charId -> { walk, idle, frames }
  MAP_SPRITES: {
    lecliss: { walk: 'assets/map/lecliss_walk.png', idle: 'assets/map/lecliss_idle.png', frames: 8 },
  },
  spriteCache: {},   // path -> Image
  curSprite: null,   // 当前主角的精灵集（已就绪才赋值）

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

    // 主角
    this.player.x = this.START.x; this.player.y = this.START.y; this.player.dir = 'up';
    const lead = Game.state.team[0] && Game.getOwned(Game.state.team[0]);
    this.player.color = lead ? window.GameData.CHARACTERS[lead.charId].color : '#b06bff';
    this.loadSprite(lead && lead.charId);
  },

  // 加载主角地图精灵（异步，加载完成后才启用，期间用矢量占位）
  loadSprite(charId) {
    this.curSprite = null;
    // 暂时：没有专属精灵的角色用现有的 lecliss 作占位，方便预览游戏内效果
    let conf = charId && this.MAP_SPRITES[charId];
    if (!conf) conf = this.MAP_SPRITES.lecliss;
    if (!conf) return;
    const ver = (window.ASSET_VER || '');
    const get = (path) => {
      if (this.spriteCache[path]) return this.spriteCache[path];
      const img = new Image();
      img.src = path + (ver ? '?v=' + ver : '');
      this.spriteCache[path] = img;
      return img;
    };
    const set = { walk: get(conf.walk), idle: get(conf.idle), frames: conf.frames || 8 };
    const check = () => { if (set.walk.complete && set.idle.complete && set.walk.naturalWidth && set.idle.naturalWidth) this.curSprite = set; };
    set.walk.onload = check; set.idle.onload = check; check();
  },

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
    const p = this.player;
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
      p.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
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
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, this.vw, this.vh);
    // 地面菱形
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.grid[y][x];
        const iso = this.worldToIso(x + 0.5, y + 0.5);
        const sx = iso.x - this.cam.x, sy = iso.y - this.cam.y;
        if (sx < -this.HW * 2 || sx > this.vw + this.HW * 2 || sy < -this.HH * 4 || sy > this.vh + this.HH * 4) continue;
        const ground = (t === 'water') ? pal.water : ((x + y) % 2 === 0 ? pal.grass : pal.grass2);
        this.diamond(sx, sy, ground);
        if (t === 'water') { ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 8, sy); ctx.lineTo(sx + 8, sy); ctx.stroke(); }
      }
    }
    // 花
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    this.flowers.forEach(([wx, wy, c]) => {
      const iso = this.worldToIso(wx, wy); const sx = iso.x - this.cam.x, sy = iso.y - this.cam.y;
      ctx.fillStyle = ['#ff8ad0', '#ffe07a', '#9bdcff'][c]; ctx.fillRect(sx - 2, sy - 2, 4, 4);
    });

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
      if (sx < -60 || sx > this.vw + 60 || sy < -80 || sy > this.vh + 80) return;
      if (o.kind === 'tree') this.bill(sx, sy, '🌲', 30);
      else if (o.kind === 'rock') this.bill(sx, sy, '🪨', 24);
      else if (o.kind === 'node') this.drawNode(sx, sy, o.node);
      else this.drawPlayer(sx, sy);
    });

    // 离屏目标的边缘指引箭头
    this.drawGuideArrow();
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
    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sx, sy + 4, 13, 6, 0, 0, 7); ctx.fill();

    if (this.curSprite) {
      const s = this.curSprite, moving = p.step > 0;
      const sheet = moving ? s.walk : s.idle;
      const fw = sheet.naturalWidth / s.frames, fh = sheet.naturalHeight;
      // 行走时按步幅推进帧；待机按时间缓慢循环
      const fi = moving
        ? Math.floor(p.step / 90) % s.frames
        : Math.floor(performance.now() / 140) % s.frames;
      const H = 64, W = H * (fw / fh);          // 屏上显示高度
      const bob = moving ? Math.abs(Math.sin(p.step / 90)) * 2 : 0;
      const flip = (p.dir === 'left');          // 仅有正面帧：向左时水平翻转
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.translate(sx, sy - bob);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(sheet, fi * fw, 0, fw, fh, -W / 2, -H, W, H);
      ctx.restore();
      return;
    }

    // 占位（精灵未就绪时）
    const bob = Math.abs(Math.sin(p.step / 90)) * 3;
    ctx.fillStyle = p.color; this.rr(sx - 8, sy - 18 - bob, 16, 18, 5); ctx.fill();
    ctx.fillStyle = '#ffe0c0'; ctx.beginPath(); ctx.arc(sx, sy - 22 - bob, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a2a';
    const off = { up: [0, -3], down: [0, 1], left: [-3, -1], right: [3, -1] }[p.dir] || [0, 1];
    ctx.fillRect(sx + off[0] - 1, sy - 23 - bob + off[1], 2, 2);
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
