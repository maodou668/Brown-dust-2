// ============================================================
//  战斗界面渲染 + 交互  &  应用主入口
// ============================================================

const BattleUI = {
  stage: null,
  root: null,
  selectedSkill: null,   // 当前选中的技能 id
  busy: false,           // 动画/AI 执行中，锁定输入

  start(stage) {
    this.stage = stage;
    this.selectedSkill = null;
    this.busy = false;
    Battle.setup(Game.state.team, stage);
    Battle.onEvent = (e) => this.handleEvent(e);
    this.buildScreen();
    this.refresh();
    this.beginTurn();
  },

  buildScreen() {
    const old = document.getElementById('battle-screen');
    if (old) old.remove();
    this.root = UI.el(`
      <div id="battle-screen">
        <div class="battle-top">
          <span>${this.stage.name}</span>
          <span id="battle-round">第 1 回合</span>
          <button class="ghost-btn" id="battle-flee" title="撤退">🏳️</button>
        </div>
        <div class="battle-field">
          <div class="enemy-zone">
            <div class="row-label">— 敌方后排 —</div>
            <div class="unit-row" id="enemy-back"></div>
            <div class="row-label">— 敌方前排 —</div>
            <div class="unit-row" id="enemy-front"></div>
          </div>
          <div class="ally-zone">
            <div class="unit-row" id="ally-front"></div>
            <div class="row-label">— 我方前排 —</div>
            <div class="unit-row" id="ally-back"></div>
            <div class="row-label">— 我方后排 —</div>
          </div>
        </div>
        <div class="battle-ctrl">
          <div class="turn-hint" id="turn-hint"></div>
          <div class="skill-bar" id="skill-bar"></div>
        </div>
        <div class="battle-log" id="battle-log"></div>
      </div>
    `);
    document.body.appendChild(this.root);
    this.root.querySelector('#battle-flee').onclick = () => this.flee();
  },

  flee() {
    const m = UI.openModal(`
      <h2>撤退？</h2>
      <p class="muted" style="margin:8px 0;">撤退将不会获得任何奖励，确定要离开战斗吗？</p>
      <div class="close-row">
        <button class="btn secondary" id="flee-no">继续战斗</button>
        <button class="btn" id="flee-yes" style="background:linear-gradient(135deg,#ff5a6a,#b02a3a);">撤退</button>
      </div>`);
    m.querySelector('#flee-no').onclick = () => UI.closeModal(m);
    m.querySelector('#flee-yes').onclick = () => {
      UI.closeModal(m);
      this.exit();
    };
  },

  exit() {
    if (this.root) this.root.remove();
    this.root = null;
    Main.refreshCurrent();
  },

  // ---------- 渲染单位 ----------
  unitHtml(c) {
    const isAlly = c.side === 'ally';
    const charDef = isAlly ? window.GameData.CHARACTERS[c.charId] : window.GameData.ENEMIES[c.charId];
    const icon = isAlly ? window.GameData.CLASSES[charDef.cls].icon : '👹';
    const hpPct = Math.max(0, (c.hp / c.maxHp) * 100);
    const spPct = (c.sp / c.maxSp) * 100;
    return `
      <div class="unit ${c.alive ? '' : 'dead'}" data-uid="${c.uid}"
           style="background:linear-gradient(180deg, ${c.color}33, var(--panel));">
        ${c.isBoss ? '<span class="u-boss">BOSS</span>' : ''}
        <span class="u-elem">${window.GameData.ELEMENTS[c.element].icon}</span>
        <div class="u-art">${icon}</div>
        <div class="u-name">${c.name}</div>
        ${c.shield > 0 ? `<span class="shield-tag">🛡${c.shield}</span>` : ''}
        <div class="bar"><div class="fill hp" style="width:${hpPct}%"></div></div>
        <div class="u-hp-text">${c.hp}/${c.maxHp}</div>
        ${isAlly ? `<div class="bar"><div class="fill sp" style="width:${spPct}%"></div></div>` : ''}
      </div>`;
  },

  refresh() {
    if (!this.root) return;
    const fill = (id, list) => {
      const elx = this.root.querySelector('#' + id);
      elx.innerHTML = list.map(c => this.unitHtml(c)).join('') || '<span class="muted" style="font-size:10px;"> </span>';
    };
    fill('enemy-front', Battle.enemies().filter(c => c.pos === 'front'));
    fill('enemy-back', Battle.enemies().filter(c => c.pos === 'back'));
    fill('ally-front', Battle.allies().filter(c => c.pos === 'front'));
    fill('ally-back', Battle.allies().filter(c => c.pos === 'back'));
    this.root.querySelector('#battle-round').textContent = `第 ${Battle.round} 回合`;

    // 标记当前行动者
    const cur = Battle.current();
    if (cur) {
      const ce = this.root.querySelector(`.unit[data-uid="${cur.uid}"]`);
      if (ce) ce.classList.add('active-turn');
    }
  },

  // ---------- 回合流程 ----------
  beginTurn() {
    if (Battle.finished) return;
    const cur = Battle.current();
    if (!cur || !cur.alive) { this.nextTurn(); return; }
    this.refresh();

    if (cur.side === 'ally') {
      this.renderSkillBar(cur);
      this.setHint(`轮到 <b>${cur.name}</b> 行动，请选择技能`);
    } else {
      this.clearSkillBar();
      this.setHint(`<b>${cur.name}</b> 正在行动...`);
      this.busy = true;
      setTimeout(() => {
        Battle.enemyAct();
        this.busy = false;
        if (!Battle.finished) this.nextTurn();
      }, 800);
    }
  },

  nextTurn() {
    if (Battle.finished) return;
    Battle.advance();
    this.beginTurn();
  },

  setHint(html) {
    const h = this.root && this.root.querySelector('#turn-hint');
    if (h) h.innerHTML = html;
  },

  clearSkillBar() {
    const bar = this.root && this.root.querySelector('#skill-bar');
    if (bar) bar.innerHTML = '';
  },

  renderSkillBar(c) {
    const bar = this.root.querySelector('#skill-bar');
    bar.innerHTML = c.skills.map(sid => {
      const sk = window.GameData.SKILLS[sid];
      const usable = Battle.canUseSkill(c, sid);
      const spLabel = sk.sp > 0
        ? `<div class="sb-sp ${usable ? 'ready' : ''}">${usable ? 'SP ' + sk.sp + ' ✓' : 'SP ' + sk.sp + ' (' + c.sp + ')'}</div>`
        : `<div class="sb-sp ready">普通</div>`;
      return `<button class="skill-btn" data-skill="${sid}" ${usable ? '' : 'disabled'}>
        <div class="sb-name">${sk.icon} ${sk.name}</div>
        ${spLabel}
      </button>`;
    }).join('');
    bar.querySelectorAll('.skill-btn').forEach(b =>
      b.addEventListener('click', () => this.selectSkill(c, b.dataset.skill)));
  },

  selectSkill(c, skillId) {
    if (this.busy) return;
    this.selectedSkill = skillId;
    // 高亮选中技能
    this.root.querySelectorAll('.skill-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.skill === skillId));

    const sk = window.GameData.SKILLS[skillId];
    const targets = Battle.validTargets(c, skillId);

    // 自身/全体技能无需选目标，直接执行
    if (sk.target === 'self' || sk.target === 'enemyAll' || sk.target === 'allyAll') {
      this.setHint(`确认对${sk.target === 'self' ? '自身' : (sk.target === 'allyAll' ? '全体友方' : '全体敌人')}使用「${sk.name}」`);
      this.execute(c, skillId, c);
      return;
    }

    // 需要选目标
    const isAllyTarget = sk.target.startsWith('ally');
    this.setHint(`选择「${sk.name}」的目标 ${sk.target === 'enemyRow' ? '(命中整排)' : ''}`);
    this.clearTargets();
    targets.forEach(t => {
      const elx = this.root.querySelector(`.unit[data-uid="${t.uid}"]`);
      if (elx) {
        elx.classList.add('targetable');
        if (isAllyTarget) elx.classList.add('ally-target');
        elx.onclick = () => this.execute(c, skillId, t);
      }
    });
  },

  clearTargets() {
    this.root.querySelectorAll('.unit').forEach(u => {
      u.classList.remove('targetable', 'ally-target');
      u.onclick = null;
    });
  },

  execute(c, skillId, target) {
    if (this.busy) return;
    this.busy = true;
    this.clearTargets();
    this.clearSkillBar();
    this.selectedSkill = null;

    Battle.executeSkill(c, skillId, target);

    // 等动画后刷新并进入下一回合
    setTimeout(() => {
      this.refresh();
      this.busy = false;
      if (!Battle.finished) this.nextTurn();
    }, 650);
  },

  // ---------- 事件（伤害飘字、结算） ----------
  handleEvent(e) {
    if (!this.root) return;
    if (e.type === 'log') {
      const logEl = this.root.querySelector('#battle-log');
      if (logEl) logEl.textContent = e.msg;
    } else if (e.type === 'damage' || e.type === 'heal') {
      this.floatText(e.target, e.amount, e.type, e.crit);
      this.refresh();
    } else if (e.type === 'end') {
      setTimeout(() => this.showResult(e.result), 700);
    }
  },

  floatText(target, amount, kind, crit) {
    const unitEl = this.root.querySelector(`.unit[data-uid="${target.uid}"]`);
    if (!unitEl) return;
    const rect = unitEl.getBoundingClientRect();
    const ft = UI.el(`<div class="float-text ${kind === 'heal' ? 'heal' : (crit ? 'crit' : 'dmg')}">${kind === 'heal' ? '+' : '-'}${amount}${crit ? '!' : ''}</div>`);
    ft.style.left = (rect.left + rect.width / 2 - 14) + 'px';
    ft.style.top = (rect.top + 10) + 'px';
    document.body.appendChild(ft);
    setTimeout(() => ft.remove(), 1000);
    // 受击抖动
    unitEl.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
      { duration: 200 }
    );
  },

  showResult(result) {
    if (result === 'win') {
      const firstClear = !Game.state.cleared.includes(this.stage.id);
      const before = { gold: Game.state.gold, gem: Game.state.gem };
      Game.rewardStage(this.stage, firstClear);
      const goldGain = Game.state.gold - before.gold;
      const gemGain = Game.state.gem - before.gem;
      const m = UI.openModal(`
        <div class="result-modal">
          <div class="result-title win">胜利！</div>
          <p class="muted">${this.stage.name} ${firstClear ? '· 首次通关' : ''}</p>
          <div class="reward-row">
            <div class="rw" style="color:var(--gold);">🪙 +${goldGain}</div>
            <div class="rw" style="color:var(--gem);">💎 +${gemGain}</div>
          </div>
          <p class="muted">队伍获得 ${this.stage.reward.exp} 经验</p>
        </div>
        <div class="close-row" style="justify-content:center;">
          <button class="btn" id="res-ok">领取奖励</button>
        </div>
      `, { noBackdropClose: true });
      m.querySelector('#res-ok').onclick = () => {
        UI.closeModal(m);
        UI.updateResources();
        this.exit();
      };
    } else {
      const m = UI.openModal(`
        <div class="result-modal">
          <div class="result-title lose">败北…</div>
          <p class="muted">队伍全员倒下了。提升佣兵等级或调整阵容后再来挑战吧！</p>
        </div>
        <div class="close-row" style="justify-content:center;">
          <button class="btn secondary" id="res-ok">返回</button>
        </div>
      `, { noBackdropClose: true });
      m.querySelector('#res-ok').onclick = () => { UI.closeModal(m); this.exit(); };
    }
  },
};

