// ============================================================
//  俯视角探索引擎（Canvas 瓦片地图）
//  - 可走动的主角、跟随镜头、虚拟摇杆
//  - 地图交互点：剧情 / 战斗 / NPC / 宝箱 / 出口（复用 Story 与 BattleUI）
//  - 瓦片为程序化绘制（占位美术），预留真实瓦片集替换
// ============================================================

const World = {
  root: null, canvas: null, ctx: null, raf: 0,
  TILE: 36,
  map: null, grid: null, w: 0, h: 0, theme: null,
  cam: { x: 0, y: 0 },
  player: { x: 0, y: 0, r: 12, speed: 2.4, dir: 'down', step: 0 },
  input: { up: false, down: false, left: false, right: false },
  nearNode: null,
  active: false,
  vw: 0, vh: 0, dpr: 1,

  // ---------- 地图数据 ----------
  MAPS: {
    forest: {
      name: '艾尔玛森林', theme: 'forest', w: 22, h: 16,
      start: { tx: 11, ty: 13 },
      // 障碍/装饰（按瓦片坐标）；其余为草地
      solids: [
        // 池塘
        { t: 'water', cells: [[3,3],[4,3],[5,3],[3,4],[4,4],[5,4],[4,5]] },
        // 树丛
        { t: 'tree', cells: [
          [8,4],[9,4],[8,5],[13,3],[14,3],[14,4],
          [6,8],[7,11],[16,9],[17,9],[16,10],
          [10,7],[12,11],[4,9],[18,5],[19,12],[3,12]
        ]},
        // 岩石
        { t: 'rock', cells: [[15,12],[6,5],[12,8]] },
      ],
      paths: [ // 纯装饰的小路（可走）
        [11,13],[11,12],[11,11],[11,10],[10,9],[9,9],[8,9],
        [11,9],[12,8],[13,7],[14,7],[15,7],
        [11,8],[11,7],[11,6],[11,5],[11,4],[11,3],[11,2],[11,1]
      ],
      nodes: [
        { tx: 11, ty: 11, type: 'story', story: 'stage1', icon: '💬', label: '森林入口的对话', once: 'forest_intro' },
        { tx: 8,  ty: 9,  type: 'battle', stage: 1, icon: '⚔️', label: '哥布林群' },
        { tx: 15, ty: 7,  type: 'battle', stage: 2, icon: '⚔️', label: '暗影狼群', need: 1 },
        { tx: 13, ty: 11, type: 'npc', icon: '🧓', label: '老猎人', text: '老猎人：「森林深处的狼群最近躁动得厉害，年轻人，去之前先解决掉入口的哥布林吧。」' },
        { tx: 4,  ty: 6,  type: 'chest', icon: '🎁', label: '宝箱', id: 'forest_1', reward: { gold: 300, gear: 'arm_sr' } },
        { tx: 11, ty: 1,  type: 'exit', icon: '🚪', label: '离开森林' },
      ],
    },
  },

  // ---------- 打开 / 关闭 ----------
  open(mapId) {
    const def = this.MAPS[mapId];
    if (!def) { UI.toast('该区域尚未开放'); return; }
    this.map = def; this.theme = def.theme; this.w = def.w; this.h = def.h;
    this.buildDOM();
    this.loadMap(def);
    this.refreshNodes();
    this.active = true;
    this.start();
  },

  buildDOM() {
    const old = document.getElementById('world-screen');
    if (old) old.remove();
    this.root = UI.el(`
      <div id="world-screen">
        <div class="world-top">
          <span>🗺️ ${this.map.name}</span>
          <button class="ghost-btn" id="world-exit" title="离开">✕</button>
        </div>
        <canvas id="world-canvas"></canvas>
        <div class="world-hint" id="world-hint"></div>
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

    // 退出
    this.root.querySelector('#world-exit').onclick = () => this.close();
    // 互动
    this.root.querySelector('#world-act').onclick = () => this.interact();
    // 方向键（按住移动）
    this.root.querySelectorAll('.dbtn').forEach(b => {
      const dir = b.dataset.dir;
      const on = (e) => { e.preventDefault(); this.input[dir] = true; };
      const off = (e) => { e.preventDefault(); this.input[dir] = false; };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
      b.addEventListener('mousedown', on); b.addEventListener('mouseup', off);
      b.addEventListener('mouseleave', off);
    });
    // 键盘
    this._keyHandler = (e) => {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const dir = map[e.key];
      if (!dir) { if (e.key === ' ' || e.key === 'Enter') this.interact(); return; }
      this.input[dir] = (e.type === 'keydown');
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
    this.ctx.imageSmoothingEnabled = false;
  },

  loadMap(def) {
    // 生成网格：默认草地，边界与障碍
    const grid = [];
    for (let y = 0; y < def.h; y++) {
      const row = [];
      for (let x = 0; x < def.w; x++) {
        if (x === 0 || y === 0 || x === def.w - 1 || y === def.h - 1) row.push('tree');
        else row.push('grass');
      }
      grid.push(row);
    }
    (def.paths || []).forEach(([x, y]) => { if (grid[y] && grid[y][x] === 'grass') grid[y][x] = 'path'; });
    (def.solids || []).forEach(s => s.cells.forEach(([x, y]) => { if (grid[y]) grid[y][x] = s.t; }));
    // 确保交互点所在格可走
    def.nodes.forEach(n => { if (grid[n.ty] && this.isSolid(grid[n.ty][n.tx])) grid[n.ty][n.tx] = 'grass'; });
    this.grid = grid;
    // 装饰花（确定性散布，仅视觉）
    this.flowers = [];
    for (let i = 0; i < def.w * def.h; i++) {
      const x = (i * 7) % def.w, y = (i * 13) % def.h;
      if (grid[y][x] === 'grass' && (i * 31) % 5 === 0) this.flowers.push([x, y, (i % 3)]);
    }
    // 主角初始位置（像素中心）
    this.player.x = (def.start.tx + 0.5) * this.TILE;
    this.player.y = (def.start.ty + 0.5) * this.TILE;
    this.player.dir = 'down';
    // 主角外观颜色：取队首角色色
    const lead = Game.state.team[0] && Game.getOwned(Game.state.team[0]);
    this.player.color = lead ? window.GameData.CHARACTERS[lead.charId].color : '#b06bff';
  },

  isSolid(t) { return t === 'tree' || t === 'rock' || t === 'water'; },

  // ---------- 主循环 ----------
  start() {
    cancelAnimationFrame(this.raf);
    let last = performance.now();
    const loop = (ts) => {
      if (!this.active) return;
      const dt = Math.min(40, ts - last); last = ts;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  stop() { this.active = false; cancelAnimationFrame(this.raf); },
  resume() { if (this.root) { this.active = true; this.refreshNodes(); this.start(); } },

  update(dt) {
    const p = this.player;
    let dx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    let dy = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const sp = p.speed * (dt / 16.67);
      const nx = p.x + (dx / len) * sp;
      const ny = p.y + (dy / len) * sp;
      if (!this.blocked(nx, p.y)) p.x = nx;
      if (!this.blocked(p.x, ny)) p.y = ny;
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      p.step += dt;
    } else { p.step = 0; }

    // 镜头跟随 + 边界钳制
    const mapW = this.w * this.TILE, mapH = this.h * this.TILE;
    this.cam.x = Math.max(0, Math.min(mapW - this.vw, p.x - this.vw / 2));
    this.cam.y = Math.max(0, Math.min(mapH - this.vh, p.y - this.vh / 2));

    // 邻近交互点
    let near = null, bestD = 1e9;
    this.map.nodes.forEach(n => {
      if (n.done) return;
      const cx = (n.tx + 0.5) * this.TILE, cy = (n.ty + 0.5) * this.TILE;
      const d = Math.hypot(cx - p.x, cy - p.y);
      if (d < this.TILE * 0.9 && d < bestD) { bestD = d; near = n; }
    });
    if (near !== this.nearNode) {
      this.nearNode = near;
      const act = this.root.querySelector('#world-act');
      const hint = this.root.querySelector('#world-hint');
      act.disabled = !near;
      act.textContent = near ? (near.type === 'battle' ? '战斗' : near.type === 'exit' ? '离开' : '互动') : '互动';
      hint.textContent = near ? `${near.icon} ${near.label}` : '';
    }
  },

  blocked(px, py) {
    const r = this.player.r * 0.7;
    // 检测脚下四角
    const pts = [[px - r, py - r], [px + r, py - r], [px - r, py + r], [px + r, py + r]];
    return pts.some(([x, y]) => {
      const tx = Math.floor(x / this.TILE), ty = Math.floor(y / this.TILE);
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
      return this.isSolid(this.grid[ty][tx]);
    });
  },

  // ---------- 渲染 ----------
  render() {
    const ctx = this.ctx, T = this.TILE;
    const pal = this.palette();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, this.vw, this.vh);
    const x0 = Math.floor(this.cam.x / T), y0 = Math.floor(this.cam.y / T);
    const x1 = Math.min(this.w, x0 + Math.ceil(this.vw / T) + 1);
    const y1 = Math.min(this.h, y0 + Math.ceil(this.vh / T) + 1);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        this.drawTile(this.grid[y][x], x * T - this.cam.x, y * T - this.cam.y, x, y, pal);
      }
    }
    // 花
    this.flowers.forEach(([x, y, c]) => {
      if (x < x0 || x >= x1 || y < y0 || y >= y1) return;
      const sx = x * T - this.cam.x, sy = y * T - this.cam.y;
      ctx.fillStyle = ['#ff8ad0', '#ffe07a', '#9bdcff'][c];
      ctx.fillRect(sx + T * 0.45, sy + T * 0.5, 4, 4);
    });
    // 交互点
    this.map.nodes.forEach(n => {
      const sx = (n.tx + 0.5) * T - this.cam.x, sy = (n.ty + 0.5) * T - this.cam.y;
      if (sx < -T || sy < -T || sx > this.vw + T || sy > this.vh + T) return;
      const locked = n.need && !Game.state.cleared.includes(n.need);
      ctx.save();
      ctx.globalAlpha = n.done ? 0.35 : 1;
      // 光环
      if (!n.done && !locked) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
        ctx.beginPath(); ctx.arc(sx, sy - 4, 14 + pulse * 3, 0, 7);
        ctx.fillStyle = 'rgba(255,220,120,' + (0.12 + pulse * 0.12) + ')'; ctx.fill();
      }
      ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(locked ? '🔒' : n.icon, sx, sy - 6);
      ctx.restore();
    });
    this.drawPlayer();
  },

  drawPlayer() {
    const ctx = this.ctx, p = this.player;
    const sx = p.x - this.cam.x, sy = p.y - this.cam.y;
    const bob = Math.abs(Math.sin(p.step / 90)) * 3;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 10, 10, 4, 0, 0, 7); ctx.fill();
    // 身体
    ctx.fillStyle = p.color;
    this.roundRect(sx - 8, sy - 6 - bob, 16, 16, 5); ctx.fill();
    // 头
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath(); ctx.arc(sx, sy - 12 - bob, 7, 0, 7); ctx.fill();
    // 朝向小点（眼睛/方向）
    ctx.fillStyle = '#3a2a2a';
    const off = { up: [0, -3], down: [0, 1], left: [-3, -1], right: [3, -1] }[p.dir] || [0, 1];
    ctx.fillRect(sx + off[0] - 1, sy - 13 - bob + off[1], 2, 2);
  },

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  palette() {
    return ({
      forest: { bg: '#1d3322', grass: '#2e5a34', grass2: '#356b3c', path: '#6b5a3a', water: '#2a6aa0' },
      cave:   { bg: '#1a1410', grass: '#3a2f28', grass2: '#46382f', path: '#5a4a3a', water: '#3a6a8a' },
      town:   { bg: '#33271c', grass: '#4a7a3a', grass2: '#558844', path: '#8a6a44', water: '#2a6aa0' },
    })[this.theme] || { bg: '#222', grass: '#3a3a3a', grass2: '#444', path: '#5a5a4a', water: '#2a6aa0' };
  },

  drawTile(t, sx, sy, gx, gy, pal) {
    const ctx = this.ctx, T = this.TILE;
    // 地面底色（草/路）
    const checker = (gx + gy) % 2 === 0;
    if (t === 'path') { ctx.fillStyle = pal.path; ctx.fillRect(sx, sy, T, T); }
    else if (t === 'water') {
      ctx.fillStyle = pal.water; ctx.fillRect(sx, sy, T, T);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx + 5, sy + 12); ctx.lineTo(sx + 14, sy + 12);
      ctx.moveTo(sx + 18, sy + 22); ctx.lineTo(sx + 28, sy + 22); ctx.stroke();
    } else {
      ctx.fillStyle = checker ? pal.grass : pal.grass2; ctx.fillRect(sx, sy, T, T);
    }
    if (t === 'tree') {
      // 草底 + 树
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx + T / 2 - 2, sy + T - 12, 4, 10);
      ctx.fillStyle = '#1f4a26'; ctx.beginPath(); ctx.arc(sx + T / 2, sy + T / 2 - 2, T * 0.42, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a6b34'; ctx.beginPath(); ctx.arc(sx + T / 2 - 4, sy + T / 2 - 6, T * 0.28, 0, 7); ctx.fill();
    } else if (t === 'rock') {
      ctx.fillStyle = '#777'; this.roundRect(sx + 6, sy + 10, T - 12, T - 16, 6); ctx.fill();
      ctx.fillStyle = '#999'; this.roundRect(sx + 9, sy + 12, (T - 12) * 0.5, (T - 16) * 0.5, 4); ctx.fill();
    }
  },

  refreshNodes() {
    // 重新评估宝箱是否已开等
    this.map.nodes.forEach(n => {
      if (n.type === 'chest' && Game.state.worldFlags['chest:' + n.id]) n.done = true;
      if (n.type === 'story' && n.once && Game.state.worldFlags['story:' + n.once]) n.done = true;
    });
  },

  // ---------- 交互 ----------
  interact() {
    const n = this.nearNode;
    if (!n || !this.active) return;
    if (n.need && !Game.state.cleared.includes(n.need)) { UI.toast('需先通关前置战斗'); return; }

    if (n.type === 'story') {
      this.stop();
      Story.play(n.story, () => {
        if (n.once) { Game.state.worldFlags['story:' + n.once] = true; Game.save(); n.done = true; }
        this.resume();
      });
    } else if (n.type === 'battle') {
      const stage = window.GameData.STAGES.find(s => s.id === n.stage);
      if (Game.state.team.length === 0) { UI.toast('请先在「佣兵」页编入队伍'); return; }
      this.stop();
      this.confirmBattle(stage);
    } else if (n.type === 'npc') {
      this.npcDialog(n);
    } else if (n.type === 'chest') {
      this.openChest(n);
    } else if (n.type === 'exit') {
      this.close();
    }
  },

  confirmBattle(stage) {
    const m = UI.openModal(`
      <h2>${stage.name}</h2>
      <p class="muted" style="margin:8px 0;">${stage.desc}</p>
      <div class="close-row">
        <button class="btn secondary" id="wb-cancel">返回</button>
        <button class="btn" id="wb-go">出战 ⚔️</button>
      </div>`);
    m.querySelector('#wb-cancel').onclick = () => { UI.closeModal(m); this.resume(); };
    m.querySelector('#wb-go').onclick = () => {
      UI.closeModal(m);
      BattleUI.start(stage, () => this.resume());
    };
  },

  npcDialog(n) {
    const m = UI.openModal(`
      <h2>${n.icon} ${n.label}</h2>
      <p style="line-height:1.7;margin:10px 0;">${n.text}</p>
      <div class="close-row"><button class="btn" id="npc-ok">好的</button></div>`);
    m.querySelector('#npc-ok').onclick = () => UI.closeModal(m);
  },

  openChest(n) {
    if (Game.state.worldFlags['chest:' + n.id]) { UI.toast('宝箱已开启'); return; }
    Game.state.worldFlags['chest:' + n.id] = true;
    let msg = [];
    if (n.reward.gold) { Game.state.gold += n.reward.gold; msg.push(`🪙${n.reward.gold}`); }
    if (n.reward.gem) { Game.state.gem += n.reward.gem; msg.push(`💎${n.reward.gem}`); }
    if (n.reward.gear) { const tpl = Game.getGearTpl(n.reward.gear); Game.addGear(n.reward.gear); if (tpl) msg.push(`${tpl.icon}${tpl.name}`); }
    Game.save();
    n.done = true;
    UI.updateResources();
    UI.toast('🎁 获得：' + msg.join('，'));
  },

  close() {
    this.stop();
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      window.removeEventListener('keyup', this._keyHandler);
    }
    if (this.root) { this.root.remove(); this.root = null; }
    Main.refreshCurrent();
  },
};

window.World = World;
