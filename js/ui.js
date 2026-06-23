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
    if (c.art) {
      // 图片优先：加载失败自动回退到职业图标占位
      return `<img class="char-img" src="${c.art}" alt="${c.name}" loading="lazy"
        onerror="this.outerHTML='<span class=&quot;char-emoji&quot;>${clsIcon}</span>'">`;
    }
    return clsIcon;
  },

  toast(msg) {
    const t = this.el(`<div class="toast">${msg}</div>`);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2100);
  },

  updateResources() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('res-gold', Game.state.gold);
    set('res-gem', Game.state.gem);
    set('res-stone', Game.state.awakenStone || 0);
    Game.syncStamina();
    set('res-stam', Game.state.stamina);
    set('pc-lv', Game.accountLevel());
    set('pc-pow', Game.playerPower());
    const dot = document.getElementById('mail-dot');
    if (dot) dot.style.display = Game.mailUnclaimed() > 0 ? '' : 'none';
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
    Game.syncStamina();
    const cleared = s.cleared.length, total = window.GameData.STAGES.length;
    const arenaName = Game.arenaRank((s.arena && s.arena.points) || 1000).name;
    // 左栏：日常玩法入口（带角标）
    const leftRail = [
      { go: 'dungeon', icon: '⚡', label: '副本', tag: `${s.stamina}` },
      { go: 'dispatch', icon: '🧭', label: '远征', tag: Game.dispatchHomeTag() },
      { go: 'arena', icon: '🏆', label: '竞技场', tag: arenaName },
      { go: 'event', icon: '🎏', label: '活动', tag: `🎟${(s.event && s.event.coin) || 0}` },
    ];
    // 右栏：信息/商店入口
    const rightRail = [
      { go: 'shop', icon: '🛒', label: '商店' },
      { go: 'codex', icon: '📚', label: '图鉴' },
      { act: 'ach', icon: '🏅', label: '成就' },
      { act: 'announce', icon: '📢', label: '公告' },
    ];
    // 底部：核心养成功能
    const bottom = [
      { go: 'gacha', icon: '🎴', label: '招募' },
      { go: 'roster', icon: '👥', label: '佣兵' },
      { act: 'team', icon: '⚔️', label: '编队' },
      { go: 'inventory', icon: '🎒', label: '背包' },
      { act: 'forge', icon: '🔨', label: '锻造' },
      { go: 'welfare', icon: '🎁', label: '福利', tag: Game.canCheckIn() ? '!' : '' },
      { act: 'story', icon: '🎬', label: '剧情' },
    ];
    const railBtn = a => `<button class="rail-btn" ${a.go ? `data-go="${a.go}"` : `data-act="${a.act}"`}>
      <span class="rb-icon">${a.icon}</span><span class="rb-label">${a.label}</span>${a.tag ? `<span class="rb-tag">${a.tag}</span>` : ''}</button>`;
    const bottomBtn = a => `<button class="lobby-btn" ${a.go ? `data-go="${a.go}"` : `data-act="${a.act}"`}>
      <span class="lb-icon">${a.icon}</span><span class="lb-label">${a.label}</span>${a.tag ? `<span class="lb-dot">${a.tag}</span>` : ''}</button>`;
    this.screenEl.innerHTML = `
      <div class="lobby">
        <div class="lobby-bg"><div class="lobby-bg-grid"></div></div>
        <div class="lobby-grid">
          <div class="lobby-rail left">${leftRail.map(railBtn).join('')}</div>
          <div class="lobby-center">
            <div class="lobby-welcome">
              <h1>棕色尘埃 <small>2</small></h1>
              <p class="muted">欢迎回来，指挥官</p>
            </div>
            <div class="lobby-char-ph">🗡️<span class="muted">（主角立绘 / 动态背景位）</span></div>
            <button class="lobby-cta" data-go="stages">
              <span class="cta-go">出 战</span>
              <span class="cta-sub">主线冒险 · 已通关 ${cleared}/${total}</span>
            </button>
          </div>
          <div class="lobby-rail right">${rightRail.map(railBtn).join('')}</div>
        </div>
        <div class="lobby-actions">${bottom.map(bottomBtn).join('')}</div>
      </div>`;
    this.screenEl.querySelectorAll('[data-go]').forEach(c =>
      c.addEventListener('click', () => Main.switchScreen(c.dataset.go)));
    this.screenEl.querySelectorAll('[data-act]').forEach(c =>
      c.addEventListener('click', () => {
        const a = c.dataset.act;
        if (a === 'team') this.showTeamEditor(0);
        else if (a === 'forge') this.showForge();
        else if (a === 'story') this.showStoryReplay();
        else if (a === 'ach') this.showAchievements();
        else if (a === 'announce') this.showAnnounce();
      }));
  },

  /** 队伍编辑器：从出战框直接编辑 */
  showTeamEditor(slotIdx) {
    const TEAM_MAX = 5;
    let sel = Math.max(0, Math.min(TEAM_MAX - 1, slotIdx || 0));
    const render = (m) => {
      const currentUid = Game.state.team[sel];
      const current = currentUid ? Game.getOwned(currentUid) : null;
      // 顶部：5 个出战槽位，点击切换正在编辑的位置
      const slotsBar = Array.from({ length: TEAM_MAX }, (_, i) => {
        const uid = Game.state.team[i];
        const o = uid ? Game.getOwned(uid) : null;
        const c = o ? window.GameData.CHARACTERS[o.charId] : null;
        const art = o
          ? `<div class="ts-art" style="background:radial-gradient(circle at 50% 35%, ${Game.activeColor(o)}55, transparent);">${this.charAvatar(o.charId)}</div>`
          : `<div class="ts-art empty">+</div>`;
        return `<div class="te-slot ${i === sel ? 'sel' : ''} ${o ? 'border-' + this.rarityClass(c.rarity) : 'empty'}" data-slot="${i}">
          ${art}
          <div class="ts-no">${o ? c.name : '第' + (i + 1) + '位'}</div>
        </div>`;
      }).join('');

      // 候选只展示「未出战」的角色，避免与已上阵角色混淆
      const avail = Game.state.roster.filter(o => Game.state.team.indexOf(o.uid) < 0)
        .sort((a, b) => {
          const ca = window.GameData.CHARACTERS[a.charId], cb = window.GameData.CHARACTERS[b.charId];
          return cb.rarity - ca.rarity || b.level - a.level;
        });

      let curHtml;
      if (current) {
        const cc = window.GameData.CHARACTERS[current.charId];
        curHtml = `<div class="te-current">
          <div class="roster-card border-${this.rarityClass(cc.rarity)}" style="width:84px;">
            <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${Game.activeColor(current)}44, transparent);">
              <span class="rarity-badge ${this.rarityClass(cc.rarity)}">${cc.rarity}★</span>
              ${current.plus ? `<span class="plus-badge corner">+${current.plus}</span>` : ''}
              ${this.charAvatar(current.charId)}
            </div>
            <div class="rc-info"><div class="rc-name">${cc.name}</div><div class="rc-lv">Lv.${current.level}</div></div>
          </div>
          <div class="te-current-info">
            <div>第 ${sel + 1} 位出战：<b>${cc.name}</b></div>
            <button class="btn secondary sm" id="te-remove">移出该位置</button>
          </div>
        </div>`;
      } else {
        curHtml = `<div class="te-current empty muted">第 ${sel + 1} 位为空，从下方选择一名角色上阵 ›</div>`;
      }

      const grid = avail.length ? avail.map(o => {
        const c = window.GameData.CHARACTERS[o.charId];
        return `<div class="roster-card border-${this.rarityClass(c.rarity)}" data-uid="${o.uid}">
          <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${Game.activeColor(o)}44, transparent);">
            <span class="rarity-badge ${this.rarityClass(c.rarity)}">${c.rarity}★</span>
            ${o.plus ? `<span class="plus-badge corner">+${o.plus}</span>` : ''}
            ${this.charAvatar(o.charId)}
          </div>
          <div class="rc-info"><div class="rc-name">${c.name}</div><div class="rc-lv">Lv.${o.level}</div></div>
        </div>`;
      }).join('') : '<div class="muted" style="padding:12px;grid-column:1/-1;">没有可上阵的角色了</div>';

      m.querySelector('.te-slots').innerHTML = slotsBar;
      m.querySelector('.te-current-wrap').innerHTML = curHtml;
      m.querySelector('.te-body').innerHTML = grid;
      m.querySelector('.te-count').textContent = `${Game.state.team.length}/${TEAM_MAX}`;

      m.querySelectorAll('.te-slot').forEach(el => el.onclick = () => { sel = +el.dataset.slot; render(m); });
      const rm = m.querySelector('#te-remove');
      if (rm) rm.onclick = () => { Game.clearTeamSlot(sel); render(m); };
      m.querySelectorAll('[data-uid]').forEach(el => el.onclick = () => {
        const r = Game.setTeamSlot(sel, el.dataset.uid);
        if (!r.ok) { this.toast(r.msg); return; }
        render(m);
      });
    };
    const m = this.openModal(`
      <h2>编队 <span class="te-count" style="font-size:13px;color:var(--accent);"></span></h2>
      <div class="te-slots"></div>
      <div class="te-current-wrap"></div>
      <p class="muted" style="margin:10px 0 8px;">先点上方选择位置，再点下方角色上阵 / 替换（最多 ${TEAM_MAX} 人）。</p>
      <div class="te-body roster-grid"></div>
      <div class="close-row"><button class="btn" id="te-done">完成</button></div>
    `);
    render(m);
    m.querySelector('#te-done').onclick = () => { this.closeModal(m); this.renderHome(); };
  },

  /** 剧情回顾弹窗 */
  showStoryReplay() {
    const main = [
      { id: 'prologue', name: '序章 · 启程' },
      { id: 'stage1', name: '第一章 · 艾尔玛森林入口' },
      { id: 'stage2', name: '第二章 · 森林深处' },
      { id: 'stage3', name: '第三章 · 废弃矿洞' },
      { id: 'stage4', name: '第四章 · 诅咒山脊' },
      { id: 'stage5', name: '第五章 · 魔王城' },
      { id: 'epilogue', name: '第一部终章 · 魔王陨落' },
      { id: 'stage6', name: '第二部 · 破碎边境' },
      { id: 'stage7', name: '第二部 · 永夜回廊' },
      { id: 'epilogue2', name: '第二部终章 · 曙光' },
    ];
    // 角色支线：从拥有的角色中筛出有支线的
    const sideSeen = new Set();
    const sides = [];
    Game.state.roster.forEach(o => {
      const ch = window.GameData.CHARACTERS[o.charId];
      if (ch.side && window.STORY[ch.side] && !sideSeen.has(ch.side)) {
        sideSeen.add(ch.side);
        sides.push({ id: ch.side, name: `${ch.name} · ${ch.title}` });
      }
    });
    const row = (ch) => {
      const unlocked = Story.seen(ch.id);
      return `<div class="story-replay-item ${unlocked ? '' : 'locked'}" ${unlocked ? `data-replay="${ch.id}"` : ''}>
        <span>${unlocked ? '📖' : '🔒'} ${ch.name}</span>
        <span class="muted">${unlocked ? '重看 ›' : '未解锁'}</span>
      </div>`;
    };
    const sidesHtml = sides.length ? `
      <div class="replay-group-title">角色支线</div>
      <div class="story-replay-list">${sides.map(row).join('')}</div>` : '';
    const m = this.openModal(`
      <h2>剧情回顾</h2>
      <p class="muted" style="margin:6px 0 12px;">重温你已经历的故事篇章。角色支线可在佣兵详情里随时观看。</p>
      <div class="replay-group-title">📖 漫画剧场 <span class="muted" style="font-weight:400;font-size:11px;">· 分镜演出关键剧情</span></div>
      <div class="comic-entry">
        <div class="comic-entry-card" data-comic="ep_prologue">
          <div class="ce-title">序章 · 烬火启程</div>
          <div class="ce-sub">指挥官与佣兵团的相遇 ›</div>
        </div>
        <div class="comic-entry-card" data-comic="ep_twist">
          <div class="ce-title">终章 · 魔王的真相</div>
          <div class="ce-sub">巴尔临终揭示的秘密 ›</div>
        </div>
        <div class="comic-entry-card" data-comic="ep_nightfall">
          <div class="ce-title">永夜将明 · 女皇的摇篮曲</div>
          <div class="ce-sub">第二卷终章 · 涅夫提斯 ›</div>
        </div>
      </div>
      <div class="replay-group-title" style="margin-top:14px;">主线剧情</div>
      <div class="story-replay-list">${main.map(row).join('')}</div>
      ${sidesHtml}
      <div class="close-row"><button class="btn secondary" id="sr-close">关闭</button></div>
    `);
    m.querySelector('#sr-close').onclick = () => this.closeModal(m);
    m.querySelectorAll('[data-comic]').forEach(it =>
      it.addEventListener('click', () => {
        this.closeModal(m);
        window.Comic && Comic.open(it.dataset.comic);
      }));
    m.querySelectorAll('[data-replay]').forEach(it =>
      it.addEventListener('click', () => {
        this.closeModal(m);
        Story.play(it.dataset.replay);
      }));
  },

  renderTeamSlots() {
    const slots = [];
    for (let i = 0; i < 5; i++) {
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
    const chapters = World.CHAPTERS.map((ch, idx) => {
      const unlocked = World.isChapterUnlocked(idx);
      const prog = World.progress(ch.id);
      const done = World.isChapterDone(ch);
      const total = ch.steps.length;
      const themeIcon = { forest: '🌲', cave: '⛏️', castle: '🏰' }[ch.theme] || '🗺️';
      return `
        <div class="chapter-card ${unlocked ? '' : 'locked'} ${done ? 'done' : ''}" data-ch="${unlocked ? ch.id : ''}">
          <div class="chapter-art">${unlocked ? themeIcon : '🔒'}</div>
          <div class="chapter-info">
            <h3>${ch.name} ${done ? '<span class="clear-mark">✓</span>' : ''}</h3>
            <p>${unlocked ? ch.desc : '通关上一章后解锁'}</p>
            ${unlocked ? `<div class="chapter-prog"><div class="cp-bar"><div class="cp-fill" style="width:${Math.round(prog / total * 100)}%"></div></div><span>${prog}/${total} 目标</span></div>` : ''}
          </div>
          <div class="chapter-go">${unlocked ? (done ? '重玩 ›' : prog > 0 ? '继续 ›' : '进入 ›') : ''}</div>
        </div>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="section-title">章节冒险 <span class="muted" style="font-weight:400;font-size:11px;">· 在场景中走动，到达目标触发剧情与战斗</span></div>
      ${chapters}
      <p class="muted" style="text-align:center;margin-top:10px;">用方向键移动，跟随 ▼ 指引到达目标</p>
      ${this.trialSectionHtml()}`;
    this.screenEl.querySelectorAll('.chapter-card[data-ch]').forEach(card => {
      const id = card.dataset.ch;
      if (!id) return;
      card.addEventListener('click', () => World.openChapter(id));
    });
    this.screenEl.querySelectorAll('.trial-card[data-trial]').forEach(card => {
      card.addEventListener('click', () => this.showTrialConfirm(parseInt(card.dataset.trial, 10)));
    });
    this.screenEl.querySelectorAll('.trial-sweep').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = Game.sweepTrial(parseInt(btn.dataset.sweep, 10));
        if (!r.ok) { this.toast(r.msg || '无法扫荡'); return; }
        if (window.Sound) Sound.sfx('levelup');
        let msg = `扫荡完成：🪙${r.gold} 💎${r.gem}`;
        if (r.drop) { const tpl = Game.getGearTpl(r.drop); if (tpl) msg += ` · 🎁${tpl.name}`; }
        this.toast(msg);
        this.updateResources();
      });
    });
  },

  /** 试炼之塔区块 HTML */
  trialSectionHtml() {
    const trials = window.GameData.TRIALS || [];
    const max = Game.state.trialMax || 0;
    const cards = trials.map((t, i) => {
      const unlocked = i <= max;          // 第 1 层默认开放；逐层解锁
      const cleared = i < max;            // 已通关的层
      const enemyNames = t.enemies.map(e => window.GameData.ENEMIES[e.id].name);
      const bossName = t.isBoss ? enemyNames[0] : null;
      return `<div class="trial-card ${unlocked ? '' : 'locked'} ${cleared ? 'done' : ''}" ${unlocked ? `data-trial="${i}"` : ''}>
        <div class="trial-floor">${t.isBoss ? '👑' : '🗼'}<span>${t.tier}F</span></div>
        <div class="trial-info">
          <h3>${unlocked ? t.name : `试炼之塔 · 第 ${t.tier} 层`} ${cleared ? '<span class="clear-mark">✓</span>' : ''}</h3>
          <p>${unlocked ? t.desc : '通关上一层后开启'}</p>
          ${unlocked ? `<div class="trial-meta"><span class="muted">推荐 Lv.${t.recommend}</span>${bossName ? `<span class="trial-boss">BOSS ${bossName}</span>` : ''}<span class="trial-reward">🪙${t.reward.gold} 💎${t.reward.gem}</span></div>` : ''}
        </div>
        <div class="trial-go">${!unlocked ? '🔒' : cleared ? `<button class="trial-sweep" data-sweep="${i}">扫荡</button><div class="muted" style="font-size:10px;margin-top:4px;">再战 ›</div>` : '挑战 ›'}</div>
      </div>`;
    }).join('');
    return `
      <div class="section-title" style="margin-top:20px;">🗼 试炼之塔 <span class="muted" style="font-weight:400;font-size:11px;">· 逐层强化的循环挑战，越高层奖励越丰厚</span></div>
      <div class="trial-progress muted">当前进度：${max} / ${trials.length} 层</div>
      ${cards}`;
  },

  /** 试炼出战确认 */
  showTrialConfirm(idx) {
    const trial = window.GameData.TRIALS[idx];
    if (!trial) return;
    if (Game.state.team.length === 0) {
      this.toast('请先在「主页」编入出战队伍');
      Main.switchScreen('home');
      return;
    }
    const teamHtml = Game.state.team.map(uid => {
      const o = Game.getOwned(uid);
      const c = window.GameData.CHARACTERS[o.charId];
      return `<div class="team-slot filled border-${this.rarityClass(c.rarity)}" style="max-width:64px;">
        <div class="char-portrait"><div class="avatar" style="font-size:26px;">${this.charAvatar(o.charId)}</div>
        <span class="pname">Lv.${o.level}</span></div></div>`;
    }).join('');
    const enemyHtml = trial.enemies.map(e => {
      const def = window.GameData.ENEMIES[e.id];
      return `<span style="font-size:11px;background:var(--panel);padding:3px 7px;border-radius:6px;">${def.name} Lv.${e.level}</span>`;
    }).join(' ');
    const m = this.openModal(`
      <h2>${trial.name}</h2>
      <p class="muted" style="margin:6px 0 12px;">${trial.desc}</p>
      <div class="muted" style="margin-bottom:6px;">敌方阵容 · 推荐 Lv.${trial.recommend}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">${enemyHtml}</div>
      <div class="muted" style="margin-bottom:6px;">我方出战（${Game.state.team.length}/5）</div>
      <div class="team-slots">${teamHtml}</div>
      <div class="close-row">
        <button class="btn secondary" id="tc-cancel">取消</button>
        <button class="btn" id="tc-fight">登塔 ⚔️</button>
      </div>
    `);
    m.querySelector('#tc-cancel').onclick = () => this.closeModal(m);
    m.querySelector('#tc-fight').onclick = () => {
      this.closeModal(m);
      BattleUI.start(trial, () => {
        if (Battle.result === 'win' && idx + 1 > (Game.state.trialMax || 0)) {
          Game.state.trialMax = idx + 1;
          Game.save();
        }
        this.renderStages();
      });
    };
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
      <div class="muted" style="margin-bottom:6px;">我方出战（${Game.state.team.length}/5）</div>
      <div class="team-slots">${teamHtml}</div>
      <div class="close-row">
        <button class="btn secondary" id="pb-cancel">取消</button>
        <button class="btn" id="pb-fight">出战 ⚔️</button>
      </div>
    `);
    m.querySelector('#pb-cancel').onclick = () => this.closeModal(m);
    m.querySelector('#pb-fight').onclick = () => {
      this.closeModal(m);
      // 进战斗前播放该关卡剧情（首次），看过则直接开战
      const storyId = 'stage' + stage.id;
      if (window.STORY && window.STORY[storyId] && !Story.seen(storyId)) {
        Story.play(storyId, () => BattleUI.start(stage));
      } else {
        BattleUI.start(stage);
      }
    };
  },

  // ============================================================
  //  佣兵列表
  // ============================================================
  renderRoster() {
    const s = Game.state;
    const E = window.GameData.ELEMENTS;
    this.rosterFilter = this.rosterFilter || { element: null, team: false };
    this.rosterSort = this.rosterSort || 'rarity';
    const f = this.rosterFilter;

    // 筛选
    let list = s.roster.filter(o => {
      const c = window.GameData.CHARACTERS[o.charId];
      if (f.element && c.element !== f.element) return false;
      if (f.team && !Game.inTeam(o.uid)) return false;
      return true;
    });
    // 排序
    const sortFns = {
      rarity: (a, b) => { const ca = window.GameData.CHARACTERS[a.charId], cb = window.GameData.CHARACTERS[b.charId]; return cb.rarity - ca.rarity || b.level - a.level; },
      level: (a, b) => b.level - a.level || (b.plus || 0) - (a.plus || 0),
      element: (a, b) => { const order = ['fire', 'water', 'wind', 'earth', 'light', 'dark']; return order.indexOf(window.GameData.CHARACTERS[a.charId].element) - order.indexOf(window.GameData.CHARACTERS[b.charId].element); },
    };
    list = list.slice().sort(sortFns[this.rosterSort] || sortFns.rarity);

    const cards = list.map(o => {
      const c = window.GameData.CHARACTERS[o.charId];
      const inTeam = Game.inTeam(o.uid);
      return `
        <div class="roster-card border-${this.rarityClass(c.rarity)}" data-uid="${o.uid}">
          ${inTeam ? '<span class="in-team-tag">出战</span>' : ''}
          <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${c.color}44, transparent);">
            <span class="rarity-badge ${this.rarityClass(c.rarity)}">${c.rarity}★</span>
            ${o.plus ? `<span class="plus-badge corner">+${o.plus}</span>` : ''}
            ${this.charAvatar(o.charId)}
            <span class="cls-chip">${E[c.element].icon}</span>
          </div>
          <div class="rc-info">
            <div class="rc-name">${c.name}</div>
            <div class="rc-lv">Lv.${o.level} · ${window.GameData.CLASSES[c.cls].name}</div>
          </div>
        </div>`;
    }).join('') || '<p class="muted" style="grid-column:1/-1;padding:16px;text-align:center;">没有符合筛选的佣兵</p>';

    const elemChip = (key, icon) => `<button class="rf-chip ${f.element === key ? 'on' : ''}" data-elem="${key || ''}">${icon}</button>`;
    const sortLabel = { rarity: '稀有度', level: '等级', element: '元素' }[this.rosterSort];

    this.screenEl.innerHTML = `
      <div class="section-title">佣兵团（${s.roster.length}）</div>
      <div class="roster-bar">
        <div class="rf-elems">
          ${elemChip(null, '全部')}
          ${['fire', 'wind', 'earth', 'water', 'light', 'dark'].map(k => elemChip(k, E[k].icon)).join('')}
        </div>
        <div class="rf-ctrl">
          <button class="rf-toggle ${f.team ? 'on' : ''}" id="rf-team">仅出战</button>
          <button class="rf-sort" id="rf-sort">排序：${sortLabel}</button>
        </div>
      </div>
      <p class="muted" style="margin:-2px 0 10px;font-size:11px;">点击佣兵查看详情、升级 · 出战 ${s.team.length}/5 · 显示 ${list.length}</p>
      <div class="roster-grid">${cards}</div>`;

    this.screenEl.querySelectorAll('[data-elem]').forEach(b => b.onclick = () => {
      f.element = b.dataset.elem || null; this.renderRoster();
    });
    this.screenEl.querySelector('#rf-team').onclick = () => { f.team = !f.team; this.renderRoster(); };
    this.screenEl.querySelector('#rf-sort').onclick = () => {
      const order = ['rarity', 'level', 'element'];
      this.rosterSort = order[(order.indexOf(this.rosterSort) + 1) % order.length];
      this.renderRoster();
    };
    this.screenEl.querySelectorAll('.roster-card').forEach(card =>
      card.addEventListener('click', () => this.showCharDetail(card.dataset.uid)));
  },

  /** 好感 + 觉醒 区块 */
  affAwakenHtml(o) {
    const affLv = Game.affLevel(o), aff = o.aff || 0;
    const awk = o.awaken || 0;
    const stars = '★'.repeat(awk) + '☆'.repeat(5 - awk);
    const ac = Game.awakenCost(awk);
    const canAwk = awk < 5 && (Game.state.awakenStone || 0) >= ac.stone && Game.state.gold >= ac.gold;
    return `
      <div class="section-title" style="font-size:14px;">羁绊 · 觉醒</div>
      <div class="aa-box">
        <div class="aa-row">
          <div class="aa-label">❤️ 好感 Lv.${affLv} <span class="muted">(攻击/生命 +${affLv}%)</span></div>
          <div class="aa-bar"><div class="aa-fill aff" style="width:${(aff % 100) / 100 * 100 || (affLv >= 10 ? 100 : 0)}%;"></div></div>
          <button class="btn sm" id="cd-gift" ${aff >= Game.AFF_MAX || Game.state.gold < Game.GIFT_COST ? 'disabled' : ''}>${aff >= Game.AFF_MAX ? '满' : `赠礼 🪙${Game.GIFT_COST}`}</button>
        </div>
        <div class="aa-row">
          <div class="aa-label">🔮 觉醒 <span class="aa-stars">${stars}</span> <span class="muted">(全属性 +${awk * 6}%)</span></div>
          <button class="btn sm" id="cd-awaken" ${canAwk ? '' : 'disabled'}>${awk >= 5 ? '已满' : `觉醒 🔮${ac.stone}+🪙${ac.gold}`}</button>
        </div>
      </div>`;
  },

  /** 角色详情弹窗 */
  showCharDetail(uid) {
    const o = Game.getOwned(uid);
    const c = window.GameData.CHARACTERS[o.charId];
    const st = Game.computeStats(o);
    const inTeam = Game.inTeam(uid);
    const lvCost = Game.levelUpCost(o.level);
    const cosDef = Game.activeCostumeDef(o);
    // 战斗技能池：普攻 + 各拥有服装的招式
    const activeSig = Game.activeCostumeDef(o).signature;
    const plus = o.plus || 0;
    const skillsHtml = Game.battleSkills(o).map(sid => {
      const sk = window.GameData.SKILLS[sid];
      // 突破强化：仅作用于「当前服装」的专属招式
      const boosted = !sk.basic && sid === activeSig && plus > 0;
      const effSp = boosted ? Math.max(0, (sk.sp || 0) - Math.floor(plus / 2)) : sk.sp;
      const cdTxt = sk.basic ? '回 SP' : `SP ${effSp}${sk.cd != null ? ' · 冷却' + sk.cd : ''}`;
      const boostTag = boosted ? `<span class="sk-boost">突破+${plus} · 威力+${plus * 6}%${effSp < sk.sp ? ' · SP-' + (sk.sp - effSp) : ''}</span>` : '';
      return `<div class="skill-item ${boosted ? 'boosted' : ''}">
        <div class="sk-head"><span>${sk.icon}</span>${sk.name}
          <span class="sk-sp">${cdTxt}</span></div>
        ${boostTag}
        <div class="sk-desc">${sk.desc}</div>
      </div>`;
    }).join('');
    // 服装切换（决定属性/外观/招式）
    const cosIds = Game.ownedCostumeIds(o);
    const activeId = Game.normCostumeId(o.charId, o.activeCostume);
    const costumeHtml = `
      <div class="section-title" style="font-size:14px;">服装 <span class="muted" style="font-weight:400;font-size:11px;">· 切换改变属性/外观/招式</span></div>
      <div class="costume-row">
        ${cosIds.map(cid => {
          const cd = window.GameData.COSTUMES[cid];
          const active = activeId === cid;
          return `<div class="costume-chip ${active ? 'active' : ''} border-${this.rarityClass(cd.rarity)}" data-cos="${cid}">
            <span class="rarity-badge ${this.rarityClass(cd.rarity)}" style="position:static;">${cd.rarity}★</span>
            <span class="cos-icon">${window.GameData.ELEMENTS[cd.element].icon}</span>
            <span class="cos-name">${cd.costumeName}</span>
          </div>`;
        }).join('')}
      </div>`;

    // 背景故事 + 台词
    const loreHtml = c.lore ? `
      <div class="section-title" style="font-size:14px;">背景故事</div>
      <p class="char-lore">${c.lore}</p>` : '';
    const quotesHtml = (c.quotes && c.quotes.length) ? `
      <div class="section-title" style="font-size:14px;">角色台词</div>
      <div class="quote-list">${c.quotes.map(q => `<div class="quote-item">「${q}」</div>`).join('')}</div>` : '';
    // 角色支线（剧情存在且已不强制解锁，随时可看）
    const hasSide = c.side && window.STORY && window.STORY[c.side];
    const sideHtml = hasSide ? `
      <button class="btn secondary" id="cd-side" style="width:100%;margin-top:6px;">📖 观看角色支线剧情</button>` : '';

    // 装备栏
    const gb = Game.gearBonus(o);
    const gbParts = [];
    if (gb.atk) gbParts.push(`攻+${gb.atk}`);
    if (gb.def) gbParts.push(`防+${gb.def}`);
    if (gb.hp) gbParts.push(`血+${gb.hp}`);
    if (gb.crit) gbParts.push(`暴击+${Math.round(gb.crit * 100)}%`);
    const setB = Game.setBonusOf(o);
    const setHtml = setB.name ? `<span class="set-tag">🏅${setB.name}</span>` : '<span class="muted" style="font-size:10px;">三件同稀有度通用装备→套装加成</span>';
    const gearHtml = `
      <div class="section-title" style="font-size:14px;">装备 ${gbParts.length ? `<span class="muted" style="font-weight:400;font-size:11px;">（${gbParts.join('，')}）</span>` : ''} ${setHtml}</div>
      <div class="gear-slots">
        ${this.gearSlotHtml(o, 'weapon', '武器')}
        ${this.gearSlotHtml(o, 'armor', '防具')}
        ${this.gearSlotHtml(o, 'accessory', '饰品')}
        ${this.gearSlotHtml(o, 'ex', '专属')}
      </div>`;

    const m = this.openModal(`
      <div class="detail-head">
        <div class="detail-art border-${this.rarityClass(cosDef.rarity)}" style="background:radial-gradient(circle at 50% 35%, ${cosDef.color}55, var(--panel));">
          ${this.charAvatar(o.charId)}
        </div>
        <div class="detail-title">
          <h2>${c.name} <span class="${this.rarityClass(cosDef.rarity)}" style="font-size:11px;padding:1px 6px;border-radius:5px;">${cosDef.rarity}★</span>${o.plus ? ` <span class="plus-badge">+${o.plus}</span>` : ''}</h2>
          <div class="subt">${cosDef.base ? c.title : cosDef.costumeName + ' · ' + c.title}</div>
          <div class="meta">${window.GameData.ELEMENTS[cosDef.element].icon}${window.GameData.ELEMENTS[cosDef.element].name} · ${window.GameData.CLASSES[c.cls].icon}${window.GameData.CLASSES[c.cls].name} · Lv.${o.level}${inTeam ? ' · <span style="color:var(--accent);">出战中</span>' : ''}</div>
        </div>
      </div>
      <p class="muted" style="line-height:1.6;">${c.desc}</p>
      <div class="stat-grid">
        <div class="stat-item"><span>❤️ 生命</span><span class="sv">${st.maxHp}</span></div>
        <div class="stat-item"><span>⚔️ 攻击</span><span class="sv">${st.atk}</span></div>
        <div class="stat-item"><span>🛡️ 防御</span><span class="sv">${st.def}</span></div>
        <div class="stat-item"><span>⚡ 速度</span><span class="sv">${st.spd}</span></div>
        <div class="stat-item"><span>💥 暴击</span><span class="sv">${Math.round(st.crit*100)}%</span></div>
        <div class="stat-item"><span>✦ 突破</span><span class="sv">+${o.plus || 0}${o.plus ? ` (属性+${o.plus * 8}%)` : ''}</span></div>
      </div>
      <p class="muted" style="margin:-4px 0 8px;font-size:11px;">突破说明：在「招募」中再次获得该佣兵可提升突破等级（最高 +5），每级 +8% 基础属性。</p>
      ${costumeHtml}
      ${gearHtml}
      <div class="section-title" style="font-size:14px;">战斗技能池 <span class="muted" style="font-weight:400;font-size:11px;">· 普攻 + 各服装招式</span></div>
      ${skillsHtml}
      ${loreHtml}
      ${this.affAwakenHtml(o)}
      ${loreHtml ? '' : ''}
      ${quotesHtml}
      ${sideHtml}
      <div class="close-row">
        <button class="btn secondary" id="cd-close">关闭</button>
        <button class="btn secondary" id="cd-autoequip">一键装备</button>
        <button class="btn gold" id="cd-levelup" ${Game.state.gold < lvCost || o.level >= 60 ? 'disabled' : ''}>
          ${o.level >= 60 ? '满级' : `升级 🪙${lvCost}`}
        </button>
      </div>
    `);
    m.querySelector('#cd-close').onclick = () => this.closeModal(m);
    const sideBtn = m.querySelector('#cd-side');
    if (sideBtn) sideBtn.onclick = () => { this.closeModal(m); Story.play(c.side); };
    m.querySelector('#cd-levelup').onclick = () => {
      const r = Game.levelUpWithGold(uid);
      if (!r.ok) { this.toast(r.msg); return; }
      if (window.Sound) Sound.sfx('levelup');
      this.toast(`${c.name} 升至 Lv.${r.level}！`);
      this.updateResources();
      this.closeModal(m);
      this.showCharDetail(uid);
    };
    m.querySelector('#cd-autoequip').onclick = () => {
      const r = Game.autoEquip(uid);
      this.toast(r.count ? `已自动装备 ${r.count} 件（含专属武器自动识别）` : '没有可装备的新装备');
      this.closeModal(m);
      this.showCharDetail(uid);
    };
    const giftBtn = m.querySelector('#cd-gift');
    if (giftBtn) giftBtn.onclick = () => {
      const r = Game.giveGift(uid);
      if (!r.ok) { this.toast(r.msg); return; }
      if (window.Sound) Sound.sfx('heal');
      this.toast(`${c.name} 好感提升！`);
      this.updateResources(); this.closeModal(m); this.showCharDetail(uid);
    };
    const awkBtn = m.querySelector('#cd-awaken');
    if (awkBtn) awkBtn.onclick = () => {
      const r = Game.awakenChar(uid);
      if (!r.ok) { this.toast(r.msg); return; }
      if (window.Sound) Sound.sfx('levelup');
      this.toast(`${c.name} 觉醒至 ${r.awaken} 星！全属性提升`);
      this.updateResources(); this.closeModal(m); this.showCharDetail(uid);
    };
    m.querySelectorAll('[data-slot]').forEach(el =>
      el.addEventListener('click', () => { this.closeModal(m); this.showGearPicker(uid, el.dataset.slot); }));
    m.querySelectorAll('[data-cos]').forEach(el =>
      el.addEventListener('click', () => {
        const r = Game.switchCostume(uid, el.dataset.cos);
        if (!r.ok) { this.toast(r.msg || '无法切换'); return; }
        this.closeModal(m);
        this.showCharDetail(uid);
        if (this.current === 'roster') this.renderRoster();
      }));
  },

  /** 单个装备槽 HTML */
  gearSlotHtml(owned, slot, label) {
    const iid = owned.equip && owned.equip[slot];
    const inst = iid ? Game.getGearInst(iid) : null;
    const tpl = inst ? Game.getGearTpl(inst.tpl) : null;
    // 专属武器红点：背包有该角色未装备的专属武器，且当前未装备它
    let redDot = '';
    if (slot === 'ex') {
      const exId = 'ex_' + owned.charId;
      const equippedThis = tpl && tpl.id === exId;
      if (!equippedThis && Game.hasUnequippedEx(owned.charId)) redDot = '<span class="red-dot"></span>';
    }
    if (tpl) {
      const exTag = tpl.type === 'ex' ? '<span class="ex-tag">专属</span>' : '';
      return `<div class="gear-slot filled border-${this.rarityClass(tpl.rarity)} ${tpl.type === 'ex' ? 'is-ex' : ''}" data-slot="${slot}">
        ${redDot}${exTag}
        <span class="rarity-badge ${this.rarityClass(tpl.rarity)}">${window.GameData.GEAR.RLABEL[tpl.rarity]}</span>
        <div class="gs-icon">${tpl.icon}</div>
        <div class="gs-name">${tpl.name}</div>
      </div>`;
    }
    return `<div class="gear-slot empty" data-slot="${slot}">
      ${redDot}
      <div class="gs-icon">＋</div>
      <div class="gs-name muted">${label}</div>
    </div>`;
  },

  /** 装备一件物品的属性字符串（含强化倍率 + 副词条） */
  gearStatStr(inst) {
    const tpl = Game.getGearTpl(inst.tpl);
    const em = Game.enhanceMult(inst.lvl);
    const lbl = { atk: '攻', def: '防', hp: '血', crit: '暴击', spd: '速' };
    const main = Object.keys(tpl.stats).map(k => {
      const v = tpl.stats[k] * em;
      return k === 'crit' ? `${lbl[k]}+${Math.round(v * 100)}%` : `${lbl[k]}+${Math.round(v)}`;
    }).join(' ');
    const subs = (inst.subs || []).map(s => {
      return s.k === 'crit' ? `${lbl[s.k]}+${Math.round(s.v * 100)}%` : `${lbl[s.k]}+${s.v}`;
    });
    return { main, subs };
  },

  /** 选择装备弹窗（含强化 / 副词条 / 套装） */
  showGearPicker(uid, slot) {
    const o = Game.getOwned(uid);
    const c = window.GameData.CHARACTERS[o.charId];
    const slotName = { weapon: '武器', armor: '防具', accessory: '饰品', ex: '专属武器' }[slot];
    const render = (m) => {
      const list = Game.state.inventory.filter(g => {
        const tpl = Game.getGearTpl(g.tpl);
        if (!tpl) return false;
        if (slot === 'ex') return tpl.type === 'ex' && tpl.owner === o.charId;
        return tpl.type === slot;
      });
      const itemsHtml = list.length ? list.map(g => {
        const tpl = Game.getGearTpl(g.tpl);
        const by = Game.gearEquippedBy(g.iid);
        const equippedHere = o.equip[slot] === g.iid;
        const byName = by && by.uid !== uid ? window.GameData.CHARACTERS[by.charId].name : null;
        const ss = this.gearStatStr(g);
        const exTag = tpl.type === 'ex' ? '<span class="ex-tag inline">专属</span>' : '';
        const lvBadge = (g.lvl || 0) > 0 ? `<span class="gp-lv">+${g.lvl}</span>` : '';
        const subsHtml = ss.subs.length ? `<div class="gp-subs">${ss.subs.map(s => `<span>${s}</span>`).join('')}</div>` : '';
        const maxed = (g.lvl || 0) >= Game.GEAR_MAX_LVL;
        const enhBtn = `<button class="gp-enh" data-enh="${g.iid}">${maxed ? '满级' : '强化 🪙' + Game.enhanceCost(g)}</button>`;
        return `<div class="gear-pick-item border-${this.rarityClass(tpl.rarity)} ${tpl.type === 'ex' ? 'is-ex' : ''}">
          <span class="rarity-badge ${this.rarityClass(tpl.rarity)}" style="position:static;">${window.GameData.GEAR.RLABEL[tpl.rarity]}</span>
          <span class="gp-icon">${tpl.icon}</span>
          <div class="gp-info" data-iid="${g.iid}">
            <div class="gp-name">${tpl.name}${lvBadge}${exTag}</div>
            <div class="gp-stats muted">${ss.main}</div>
            ${subsHtml}
          </div>
          <div class="gp-right">
            ${equippedHere ? '<span class="gp-tag">已装备</span>' : (byName ? `<span class="gp-tag" style="background:var(--panel-2);color:var(--text-dim);">${byName}佩戴</span>` : '')}
            ${enhBtn}
          </div>
        </div>`;
      }).join('') : `<p class="empty-hint">背包里没有可装备的${slotName}。<br>去「锻造坊」打造，或通关关卡掉落获取。</p>`;
      m.querySelector('.gear-pick-list').innerHTML = itemsHtml;
      // 装备（点信息区）
      m.querySelectorAll('.gp-info[data-iid]').forEach(el => el.onclick = () => {
        const r = Game.equipGear(uid, el.dataset.iid);
        if (!r.ok) { this.toast(r.msg); return; }
        this.closeModal(m); this.showCharDetail(uid);
      });
      // 强化（点强化按钮，不触发装备）
      m.querySelectorAll('[data-enh]').forEach(el => el.onclick = (e) => {
        e.stopPropagation();
        const r = Game.enhanceGear(el.dataset.enh);
        if (!r.ok) { this.toast(r.msg); return; }
        if (window.Sound) Sound.sfx('levelup');
        this.toast(`强化至 +${r.lvl}（🪙${r.cost}）`);
        this.updateResources();
        render(m);
      });
    };
    const curIid = o.equip[slot];
    const m = this.openModal(`
      <h2>${c.name} · ${slotName}</h2>
      <p class="muted" style="margin:6px 0 12px;">点装备上阵 · 点「强化」用金币提升属性。副词条随掉落随机。</p>
      <div class="gear-pick-list"></div>
      <div class="close-row">
        ${curIid ? '<button class="btn secondary" id="gp-unequip">卸下</button>' : ''}
        <button class="btn secondary" id="gp-close">返回</button>
      </div>
    `);
    render(m);
    m.querySelector('#gp-close').onclick = () => { this.closeModal(m); this.showCharDetail(uid); };
    const un = m.querySelector('#gp-unequip');
    if (un) un.onclick = () => { Game.unequipGear(uid, slot); this.closeModal(m); this.showCharDetail(uid); };
  },

  /** 锻造坊 */
  showForge() {
    const C = window.GameData.GEAR.CRAFT;
    const invCount = Game.state.inventory.length;
    const m = this.openModal(`
      <h2>🔨 锻造坊</h2>
      <p class="muted" style="margin:6px 0 12px;">打造装备强化你的佣兵。背包现有 ${invCount} 件装备。</p>
      <div class="forge-card">
        <div class="forge-title">锻造通用装备</div>
        <p class="muted">随机产出武器/防具/饰品（R/SR/UR）。</p>
        <button class="btn gold" id="fg-craft" ${Game.state.gold < C.goldCost ? 'disabled' : ''}>锻造 🪙${C.goldCost}</button>
      </div>
      <p class="muted" style="font-size:11px;">※ 专属武器改为「招募」页的专属武器抽奖获取。</p>
      <div class="close-row"><button class="btn secondary" id="fg-close">关闭</button></div>
    `);
    m.querySelector('#fg-close').onclick = () => this.closeModal(m);
    m.querySelector('#fg-craft').onclick = () => {
      const r = Game.craftGear();
      if (!r.ok) { this.toast(r.msg); return; }
      const tpl = Game.getGearTpl(r.tplId);
      this.updateResources();
      this.toast(`锻造出 [${window.GameData.GEAR.RLABEL[tpl.rarity]}] ${tpl.name}！`);
      this.closeModal(m);
      this.showForge();
    };
  },

  // ============================================================
  //  抽卡
  // ============================================================
  renderGacha() {
    const s = Game.state;
    const g = window.GameData.GACHA;
    const eg = window.GameData.GEAR.exGacha;
    const pool = window.GameData.COSTUME_POOL;
    const exPool = window.GameData.GEAR.exPool;
    const tab = this.gachaTab || 'costume';
    // 卡池（左侧 banner 列表）
    const banners = [
      { id: 'costume', name: '服装招募', tag: '常驻 · PICK UP', icon: '🎴', cls: 'b-costume' },
      { id: 'ex', name: '专属武器', tag: '武器军械库', icon: '🗡️', cls: 'b-ex' },
    ];
    const listHtml = banners.map(b => `
      <button class="gacha-banner-card ${b.cls} ${tab === b.id ? 'active' : ''}" data-tab="${b.id}">
        <span class="gbc-icon">${b.icon}</span>
        <span class="gbc-text"><span class="gbc-name">${b.name}</span><span class="gbc-tag">${b.tag}</span></span>
      </button>`).join('');

    let feature;
    if (tab === 'costume') {
      const pity = 90 - s.pity;
      const pickups = (pool[5] || []).slice(0, 8).map(cid =>
        `<span class="gf-pick border-r5">${this.charAvatar(cid)}</span>`).join('');
      feature = `
        <div class="gf-art b-costume">
          <span class="gf-badge">SPECIAL</span>
          <h2>服装招募</h2>
          <div class="gf-sub">抽取服装即获得对应角色 · 同角色可叠多套服装</div>
        </div>
        <div class="gf-meta">
          <div class="gf-rate"><b class="r5">5★ ${(g.rates[5] * 100).toFixed(1)}%</b><span class="muted"> · 4★ ${(g.rates[4] * 100).toFixed(0)}% · 3★ ${(g.rates[3] * 100).toFixed(0)}%</span></div>
          <div class="gf-pity">
            <div class="gf-pity-bar"><div class="gf-pity-fill" style="width:${s.pity / 90 * 100}%;"></div></div>
            <span class="muted">距保底 5★ 还有 <b style="color:var(--gold);">${pity}</b> 抽</span>
          </div>
          ${!s.firstTen ? '<div class="gf-guar">🎁 首次十连必出 5★</div>' : ''}
        </div>
        <div class="gf-pool">
          <div class="gf-pool-label">本期上架 5★</div>
          <div class="gf-pick-row">${pickups}</div>
        </div>
        <div class="gf-pull">
          <button class="btn secondary sm" id="gacha-rates">概率公示</button>
          <button class="btn gold gf-pull-btn" id="pull1"><b>抽 1 次</b><span>💎${g.cost}</span></button>
          <button class="btn gf-pull-btn" id="pull10"><span class="gf-guar-badge">5★保底</span><b>抽 10 次</b><span>💎${g.cost * 10}</span></button>
        </div>`;
    } else {
      const pickups = (exPool[5] || []).slice(0, 8).map(id => `<span class="gf-pick border-r5">${this.exPoolCard ? '🗡️' : '🗡️'}</span>`).join('') || '<span class="muted">暂无上架</span>';
      feature = `
        <div class="gf-art b-ex">
          <span class="gf-badge">WEAPON</span>
          <h2>专属武器招募</h2>
          <div class="gf-sub">专属武器仅此处产出 · 装备对应角色大幅强化</div>
        </div>
        <div class="gf-meta">
          <div class="gf-rate"><b class="r5">UR ${(eg.rates[5] * 100).toFixed(1)}%</b><span class="muted"> · SR ${(eg.rates[4] * 100).toFixed(0)}% · R ${(eg.rates[3] * 100).toFixed(0)}%</span></div>
        </div>
        <div class="gf-pool"><div class="gf-pool-label">传说武器 UR</div><div class="gf-pick-row">${pickups}</div></div>
        <div class="gf-pull">
          <button class="btn secondary sm" id="gacha-rates">概率公示</button>
          <button class="btn gold gf-pull-btn" id="ex-pull1"><b>抽 1 次</b><span>💎${eg.cost}</span></button>
          <button class="btn gf-pull-btn" id="ex-pull10"><b>抽 10 次</b><span>💎${eg.cost * 10}</span></button>
        </div>`;
    }

    this.screenEl.innerHTML = `
      <div class="gacha-page">
        <div class="gacha-list">
          <div class="gacha-list-title">卡池</div>
          ${listHtml}
          <div class="gacha-mileage muted">⭐${s.spark}/${Game.SPARK_COST} · ✨${s.powder}/${Game.POWDER_COST}</div>
        </div>
        <div class="gacha-feature">${feature}</div>
      </div>
      <p class="gacha-disclaimer">※ 概率为公示值；保底与首抽规则见「概率公示」。抽取服装即解锁角色，重复获得提升突破等级。</p>`;

    this.screenEl.querySelectorAll('.gacha-banner-card').forEach(b => {
      b.onclick = () => { this.gachaTab = b.dataset.tab; this.renderGacha(); };
    });
    const rb = this.screenEl.querySelector('#gacha-rates');
    if (rb) rb.onclick = () => this.showGachaRates(tab);
    if (tab === 'costume') {
      document.getElementById('pull1').onclick = () => this.doPull(1);
      document.getElementById('pull10').onclick = () => this.doPull(10);
    } else {
      document.getElementById('ex-pull1').onclick = () => this.doExPull(1);
      document.getElementById('ex-pull10').onclick = () => this.doExPull(10);
    }
  },

  /** 概率公示弹窗 */
  showGachaRates(tab) {
    const g = window.GameData.GACHA, eg = window.GameData.GEAR.exGacha;
    const pool = window.GameData.COSTUME_POOL, exPool = window.GameData.GEAR.exPool;
    let body;
    if (tab === 'ex') {
      body = `<p><b class="r5">UR ${(eg.rates[5] * 100).toFixed(2)}%</b> · <b class="r4">SR ${(eg.rates[4] * 100).toFixed(2)}%</b> · R ${(eg.rates[3] * 100).toFixed(2)}%</p>
        <p class="muted" style="margin-top:8px;">专属武器无保底，按公示概率独立产出。</p>`;
    } else {
      const list5 = (pool[5] || []).map(c => window.GameData.CHARACTERS[c].name).join('、');
      const list4 = (pool[4] || []).map(c => window.GameData.CHARACTERS[c].name).join('、');
      body = `<p><b class="r5">5★ ${(g.rates[5] * 100).toFixed(2)}%</b> · <b class="r4">4★ ${(g.rates[4] * 100).toFixed(2)}%</b> · 3★ ${(g.rates[3] * 100).toFixed(2)}%</p>
        <p class="muted" style="margin-top:8px;">· 累计 90 抽未出 5★，第 90 抽必出 5★（保底后计数重置）<br>· 首次十连必定包含至少 1 个 5★<br>· 每抽 +1 ⭐闪耀之星（${Game.SPARK_COST} 自选 5★ 服装）、+10 ✨希望之粉</p>
        <div class="section-title" style="font-size:13px;margin-top:12px;">5★ 服装池</div><p class="muted" style="font-size:12px;">${list5 || '—'}</p>
        <div class="section-title" style="font-size:13px;margin-top:8px;">4★ 服装池</div><p class="muted" style="font-size:12px;">${list4 || '—'}</p>`;
    }
    const m = this.openModal(`<h2>概率公示</h2><div style="max-height:56vh;overflow-y:auto;font-size:13px;line-height:1.7;">${body}</div>
      <div class="close-row"><button class="btn" id="gr-ok">关闭</button></div>`);
    m.querySelector('#gr-ok').onclick = () => this.closeModal(m);
  },

  exPoolCard(id) {
    const tpl = window.GameData.GEAR.ex[id];
    if (!tpl) return '';
    const rl = window.GameData.GEAR.RLABEL[tpl.rarity];
    const owned = Game.state.inventory.some(g => g.tpl === id);
    return `<div class="roster-card border-${this.rarityClass(tpl.rarity)}" style="${owned?'':'opacity:.6;'}">
      <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, #ff9b3d44, transparent);">
        <span class="rarity-badge ${this.rarityClass(tpl.rarity)}">${rl}</span>
        🗡️
        ${owned ? '<span class="in-team-tag" style="background:var(--gold);color:#241a08;">已有</span>' : ''}
      </div>
      <div class="rc-info"><div class="rc-name" style="font-size:10px;">${tpl.name}</div></div>
    </div>`;
  },

  doExPull(count) {
    const cost = window.GameData.GEAR.exGacha.cost * count;
    if (Game.state.gem < cost) { this.toast('宝石不足'); return; }
    const results = [];
    for (let i = 0; i < count; i++) { const r = Game.gachaEx(); if (!r.ok) break; results.push(r); }
    this.updateResources();
    if (window.Sound) Sound.sfx(results.some(r => { const t = Game.getGearTpl(r.tplId); return t && t.rarity >= 5; }) ? 'pull5' : 'pull');
    const grid = results.map(r => {
      const tpl = Game.getGearTpl(r.tplId);
      const rl = window.GameData.GEAR.RLABEL[tpl.rarity];
      return `<div class="roster-card border-${this.rarityClass(tpl.rarity)}">
        <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, #ff9b3d44, transparent);">
          <span class="rarity-badge ${this.rarityClass(tpl.rarity)}">${rl}</span>
          🗡️${r.dup ? `<span class="in-team-tag" style="background:var(--panel-2);color:var(--text-dim);">💎${r.refund}</span>` : '<span class="in-team-tag" style="background:var(--gold);color:#241a08;">NEW</span>'}
        </div>
        <div class="rc-info"><div class="rc-name" style="font-size:10px;">${tpl.name}</div></div>
      </div>`;
    }).join('');
    const m = this.openModal(`
      <h2 style="text-align:center;">专属武器招募</h2>
      <div class="roster-grid">${grid}</div>
      <div class="close-row"><button class="btn" id="ex-ok">确定</button></div>
    `, { noBackdropClose: true });
    m.querySelector('#ex-ok').onclick = () => { this.closeModal(m); this.renderGacha(); };
  },

  costumePoolCard(cid) {
    const cd = window.GameData.COSTUMES[cid];
    return `<div class="roster-card border-${this.rarityClass(cd.rarity)}">
      <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${cd.color}55, transparent);">
        <span class="rarity-badge ${this.rarityClass(cd.rarity)}">${cd.rarity}★</span>
        ${window.GameData.CLASSES[cd.cls].icon}
        <span class="cls-chip">${window.GameData.ELEMENTS[cd.element].icon}</span>
      </div>
      <div class="rc-info"><div class="rc-name" style="font-size:11px;">${cd.charName}</div>
      <div class="rc-lv">${cd.costumeName}</div></div>
    </div>`;
  },

  doPull(count) {
    const cost = window.GameData.GACHA.cost * count;
    if (Game.state.gem < cost) { this.toast('宝石不足，去冒险赚取吧！'); return; }
    // 首抽十连保底：必出至少 1 个五星
    const firstTenGuarantee = count === 10 && !Game.state.firstTen;
    const results = [];
    let got5 = false;
    for (let i = 0; i < count; i++) {
      // 最后一抽若仍未出五星，则强制五星
      const force = (firstTenGuarantee && i === count - 1 && !got5) ? 5 : undefined;
      const r = Game.gachaPull(force);
      if (!r.ok) break;
      if (r.rarity >= 5) got5 = true;
      results.push(r);
    }
    if (firstTenGuarantee && results.length === count) {
      Game.state.firstTen = true;
      Game.save();
    }
    this.updateResources();
    if (window.Sound) Sound.sfx(results.some(r => r.rarity >= 5) ? 'pull5' : 'pull');
    this.showPullResults(results);
  },

  pullTag(r) {
    if (r.isNew) return '<div class="pull-dup">✦ 新角色 + 新服装！</div>';
    if (r.newCostume) return '<div class="pull-dup" style="color:var(--gem);">✦ 新服装！可在佣兵详情切换</div>';
    if (r.plusUp) return `<div class="pull-dup" style="color:var(--accent-2);">重复服装 → 突破 +${r.plus}（属性 +${r.plus * 8}%）</div>`;
    return `<div class="pull-dup">已满突破 +5 · 返还 💎${r.refund}</div>`;
  },

  showPullResults(results) {
    if (results.length === 1) {
      const r = results[0];
      const cd = window.GameData.COSTUMES[r.costumeId];
      const m = this.openModal(`
        <div class="pull-result">
          <div class="pull-art border-${this.rarityClass(cd.rarity)}" style="background:radial-gradient(circle at 50% 35%, ${cd.color}66, var(--panel));">
            ${window.GameData.CLASSES[cd.cls].icon}
          </div>
          <div class="pull-stars ${this.rarityClass(cd.rarity)}" style="-webkit-text-fill-color:initial;color:var(--${'r'+r.rarity});">${'★'.repeat(r.rarity)}</div>
          <div class="pull-name">${cd.charName} <span class="muted" style="font-size:13px;">· ${cd.costumeName}</span></div>
          <div class="pull-title">${window.GameData.ELEMENTS[cd.element].icon}${window.GameData.ELEMENTS[cd.element].name} · 招式「${window.GameData.SKILLS[cd.signature].name}」</div>
          ${this.pullTag(r)}
        </div>
        <div class="close-row"><button class="btn" id="pr-ok">确定</button></div>
      `, { noBackdropClose: true });
      m.querySelector('#pr-ok').onclick = () => { this.closeModal(m); this.renderGacha(); };
    } else {
      const grid = results.map(r => {
        const cd = window.GameData.COSTUMES[r.costumeId];
        const tag = r.isNew ? 'NEW' : r.newCostume ? '新装' : r.plusUp ? '突破+' + r.plus : '💎' + r.refund;
        const tagBg = r.isNew ? 'var(--gold);color:#241a08' : r.newCostume ? 'var(--gem)' : r.plusUp ? 'var(--accent-2)' : 'var(--panel-2);color:var(--text-dim)';
        return `<div class="roster-card border-${this.rarityClass(r.rarity)}">
          <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${cd.color}44, transparent);">
            <span class="rarity-badge ${this.rarityClass(r.rarity)}">${r.rarity}★</span>
            ${window.GameData.CLASSES[cd.cls].icon}
            <span class="in-team-tag" style="background:${tagBg};">${tag}</span>
          </div>
          <div class="rc-info"><div class="rc-name" style="font-size:11px;">${cd.charName}·${cd.costumeName}</div></div>
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

  // ============================================================
  //  福利：签到 / 任务 / 保底兑换 / 商店
  // ============================================================
  renderWelfare() {
    Game.ensureDaily();
    const s = Game.state;
    // 签到
    const cyc = s.daily.streak % 7;
    const claimedCount = Game.canCheckIn() ? cyc : (cyc === 0 ? 7 : cyc);
    const checkRow = Game.CHECKIN.map((r, i) => {
      const claimed = i < claimedCount;
      const isToday = Game.canCheckIn() && i === cyc;
      const label = r.gold ? `🪙${r.gold}` : r.gem ? `💎${r.gem}` : r.powder ? `✨${r.powder}` : r.gear ? '🎁装备' : '';
      const extra = r.powder && r.gem ? `+✨${r.powder}` : '';
      return `<div class="checkin-cell ${claimed ? 'claimed' : ''} ${isToday ? 'today' : ''}">
        <div class="ci-day">第${i + 1}天</div>
        <div class="ci-reward">${label}${extra}</div>
        ${claimed ? '<div class="ci-tick">✓</div>' : ''}
      </div>`;
    }).join('');
    // 任务
    const questRow = Game.QUESTS.map(q => {
      const prog = Math.min(q.target, s.quests.progress[q.key] || 0);
      const claimed = s.quests.claimed[q.id];
      const done = prog >= q.target;
      const rw = q.reward.gem ? `💎${q.reward.gem}` : q.reward.gold ? `🪙${q.reward.gold}` : '';
      return `<div class="quest-item">
        <div class="quest-info">
          <div class="quest-name">${q.name} <span class="muted">(${prog}/${q.target})</span></div>
          <div class="quest-bar"><div class="quest-fill" style="width:${prog / q.target * 100}%"></div></div>
        </div>
        <div class="quest-reward">${rw}</div>
        <button class="btn ${done && !claimed ? 'gold' : 'secondary'} quest-claim" data-quest="${q.id}" ${done && !claimed ? '' : 'disabled'}>${claimed ? '已领' : '领取'}</button>
      </div>`;
    }).join('');
    // 商店
    const shopRow = s.shop.slots.map((slot, i) => {
      const tpl = Game.getGearTpl(slot.tpl);
      const bought = s.shop.bought[i];
      return `<div class="shop-item border-${this.rarityClass(tpl.rarity)} ${bought ? 'sold' : ''}">
        <span class="rarity-badge ${this.rarityClass(tpl.rarity)}" style="position:static;">${window.GameData.GEAR.RLABEL[tpl.rarity]}</span>
        <div class="shop-icon">${tpl.icon}</div>
        <div class="shop-name">${tpl.name}</div>
        <button class="btn ${bought ? 'secondary' : 'gold'} shop-buy" data-shop="${i}" ${bought ? 'disabled' : ''}>${bought ? '已售' : '🪙' + slot.price}</button>
      </div>`;
    }).join('');

    this.screenEl.innerHTML = `
      <div class="welfare-cur">
        <div class="wc-item">✨ 闪耀之星 <b>${s.spark}</b><span class="muted"> /${Game.SPARK_COST}</span></div>
        <div class="wc-item">🌸 希望之粉 <b>${s.powder}</b><span class="muted"> /${Game.POWDER_COST}</span></div>
      </div>

      <button class="ach-entry" id="open-ach">
        <span class="ach-entry-icon">🏆</span>
        <span class="ach-entry-text"><b>成就殿堂</b><span class="muted">达成里程碑领取宝石奖励</span></span>
        ${Game.achClaimable() ? `<span class="ach-entry-badge">${Game.achClaimable()} 可领</span>` : '<span class="ach-entry-go">›</span>'}
      </button>

      <button class="ach-entry" id="open-save" style="background:linear-gradient(135deg,rgba(108,198,255,.14),var(--panel));border-color:rgba(108,198,255,.3);">
        <span class="ach-entry-icon">💾</span>
        <span class="ach-entry-text"><b>存档管理</b><span class="muted">导出/导入存档码，换设备或清缓存前务必备份</span></span>
        <span class="ach-entry-go">›</span>
      </button>

      <div class="section-title">每日签到 ${Game.canCheckIn() ? '' : '<span class="muted" style="font-weight:400;font-size:11px;">· 今日已签</span>'}</div>
      <div class="checkin-grid">${checkRow}</div>
      <button class="btn ${Game.canCheckIn() ? 'gold' : 'secondary'}" id="do-checkin" ${Game.canCheckIn() ? '' : 'disabled'} style="width:100%;margin-bottom:16px;">${Game.canCheckIn() ? '签到领取' : '明日再来'}</button>

      <div class="section-title">每日任务</div>
      ${questRow}

      <div class="section-title" style="margin-top:16px;">保底兑换</div>
      <div class="pity-card">
        <div><div class="pity-name">🌸 祈愿之箱</div><div class="muted">消耗 ${Game.POWDER_COST} 希望之粉，必出一套 5★ 服装</div></div>
        <button class="btn ${s.powder >= Game.POWDER_COST ? 'gold' : 'secondary'}" id="do-powder" ${s.powder >= Game.POWDER_COST ? '' : 'disabled'}>兑换</button>
      </div>
      <div class="pity-card">
        <div><div class="pity-name">✨ 自选服装</div><div class="muted">消耗 ${Game.SPARK_COST} 闪耀之星，任选一套服装</div></div>
        <button class="btn ${s.spark >= Game.SPARK_COST ? '' : 'secondary'}" id="do-spark" ${s.spark >= Game.SPARK_COST ? '' : 'disabled'}>自选</button>
      </div>

      <div class="section-title" style="margin-top:16px;">每日商店 <span class="muted" style="font-weight:400;font-size:11px;">· 每日刷新</span></div>
      <div class="shop-grid">${shopRow}</div>
    `;

    const ci = this.screenEl.querySelector('#do-checkin');
    if (ci) ci.onclick = () => {
      const r = Game.checkIn();
      if (!r.ok) { this.toast(r.msg); return; }
      const rw = r.reward;
      const txt = [rw.gold && `🪙${rw.gold}`, rw.gem && `💎${rw.gem}`, rw.powder && `✨${rw.powder}`, rw.gear && '🎁装备'].filter(Boolean).join('，');
      this.toast(`签到成功（第${r.day}天）：${txt}`);
      this.updateResources(); this.renderWelfare();
    };
    this.screenEl.querySelectorAll('.quest-claim').forEach(b => b.onclick = () => {
      const r = Game.claimQuest(b.dataset.quest);
      if (!r.ok) { this.toast(r.msg || '不可领取'); return; }
      this.toast('任务奖励已领取'); this.updateResources(); this.renderWelfare();
    });
    this.screenEl.querySelectorAll('.shop-buy').forEach(b => b.onclick = () => {
      const r = Game.buyShopItem(Number(b.dataset.shop));
      if (!r.ok) { this.toast(r.msg); return; }
      const tpl = Game.getGearTpl(r.tpl);
      this.toast(`购买成功：${tpl.name}`); this.updateResources(); this.renderWelfare();
    });
    const dp = this.screenEl.querySelector('#do-powder');
    if (dp) dp.onclick = () => {
      const r = Game.powderBox();
      if (!r.ok) { this.toast(r.msg); return; }
      this.updateResources();
      this.showPullResults([{ ...r.result }]);
    };
    const ds = this.screenEl.querySelector('#do-spark');
    if (ds) ds.onclick = () => this.showSparkPicker();
    const oa = this.screenEl.querySelector('#open-ach');
    if (oa) oa.onclick = () => this.showAchievements();
    const os = this.screenEl.querySelector('#open-save');
    if (os) os.onclick = () => this.showSaveManager();
  },

  // ============================================================
  //  资源副本（farm）
  // ============================================================
  staminaBarHtml() {
    Game.syncStamina();
    const st = Game.state.stamina, mx = Game.STAMINA_MAX;
    let eta = '';
    if (st < mx) { const ms = Game.staminaEtaMs(); const min = Math.ceil(ms / 60000); eta = `· 下一点 ${min} 分钟`; }
    else eta = '· 已满';
    return `<div class="stam-bar">
      <span class="stam-ico">⚡</span>
      <div class="stam-track"><div class="stam-fill" style="width:${Math.min(100, st / mx * 100)}%;"></div></div>
      <span class="stam-num">${st}/${mx}</span>
      <span class="muted" style="font-size:11px;">${eta}</span>
      <button class="btn secondary sm" id="stam-buy">💎50 +60</button>
    </div>`;
  },
  renderDungeon() {
    Game.syncStamina();
    const cards = Game.FARM.map(d => {
      const open = Game.farmUnlocked(d);
      const r = d.reward;
      const rew = [r.gold ? `🪙${r.gold}` : '', r.exp ? `📘${r.exp}` : '', r.gearScale ? '⚒️装备' : ''].filter(Boolean).join(' · ');
      return `<div class="farm-card ${open ? '' : 'locked'}">
        <div class="farm-ico">${d.icon}</div>
        <div class="farm-main">
          <div class="farm-name">${d.name} ${open ? '' : `<span class="muted">· 通关${d.unlock}关解锁</span>`}</div>
          <div class="farm-sub muted">${d.desc}</div>
          <div class="farm-rew">${rew}</div>
        </div>
        <div class="farm-actions">
          <div class="farm-cost">⚡${d.stam}</div>
          ${open ? `<button class="btn sm" data-run="${d.id}" data-x="1">挑战</button>
                    <button class="btn secondary sm" data-run="${d.id}" data-x="5">扫荡×5</button>` : '<button class="btn sm" disabled>🔒</button>'}
        </div>
      </div>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="section-title">资源副本</div>
      ${this.staminaBarHtml()}
      <p class="muted" style="margin:6px 0 12px;">消耗体力快速获取金币 / 经验 / 装备，可一键扫荡多次。</p>
      <div class="farm-list">${cards}</div>`;
    const buy = this.screenEl.querySelector('#stam-buy');
    if (buy) buy.onclick = () => { const r = Game.buyStamina(); this.toast(r.ok ? '体力 +60' : r.msg); this.updateResources(); this.renderDungeon(); };
    this.screenEl.querySelectorAll('[data-run]').forEach(b => b.onclick = () => {
      const r = Game.runFarm(b.dataset.run, parseInt(b.dataset.x, 10));
      if (!r.ok) { this.toast(r.msg); return; }
      const parts = [];
      if (r.tot.gold) parts.push(`🪙${r.tot.gold}`);
      if (r.tot.exp) parts.push(`📘经验${r.tot.exp}`);
      if (r.tot.gears.length) parts.push(`⚒️装备×${r.tot.gears.length}`);
      this.toast(`获得 ${parts.join(' · ') || '奖励'}（-⚡${r.cost}）`);
      if (window.Sound) Sound.sfx('levelup');
      this.updateResources(); this.renderDungeon();
    });
  },

  // ============================================================
  //  远征派遣（dispatch）—— 离线挂机
  // ============================================================
  renderDispatch() {
    const slots = Game.DISPATCH_SLOTS;
    let html = `<div class="section-title">远征派遣</div>
      <p class="muted" style="margin:0 0 12px;">派遣闲置佣兵外出，按真实时间产出资源（可离线）。参与人数与稀有度越高奖励越多。</p>
      <div class="disp-list">`;
    for (let i = 0; i < slots; i++) {
      const s = Game.state.dispatch.slots[i];
      const unlocked = Game.dispatchSlotUnlocked(i);
      if (!unlocked) {
        html += `<div class="disp-slot locked"><div class="disp-empty">🔒 第 ${i + 1} 派遣位 · 通关 ${i * 2} 关解锁</div></div>`;
      } else if (!s) {
        html += `<div class="disp-slot"><div class="disp-empty">＋ 空闲派遣位</div>
          <button class="btn sm" data-disp-new="${i}">派遣出发</button></div>`;
      } else {
        const tier = Game.DISPATCH_TIERS.find(t => t.id === s.tierId);
        const done = Game.dispatchDone(i);
        const names = s.charUids.map(u => { const o = Game.getOwned(u); return o ? window.GameData.CHARACTERS[o.charId].name : '?'; }).join('、');
        html += `<div class="disp-slot ${done ? 'done' : 'running'}">
          <div class="disp-info">
            <div class="disp-name">${tier.icon} ${tier.name} <span class="muted">×${s.mult.toFixed(2)}</span></div>
            <div class="disp-team muted">${names}</div>
            <div class="disp-timer" data-end="${s.endTs}">${done ? '✅ 已完成' : '⏳ ' + this.fmtRemain(s.endTs - Date.now())}</div>
          </div>
          ${done ? `<button class="btn sm" data-disp-claim="${i}">领取</button>`
                 : `<button class="btn secondary sm" data-disp-cancel="${i}">召回</button>`}
        </div>`;
      }
    }
    html += `</div>`;
    this.screenEl.innerHTML = html;
    this.screenEl.querySelectorAll('[data-disp-new]').forEach(b => b.onclick = () => this.showDispatchSetup(parseInt(b.dataset.dispNew, 10)));
    this.screenEl.querySelectorAll('[data-disp-claim]').forEach(b => b.onclick = () => {
      const r = Game.claimDispatch(parseInt(b.dataset.dispClaim, 10));
      if (!r.ok) { this.toast(r.msg); return; }
      const p = [];
      if (r.got.gold) p.push(`🪙${r.got.gold}`); if (r.got.gem) p.push(`💎${r.got.gem}`);
      if (r.got.stone) p.push(`🔮${r.got.stone}`);
      if (r.got.exp) p.push(`📘经验${r.got.exp}`); if (r.got.gears.length) p.push(`⚒️装备×${r.got.gears.length}`);
      this.toast(`远征归来：${p.join(' · ')}`); if (window.Sound) Sound.sfx('levelup');
      this.updateResources(); this.renderDispatch();
    });
    this.screenEl.querySelectorAll('[data-disp-cancel]').forEach(b => b.onclick = () => {
      Game.cancelDispatch(parseInt(b.dataset.dispCancel, 10)); this.toast('已召回佣兵'); this.renderDispatch();
    });
    // 定时刷新倒计时
    clearInterval(this._dispTimer);
    this._dispTimer = setInterval(() => {
      if (Main.current !== 'dispatch') { clearInterval(this._dispTimer); return; }
      this.screenEl.querySelectorAll('.disp-timer[data-end]').forEach(el => {
        const left = parseInt(el.dataset.end, 10) - Date.now();
        if (left <= 0) { this.renderDispatch(); } else { el.textContent = '⏳ ' + this.fmtRemain(left); }
      });
    }, 1000);
  },
  fmtRemain(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  },
  showDispatchSetup(slotIdx) {
    let picked = [];
    const busy = new Set();
    Game.state.dispatch.slots.forEach(s => s && s.charUids.forEach(u => busy.add(u)));
    let tierId = Game.DISPATCH_TIERS[0].id;
    const render = (m) => {
      const tiers = Game.DISPATCH_TIERS.map(t => {
        const r = t.reward;
        const rew = [r.gold ? `🪙${r.gold}` : '', r.gem ? `💎${r.gem}` : '', r.exp ? `📘${r.exp}` : '', r.gearScale ? '⚒️' : ''].filter(Boolean).join(' ');
        return `<button class="disp-tier ${t.id === tierId ? 'sel' : ''}" data-tier="${t.id}">
          <div>${t.icon} ${t.name}</div><div class="muted" style="font-size:11px;">${t.hours}小时 · ${rew}</div></button>`;
      }).join('');
      const avail = Game.state.roster.filter(o => !busy.has(o.uid));
      const grid = avail.map(o => {
        const c = window.GameData.CHARACTERS[o.charId];
        const on = picked.includes(o.uid);
        return `<div class="roster-card border-${this.rarityClass(c.rarity)} ${on ? 'sel-pick' : ''}" data-pick="${o.uid}">
          <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${Game.activeColor(o)}44, transparent);">
            <span class="rarity-badge ${this.rarityClass(c.rarity)}">${c.rarity}★</span>${this.charAvatar(o.charId)}</div>
          <div class="rc-info"><div class="rc-name">${c.name}</div><div class="rc-lv">Lv.${o.level}</div></div></div>`;
      }).join('') || '<div class="muted" style="grid-column:1/-1;padding:12px;">没有空闲佣兵</div>';
      const mult = Game.dispatchMult(picked);
      m.querySelector('.ds-tiers').innerHTML = tiers;
      m.querySelector('.ds-grid').innerHTML = grid;
      m.querySelector('.ds-mult').textContent = `已选 ${picked.length} 人 · 奖励 ×${mult.toFixed(2)}`;
      m.querySelectorAll('[data-tier]').forEach(b => b.onclick = () => { tierId = b.dataset.tier; render(m); });
      m.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => {
        const u = el.dataset.pick;
        if (picked.includes(u)) picked = picked.filter(x => x !== u);
        else if (picked.length < 3) picked.push(u);
        else { this.toast('最多派遣 3 人'); return; }
        render(m);
      });
    };
    const m = this.openModal(`
      <h2>派遣出发</h2>
      <div class="ds-tiers disp-tiers"></div>
      <p class="muted" style="margin:10px 0 6px;">选择佣兵（最多 3 人，<span class="ds-mult"></span>）</p>
      <div class="ds-grid roster-grid"></div>
      <div class="close-row"><button class="btn secondary" id="ds-cancel">取消</button><button class="btn" id="ds-go">出发</button></div>`);
    render(m);
    m.querySelector('#ds-cancel').onclick = () => this.closeModal(m);
    m.querySelector('#ds-go').onclick = () => {
      const r = Game.startDispatch(slotIdx, tierId, picked);
      if (!r.ok) { this.toast(r.msg); return; }
      this.closeModal(m); this.toast('佣兵已派遣出发'); this.renderDispatch();
    };
  },

  // ============================================================
  //  竞技场（模拟 PvP）
  // ============================================================
  renderArena() {
    Game.ensureArena();
    const a = Game.state.arena;
    const rank = Game.arenaRank(a.points);
    const myPow = Game.playerPower();
    const teamMini = (team) => team.slice(0, 4).map(e => {
      const c = window.GameData.CHARACTERS[e.char];
      return `<span class="ar-mini border-${this.rarityClass(c.rarity)}">${this.charAvatar(e.char)}</span>`;
    }).join('');
    const oppCards = a.opps.map(o => {
      const adv = o.power > myPow * 1.1 ? '<span style="color:var(--danger);">强</span>'
        : o.power < myPow * 0.9 ? '<span style="color:var(--hp);">弱</span>' : '<span class="muted">均</span>';
      return `<div class="ar-card ${o.beaten ? 'beaten' : ''}">
        <div class="ar-team">${teamMini(o.team)}</div>
        <div class="ar-mid">
          <div class="ar-name">${o.name}</div>
          <div class="ar-meta muted">积分 ${o.points} · 战力 ${o.power} ${adv}</div>
        </div>
        ${o.beaten ? '<div class="ar-done muted">已击败</div>'
          : `<button class="btn sm" data-fight="${o.id}">挑战</button>`}
      </div>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="section-title">竞技场</div>
      <div class="ar-head">
        <div class="ar-rank">${rank.icon} <b>${rank.name}</b><div class="ar-pts">${a.points} 分</div></div>
        <div class="ar-stat">
          <div>我的战力 <b style="color:var(--accent);">${myPow}</b></div>
          <div>今日挑战 <b>${a.attempts}/${Game.ARENA_MAX_ATTEMPTS}</b></div>
        </div>
        <button class="btn secondary sm" id="ar-refresh">换一批</button>
      </div>
      <p class="muted" style="margin:8px 0 12px;">挑战其他佣兵团的防守队，胜利涨分、获得金币宝石。每日 ${Game.ARENA_MAX_ATTEMPTS} 次挑战，跨日重置。</p>
      <div class="ar-list">${oppCards}</div>`;
    this.screenEl.querySelector('#ar-refresh').onclick = () => { Game.arenaRefresh(); this.renderArena(); };
    this.screenEl.querySelectorAll('[data-fight]').forEach(b => b.onclick = () => this.startArenaFight(b.dataset.fight));
  },
  startArenaFight(oppId) {
    if (!Game.state.team.length) { this.toast('请先编队'); return; }
    const opp = Game.state.arena.opps.find(o => o.id === oppId);
    if (!opp || opp.beaten) return;
    const att = Game.arenaStartAttempt();
    if (!att.ok) { this.toast(att.msg); return; }
    const stage = {
      id: 'arena_' + oppId, name: '竞技场 · ' + opp.name, arena: true, oppId,
      enemies: opp.team.map(e => ({ char: e.char, level: e.level, plus: e.plus || 0 })),
      reward: { gold: 0, gem: 0, exp: 0 },
    };
    BattleUI.start(stage, () => { if (Main.current === 'arena') this.renderArena(); });
  },

  // ============================================================
  //  限时活动（活动本 + 活动商店）
  // ============================================================
  renderEvent() {
    Game.ensureEvent();
    const ev = Game.EVENT;
    const coin = Game.state.event.coin;
    const stageCards = ev.stages.map(s => {
      const left = Game.eventRunsLeft(s);
      return `<div class="farm-card">
        <div class="farm-ico">${s.icon}</div>
        <div class="farm-main">
          <div class="farm-name">${s.name}</div>
          <div class="farm-rew">🎟️${s.coin} · 🪙${s.gold} · 📘${s.exp}</div>
          <div class="farm-sub muted">今日剩余 ${left}/${s.daily} 次</div>
        </div>
        <div class="farm-actions">
          ${left > 0 ? `<button class="btn sm" data-ev="${s.id}">挑战</button>` : '<button class="btn sm" disabled>已尽</button>'}
        </div>
      </div>`;
    }).join('');
    const shopCards = ev.shop.map(it => {
      const left = Game.state.event.stock[it.id] != null ? Game.state.event.stock[it.id] : it.stock;
      const can = left > 0 && coin >= it.cost;
      return `<div class="ev-shop-item ${left <= 0 ? 'sold' : ''}">
        <div class="ev-si-ico">${it.icon}</div>
        <div class="ev-si-main"><div class="ev-si-name">${it.name}</div><div class="muted" style="font-size:11px;">剩余 ${left}/${it.stock}</div></div>
        <button class="btn sm" data-buy="${it.id}" ${can ? '' : 'disabled'}>🎟️${it.cost}</button>
      </div>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="event-banner">
        <div class="eb-title">🎏 ${ev.name}</div>
        <div class="eb-desc">${ev.desc}</div>
        <div class="eb-coin">🎟️ 活动币：<b>${coin}</b></div>
      </div>
      <div class="section-title" style="font-size:14px;">活动关卡</div>
      <div class="farm-list">${stageCards}</div>
      <div class="section-title" style="font-size:14px;margin-top:14px;">活动商店</div>
      <div class="ev-shop">${shopCards}</div>`;
    this.screenEl.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => this.startEventFight(b.dataset.ev));
    this.screenEl.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const r = Game.eventBuy(b.dataset.buy);
      if (!r.ok) { this.toast(r.msg); return; }
      if (window.Sound) Sound.sfx('levelup');
      this.toast('兑换成功'); this.updateResources(); this.renderEvent();
    });
  },
  startEventFight(id) {
    if (!Game.state.team.length) { this.toast('请先编队'); return; }
    const s = Game.EVENT.stages.find(x => x.id === id);
    if (!s) return;
    const r = Game.eventStartRun(id);
    if (!r.ok) { this.toast(r.msg); return; }
    const stage = {
      id: 'event_' + id, name: s.name, event: true, eventId: id,
      enemies: s.enemies.map(e => ({ ...e })),
      reward: { gold: 0, gem: 0, exp: 0 }, isBoss: id === 'ev3',
    };
    BattleUI.start(stage, () => { if (Main.current === 'event') this.renderEvent(); });
  },

  // ============================================================
  //  背包（装备一览）
  // ============================================================
  renderInventory() {
    const inv = Game.state.inventory;
    if (!this._invSort) this._invSort = 'rarity';
    const equippedSet = new Set();
    Game.state.roster.forEach(o => Object.values(o.equip || {}).forEach(iid => iid && equippedSet.add(iid)));
    const items = inv.slice().sort((a, b) => {
      const ta = Game.getGearTpl(a.tpl), tb = Game.getGearTpl(b.tpl);
      if (this._invSort === 'rarity') return (tb.rarity - ta.rarity) || (b.lvl - a.lvl);
      return (b.lvl || 0) - (a.lvl || 0);
    });
    const cards = items.length ? items.map(g => {
      const tpl = Game.getGearTpl(g.tpl);
      const eq = equippedSet.has(g.iid);
      return `<div class="inv-item border-${this.rarityClass(tpl.rarity)}">
        <div class="inv-ico">${tpl.icon}</div>
        <div class="inv-main"><div class="inv-name">${tpl.name}${g.lvl ? ` +${g.lvl}` : ''}</div>
          <div class="muted" style="font-size:11px;">${window.GameData.GEAR.RLABEL[tpl.rarity]} · ${({ weapon: '武器', armor: '防具', accessory: '饰品', ex: '专属' }[tpl.type] || '')}${eq ? ' · <span style="color:var(--accent);">已装备</span>' : ''}</div></div>
      </div>`;
    }).join('') : '<div class="muted" style="padding:24px;text-align:center;grid-column:1/-1;">背包空空如也，去锻造或副本获取装备吧。</div>';
    this.screenEl.innerHTML = `
      <div class="section-title">背包 <span class="muted" style="font-weight:400;font-size:12px;">· 共 ${inv.length} 件装备</span></div>
      <div class="inv-tools">
        <button class="btn secondary sm" id="inv-sort">排序：${this._invSort === 'rarity' ? '稀有度' : '强化等级'}</button>
        <button class="btn secondary sm" id="inv-forge">🔨 前往锻造</button>
      </div>
      <div class="inv-grid">${cards}</div>`;
    this.screenEl.querySelector('#inv-sort').onclick = () => { this._invSort = this._invSort === 'rarity' ? 'lvl' : 'rarity'; this.renderInventory(); };
    this.screenEl.querySelector('#inv-forge').onclick = () => this.showForge();
  },

  // ============================================================
  //  图鉴（角色档案：已拥有 + 未解锁）
  // ============================================================
  renderCodex() {
    const all = Object.keys(window.GameData.CHARACTERS);
    const ownedIds = new Set(Game.state.roster.map(o => o.charId));
    const cards = all.sort((a, b) => window.GameData.CHARACTERS[b].rarity - window.GameData.CHARACTERS[a].rarity).map(id => {
      const c = window.GameData.CHARACTERS[id];
      const owned = ownedIds.has(id);
      const el = window.GameData.ELEMENTS[c.element], cl = window.GameData.CLASSES[c.cls];
      if (!owned) return `<div class="codex-card locked"><div class="cx-art">❔</div><div class="cx-name muted">？？？</div><div class="cx-meta muted">${c.rarity}★</div></div>`;
      const o = Game.state.roster.find(x => x.charId === id);
      return `<div class="codex-card border-${this.rarityClass(c.rarity)}" data-uid="${o.uid}">
        <div class="cx-art" style="background:radial-gradient(circle at 50% 35%, ${c.color}44, transparent);">${this.charAvatar(id)}</div>
        <div class="cx-name">${c.name}</div>
        <div class="cx-meta">${el.icon}${cl.icon} ${c.rarity}★ Lv.${o.level}</div>
      </div>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="section-title">图鉴 <span class="muted" style="font-weight:400;font-size:12px;">· 已收集 ${ownedIds.size}/${all.length}</span></div>
      <div class="codex-grid">${cards}</div>`;
    this.screenEl.querySelectorAll('[data-uid]').forEach(c => c.onclick = () => this.showCharDetail(c.dataset.uid));
  },

  // ============================================================
  //  商店（每日装备商店 + 保底兑换）
  // ============================================================
  renderShop() {
    Game.ensureDaily();
    const s = Game.state;
    const slots = s.shop.slots.map((slot, i) => {
      const tpl = Game.getGearTpl(slot.tpl);
      const sold = s.shop.bought[i];
      return `<div class="shop-card border-${this.rarityClass(tpl.rarity)} ${sold ? 'sold' : ''}">
        <div class="shop-ico">${tpl.icon}</div>
        <div class="shop-name">${tpl.name}</div>
        <div class="muted" style="font-size:11px;">${window.GameData.GEAR.RLABEL[tpl.rarity]}</div>
        <button class="btn sm ${sold ? 'secondary' : 'gold'}" data-buy="${i}" ${sold || s.gold < slot.price ? 'disabled' : ''}>${sold ? '已售出' : `🪙${slot.price}`}</button>
      </div>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="section-title">商店 <span class="muted" style="font-weight:400;font-size:12px;">· 每日刷新</span></div>
      <div class="shop-grid">${slots}</div>
      <div class="section-title" style="margin-top:16px;">保底兑换</div>
      <div class="exchange-card">
        <div><b>✨ 希望之粉</b> <span class="muted">${s.powder}/${Game.POWDER_COST}</span><div class="muted" style="font-size:11px;">兑换必出 5★ 招募</div></div>
        <button class="btn sm ${s.powder >= Game.POWDER_COST ? 'gold' : 'secondary'}" id="sh-powder" ${s.powder >= Game.POWDER_COST ? '' : 'disabled'}>兑换</button>
      </div>
      <div class="exchange-card">
        <div><b>⭐ 闪耀之星</b> <span class="muted">${s.spark}/${Game.SPARK_COST}</span><div class="muted" style="font-size:11px;">自选一套 5★ 服装</div></div>
        <button class="btn sm ${s.spark >= Game.SPARK_COST ? '' : 'secondary'}" id="sh-spark" ${s.spark >= Game.SPARK_COST ? '' : 'disabled'}>自选</button>
      </div>`;
    this.screenEl.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const r = Game.buyShopItem(parseInt(b.dataset.buy, 10));
      if (!r.ok) { this.toast(r.msg); return; }
      const tpl = Game.getGearTpl(r.tpl);
      this.toast(`购买成功：${tpl.name}`); this.updateResources(); this.renderShop();
    });
    const pw = this.screenEl.querySelector('#sh-powder');
    if (pw) pw.onclick = () => { const r = Game.powderBox(); if (!r.ok) { this.toast(r.msg); return; } this.closeModal && 0; this.toast('已兑换必出 5★ 招募券，请在招募使用'); this.updateResources(); this.renderShop(); };
    const sp = this.screenEl.querySelector('#sh-spark');
    if (sp) sp.onclick = () => this.showSparkPicker();
  },

  // ============================================================
  //  邮件 / 设置 / 资料 / 公告（弹窗）
  // ============================================================
  showMailbox() {
    Game.ensureMail();
    const render = (m) => {
      const list = Game.state.mail.map(ml => {
        const rw = ml.reward && Object.keys(ml.reward).length
          ? Object.entries(ml.reward).map(([k, v]) => ({ gold: '🪙', gem: '💎', stone: '🔮', powder: '✨', spark: '⭐' }[k] + v)).join(' ') : '';
        return `<div class="mail-item ${ml.claimed ? 'claimed' : ''}">
          <div class="mail-main"><div class="mail-title">${ml.title}</div><div class="mail-body muted">${ml.body}</div>${rw ? `<div class="mail-rew">${rw}</div>` : ''}</div>
          ${rw ? (ml.claimed ? '<span class="muted" style="font-size:12px;">已领</span>' : `<button class="btn sm" data-claim="${ml.id}">领取</button>`) : ''}
        </div>`;
      }).join('');
      m.querySelector('.mb-list').innerHTML = list;
      m.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
        Game.claimMail(b.dataset.claim); this.updateResources(); render(m);
      });
    };
    const m = this.openModal(`
      <h2>📧 邮件</h2>
      <div class="mb-list" style="max-height:50vh;overflow-y:auto;margin:8px 0;"></div>
      <div class="close-row"><button class="btn secondary" id="mb-close">关闭</button><button class="btn" id="mb-all">一键领取</button></div>`);
    render(m);
    m.querySelector('#mb-close').onclick = () => this.closeModal(m);
    m.querySelector('#mb-all').onclick = () => {
      const r = Game.claimAllMail();
      if (!r.n) { this.toast('没有可领取的邮件'); return; }
      this.toast(`已领取 ${r.n} 封邮件奖励`); this.updateResources(); render(m);
    };
  },
  showProfile() {
    const s = Game.state;
    const costumes = s.roster.reduce((n, o) => n + (o.costumes ? o.costumes.length : 0), 0);
    this.openModal(`
      <div class="detail-head">
        <div class="detail-art" style="background:radial-gradient(circle at 50% 35%, #b06bff55, var(--panel));font-size:40px;display:grid;place-items:center;">🎖️</div>
        <div class="detail-title"><h2>指挥官</h2><div class="subt">账号等级 Lv.${Game.accountLevel()}</div><div class="meta">出战战力 ⚔ ${Game.playerPower()}</div></div>
      </div>
      <div class="stat-grid">
        <div class="stat-item"><span>👥 佣兵</span><span class="sv">${s.roster.length}/${Object.keys(window.GameData.CHARACTERS).length}</span></div>
        <div class="stat-item"><span>👗 服装</span><span class="sv">${costumes}</span></div>
        <div class="stat-item"><span>🗺️ 通关</span><span class="sv">${s.cleared.length}/${window.GameData.STAGES.length}</span></div>
        <div class="stat-item"><span>🏆 竞技</span><span class="sv">${Game.arenaRank((s.arena && s.arena.points) || 1000).name}</span></div>
        <div class="stat-item"><span>🎴 招募</span><span class="sv">${s.stats.pulls}</span></div>
        <div class="stat-item"><span>⚔️ 胜场</span><span class="sv">${s.stats.wins}</span></div>
      </div>
      <div class="close-row"><button class="btn" id="pf-ok">关闭</button></div>`).querySelector('#pf-ok').onclick = function () { UI.closeModal(this.closest('.modal-overlay') || this.closest('.modal')); };
  },
  showAnnounce() {
    this.openModal(`
      <h2>📢 公告</h2>
      <div style="max-height:54vh;overflow-y:auto;font-size:13px;line-height:1.7;">
        <p><b>【新版本】单机玩法大更新</b></p>
        <p class="muted">新增竞技场、资源副本、远征派遣、限时活动，以及好感、觉醒系统。横屏游玩体验最佳。</p>
        <p style="margin-top:10px;"><b>【玩法指引】</b></p>
        <p class="muted">· 副本消耗体力换取金币/经验/装备，可扫荡<br>· 远征按真实时间挂机产出，可离线<br>· 竞技场每日 5 次挑战 AI 防守队涨分<br>· 弱点元素命中 BOSS 可触发破防<br>· 角色详情可赠礼(好感)与觉醒(全属性)</p>
      </div>
      <div class="close-row"><button class="btn" id="an-ok">知道了</button></div>`).querySelector('#an-ok').onclick = function () { UI.closeModal(this.closest('.modal-overlay') || this.closest('.modal')); };
  },
  showSettings() {
    const speed = (() => { try { return parseInt(localStorage.getItem('bd2_battle_speed'), 10) || 1; } catch (e) { return 1; } })();
    const m = this.openModal(`
      <h2>⚙️ 设置</h2>
      <div class="set-row"><span>音效 / 音乐</span><button class="btn secondary sm" id="set-mute">${(window.Sound && Sound.muted) ? '🔇 已静音' : '🔊 开启'}</button></div>
      <div class="set-row"><span>默认战斗倍速</span><button class="btn secondary sm" id="set-speed">${speed}x</button></div>
      <div class="set-row"><span>存档管理</span><button class="btn secondary sm" id="set-save">导出 / 导入</button></div>
      <div class="set-row"><span>重置存档</span><button class="btn sm" id="set-reset" style="background:linear-gradient(135deg,#ff5a6a,#b02a3a);">重置</button></div>
      <div class="close-row"><button class="btn" id="set-close">关闭</button></div>`);
    m.querySelector('#set-close').onclick = () => this.closeModal(m);
    m.querySelector('#set-mute').onclick = (e) => { const b = document.getElementById('btn-mute'); if (b) b.click(); e.target.textContent = (window.Sound && Sound.muted) ? '🔇 已静音' : '🔊 开启'; };
    m.querySelector('#set-speed').onclick = (e) => {
      let sp = (parseInt(e.target.textContent, 10) || 1) + 1; if (sp > 3) sp = 1;
      try { localStorage.setItem('bd2_battle_speed', String(sp)); } catch (er) {}
      e.target.textContent = sp + 'x';
    };
    m.querySelector('#set-save').onclick = () => { this.closeModal(m); this.showSaveManager(); };
    m.querySelector('#set-reset').onclick = () => { this.closeModal(m); const b = document.getElementById('btn-reset'); if (b) b.click(); };
  },

  /** 存档管理：导出 / 导入 */
  showSaveManager() {
    const code = Game.exportSave() || '';
    const m = this.openModal(`
      <h2>💾 存档管理</h2>
      <p class="muted" style="margin:6px 0 10px;">本游戏存档在本机浏览器。<b style="color:var(--danger);">清缓存/换设备会丢档</b>，请用下面的存档码备份。</p>
      <div class="section-title" style="font-size:14px;">导出（备份）</div>
      <textarea id="save-out" readonly class="save-box">${code}</textarea>
      <button class="btn" id="save-copy" style="width:100%;margin:8px 0 16px;">复制存档码</button>
      <div class="section-title" style="font-size:14px;">导入（恢复）</div>
      <p class="muted" style="font-size:11px;margin:4px 0;">粘贴存档码后导入将<b style="color:var(--danger);">覆盖当前进度</b>。</p>
      <textarea id="save-in" class="save-box" placeholder="在此粘贴存档码…"></textarea>
      <div class="close-row">
        <button class="btn secondary" id="save-close">关闭</button>
        <button class="btn gold" id="save-import">导入覆盖</button>
      </div>
    `);
    m.querySelector('#save-copy').onclick = () => {
      const ta = m.querySelector('#save-out');
      ta.select();
      try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand && document.execCommand('copy'); }
      this.toast('已复制存档码');
    };
    m.querySelector('#save-close').onclick = () => this.closeModal(m);
    m.querySelector('#save-import').onclick = () => {
      const code = m.querySelector('#save-in').value;
      if (!code.trim()) { this.toast('请先粘贴存档码'); return; }
      if (!confirm('导入将覆盖当前进度，确定？')) return;
      const r = Game.importSave(code);
      if (!r.ok) { this.toast(r.msg || '导入失败'); return; }
      this.closeModal(m);
      this.toast('存档已导入');
      this.updateResources();
      Main.switchScreen('home');
    };
  },

  /** 成就殿堂 */
  showAchievements() {
    const render = (m) => {
      const list = Game.ACHIEVEMENTS.slice().sort((a, b) => {
        // 可领取的排最前，其次未达成，最后已领取
        const rank = x => Game.state.achClaimed[x.id] ? 2 : (Game.achValue(x) >= x.target ? 0 : 1);
        return rank(a) - rank(b);
      });
      const rows = list.map(a => {
        const cur = Game.achValue(a);
        const done = cur >= a.target;
        const claimed = !!Game.state.achClaimed[a.id];
        const pct = Math.min(100, cur / a.target * 100);
        const rw = a.reward.gem ? `💎${a.reward.gem}` : a.reward.gold ? `🪙${a.reward.gold}` : a.reward.powder ? `🌸${a.reward.powder}` : '';
        const btn = claimed
          ? '<button class="btn secondary sm" disabled>已领</button>'
          : `<button class="btn ${done ? 'gold' : 'secondary'} sm ach-claim" data-ach="${a.id}" ${done ? '' : 'disabled'}>领取</button>`;
        return `<div class="ach-item ${claimed ? 'claimed' : done ? 'done' : ''}">
          <div class="ach-icon">${a.icon}</div>
          <div class="ach-mid">
            <div class="ach-name">${a.name} <span class="muted" style="font-weight:400;">${a.desc}</span></div>
            <div class="ach-bar"><div class="ach-fill" style="width:${pct}%"></div></div>
            <div class="ach-prog muted">${Math.min(cur, a.target)} / ${a.target}</div>
          </div>
          <div class="ach-right"><div class="ach-rw">${rw}</div>${btn}</div>
        </div>`;
      }).join('');
      m.querySelector('.ach-list').innerHTML = rows;
      m.querySelectorAll('.ach-claim').forEach(b => b.onclick = () => {
        const r = Game.claimAch(b.dataset.ach);
        if (!r.ok) { this.toast(r.msg || '不可领取'); return; }
        if (window.Sound) Sound.sfx('levelup');
        const rw = r.reward.gem ? `💎${r.reward.gem}` : r.reward.gold ? `🪙${r.reward.gold}` : '奖励';
        this.toast(`成就达成！获得 ${rw}`);
        this.updateResources();
        render(m);
      });
    };
    const claimable = Game.achClaimable();
    const m = this.openModal(`
      <h2>🏆 成就殿堂</h2>
      <p class="muted" style="margin:6px 0 12px;">达成里程碑领取宝石奖励。${claimable ? `当前有 <b style="color:var(--gold);">${claimable}</b> 个可领取。` : ''}</p>
      <div class="ach-list"></div>
      <div class="close-row"><button class="btn secondary" id="ach-close">关闭</button></div>
    `);
    render(m);
    m.querySelector('#ach-close').onclick = () => { this.closeModal(m); this.renderWelfare(); };
  },

  showSparkPicker() {
    const pool = window.GameData.COSTUME_POOL;
    const section = (rar) => `
      <div class="replay-group-title">${rar}★ 服装</div>
      <div class="roster-grid">${pool[rar].map(cid => {
        const cd = window.GameData.COSTUMES[cid];
        return `<div class="roster-card border-${this.rarityClass(cd.rarity)}" data-pick="${cid}">
          <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${cd.color}55, transparent);">
            <span class="rarity-badge ${this.rarityClass(cd.rarity)}">${cd.rarity}★</span>
            ${window.GameData.CLASSES[cd.cls].icon}
          </div>
          <div class="rc-info"><div class="rc-name" style="font-size:10px;">${cd.charName}·${cd.costumeName}</div></div>
        </div>`;
      }).join('')}</div>`;
    const m = this.openModal(`
      <h2>自选服装 ✨${Game.SPARK_COST}</h2>
      <p class="muted" style="margin:6px 0 12px;">选择一套服装兑换（消耗 ${Game.SPARK_COST} 闪耀之星）。</p>
      ${section(5)}${section(4)}${section(3)}
      <div class="close-row"><button class="btn secondary" id="sp-close">取消</button></div>
    `);
    m.querySelector('#sp-close').onclick = () => this.closeModal(m);
    m.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => {
      const r = Game.sparkExchange(el.dataset.pick);
      if (!r.ok) { this.toast(r.msg); return; }
      this.closeModal(m);
      this.updateResources();
      this.showPullResults([{ ...r.result }]);
    });
  },
};

window.UI = UI;
