// ============================================================
//  战斗界面渲染 + 交互  &  应用主入口
// ============================================================

const BattleUI = {
  stage: null,
  root: null,
  selectedSkill: null,   // 当前选中的技能 id
  busy: false,           // 动画/AI 执行中，锁定输入

  start(stage, onExit) {
    this.stage = stage;
    this.onExitCb = onExit || null;
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
    const scene = this.sceneForStage(this.stage.id);
    this.root = UI.el(`
      <div id="battle-screen">
        <div class="battle-top">
          <span>${this.stage.name}</span>
          <span id="battle-round">第 1 回合</span>
          <button class="ghost-btn" id="battle-flee" title="撤退">🏳️</button>
        </div>
        <div class="battle-field bg-${scene}">
          <div class="battle-floor"></div>
          <div class="bfx-particles" id="bfx"></div>
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
          <div class="skill-banner" id="skill-banner"></div>
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
    this.spawnParticles(scene);
  },

  /** 关卡 -> 场景类型 */
  sceneForStage(id) {
    return ({ 1: 'forest', 2: 'forest_deep', 3: 'cave', 4: 'ridge', 5: 'castle', 6: 'forest_deep', 7: 'castle' })[id] || 'void';
  },

  /** 场景氛围粒子 */
  spawnParticles(scene) {
    const type = ({ forest: 'leaf', forest_deep: 'leaf', cave: 'ember', castle: 'ember', ridge: 'snow' })[scene] || 'mote';
    const box = this.root && this.root.querySelector('#bfx');
    if (!box) return;
    const n = 14;
    let html = '';
    for (let i = 0; i < n; i++) {
      const left = Math.random() * 100;
      const dur = 6 + Math.random() * 7;
      const delay = -Math.random() * dur;
      const size = 6 + Math.random() * 8;
      html += `<span class="bfx ${type}" style="left:${left}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
    }
    box.innerHTML = html;
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
    const cb = this.onExitCb;
    this.onExitCb = null;
    if (cb) cb();
    else Main.refreshCurrent();
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
      this._lunged = false;
      setTimeout(() => {
        Battle.enemyAct();
        this.busy = false;
        if (!Battle.finished) this.nextTurn();
      }, 850);
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
      const cd = c.cooldowns[sid] || 0;
      let label;
      if (sk.basic) label = `<div class="sb-sp ready">回 SP +3</div>`;
      else if (cd > 0) label = `<div class="sb-sp cooldown">冷却 ${cd}</div>`;
      else label = `<div class="sb-sp ${usable ? 'ready' : ''}">SP ${sk.sp}${usable ? ' ✓' : ' (' + c.sp + ')'}</div>`;
      return `<button class="skill-btn ${sk.basic ? 'basic' : ''}" data-skill="${sid}" ${usable ? '' : 'disabled'}>
        <div class="sb-name">${sk.icon} ${sk.name}</div>
        ${label}
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
    const tags = [];
    if (sk.target === 'enemyRow') tags.push('命中整排');
    if (sk.pierce) tags.push('穿透·可选后排');
    else if (sk.target === 'enemySingle') tags.push('前排保护');
    if (sk.knockback) tags.push('击退');
    this.setHint(`选择「${sk.name}」的目标 ${tags.length ? '(' + tags.join('·') + ')' : ''}`);
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

    this._lunged = false;
    Battle.executeSkill(c, skillId, target);

    // 等动画后刷新并进入下一回合
    setTimeout(() => {
      this.refresh();
      this.busy = false;
      if (!Battle.finished) this.nextTurn();
    }, 700);
  },

  // ---------- 事件（演出、伤害飘字、结算） ----------
  handleEvent(e) {
    if (!this.root) return;
    if (e.type === 'log') {
      const logEl = this.root.querySelector('#battle-log');
      if (logEl) logEl.textContent = e.msg;
      // 技能横幅：从日志中提取「技能名」
      const mt = e.msg.match(/使用「(.+?)」/);
      if (mt) this.showSkillBanner(mt[1]);
    } else if (e.type === 'damage') {
      if (e.attacker && !this._lunged) { this.lunge(e.attacker); this._lunged = true; }
      this.impactFlash(e.target, false);
      if (e.crit) this.screenShake();
      this.floatText(e.target, e.amount, 'damage', e.crit);
      this.refresh();
    } else if (e.type === 'heal') {
      this.impactFlash(e.target, true);
      this.floatText(e.target, e.amount, 'heal', false);
      this.refresh();
    } else if (e.type === 'knockback') {
      this.knockFloat(e.target, e.kind === 'collide' ? '💥 撞击!' : '↩ 击退!');
    } else if (e.type === 'end') {
      setTimeout(() => this.showResult(e.result), 700);
    }
  },

  /** 攻击者向目标方向突进 */
  lunge(attacker) {
    const el = this.root.querySelector(`.unit[data-uid="${attacker.uid}"]`);
    if (!el) return;
    const dy = attacker.side === 'ally' ? -18 : 18;
    el.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${dy}px) scale(1.08)`, offset: 0.4 }, { transform: 'translateY(0)' }],
      { duration: 360, easing: 'ease-out' }
    );
    el.classList.add('lunging');
    setTimeout(() => el.classList.remove('lunging'), 360);
  },

  /** 击退/撞击提示飘字 */
  knockFloat(target, text) {
    const el = this.root.querySelector(`.unit[data-uid="${target.uid}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ft = UI.el(`<div class="knock-text">${text}</div>`);
    ft.style.left = (rect.left + rect.width / 2 - 24) + 'px';
    ft.style.top = (rect.top - 6) + 'px';
    document.body.appendChild(ft);
    setTimeout(() => ft.remove(), 800);
  },

  /** 命中闪光 */
  impactFlash(target, isHeal) {
    const el = this.root.querySelector(`.unit[data-uid="${target.uid}"]`);
    if (!el) return;
    const fx = UI.el(`<span class="impact-ring ${isHeal ? 'heal' : ''}"></span>`);
    el.appendChild(fx);
    setTimeout(() => fx.remove(), 500);
  },

  /** 暴击/重击震屏 */
  screenShake() {
    const field = this.root.querySelector('.battle-field');
    if (!field) return;
    field.animate(
      [{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(5px,-2px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' }],
      { duration: 260 }
    );
  },

  /** 技能名横幅 */
  showSkillBanner(name) {
    const b = this.root && this.root.querySelector('#skill-banner');
    if (!b) return;
    b.textContent = name;
    b.classList.remove('show');
    void b.offsetWidth; // 强制重绘以重启动画
    b.classList.add('show');
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
      const res = Game.rewardStage(this.stage, firstClear) || {};
      const goldGain = Game.state.gold - before.gold;
      const gemGain = Game.state.gem - before.gem;
      let dropHtml = '';
      if (res.drop) {
        const tpl = Game.getGearTpl(res.drop);
        const rl = window.GameData.GEAR.RLABEL[tpl.rarity];
        dropHtml = `<p style="margin-top:8px;"><span class="rw ${UI.rarityClass(tpl.rarity)}" style="display:inline-block;">🎁 装备掉落：[${rl}] ${tpl.icon}${tpl.name}</span></p>`;
      }
      const m = UI.openModal(`
        <div class="result-modal">
          <div class="result-title win">胜利！</div>
          <p class="muted">${this.stage.name} ${firstClear ? '· 首次通关' : ''}</p>
          <div class="reward-row">
            <div class="rw" style="color:var(--gold);">🪙 +${goldGain}</div>
            <div class="rw" style="color:var(--gem);">💎 +${gemGain}</div>
          </div>
          <p class="muted">队伍获得 ${this.stage.reward.exp} 经验</p>
          ${dropHtml}
        </div>
        <div class="close-row" style="justify-content:center;">
          <button class="btn" id="res-ok">领取奖励</button>
        </div>
      `, { noBackdropClose: true });
      m.querySelector('#res-ok').onclick = () => {
        UI.closeModal(m);
        UI.updateResources();
        // 章节结局：由关卡数据的 endStory 驱动（如魔王城→终章，永夜回廊→第二部结局）
        const endStory = this.stage.endStory;
        if (endStory && window.STORY && window.STORY[endStory] && !Story.seen(endStory)) {
          this.exit();
          Story.play(endStory);
        } else {
          this.exit();
        }
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

    // 首次进入播放序章
    if (!Story.seen('prologue')) {
      Story.play('prologue');
    }
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
      case 'welfare': UI.renderWelfare(); break;
    }
  },
};

window.BattleUI = BattleUI;
window.Main = Main;

document.addEventListener('DOMContentLoaded', () => Main.init());