// ============================================================
//  Main — 应用入口与页面路由
// ============================================================
const Main = {
  current: 'home',

  init() {
    Game.init();
    UI.init();
    UI.updateResources();

    // 首次游戏自动编队
    if (Game.state.team.length === 0 && Game.state.roster.length > 0) {
      Game.state.roster.forEach(o => {
        if (Game.state.team.length < 4) Game.state.team.push(o.uid);
      });
      Game.save();
    }

    // 导航
    document.querySelectorAll('.nav-btn').forEach(btn =>
      btn.addEventListener('click', () => this.switchScreen(btn.dataset.screen)));

    // 重置存档
    document.getElementById('btn-reset').addEventListener('click', () => {
      const m = UI.openModal(`
        <h2>重置存档</h2>
        <p class="muted" style="margin:8px 0;">将清空所有进度、佣兵与资源，恢复到新游戏状态。确定吗？</p>
        <div class="close-row">
          <button class="btn secondary" id="rs-no">取消</button>
          <button class="btn" id="rs-yes" style="background:linear-gradient(135deg,#ff5a6a,#b02a3a);">确认重置</button>
        </div>`);
      m.querySelector('#rs-no').onclick = () => UI.closeModal(m);
      m.querySelector('#rs-yes').onclick = () => {
        Game.reset();
        UI.closeModal(m);
        UI.updateResources();
        this.switchScreen('home');
        UI.toast('存档已重置');
      };
    });

    this.switchScreen('home');
  },

  switchScreen(name) {
    this.current = name;
    document.querySelectorAll('.nav-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.screen === name));
    this.refreshCurrent();
  },

  refreshCurrent() {
    UI.updateResources();
    switch (this.current) {
      case 'home': UI.renderHome(); break;
      case 'stages': UI.renderStages(); break;
      case 'roster': UI.renderRoster(); break;
      case 'gacha': UI.renderGacha(); break;
    }
  },
};

window.BattleUI = BattleUI;
window.Main = Main;

document.addEventListener('DOMContentLoaded', () => Main.init());
