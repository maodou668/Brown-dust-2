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
        <div class="quick-card" data-story-replay>
          <div class="qc-icon">📖</div>
          <div class="qc-title">剧情回顾</div>
          <div class="qc-sub">重温已解锁的故事</div>
        </div>
        <div class="quick-card" data-forge>
          <div class="qc-icon">🔨</div>
          <div class="qc-title">锻造坊</div>
          <div class="qc-sub">背包 ${s.inventory.length} 件装备</div>
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
    const replay = this.screenEl.querySelector('[data-story-replay]');
    if (replay) replay.addEventListener('click', () => this.showStoryReplay());
    const forge = this.screenEl.querySelector('[data-forge]');
    if (forge) forge.addEventListener('click', () => this.showForge());
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
      <div class="replay-group-title">主线剧情</div>
      <div class="story-replay-list">${main.map(row).join('')}</div>
      ${sidesHtml}
      <div class="close-row"><button class="btn secondary" id="sr-close">关闭</button></div>
    `);
    m.querySelector('#sr-close').onclick = () => this.closeModal(m);
    m.querySelectorAll('[data-replay]').forEach(it =>
      it.addEventListener('click', () => {
        this.closeModal(m);
        Story.play(it.dataset.replay);
      }));
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
      <p class="muted" style="text-align:center;margin-top:10px;">用方向键移动，跟随 ▼ 指引到达目标</p>`;
    this.screenEl.querySelectorAll('.chapter-card[data-ch]').forEach(card => {
      const id = card.dataset.ch;
      if (!id) return;
      card.addEventListener('click', () => World.openChapter(id));
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
            ${o.plus ? `<span class="plus-badge corner">+${o.plus}</span>` : ''}
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
    const cosDef = Game.activeCostumeDef(o);
    // 战斗技能池：普攻 + 各拥有服装的招式
    const skillsHtml = Game.battleSkills(o).map(sid => {
      const sk = window.GameData.SKILLS[sid];
      const cdTxt = sk.basic ? '回 SP' : `SP ${sk.sp}${sk.cd != null ? ' · 冷却' + sk.cd : ''}`;
      return `<div class="skill-item">
        <div class="sk-head"><span>${sk.icon}</span>${sk.name}
          <span class="sk-sp">${cdTxt}</span></div>
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
    const gearHtml = `
      <div class="section-title" style="font-size:14px;">装备 ${gbParts.length ? `<span class="muted" style="font-weight:400;font-size:11px;">（${gbParts.join('，')}）</span>` : ''}</div>
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
          <div class="meta">${window.GameData.ELEMENTS[cosDef.element].icon}${window.GameData.ELEMENTS[cosDef.element].name} · ${window.GameData.CLASSES[c.cls].icon}${window.GameData.CLASSES[c.cls].name} · Lv.${o.level}</div>
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
      ${quotesHtml}
      ${sideHtml}
      <div class="close-row">
        <button class="btn secondary" id="cd-close">关闭</button>
        <button class="btn gold" id="cd-levelup" ${Game.state.gold < lvCost || o.level >= 60 ? 'disabled' : ''}>
          ${o.level >= 60 ? '满级' : `升级 🪙${lvCost}`}
        </button>
        <button class="btn" id="cd-team">${inTeam ? '移出队伍' : '编入队伍'}</button>
      </div>
    `);
    m.querySelector('#cd-close').onclick = () => this.closeModal(m);
    const sideBtn = m.querySelector('#cd-side');
    if (sideBtn) sideBtn.onclick = () => { this.closeModal(m); Story.play(c.side); };
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
    if (tpl) {
      return `<div class="gear-slot filled border-${this.rarityClass(tpl.rarity)}" data-slot="${slot}">
        <span class="rarity-badge ${this.rarityClass(tpl.rarity)}">${window.GameData.GEAR.RLABEL[tpl.rarity]}</span>
        <div class="gs-icon">${tpl.icon}</div>
        <div class="gs-name">${tpl.name}</div>
      </div>`;
    }
    return `<div class="gear-slot empty" data-slot="${slot}">
      <div class="gs-icon">＋</div>
      <div class="gs-name muted">${label}</div>
    </div>`;
  },

  /** 选择装备弹窗 */
  showGearPicker(uid, slot) {
    const o = Game.getOwned(uid);
    const c = window.GameData.CHARACTERS[o.charId];
    // 该槽位可装备的背包物品
    const list = Game.state.inventory.filter(g => {
      const tpl = Game.getGearTpl(g.tpl);
      if (!tpl) return false;
      if (slot === 'ex') return tpl.type === 'ex' && tpl.owner === o.charId;
      return tpl.type === slot;
    });
    const slotName = { weapon: '武器', armor: '防具', accessory: '饰品', ex: '专属武器' }[slot];
    const itemsHtml = list.length ? list.map(g => {
      const tpl = Game.getGearTpl(g.tpl);
      const by = Game.gearEquippedBy(g.iid);
      const equippedHere = o.equip[slot] === g.iid;
      const byName = by && by.uid !== uid ? window.GameData.CHARACTERS[by.charId].name : null;
      const statStr = Object.keys(tpl.stats).map(k => {
        const lbl = { atk: '攻', def: '防', hp: '血', crit: '暴击', spd: '速' }[k];
        return k === 'crit' ? `${lbl}+${Math.round(tpl.stats[k] * 100)}%` : `${lbl}+${tpl.stats[k]}`;
      }).join(' ');
      return `<div class="gear-pick-item border-${this.rarityClass(tpl.rarity)}" data-iid="${g.iid}">
        <span class="rarity-badge ${this.rarityClass(tpl.rarity)}" style="position:static;">${window.GameData.GEAR.RLABEL[tpl.rarity]}</span>
        <span class="gp-icon">${tpl.icon}</span>
        <div class="gp-info"><div class="gp-name">${tpl.name}</div><div class="gp-stats muted">${statStr}</div></div>
        ${equippedHere ? '<span class="gp-tag">已装备</span>' : (byName ? `<span class="gp-tag" style="background:var(--panel-2);color:var(--text-dim);">${byName}佩戴</span>` : '')}
      </div>`;
    }).join('') : `<p class="empty-hint">背包里没有可装备的${slotName}。<br>去「锻造坊」打造，或通关关卡掉落获取。</p>`;

    const curIid = o.equip[slot];
    const m = this.openModal(`
      <h2>${c.name} · ${slotName}</h2>
      <p class="muted" style="margin:6px 0 12px;">选择要装备的${slotName}。</p>
      <div class="gear-pick-list">${itemsHtml}</div>
      <div class="close-row">
        ${curIid ? '<button class="btn secondary" id="gp-unequip">卸下</button>' : ''}
        <button class="btn secondary" id="gp-close">返回</button>
      </div>
    `);
    m.querySelector('#gp-close').onclick = () => { this.closeModal(m); this.showCharDetail(uid); };
    const un = m.querySelector('#gp-unequip');
    if (un) un.onclick = () => { Game.unequipGear(uid, slot); this.closeModal(m); this.showCharDetail(uid); };
    m.querySelectorAll('[data-iid]').forEach(el =>
      el.addEventListener('click', () => {
        const r = Game.equipGear(uid, el.dataset.iid);
        if (!r.ok) { this.toast(r.msg); return; }
        this.closeModal(m);
        this.showCharDetail(uid);
      }));
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
      <div class="forge-card">
        <div class="forge-title">打造专属武器</div>
        <p class="muted">为指定佣兵打造其专属武器（UR），提供强力专属属性。</p>
        <button class="btn" id="fg-ex">选择佣兵打造 💎</button>
      </div>
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
    m.querySelector('#fg-ex').onclick = () => { this.closeModal(m); this.showForgeExPicker(); };
  },

  /** 选择佣兵打造专属武器 */
  showForgeExPicker() {
    // 去重：同一角色只列一次
    const seen = new Set();
    const owners = [];
    Game.state.roster.forEach(o => {
      if (seen.has(o.charId)) return;
      seen.add(o.charId);
      owners.push(o);
    });
    const items = owners.map(o => {
      const c = window.GameData.CHARACTERS[o.charId];
      const tplId = 'ex_' + o.charId;
      const owned = Game.state.inventory.some(g => g.tpl === tplId);
      const tpl = Game.getGearTpl(tplId);
      return `<div class="gear-pick-item border-${this.rarityClass(c.rarity)} ${owned ? 'locked' : ''}" ${owned ? '' : `data-forge="${o.uid}"`}>
        <span class="gp-icon">${this.charAvatar(o.charId)}</span>
        <div class="gp-info"><div class="gp-name">${c.name}·专属武器</div>
          <div class="gp-stats muted">${owned ? '已拥有' : `💎${tpl.gemCost}`}</div></div>
      </div>`;
    }).join('');
    const m = this.openModal(`
      <h2>打造专属武器</h2>
      <p class="muted" style="margin:6px 0 12px;">选择佣兵打造其专属武器（每人一件）。</p>
      <div class="gear-pick-list">${items}</div>
      <div class="close-row"><button class="btn secondary" id="fe-close">返回</button></div>
    `);
    m.querySelector('#fe-close').onclick = () => { this.closeModal(m); this.showForge(); };
    m.querySelectorAll('[data-forge]').forEach(el =>
      el.addEventListener('click', () => {
        const r = Game.forgeEx(el.dataset.forge);
        if (!r.ok) { this.toast(r.msg); return; }
        const tpl = Game.getGearTpl(r.tplId);
        this.updateResources();
        this.toast(`打造出 ${tpl.name}！`);
        this.closeModal(m);
        this.showForgeExPicker();
      }));
  },

  // ============================================================
  //  抽卡
  // ============================================================
  renderGacha() {
    const s = Game.state;
    const g = window.GameData.GACHA;
    const pool = window.GameData.COSTUME_POOL;
    this.screenEl.innerHTML = `
      <div class="gacha-banner">
        <h2>服装招募</h2>
        <div class="sub">抽取服装即获得对应角色 · 同角色可多套服装</div>
        <div class="gacha-rates">
          <b>5★ ${(g.rates[5]*100).toFixed(0)}%</b> · 4★ ${(g.rates[4]*100).toFixed(0)}% · 3★ ${(g.rates[3]*100).toFixed(0)}%
          <div class="pity-bar">距离保底 5★ 还有 ${90 - s.pity} 抽</div>
        </div>
        <div class="gacha-actions">
          <button class="btn gold" id="pull1">单次招募 💎${g.cost}</button>
          <button class="btn" id="pull10">十连招募 💎${g.cost*10}</button>
        </div>
      </div>
      <div class="section-title" style="font-size:14px;">传说服装（5★）</div>
      <div class="roster-grid">${pool[5].map(cid => this.costumePoolCard(cid)).join('')}</div>
      <div class="section-title" style="font-size:14px;margin-top:16px;">稀有服装（4★）</div>
      <div class="roster-grid">${pool[4].map(cid => this.costumePoolCard(cid)).join('')}</div>
    `;
    document.getElementById('pull1').onclick = () => this.doPull(1);
    document.getElementById('pull10').onclick = () => this.doPull(10);
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
    const results = [];
    for (let i = 0; i < count; i++) {
      const r = Game.gachaPull();
      if (!r.ok) break;
      results.push(r);
    }
    this.updateResources();
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
