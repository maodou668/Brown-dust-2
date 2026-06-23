// ============================================================
//  战斗界面渲染 + 交互  &  应用主入口
// ============================================================

const BattleUI = {
  stage: null,
  root: null,
  selectedSkill: null,   // 当前选中的技能 id
  busy: false,           // 动画/AI 执行中，锁定输入
  auto: false,           // 自动战斗
  speed: 1,              // 战斗倍速 1/2/3（节奏计时除以它）

  /** 倍速后的节奏时长 */
  d(ms) { return Math.round(ms / (this.speed || 1)); },

  start(stage, onExit) {
    this.stage = stage;
    this.onExitCb = onExit || null;
    this.selectedSkill = null;
    this.busy = false;
    try { this.speed = Math.min(3, Math.max(1, parseInt(localStorage.getItem('bd2_battle_speed'), 10) || 1)); } catch (e) { this.speed = 1; }
    Battle.setup(Game.state.team, stage);
    Battle.onEvent = (e) => this.handleEvent(e);
    if (window.Sound) Sound.bgm(stage.isBoss ? 'boss' : 'battle');
    this.buildScreen();
    this.refresh();
    this.beginTurn();
    if (!Game.state._tacticTip) {
      Game.state._tacticTip = true; Game.save();
      setTimeout(() => UI.toast('站位 前→中→后：前排先挨打。击退能把敌人推向后排，挤成一排后用范围技能集火！'), 500);
    }
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
          <div style="display:flex;gap:6px;">
            <button class="auto-btn" id="battle-speed" title="战斗倍速">${this.speed}x</button>
            <button class="auto-btn ${this.auto ? 'on' : ''}" id="battle-auto" title="自动战斗">自动</button>
            <button class="ghost-btn" id="battle-flee" title="撤退">🏳️</button>
          </div>
        </div>
        <div class="battle-field bg-${scene}">
          <div class="bfx-particles" id="bfx"></div>
          <div class="stage-ground enemy"></div>
          <div class="stage-ground ally"></div>
          <div class="battle-stage" id="battle-stage"></div>
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
    this.root.querySelector('#battle-auto').onclick = () => this.toggleAuto();
    this.root.querySelector('#battle-speed').onclick = () => this.cycleSpeed();
    this.spawnParticles(scene);
  },

  cycleSpeed() {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1;
    try { localStorage.setItem('bd2_battle_speed', String(this.speed)); } catch (e) {}
    const b = this.root && this.root.querySelector('#battle-speed');
    if (b) b.textContent = this.speed + 'x';
    if (window.Sound) Sound.sfx('tap');
  },

  toggleAuto() {
    this.auto = !this.auto;
    const b = this.root && this.root.querySelector('#battle-auto');
    if (b) b.classList.toggle('on', this.auto);
    // 若当前正等待我方操作，立即接管
    if (this.auto && !this.busy && Battle.isPlayerTurn && Battle.isPlayerTurn()) {
      this.autoAct();
    }
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
    if (window.Sound) Sound.bgm('home');
    const cb = this.onExitCb;
    this.onExitCb = null;
    if (cb) cb();
    else Main.refreshCurrent();
  },

  // ---------- 渲染单位（斜俯视角舞台，近大远小） ----------
  // 各排在舞台中的纵向位置/缩放/横向间距（百分比）
  ROWCFG: {
    enemy_back:  { y: 14, s: 0.70, sp: 15 },
    enemy_mid:   { y: 24, s: 0.78, sp: 17 },
    enemy_front: { y: 35, s: 0.86, sp: 19 },
    ally_front:  { y: 56, s: 0.94, sp: 22 },
    ally_mid:    { y: 68, s: 1.02, sp: 25 },
    ally_back:   { y: 80, s: 1.10, sp: 28 },
  },

  unitHtml(c, side, pos, idx, count) {
    const isAlly = c.side === 'ally';
    const charDef = isAlly ? window.GameData.CHARACTERS[c.charId] : window.GameData.ENEMIES[c.charId];
    const fallback = isAlly ? window.GameData.CLASSES[charDef.cls].icon : '👹';
    const icon = (charDef && charDef.art)
      ? `<img class="u-img" src="${charDef.art}" alt="" onerror="this.outerHTML='${fallback}'">`
      : fallback;
    const hpPct = Math.max(0, (c.hp / c.maxHp) * 100);
    const spPct = (c.sp / c.maxSp) * 100;
    const stIcon = { poison: '☠️', burn: '🔥', stun: '💫', silence: '🔇' };
    const statusHtml = (c.statuses || []).filter(s => s.turns > 0)
      .map(s => `<span class="st-badge" title="${s.type}">${stIcon[s.type] || ''}</span>`).join('');
    const cfg = this.ROWCFG[side + '_' + pos];
    const x = 50 + (idx - (count - 1) / 2) * cfg.sp;
    const z = Math.round(cfg.y * 10);
    const style = `left:${x}%; top:${cfg.y}%; --uscale:${cfg.s}; z-index:${z};`;
    return `
      <div class="unit ${c.alive ? '' : 'dead'} ${c.enraged ? 'enraged' : ''} ${isAlly ? 'ally-unit' : ''}" data-uid="${c.uid}"
           style="${style}background:linear-gradient(180deg, ${c.color}44, var(--panel));">
        <div class="u-shadow"></div>
        ${c.isBoss ? '<span class="u-boss">BOSS</span>' : ''}
        <span class="u-elem">${window.GameData.ELEMENTS[c.element].icon}</span>
        ${statusHtml ? `<div class="u-status">${statusHtml}</div>` : ''}
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
    const stage = this.root.querySelector('#battle-stage');
    if (!stage) return;
    let html = '';
    [['enemy', 'back'], ['enemy', 'mid'], ['enemy', 'front'],
     ['ally', 'front'], ['ally', 'mid'], ['ally', 'back']].forEach(([side, pos]) => {
      const list = Battle.combatants.filter(c => c.side === side && c.pos === pos);
      list.forEach((c, i) => { html += this.unitHtml(c, side, pos, i, list.length); });
    });
    stage.innerHTML = html;
    this.root.querySelector('#battle-round').textContent = `第 ${Battle.round} 回合`;

    const cur = Battle.current();
    if (cur) {
      const ce = stage.querySelector(`.unit[data-uid="${cur.uid}"]`);
      if (ce) ce.classList.add('active-turn');
    }
    this.attachDrag();
  },

  /** 仅更新单个单位的血量/SP/状态（不重建，保留动画） */
  updateUnitDom(c) {
    if (!c || !this.root) return;
    const el = this.root.querySelector(`.unit[data-uid="${c.uid}"]`);
    if (!el) return;
    const hpFill = el.querySelector('.fill.hp'); if (hpFill) hpFill.style.width = Math.max(0, c.hp / c.maxHp * 100) + '%';
    const hpText = el.querySelector('.u-hp-text'); if (hpText) hpText.textContent = `${c.hp}/${c.maxHp}`;
    const spFill = el.querySelector('.fill.sp'); if (spFill) spFill.style.width = (c.sp / c.maxSp * 100) + '%';
    el.classList.toggle('dead', !c.alive);
    el.classList.toggle('enraged', !!c.enraged);
    // 护盾
    let sh = el.querySelector('.shield-tag');
    if (c.shield > 0) { if (!sh) { sh = UI.el('<span class="shield-tag"></span>'); el.appendChild(sh); } sh.textContent = '🛡' + c.shield; }
    else if (sh) sh.remove();
    // 状态图标
    const stIcon = { poison: '☠️', burn: '🔥', stun: '💫', silence: '🔇' };
    const active = (c.statuses || []).filter(s => s.turns > 0);
    let su = el.querySelector('.u-status');
    if (active.length) {
      if (!su) { su = UI.el('<div class="u-status"></div>'); el.insertBefore(su, el.querySelector('.u-art')); }
      su.innerHTML = active.map(s => `<span class="st-badge">${stIcon[s.type] || ''}</span>`).join('');
    } else if (su) su.remove();
  },

  /** 拖动调整我方站位（前后排/左右） */
  attachDrag() {
    const stage = this.root && this.root.querySelector('#battle-stage');
    if (!stage) return;
    stage.querySelectorAll('.unit.ally-unit').forEach(el => {
      el.addEventListener('pointerdown', (e) => this.onDragStart(e, el));
    });
  },

  onDragStart(e, el) {
    // 仅在空闲（非动画、未选技能、非自动）时允许拖动
    if (this.busy || this.selectedSkill || this.auto) return;
    const uid = el.dataset.uid;
    const c = Battle.combatants.find(x => x.uid === uid);
    if (!c || !c.alive) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const move = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 8) { dragging = true; el.classList.add('dragging'); this.setHint('拖动到目标位置交换站位'); }
      if (dragging) { el.style.transform = `translate(calc(-50% + ${dx}px), calc(-100% + ${dy}px)) scale(var(--uscale))`; }
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.classList.remove('dragging');
      if (!dragging) return;
      // 找放置目标：最近的我方单位
      const targetUid = this.dropTargetUid(ev.clientX, ev.clientY, uid);
      if (targetUid) this.swapFormation(uid, targetUid);
      else this.refresh();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  },

  dropTargetUid(px, py, selfUid) {
    let best = null, bestD = 70;
    this.root.querySelectorAll('.unit.ally-unit').forEach(el => {
      if (el.dataset.uid === selfUid) return;
      const r = el.getBoundingClientRect();
      const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = el.dataset.uid; }
    });
    return best;
  },

  /** 交换两名我方单位的站位（前后排互换） */
  swapFormation(uidA, uidB) {
    const a = Battle.combatants.find(c => c.uid === uidA);
    const b = Battle.combatants.find(c => c.uid === uidB);
    if (!a || !b) { this.refresh(); return; }
    const ap = a.pos; a.pos = b.pos; b.pos = ap;
    this.setHint('站位已调整');
    this.refresh();
  },

  // ---------- 回合流程 ----------
  beginTurn() {
    if (Battle.finished) return;
    const cur = Battle.current();
    if (!cur || !cur.alive) { this.nextTurn(); return; }
    this.refresh();

    // 眩晕：跳过本回合
    if (Battle.isStunned(cur)) {
      Battle.consumeStun(cur);
      if (cur.broken) cur.broken = false;   // 破防眩晕结束，解除受额外伤害状态
      this.clearSkillBar();
      this.setHint(`💫 <b>${cur.name}</b> 被眩晕，跳过回合`);
      this.knockFloat(cur, '💫 眩晕');
      this.busy = true;
      setTimeout(() => { this.busy = false; if (!Battle.finished) this.nextTurn(); }, this.d(750));
      return;
    }

    if (cur.side === 'ally') {
      this.renderSkillBar(cur);
      this.setHint(`轮到 <b>${cur.name}</b> 行动，请选择技能`);
      if (this.auto) { this.busy = true; setTimeout(() => { this.busy = false; this.autoAct(); }, this.d(450)); }
    } else {
      this.clearSkillBar();
      this.setHint(`<b>${cur.name}</b> 正在行动...`);
      this.busy = true;
      this._lunged = false;
      setTimeout(() => {
        Battle.enemyAct();
        this.busy = false;
        if (!Battle.finished) this.nextTurn();
      }, this.d(850));
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

  /** 自动战斗：智能选招 + 选目标，按最大收益 */
  autoAct() {
    if (!this.root || this.busy || Battle.finished) return;
    const c = Battle.current();
    if (!c || c.side !== 'ally' || !c.alive) return;
    const pick = this.autoPickAction(c);
    if (pick) this.execute(c, pick.skillId, pick.target);
  },

  autoPickAction(c) {
    const SK = window.GameData.SKILLS;
    const enemies = Battle.aliveEnemies();
    const allies = Battle.aliveAllies();
    const usable = c.skills.filter(id => Battle.canUseSkill(c, id));
    let best = null, bestVal = -1;
    usable.forEach(id => {
      const sk = SK[id];
      let val = 0, target = c;
      if (sk.effect === 'damage') {
        const atk = c.effAtk() * sk.power;
        if (sk.target === 'enemyAll') { val = atk * enemies.length * 0.9; target = enemies[0]; }
        else if (sk.target === 'enemyRow') {
          // 选人数最多的一段站位（击退会把敌人挤到同一排，这里正好集火）
          const tiers = {};
          enemies.forEach(e => { (tiers[e.pos] = tiers[e.pos] || []).push(e); });
          let row = [];
          Object.values(tiers).forEach(r => { if (r.length > row.length) row = r; });
          val = atk * Math.max(1, row.length) * 0.95; target = row[0] || enemies[0];
        } else {
          const pool = sk.pierce ? enemies : Battle.frontline(enemies);
          // 优先能击杀 / 血量最低
          target = pool.reduce((lo, t) => (t.hp < lo.hp ? t : lo), pool[0]);
          val = atk;
          if (target && atk * 0.5 >= target.hp) val += 500; // 可击杀加权
        }
        if (sk.inflict) val += 120; // 附带控制/中毒加权
        if (sk.basic) val *= 0.4;   // 普攻收益打折（留着回 SP）
      } else if (sk.effect === 'heal') {
        const pool = sk.target === 'allyAll' ? allies : allies;
        const missing = pool.reduce((a, t) => a + (t.maxHp - t.hp), 0);
        const heal = c.effAtk() * sk.power * (sk.target === 'allyAll' ? pool.filter(t => t.hp < t.maxHp).length || 1 : 1);
        val = Math.min(missing, heal) * 1.1;
        if (sk.target !== 'allyAll') { target = allies.reduce((lo, t) => ((t.maxHp - t.hp) > (lo.maxHp - lo.hp) ? t : lo), allies[0]); }
        else target = c;
        if (missing <= 0) val = 0; // 满血不治疗
      } else if (sk.effect === 'shield') {
        val = c.effAtk() * sk.power * allies.length * 0.5; target = c;
      } else if (sk.effect === 'buffAtk') {
        val = c.effAtk() * 1.2; target = c;
      } else if (sk.effect === 'buffDef') {
        val = 60; target = c;
      }
      if (val > bestVal) { bestVal = val; best = { skillId: id, target }; }
    });
    // 兜底：普攻最低血敌人
    if (!best) {
      const pool = Battle.frontline(enemies);
      best = { skillId: 'basic_attack', target: pool.reduce((lo, t) => (t.hp < lo.hp ? t : lo), pool[0]) };
    }
    return best;
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
    }, this.d(700));
  },

  // ---------- 事件（演出、伤害飘字、结算） ----------
  handleEvent(e) {
    if (!this.root) return;
    const S = window.Sound;
    if (e.type === 'log') {
      const logEl = this.root.querySelector('#battle-log');
      if (logEl) logEl.textContent = e.msg;
      // 技能横幅：从日志中提取「技能名」
      const mt = e.msg.match(/使用「(.+?)」/);
      if (mt) { this.showSkillBanner(mt[1]); if (S) S.sfx('skill'); }
    } else if (e.type === 'damage') {
      if (e.dot) {
        this.floatText(e.target, e.amount, 'dot', false);
      } else {
        if (e.attacker && !this._lunged) { this.lunge(e.attacker); this._lunged = true; }
        this.impactFlash(e.target, false);
        if (e.crit) this.screenShake();
        this.floatText(e.target, e.amount, 'damage', e.crit);
        if (S) S.sfx(e.crit ? 'crit' : 'hit');
      }
      this.updateUnitDom(e.target);
    } else if (e.type === 'heal') {
      this.impactFlash(e.target, true);
      this.floatText(e.target, e.amount, 'heal', false);
      if (S) S.sfx('heal');
      this.updateUnitDom(e.target);
    } else if (e.type === 'knockback') {
      this.knockFloat(e.target, e.kind === 'collide' ? '💥 撞击!' : '↩ 击退!');
      if (S) S.sfx('knock');
    } else if (e.type === 'status') {
      const nm = { poison: '☠️中毒', burn: '🔥灼烧', stun: '💫眩晕', silence: '🔇沉默' }[e.status] || '';
      this.knockFloat(e.target, nm);
      if (S) S.sfx('status');
      this.updateUnitDom(e.target);
    } else if (e.type === 'enrage') {
      this.showSkillBanner('狂暴!');
      this.screenShake();
      if (S) S.sfx('enrage');
      this.updateUnitDom(e.target);
    } else if (e.type === 'break') {
      this.showSkillBanner('破防!');
      this.screenShake();
      if (S) S.sfx('crit');
      this.updateUnitDom(e.target);
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
      { duration: 360, easing: 'ease-out', composite: 'add' }
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
    const cls = kind === 'heal' ? 'heal' : kind === 'dot' ? 'dot' : (crit ? 'crit' : 'dmg');
    const ft = UI.el(`<div class="float-text ${cls}">${kind === 'heal' ? '+' : '-'}${amount}${crit ? '!' : ''}</div>`);
    ft.style.left = (rect.left + rect.width / 2 - 14) + 'px';
    ft.style.top = (rect.top + 10) + 'px';
    document.body.appendChild(ft);
    setTimeout(() => ft.remove(), 1000);
    // 受击抖动（叠加到基础定位变换上）
    unitEl.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
      { duration: 200, composite: 'add' }
    );
  },

  showResult(result) {
    if (window.Sound) Sound.sfx(result === 'win' ? 'victory' : 'defeat');
    // 竞技场结算：不走关卡奖励，按积分处理
    if (this.stage && this.stage.arena) {
      const r = Game.arenaResolve(this.stage.oppId, result === 'win');
      const sign = r.pts >= 0 ? '+' : '';
      const body = result === 'win'
        ? `<div class="reward-row"><div class="rw" style="color:var(--gold);">🪙 +${r.gold}</div><div class="rw" style="color:var(--gem);">💎 +${r.gem}</div></div>
           <p class="muted">竞技积分 <b style="color:var(--accent);">${sign}${r.pts}</b> → ${r.points}</p>`
        : `<p class="muted">惜败… 竞技积分 <b style="color:var(--danger);">${r.pts}</b> → ${r.points}</p>`;
      const m = UI.openModal(`
        <div class="result-modal">
          <div class="result-title ${result === 'win' ? 'win' : 'lose'}">${result === 'win' ? '竞技胜利！' : '竞技失败'}</div>
          <p class="muted">${this.stage.name}</p>
          ${body}
        </div>
        <div class="close-row" style="justify-content:center;"><button class="btn" id="res-ok">${result === 'win' ? '领取' : '返回'}</button></div>
      `, { noBackdropClose: true });
      m.querySelector('#res-ok').onclick = () => { UI.closeModal(m); UI.updateResources(); this.exit(); };
      return;
    }
    // 活动本结算
    if (this.stage && this.stage.event) {
      const r = Game.eventResolve(this.stage.eventId, result === 'win');
      const body = result === 'win'
        ? `<div class="reward-row"><div class="rw" style="color:var(--gold);">🪙 +${r.gold}</div><div class="rw" style="color:var(--accent);">🎟️ 活动币 +${r.coin}</div></div><p class="muted">队伍获得 ${r.exp} 经验</p>`
        : `<p class="muted">挑战失败，未获得奖励。</p>`;
      const m = UI.openModal(`
        <div class="result-modal">
          <div class="result-title ${result === 'win' ? 'win' : 'lose'}">${result === 'win' ? '活动胜利！' : '挑战失败'}</div>
          <p class="muted">${this.stage.name}</p>${body}
        </div>
        <div class="close-row" style="justify-content:center;"><button class="btn" id="res-ok">${result === 'win' ? '领取' : '返回'}</button></div>
      `, { noBackdropClose: true });
      m.querySelector('#res-ok').onclick = () => { UI.closeModal(m); UI.updateResources(); this.exit(); };
      return;
    }
    // 混战（无尽波次）结算
    if (this.stage && this.stage.mayhem) {
      const wave = this.stage.wave;
      if (result === 'win') {
        const rw = Game.mayhemWaveReward(wave);
        Game.applyReward({ gold: rw.gold, gem: rw.gem });
        Game.state.team.forEach(uid => { const o = Game.getOwned(uid); if (o) Game.addExp(o, rw.exp); });
        Game.recordMayhem(wave);
        Game.incQuest('win', 1);
        Game.save();
        const m = UI.openModal(`
          <div class="result-modal">
            <div class="result-title win">第 ${wave} 波 突破！</div>
            <div class="reward-row"><div class="rw" style="color:var(--gold);">🪙 +${rw.gold}</div>${rw.gem ? `<div class="rw" style="color:var(--gem);">💎 +${rw.gem}</div>` : ''}<div class="rw" style="color:var(--accent);">📘 +${rw.exp}</div></div>
            <p class="muted">队伍满血进入下一波，越深奖励越高。</p>
          </div>
          <div class="close-row" style="justify-content:center;">
            <button class="btn secondary" id="mh-stop">结算离场</button>
            <button class="btn gold" id="mh-next">挑战第 ${wave + 1} 波 ›</button>
          </div>`, { noBackdropClose: true });
        m.querySelector('#mh-next').onclick = () => { UI.closeModal(m); UI.updateResources(); UI.startMayhemWave(wave + 1); };
        m.querySelector('#mh-stop').onclick = () => { UI.closeModal(m); UI.updateResources(); this.exit(); };
      } else {
        const m = UI.openModal(`
          <div class="result-modal">
            <div class="result-title lose">混战结束</div>
            <p class="muted">止步第 ${wave} 波 · 历史最高 ${Game.mayhemBest()} 波</p>
          </div>
          <div class="close-row" style="justify-content:center;"><button class="btn" id="res-ok">返回</button></div>`, { noBackdropClose: true });
        m.querySelector('#res-ok').onclick = () => { UI.closeModal(m); UI.updateResources(); this.exit(); };
      }
      return;
    }
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
        if (Game.state.team.length < 5) Game.state.team.push(o.uid);
      });
      Game.save();
    }

    // 返回主界面
    const backBtn = document.getElementById('btn-back');
    if (backBtn) backBtn.addEventListener('click', () => this.switchScreen('home'));

    // 顶栏：邮件 / 设置 / 玩家资料
    const mailBtn = document.getElementById('btn-mail');
    if (mailBtn) mailBtn.addEventListener('click', () => UI.showMailbox());
    const setBtn = document.getElementById('btn-settings');
    if (setBtn) setBtn.addEventListener('click', () => UI.showSettings());
    const noticeBtn = document.getElementById('btn-notice');
    if (noticeBtn) noticeBtn.addEventListener('click', () => UI.showAnnounce());
    const profBtn = document.getElementById('topbar-profile');
    if (profBtn) profBtn.addEventListener('click', () => UI.showProfile());

    // 全屏：按钮切换 + 首次交互自动请求（浏览器要求用户手势触发）
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) fsBtn.addEventListener('click', () => this.toggleFullscreen());
    const syncFsIcon = () => { if (fsBtn) fsBtn.textContent = this.isFullscreen() ? '🗗' : '⛶'; };
    document.addEventListener('fullscreenchange', syncFsIcon);
    document.addEventListener('webkitfullscreenchange', syncFsIcon);
    const autoFs = () => {
      document.removeEventListener('pointerdown', autoFs);
      if (!this.isFullscreen()) this.requestFullscreen();
    };
    document.addEventListener('pointerdown', autoFs, { once: true });

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

  // ---------- 全屏 ----------
  isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  requestFullscreen() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (fn) { try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  },
  exitFullscreen() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) { try { fn.call(document); } catch (e) {} }
  },
  toggleFullscreen() {
    if (this.isFullscreen()) this.exitFullscreen();
    else this.requestFullscreen();
  },

  switchScreen(name) {
    this.current = name;
    if (window.Sound) Sound.bgm('home');
    const isHome = name === 'home';
    // 单一主界面：主页为满屏大厅；其余功能为覆盖面板 + 返回按钮
    const screen = document.getElementById('screen');
    if (screen) screen.classList.toggle('lobby-mode', isHome);
    const backBtn = document.getElementById('btn-back');
    if (backBtn) backBtn.style.display = isHome ? 'none' : '';
    this.refreshCurrent();
    if (screen) screen.scrollTop = 0;
  },

  refreshCurrent() {
    UI.updateResources();
    switch (this.current) {
      case 'home': UI.renderHome(); break;
      case 'gamecards': UI.renderGameCards(); break;
      case 'mayhem': UI.renderMayhem(); break;
      case 'restaurant': UI.renderRestaurant(); break;
      case 'stages': UI.renderStages(); break;
      case 'roster': UI.renderRoster(); break;
      case 'gacha': UI.renderGacha(); break;
      case 'welfare': UI.renderWelfare(); break;
      case 'dungeon': UI.renderDungeon(); break;
      case 'dispatch': UI.renderDispatch(); break;
      case 'arena': UI.renderArena(); break;
      case 'event': UI.renderEvent(); break;
      case 'inventory': UI.renderInventory(); break;
      case 'story': UI.renderStory(); break;
      case 'tasks': UI.renderTasks(); break;
      case 'ach': UI.renderAchievements(); break;
      case 'codex': UI.renderCollection(); break;
      case 'shop': UI.renderShop(); break;
    }
  },
};

window.BattleUI = BattleUI;
window.Main = Main;

document.addEventListener('DOMContentLoaded', () => Main.init());
