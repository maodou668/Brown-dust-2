// ============================================================
//  UI 渲染层 — 各界面渲染、弹窗、战斗界面
// ============================================================

const UI = {
  screenEl: null,
  modalRoot: null,

  init() {
    this.screenEl = document.getElementById('screen');
    this.modalRoot = document.getElementById('modal-root');
  },

  // ---------- 工具 ----------
  el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  },

  rarityClass(r) { return 'r' + r; },

  charAvatar(charId) {
    const c = window.GameData.CHARACTERS[charId];
    const clsIcon = window.GameData.CLASSES[c.cls].icon;
    return clsIcon;
  },

  toast(msg) {
    const t = this.el(`<div class="toast">${msg}</div>`);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2100);
  },

  updateResources() {
    document.getElementById('res-gold').textContent = Game.state.gold;
    document.getElementById('res-gem').textContent = Game.state.gem;
  },

  // ---------- 弹窗 ----------
  openModal(innerHtml, opts = {}) {
    const overlay = this.el(`<div class="modal-overlay"><div class="modal">${innerHtml}</div></div>`);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !opts.noBackdropClose) this.closeModal(overlay);
    });
    this.modalRoot.appendChild(overlay);
    return overlay;
  },
  closeModal(overlay) {
    if (overlay && overlay.remove) overlay.remove();
    else this.modalRoot.innerHTML = '';
  },
  closeAllModals() { this.modalRoot.innerHTML = ''; },

  // ============================================================
  //  主页
  // ============================================================
  renderHome() {
    const s = Game.state;
    const teamHtml = this.renderTeamSlots();
    const totalChars = s.roster.length;
    const cleared = s.cleared.length;
    this.screenEl.innerHTML = `
      <div class="hero-banner">
        <h1>欢迎回来，指挥官</h1>
        <p>组建你的佣兵团，踏上拯救大陆的冒险。挑战关卡、招募强力佣兵，击败魔王巴尔！</p>
      </div>
      <div class="quick-grid">
        <div class="quick-card" data-go="stages">
          <div class="qc-icon">🗺️</div>
          <div class="qc-title">继续冒险</div>
          <div class="qc-sub">已通关 ${cleared}/${window.GameData.STAGES.length} 关</div>
        </div>
        <div class="quick-card" data-go="gacha">
          <div class="qc-icon">🎴</div>
          <div class="qc-title">佣兵招募</div>
          <div class="qc-sub">💎 ${s.gem} 可用</div>
        </div>
        <div class="quick-card" data-go="roster">
          <div class="qc-icon">👥</div>
          <div class="qc-title">佣兵团</div>
          <div class="qc-sub">共 ${totalChars} 名佣兵</div>
        </div>
        <div class="quick-card" data-go="stages">
          <div class="qc-icon">⚔️</div>
          <div class="qc-title">快速战斗</div>
          <div class="qc-sub">挑战最新关卡</div>
        </div>
      </div>
      <div class="team-preview">
        <div class="section-title">出战队伍</div>
        <div class="team-slots">${teamHtml}</div>
        <p class="muted" style="margin-top:8px;">在「佣兵」页点击角色可编入/移出队伍（最多 4 人）</p>
      </div>
    `;
    this.screenEl.querySelectorAll('[data-go]').forEach(c =>
      c.addEventListener('click', () => Main.switchScreen(c.dataset.go)));
  },

  renderTeamSlots() {
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const uid = Game.state.team[i];
      if (uid) {
        const o = Game.getOwned(uid);
        const c = window.GameData.CHARACTERS[o.charId];
        slots.push(`
          <div class="team-slot filled border-${this.rarityClass(c.rarity)}">
            <div class="char-portrait" style="background:radial-gradient(circle at 50% 30%, ${c.color}44, transparent);">
              <span class="rarity-badge ${this.rarityClass(c.rarity)}">${c.rarity}★</span>
              <div class="avatar">${this.charAvatar(o.charId)}</div>
              <span class="pname">${c.name} Lv.${o.level}</span>
            </div>
          </div>`);
      } else {
        slots.push(`<div class="team-slot"><span class="muted" style="font-size:24px;">＋</span></div>`);
      }
    }
    return slots.join('');
  },

  // ============================================================
  //  关卡 / 冒险
  // ============================================================
  renderStages() {
    const s = Game.state;
    const cards = window.GameData.STAGES.map(stage => {
      // 解锁条件：第一关恒解锁，后续需通关前一关
      const unlocked = stage.id === 1 || s.cleared.includes(stage.id - 1);
      const cleared = s.cleared.includes(stage.id);
      return `
        <div class="stage-card ${stage.isBoss ? 'boss' : ''} ${unlocked ? '' : 'locked'}" data-stage="${unlocked ? stage.id : ''}">
          <div class="stage-num">${unlocked ? (stage.isBoss ? '👑' : stage.id) : '🔒'}</div>
          <div class="stage-info">
            <h3>${stage.name} ${cleared ? '<span class="clear-mark">✓</span>' : ''}</h3>
            <p>${unlocked ? stage.desc : '通关前一关后解锁'}</p>
            <div class="stage-meta">
              <span>推荐 Lv.${stage.recommend}</span>
              <span>🪙${stage.reward.gold}</span>
              <span>💎${stage.reward.gem}</span>
            </div>
          </div>
        </div>`;
    }).join('');
    this.screenEl.innerHTML = `<div class="section-title">冒险关卡</div>${cards}`;
    this.screenEl.querySelectorAll('.stage-card[data-stage]').forEach(card => {
      const id = card.dataset.stage;
      if (!id) return;
      card.addEventListener('click', () => this.preBattle(Number(id)));
    });
  },

  /** 出战确认 */
  preBattle(stageId) {
    const stage = window.GameData.STAGES.find(s => s.id === stageId);
    if (Game.state.team.length === 0) {
      this.toast('请先在「佣兵」页编入出战队伍');
      Main.switchScreen('roster');
      return;
    }
    const teamHtml = Game.state.team.map(uid => {
      const o = Game.getOwned(uid);
      const c = window.GameData.CHARACTERS[o.charId];
      return `<div class="team-slot filled border-${this.rarityClass(c.rarity)}" style="max-width:64px;">
        <div class="char-portrait"><div class="avatar" style="font-size:26px;">${this.charAvatar(o.charId)}</div>
        <span class="pname">Lv.${o.level}</span></div></div>`;
    }).join('');
    const enemyHtml = stage.enemies.map(e => {
      const def = window.GameData.ENEMIES[e.id];
      return `<span style="font-size:11px;background:var(--panel);padding:3px 7px;border-radius:6px;">${def.name} Lv.${e.level}</span>`;
    }).join(' ');

    const m = this.openModal(`
      <h2>${stage.name}</h2>
      <p class="muted" style="margin:6px 0 12px;">${stage.desc}</p>
      <div class="muted" style="margin-bottom:6px;">敌方阵容</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">${enemyHtml}</div>
      <div class="muted" style="margin-bottom:6px;">我方出战（${Game.state.team.length}/4）</div>
      <div class="team-slots">${teamHtml}</div>
      <div class="close-row">
        <button class="btn secondary" id="pb-cancel">取消</button>
        <button class="btn" id="pb-fight">出战 ⚔️</button>
      </div>
    `);
    m.querySelector('#pb-cancel').onclick = () => this.closeModal(m);
    m.querySelector('#pb-fight').onclick = () => { this.closeModal(m); BattleUI.start(stage); };
  },

  // ============================================================
  //  佣兵列表
  // ============================================================
  renderRoster() {
    const s = Game.state;
    // 按稀有度、等级排序
    const sorted = s.roster.slice().sort((a, b) => {
      const ca = window.GameData.CHARACTERS[a.charId], cb = window.GameData.CHARACTERS[b.charId];
      return cb.rarity - ca.rarity || b.level - a.level;
    });
    const cards = sorted.map(o => {
      const c = window.GameData.CHARACTERS[o.charId];
      const inTeam = Game.inTeam(o.uid);
      return `
        <div class="roster-card border-${this.rarityClass(c.rarity)}" data-uid="${o.uid}">
          ${inTeam ? '<span class="in-team-tag">出战</span>' : ''}
          <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${c.color}44, transparent);">
            <span class="rarity-badge ${this.rarityClass(c.rarity)}">${c.rarity}★</span>
            ${this.charAvatar(o.charId)}
            <span class="cls-chip">${window.GameData.ELEMENTS[c.element].icon}</span>
          </div>
          <div class="rc-info">
            <div class="rc-name">${c.name}</div>
            <div class="rc-lv">Lv.${o.level} · ${window.GameData.CLASSES[c.cls].name}</div>
          </div>
        </div>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="section-title">佣兵团（${s.roster.length}）</div>
      <p class="muted" style="margin:-6px 0 12px;">点击佣兵查看详情、升级与编队 · 出战 ${s.team.length}/4</p>
      <div class="roster-grid">${cards}</div>`;
    this.screenEl.querySelectorAll('.roster-card').forEach(card =>
      card.addEventListener('click', () => this.showCharDetail(card.dataset.uid)));
  },

  /** 角色详情弹窗 */
  showCharDetail(uid) {
    const o = Game.getOwned(uid);
    const c = window.GameData.CHARACTERS[o.charId];
    const st = Game.computeStats(o);
    const inTeam = Game.inTeam(uid);
    const lvCost = Game.levelUpCost(o.level);
    const skillsHtml = c.skills.map(sid => {
      const sk = window.GameData.SKILLS[sid];
      return `<div class="skill-item">
        <div class="sk-head"><span>${sk.icon}</span>${sk.name}
          <span class="sk-sp">${sk.sp > 0 ? 'SP ' + sk.sp : '普通'}</span></div>
        <div class="sk-desc">${sk.desc}</div>
      </div>`;
    }).join('');

    const m = this.openModal(`
      <div class="detail-head">
        <div class="detail-art border-${this.rarityClass(c.rarity)}" style="background:radial-gradient(circle at 50% 35%, ${c.color}55, var(--panel));">
          ${this.charAvatar(o.charId)}
        </div>
        <div class="detail-title">
          <h2>${c.name} <span class="${this.rarityClass(c.rarity)}" style="font-size:11px;padding:1px 6px;border-radius:5px;">${c.rarity}★</span></h2>
          <div class="subt">${c.title}</div>
          <div class="meta">${window.GameData.ELEMENTS[c.element].icon}${window.GameData.ELEMENTS[c.element].name} · ${window.GameData.CLASSES[c.cls].icon}${window.GameData.CLASSES[c.cls].name} · Lv.${o.level}</div>
        </div>
      </div>
      <p class="muted" style="line-height:1.6;">${c.desc}</p>
      <div class="stat-grid">
        <div class="stat-item"><span>❤️ 生命</span><span class="sv">${st.maxHp}</span></div>
        <div class="stat-item"><span>⚔️ 攻击</span><span class="sv">${st.atk}</span></div>
        <div class="stat-item"><span>🛡️ 防御</span><span class="sv">${st.def}</span></div>
        <div class="stat-item"><span>⚡ 速度</span><span class="sv">${st.spd}</span></div>
        <div class="stat-item"><span>💥 暴击</span><span class="sv">${Math.round(st.crit*100)}%</span></div>
        <div class="stat-item"><span>⭐ 稀有</span><span class="sv">${c.rarity}★</span></div>
      </div>
      <div class="section-title" style="font-size:14px;">技能</div>
      ${skillsHtml}
      <div class="close-row">
        <button class="btn secondary" id="cd-close">关闭</button>
        <button class="btn gold" id="cd-levelup" ${Game.state.gold < lvCost || o.level >= 60 ? 'disabled' : ''}>
          ${o.level >= 60 ? '满级' : `升级 🪙${lvCost}`}
        </button>
        <button class="btn" id="cd-team">${inTeam ? '移出队伍' : '编入队伍'}</button>
      </div>
    `);
    m.querySelector('#cd-close').onclick = () => this.closeModal(m);
    m.querySelector('#cd-levelup').onclick = () => {
      const r = Game.levelUpWithGold(uid);
      if (!r.ok) { this.toast(r.msg); return; }
      this.toast(`${c.name} 升至 Lv.${r.level}！`);
      this.updateResources();
      this.closeModal(m);
      this.showCharDetail(uid);
    };
    m.querySelector('#cd-team').onclick = () => {
      const r = Game.toggleTeam(uid);
      if (!r.ok) { this.toast(r.msg); return; }
      this.closeModal(m);
      this.renderRoster();
    };
  },

  // ============================================================
  //  抽卡
  // ============================================================
  renderGacha() {
    const s = Game.state;
    const g = window.GameData.GACHA;
    this.screenEl.innerHTML = `
      <div class="gacha-banner">
        <h2>命运的召唤</h2>
        <div class="sub">传说级佣兵正在等待你的召唤</div>
        <div class="gacha-rates">
          <b>5★ ${(g.rates[5]*100).toFixed(0)}%</b> · 4★ ${(g.rates[4]*100).toFixed(0)}% · 3★ ${(g.rates[3]*100).toFixed(0)}%
          <div class="pity-bar">距离保底 5★ 还有 ${90 - s.pity} 抽</div>
        </div>
        <div class="gacha-actions">
          <button class="btn gold" id="pull1">单次招募 💎${g.cost}</button>
          <button class="btn" id="pull10">十连招募 💎${g.cost*10}</button>
        </div>
      </div>
      <div class="section-title" style="font-size:14px;">可获得的传说佣兵（5★）</div>
      <div class="roster-grid">${g.pool[5].map(id => this.poolCard(id)).join('')}</div>
      <div class="section-title" style="font-size:14px;margin-top:16px;">稀有佣兵（4★）</div>
      <div class="roster-grid">${g.pool[4].map(id => this.poolCard(id)).join('')}</div>
    `;
    document.getElementById('pull1').onclick = () => this.doPull(1);
    document.getElementById('pull10').onclick = () => this.doPull(10);
  },

  poolCard(id) {
    const c = window.GameData.CHARACTERS[id];
    return `<div class="roster-card border-${this.rarityClass(c.rarity)}">
      <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${c.color}44, transparent);">
        <span class="rarity-badge ${this.rarityClass(c.rarity)}">${c.rarity}★</span>
        ${this.charAvatar(id)}
        <span class="cls-chip">${window.GameData.ELEMENTS[c.element].icon}</span>
      </div>
      <div class="rc-info"><div class="rc-name">${c.name}</div>
      <div class="rc-lv">${window.GameData.CLASSES[c.cls].name}</div></div>
    </div>`;
  },

  doPull(count) {
    const cost = window.GameData.GACHA.cost * count;
    if (Game.state.gem < cost) { this.toast('宝石不足，去冒险赚取吧！'); return; }
    const results = [];
    for (let i = 0; i < count; i++) {
      const r = Game.gachaPull();
      if (!r.ok) break;
      results.push(r);
    }
    this.updateResources();
    this.showPullResults(results);
  },

  showPullResults(results) {
    if (results.length === 1) {
      const r = results[0];
      const c = window.GameData.CHARACTERS[r.charId];
      const stars = '★'.repeat(r.rarity);
      const m = this.openModal(`
        <div class="pull-result">
          <div class="pull-art border-${this.rarityClass(r.rarity)}" style="background:radial-gradient(circle at 50% 35%, ${c.color}66, var(--panel));">
            ${this.charAvatar(r.charId)}
          </div>
          <div class="pull-stars ${this.rarityClass(r.rarity)}" style="-webkit-text-fill-color:initial;color:var(--${'r'+r.rarity});">${stars}</div>
          <div class="pull-name">${c.name}</div>
          <div class="pull-title">${c.title}</div>
          ${r.dup ? '<div class="pull-dup">重复获得 · 返还 💎20</div>' : '<div class="pull-dup">✦ 新佣兵加入！</div>'}
        </div>
        <div class="close-row"><button class="btn" id="pr-ok">确定</button></div>
      `, { noBackdropClose: true });
      m.querySelector('#pr-ok').onclick = () => { this.closeModal(m); this.renderGacha(); };
    } else {
      // 十连结果网格
      const grid = results.map(r => {
        const c = window.GameData.CHARACTERS[r.charId];
        return `<div class="roster-card border-${this.rarityClass(r.rarity)}">
          <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${c.color}44, transparent);">
            <span class="rarity-badge ${this.rarityClass(r.rarity)}">${r.rarity}★</span>
            ${this.charAvatar(r.charId)}
            ${r.dup ? '' : '<span class="in-team-tag" style="background:var(--gold);color:#241a08;">NEW</span>'}
          </div>
          <div class="rc-info"><div class="rc-name">${c.name}</div></div>
        </div>`;
      }).join('');
      const best = Math.max(...results.map(r => r.rarity));
      const m = this.openModal(`
        <h2 style="text-align:center;">十连招募结果</h2>
        <p class="muted" style="text-align:center;margin-bottom:12px;">最高稀有度 <b class="${this.rarityClass(best)}" style="padding:1px 6px;border-radius:5px;">${best}★</b></p>
        <div class="roster-grid">${grid}</div>
        <div class="close-row"><button class="btn" id="pr-ok">确定</button></div>
      `, { noBackdropClose: true });
      m.querySelector('#pr-ok').onclick = () => { this.closeModal(m); this.renderGacha(); };
    }
  },
};

window.UI = UI;
