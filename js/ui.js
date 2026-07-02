// ============================================================
//  UI 渲染层 — 各界面渲染、弹窗、战斗界面
// ============================================================

const UI = {
  screenEl: null,
  modalRoot: null,

  init() {
    this.screenEl = document.getElementById('screen');
    this.modalRoot = document.getElementById('modal-root');
    this._initIconSwap();
    this.startFieldAnimator();
    // 过场淡黑遮罩(切界面用)
    const f = document.createElement('div'); f.id = 'nav-fade'; document.body.appendChild(f); this._navFade = f;
  },

  /** 过场转场：淡黑 → 黑屏中渲染新界面 → 等该界面图片真正解码完成(封顶700ms)才淡入 → 淡入即完整无 pop-in */
  transition(fn) {
    const f = this._navFade;
    if (!f || document.hidden) { fn(); return; }
    f.classList.add('on');
    clearTimeout(this._navT);
    this._navT = setTimeout(() => {
      try { fn(); } catch (e) { console.error(e); }
      this._revealWhenReady(f);
    }, 150);
  },
  /** 等新界面所有 <img> 解码完成再揭幕(已预载的秒过, 未载的最多等封顶时长, 绝不卡死) */
  _revealWhenReady(f) {
    const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
    const imgs = Array.from(this.screenEl.querySelectorAll('img')).filter(im => !im.complete);
    if (!imgs.length) { reveal(); return; }
    let pending = imgs.length, done = false;
    const finish = () => { if (done) return; done = true; reveal(); };
    imgs.forEach(im => {
      const on = () => { if (--pending <= 0) finish(); };
      im.addEventListener('load', on, { once: true });
      im.addEventListener('error', on, { once: true });
    });
    setTimeout(finish, 700);
  },

  /** 编队/阵形里 south idle 精灵的呼吸动画: 单一全局定时器循环推进所有可见精灵的帧 (帧已预加载, 走缓存无闪烁) */
  startFieldAnimator() {
    if (this._fieldTimer) return;
    const FRAMES = 7;   // 各角色 idle/south 均 00..06
    this._fieldTimer = setInterval(() => {
      const V = window.ASSET_VER || '';
      const els = document.querySelectorAll('img.char-field-sprite[data-cf]');
      for (const im of els) {
        const id = im.getAttribute('data-cf');
        const f = ((parseInt(im.getAttribute('data-ff') || '0', 10) + 1) % FRAMES);
        im.setAttribute('data-ff', f);
        im.src = `art/05_pixellab/${id}_field/idle/south/0${f}.png?v=${V}`;
      }
    }, 170);
  },

  // ---------- emoji → 像素图标 (全局文本节点替换, 不碰属性, em 尺寸随字号缩放如 emoji) ----------
  // 注意: 具体游戏元素(装备/食谱/炼金/收集品/任务/技能/状态…)的图标已"按用途锚定"在各自数据定义里(用 I('xxx'))。
  // 此处仅保留 emoji 本身即代表该物、且会内联出现在文本里的通用符号 —— 资源货币 + 属性/职业 chip 兜底。
  EMOJI2ICON: {
    '🪙':'coin','💎':'gem','🎟':'ticket','🎫':'ticket','🔑':'key','🔒':'lock','🎁':'gift',
    '⚔':'atk','🛡':'def','❤':'hp','🔮':'mag','🏹':'bow',
  },
  _initIconSwap() {
    const keys = Object.keys(this.EMOJI2ICON).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // 可选变体选择符 U+FE0F
    this._iconRe = new RegExp('(' + keys.join('|') + ')\\uFE0F?', 'u');
    const obs = new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) this.iconizeNode(n);
    });
    obs.observe(this.screenEl, { childList: true, subtree: true });
    obs.observe(this.modalRoot, { childList: true, subtree: true });
    this.iconizeNode(this.screenEl);
  },
  iconizeNode(root) {
    if (!root || !this._iconRe) return;
    if (root.nodeType === 3) { this._swapText(root); return; }
    if (root.nodeType !== 1) return;
    // 只走文本节点, 永不碰属性
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const hits = [];
    let tn; while ((tn = walker.nextNode())) { if (this._iconRe.test(tn.nodeValue)) hits.push(tn); }
    hits.forEach(t => this._swapText(t));
  },
  _swapText(textNode) {
    const re = new RegExp(this._iconRe.source, 'gu');
    const s = textNode.nodeValue;
    if (!re.test(s)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, mm;
    while ((mm = re.exec(s))) {
      if (mm.index > last) frag.appendChild(document.createTextNode(s.slice(last, mm.index)));
      const name = this.EMOJI2ICON[mm[1]];
      const img = document.createElement('img');
      img.className = 'px-ico-in'; img.src = `art/05_pixellab/ui/icons/${name}.png`; img.alt = '';
      frag.appendChild(img);
      last = mm.index + mm[0].length;
    }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    textNode.parentNode && textNode.parentNode.replaceChild(frag, textNode);
  },

  // ---------- 工具 ----------
  el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    const node = t.content.firstElementChild;
    this.iconizeNode(node);
    return node;
  },

  rarityClass(r) { return 'r' + r; },

  // 动态立绘（佣兵详情大框）：charId → 视频基名（自动找 .mp4/.webm）
  LIVE_SPLASH: { lecliss: 'art/01_splash/lecliss_live', seir: 'art/01_splash/seir_live' },

  charAvatar(charId, costumeId) {
    const c = window.GameData.CHARACTERS[charId];
    const clsIcon = window.GameData.CLASSES[c.cls].icon;  // 职业像素图标 (img html)
    // 出战服装=显示总开关：未显式传服装 id 时按该角色当前出战服装解析（服装有专属半身像则用它）
    let cosId = costumeId;
    if (cosId === undefined && window.Game && Game.state && Game.state.roster) {
      const o = Game.state.roster.find(x => x.charId === charId);
      if (o) cosId = o.activeCostume;
    }
    const cos = cosId && window.GameData.COSTUMES ? window.GameData.COSTUMES[cosId] : null;
    // 小框立绘优先级：服装专属半身像 → 角色像素半身像(portrait) → art → 职业图标
    const src = (cos && cos.portrait) || c.portrait || c.art;
    if (src) {
      // 图片优先：加载失败时把 src 换成职业像素图标(不能往属性里塞 img 标签)
      const fb = `art/05_pixellab/ui/icons/cls_${c.cls}.png`;
      const cls = ((cos && cos.portrait) || c.portrait) ? 'char-img char-portrait-px' : 'char-img';
      const V = window.ASSET_VER || '';
      // 带 ?v 与预加载 URL 完全一致 → 命中缓存直接展示(不 lazy, 不留白)
      return `<img class="${cls}" src="${src}?v=${V}" alt="${c.name}" decoding="async"
        onerror="this.onerror=null;this.src='${fb}';this.classList.add('cls-fallback');">`;
    }
    return clsIcon;
  },

  /** 游戏内 south 向 idle 呼吸动画精灵 (用于编队/阵形; 逐帧由 fieldAnimator 驱动) */
  charField(charId) {
    const c = window.GameData.CHARACTERS[charId];
    const V = window.ASSET_VER || '';
    const fb = `art/05_pixellab/ui/icons/cls_${c.cls}.png`;
    return `<img class="char-field-sprite" data-cf="${charId}" data-ff="0" src="art/05_pixellab/${charId}_field/idle/south/00.png?v=${V}" alt="${c.name}" decoding="async"
      onerror="this.onerror=null;this.src='${fb}';this.classList.add('cls-fallback');this.removeAttribute('data-cf');">`;
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
    set('pc-name', Game.currentTitle().name);
    const dot = document.getElementById('mail-dot');
    if (dot) dot.style.display = Game.mailUnclaimed() > 0 ? '' : 'none';
  },

  // ---------- 弹窗 ----------
  openModal(innerHtml, opts = {}) {
    const overlay = this.el(`<div class="modal-overlay"><div class="modal${opts.wide ? ' wide' : ''}">${innerHtml}</div></div>`);
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
    // 左上集群（系统/养成小入口）
    const leftCluster = [
      { go: 'tasks', icon: '📋', label: '任务', dot: Game.tasksAnyClaimable() ? '!' : '' },
      { go: 'codex', icon: '📖', label: '珍藏集' },
      { act: 'forge', icon: '🔨', label: '锻造' },
      { go: 'ach', icon: '🏅', label: '成就', dot: Game.achAnyClaimable() ? '!' : '' },
      { go: 'story', icon: '🎬', label: '剧情' },
    ];
    // 右侧活动/模式 banner 卡（对应 BD2 右侧活动横幅栈）
    const rightBanners = [
      { go: 'arena', icon: '🏆', name: '竞技场', tag: Game.arenaRank((s.arena && s.arena.points) || 1000).name, cls: 'bn-arena' },
      { go: 'dungeon', icon: '⚡', name: '资源副本', tag: `体力 ${s.stamina}`, cls: 'bn-dungeon' },
      { go: 'dispatch', icon: '🧭', name: '远征派遣', tag: Game.dispatchHomeTag() || '挂机产出', cls: 'bn-dispatch' },
      { go: 'event', icon: '🎏', name: '限时活动', tag: `🎟 ${(s.event && s.event.coin) || 0}`, cls: 'bn-event' },
    ];
    // 底部功能行
    const bottomFuncs = [
      { go: 'gacha', icon: '🎴', label: '招募' },
      { go: 'roster', icon: '👥', label: '佣兵' },
      { act: 'team', icon: '⚔️', label: '编队' },
      { go: 'inventory', icon: '🎒', label: '背包' },
      { go: 'welfare', icon: '🎁', label: '福利', dot: Game.canCheckIn() ? '!' : '' },
      { go: 'shop', icon: '🛒', label: '商店' },
    ];
    // emoji → PixelLab 像素图标映射（按 go/act 键）；无映射回退 emoji
    const UI_ICON = { tasks:'quest', codex:'codex', forge:'forge', ach:'medal', story:'story',
      gacha:'summon', roster:'merc', team:'team', inventory:'bag', welfare:'gift', shop:'shop',
      arena:'arena', dispatch:'expd', dungeon:'dungeon', event:'event' };
    const icoHtml = a => { const k = UI_ICON[a.go || a.act];
      return k ? `<img class="px-ico" src="art/05_pixellab/ui/icons/${k}.png" alt="">` : a.icon; };
    const clusterBtn = a => `<button class="ll-tile" ${a.go ? `data-go="${a.go}"` : `data-act="${a.act}"`}>
      <span class="ll-ico">${icoHtml(a)}</span><span class="ll-lab">${a.label}</span>${a.dot ? `<span class="lb-dot">${a.dot}</span>` : ''}</button>`;
    const bannerBtn = a => `<button class="lr-banner ${a.cls}" data-go="${a.go}">
      <span class="lr-ico">${icoHtml(a)}</span>
      <span class="lr-text"><span class="lr-name">${a.name}</span><span class="lr-tag">${a.tag}</span></span></button>`;
    const funcBtn = a => `<button class="lobby-btn" ${a.go ? `data-go="${a.go}"` : `data-act="${a.act}"`}>
      <span class="lb-icon">${icoHtml(a)}</span><span class="lb-label">${a.label}</span>${a.dot ? `<span class="lb-dot">${a.dot}</span>` : ''}</button>`;
    this.screenEl.innerHTML = `
      <div class="lobby">
        <div class="lobby-bg">
          <video class="lobby-video" autoplay loop muted playsinline preload="auto" poster="">
            <source src="art/video/home_bg.mp4?v=${window.ASSET_VER || ''}" type="video/mp4">
            <source src="art/video/home_bg.webm?v=${window.ASSET_VER || ''}" type="video/webm">
          </video>
          <div class="lobby-video-scrim"></div>
          <div class="lobby-bg-grid"></div>
        </div>
        <!-- 左上集群 -->
        <div class="lobby-left">${leftCluster.map(clusterBtn).join('')}</div>
        <!-- 右侧活动横幅栈 -->
        <div class="lobby-right">${rightBanners.map(bannerBtn).join('')}</div>
        <!-- 左下音乐挂件 -->
        <div class="lobby-music" id="lobby-music">
          <span class="lm-ico">🎵</span><span class="lm-track">棕色尘埃 · 序曲</span>
          <span class="lm-toggle" id="lm-toggle">${(window.Sound && Sound.muted) ? '▶' : '⏸'}</span>
        </div>
        <!-- 底部功能行 + 出战 CTA + 角色缩略 -->
        <div class="lobby-bottombar">
          <div class="lb-funcs">${bottomFuncs.map(funcBtn).join('')}</div>
          <button class="lb-cta" data-go="gamecards">
            <span class="cta-go">出 战</span><span class="cta-sub">游戏卡 · 主线 ${cleared}/${total}</span>
          </button>
        </div>
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
    const mt = this.screenEl.querySelector('#lm-toggle');
    if (mt) mt.onclick = () => { if (window.Sound) Sound.toggleMute(); mt.textContent = (window.Sound && Sound.muted) ? '▶' : '⏸'; };
    // 动态背景视频：尝试自动播放；被浏览器拦截则在首次交互时补播；加载失败则隐藏露出渐变兜底
    const vid = this.screenEl.querySelector('.lobby-video');
    if (vid) {
      vid.muted = true;                                  // 静音才允许自动播放
      const tryPlay = () => { const p = vid.play(); if (p && p.catch) p.catch(() => {}); };
      tryPlay();
      const kick = () => { tryPlay(); document.removeEventListener('pointerdown', kick); };
      document.addEventListener('pointerdown', kick, { once: true });
      vid.addEventListener('error', () => { vid.style.display = 'none'; }, { once: true });
    }
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
          ? `<div class="ts-art" style="background:radial-gradient(circle at 50% 35%, ${Game.activeColor(o)}55, transparent);">${this.charField(o.charId)}</div>`
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
              ${this.charField(current.charId)}
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
            ${this.charField(o.charId)}
          </div>
          <div class="rc-info"><div class="rc-name">${c.name}</div><div class="rc-lv">Lv.${o.level}</div></div>
        </div>`;
      }).join('') : '<div class="muted" style="padding:12px;grid-column:1/-1;">没有可上阵的角色了</div>';

      m.querySelector('.te-slots').innerHTML = slotsBar;
      // 阵容羁绊（实时随编队变化）
      const syn = Game.teamSynergy(Game.state.team);
      const rxs = Game.teamReactions(Game.state.team);
      const synHtml = syn.list.length
        ? `<div class="syn-title">⚜️ 当前羁绊</div>${syn.list.map(x => `<div class="syn-item syn-${x.kind}">${x.desc}</div>`).join('')}`
        : `<div class="syn-empty">暂无羁绊 · 同元素叠 2+ 触发共鸣；带齐 坦克+治疗+输出 触发均衡阵</div>`;
      const rxHtml = rxs.length
        ? `<div class="syn-title rx-title">⚡ 可触发元素反应（战斗中异色连击引爆）</div><div class="rx-row">${rxs.map(x => `<span class="rx-chip">${x.desc}</span>`).join('')}</div>`
        : '';
      m.querySelector('.te-synergy').innerHTML = synHtml + rxHtml;
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
      <div class="te-synergy"></div>
      <div class="te-current-wrap"></div>
      <p class="muted" style="margin:10px 0 8px;">先点上方选择位置，再点下方角色上阵 / 替换（最多 ${TEAM_MAX} 人）。</p>
      <div class="te-body roster-grid"></div>
      <div class="close-row"><button class="btn" id="te-done">完成</button></div>
    `);
    render(m);
    if (Game.onceTip('synergy')) setTimeout(() => this.toast('⚜️ 编队会触发「羁绊」：同元素叠 2+ 加爆发、坦+奶+输出凑齐更耐久。下方还会列出本队战斗中可引爆的元素反应。'), 450);
    m.querySelector('#te-done').onclick = () => { this.closeModal(m); this.renderHome(); };
  },

  /** 剧情板块（BD2 式：左分类侧栏 + 右剧集卡列表） */
  renderStory() {
    this.storyTab = this.storyTab || 'main';
    const cats = [
      { id: 'main', name: '主线剧情' },
      { id: 'char', name: '角色剧情' },
      { id: 'comic', name: '漫画剧场' },
      { id: 'term', name: '术语' },
    ];
    // 各分类剧集
    const mainEps = [
      { id: 'prologue', title: '序章 · 启程', src: '主线剧情 · 序章', tags: ['烬火', '相遇'], icon: I('loc_prologue') },
      { id: 'stage1', title: '第一章 · 艾尔玛森林入口', src: '主线剧情 · 第一章', tags: ['哥布林', '褐尘'], icon: I('loc_forest') },
      { id: 'stage2', title: '第二章 · 森林深处', src: '主线剧情 · 第二章', tags: ['暗影狼', '深林'], icon: I('loc_forest') },
      { id: 'stage3', title: '第三章 · 废弃矿洞', src: '主线剧情 · 第三章', tags: ['巨魔', '矿洞'], icon: I('loc_mine') },
      { id: 'stage4', title: '第四章 · 诅咒山脊', src: '主线剧情 · 第四章', tags: ['BOSS', '山脊'], icon: I('loc_ridge') },
      { id: 'stage5', title: '第五章 · 魔王城', src: '主线剧情 · 第五章', tags: ['魔王', '决战'], icon: I('loc_castle') },
      { id: 'epilogue', title: '第一部终章 · 魔王陨落', src: '主线剧情 · 终章', tags: ['终章', '真相'], icon: I('loc_fallen') },
      { id: 'stage6', title: '第二部 · 破碎边境', src: '主线剧情 · 第二部', tags: ['边境', '永夜'], icon: I('loc_frontier') },
      { id: 'stage7', title: '第二部 · 永夜回廊', src: '主线剧情 · 第二部', tags: ['回廊', '女皇'], icon: I('loc_night') },
      { id: 'epilogue2', title: '第二部终章 · 曙光', src: '主线剧情 · 终章', tags: ['曙光', '希望'], icon: I('loc_prologue') },
    ];
    const sideSeen = new Set(); const charEps = [];
    Game.state.roster.forEach(o => {
      const ch = window.GameData.CHARACTERS[o.charId];
      if (ch.side && window.STORY && window.STORY[ch.side] && !sideSeen.has(ch.side)) {
        sideSeen.add(ch.side);
        charEps.push({ id: ch.side, title: ch.name, src: '角色剧情 · ' + ch.title, tags: [ch.title], avatar: o.charId });
      }
    });
    const comicEps = [
      { id: 'ep_prologue', title: '序章 · 烬火启程', src: '漫画剧场 · 分镜演出', tags: ['指挥官', '佣兵团'], icon: I('film'), kind: 'comic' },
      { id: 'ep_twist', title: '终章 · 魔王的真相', src: '漫画剧场 · 分镜演出', tags: ['巴尔', '揭秘'], icon: I('film'), kind: 'comic' },
      { id: 'ep_nightfall', title: '永夜将明 · 女皇的摇篮曲', src: '漫画剧场 · 分镜演出', tags: ['涅夫提斯', '第二卷'], icon: I('film'), kind: 'comic' },
    ];
    const terms = [
      { id: 't_dust', title: '褐尘', src: '术语 · 世界观', tags: ['灾厄', '本源'], icon: '🌫️', kind: 'term', desc: '自天而降的褐色尘埃，侵蚀大地与生灵，是本作一切灾厄的根源。尘落之处，魔物滋生、人心异变。' },
      { id: 't_merc', title: '佣兵团', src: '术语 · 阵营', tags: ['指挥官', '雇佣'], icon: '⚔️', kind: 'term', desc: '由指挥官统领的雇佣兵团，受雇清剿魔物、守护商路，是乱世中少数还在抵抗褐尘的力量。' },
      { id: 't_baal', title: '魔王巴尔', src: '术语 · 人物', tags: ['第一部', 'BOSS'], icon: I('ogre'), kind: 'term', desc: '第一部的最终敌人，盘踞魔王城，操纵被褐尘污染的魔物。其临终揭示的秘密，掀开了第二部的序幕。' },
      { id: 't_night', title: '永夜', desc: '魔王陨落后仍未散去的黑暗，笼罩破碎边境。第二部的核心谜团，与女皇的传说交织。', src: '术语 · 谜团', tags: ['第二部', '黑暗'], icon: '🌙', kind: 'term' },
    ];
    const eps = { main: mainEps, char: charEps, comic: comicEps, term: terms }[this.storyTab] || [];

    const card = (e) => {
      const kind = e.kind || 'story';
      const seen = kind === 'story' ? Story.seen(e.id) : (kind === 'comic' ? true : true);
      const isNew = kind === 'story' && !seen;
      const reward = isNew ? 20 : 0;
      const thumb = e.avatar
        ? `<div class="ep-thumb avatar">${this.charAvatar(e.avatar)}</div>`
        : `<div class="ep-thumb">${e.icon || '📖'}</div>`;
      return `<div class="ep-card">
        <div class="ep-thumb-wrap">${thumb}${isNew ? '<span class="ep-new">NEW</span>' : ''}</div>
        <div class="ep-main">
          <div class="ep-title">${e.title}</div>
          <div class="ep-src">${e.src}</div>
          <div class="ep-tags">${(e.tags || []).map(t => `<span class="ep-tag">#${t}</span>`).join('')}</div>
        </div>
        <div class="ep-right">
          ${reward ? `<div class="ep-reward">💎${reward}</div>` : ''}
          <button class="btn sm ep-play" data-play="${e.id}" data-kind="${kind}">▶ ${kind === 'story' ? (seen ? '重看' : '播放') : (kind === 'term' ? '查看' : '播放')}</button>
        </div>
      </div>`;
    };

    const sortLabel = { main: '剧情顺序', char: '角色', comic: '分镜', term: '世界观' }[this.storyTab];
    this.screenEl.innerHTML = `
      <div class="story-board">
        <div class="sb-side">
          ${cats.map(c => `<button class="sb-cat ${this.storyTab === c.id ? 'on' : ''}" data-tab="${c.id}">${c.name}</button>`).join('')}
        </div>
        <div class="sb-main">
          <div class="sb-head"><span>🎬 共 ${eps.length} 话</span><span class="muted" style="font-size:12px;">${sortLabel}</span></div>
          <div class="ep-list">${eps.length ? eps.map(card).join('') : '<div class="muted" style="padding:30px;text-align:center;">该分类暂无内容</div>'}</div>
        </div>
      </div>`;

    this.screenEl.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.storyTab = b.dataset.tab; this.renderStory(); });
    this.screenEl.querySelectorAll('[data-play]').forEach(b => b.onclick = () => {
      const id = b.dataset.play, kind = b.dataset.kind;
      if (kind === 'comic') { if (window.Comic) Comic.open(id); return; }
      if (kind === 'term') { const t = terms.find(x => x.id === id); if (t) this.showTermDetail(t); return; }
      // story：首次观看给宝石奖励
      if (!Story.seen(id)) { Game.state.gem += 20; Game.save(); this.updateResources(); this.toast('首次观看 · 💎+20'); }
      Story.play(id);
    });
  },
  showTermDetail(t) {
    const m = this.openModal(`
      <div class="gd-head"><div class="gd-art border-r5"><span class="gd-ico">${t.icon}</span></div>
        <div class="gd-title"><div class="gd-name">${t.title}</div><div class="gd-meta muted">${t.src}</div></div></div>
      <p style="line-height:1.8;font-size:13px;margin:10px 0;">${t.desc}</p>
      <div class="close-row"><button class="btn" id="tm-ok">关闭</button></div>`);
    m.querySelector('#tm-ok').onclick = () => this.closeModal(m);
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
      ${this.trialSectionHtml()}
      ${this.abyssSectionHtml()}`;
    this.screenEl.querySelectorAll('.chapter-card[data-ch]').forEach(card => {
      const id = card.dataset.ch;
      if (!id) return;
      card.addEventListener('click', () => World.openChapter(id));
    });
    this.screenEl.querySelectorAll('.trial-card[data-trial]').forEach(card => {
      card.addEventListener('click', () => this.showTrialConfirm(parseInt(card.dataset.trial, 10)));
    });
    this.screenEl.querySelectorAll('.trial-card[data-abyss]').forEach(card => {
      card.addEventListener('click', () => this.showAbyssConfirm(parseInt(card.dataset.abyss, 10)));
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

  /** 深渊区块 HTML（通关试炼之塔全部 6 层后开启）*/
  abyssSectionHtml() {
    const abyss = window.GameData.ABYSS || [];
    if (!abyss.length) return '';
    const trialDone = (Game.state.trialMax || 0) >= (window.GameData.TRIALS || []).length;
    const max = Game.state.abyssMax || 0;
    if (!trialDone) {
      return `
        <div class="section-title" style="margin-top:20px;">🌑 深渊 <span class="muted" style="font-weight:400;font-size:11px;">· 满练强者的终极试炼</span></div>
        <div class="trial-card locked"><div class="trial-floor">🔒</div>
          <div class="trial-info"><h3>深渊 · 封印中</h3><p>通关试炼之塔全部 ${(window.GameData.TRIALS || []).length} 层后开启</p></div>
          <div class="trial-go">🔒</div></div>`;
    }
    const cards = abyss.map((t, i) => {
      const unlocked = i <= max;
      const cleared = i < max;
      const bossName = window.GameData.ENEMIES[t.enemies[0].id].name;
      const mods = [];
      if (t.mod && t.mod.healCut) mods.push(`枯萎-${Math.round(t.mod.healCut * 100)}%治疗`);
      if (t.mod && t.mod.rampage) mods.push('灼世狂暴');
      if (t.enemies.some(e => e.armored)) mods.push('护甲·须破防');
      return `<div class="trial-card abyss ${unlocked ? '' : 'locked'} ${cleared ? 'done' : ''}" ${unlocked ? `data-abyss="${i}"` : ''}>
        <div class="trial-floor">🌑<span>${t.tier}层</span></div>
        <div class="trial-info">
          <h3>${unlocked ? t.name : `深渊 · 第 ${t.tier} 层`} ${cleared ? '<span class="clear-mark">✓</span>' : ''}</h3>
          <p>${unlocked ? t.desc : '通关上一层后开启'}</p>
          ${unlocked ? `<div class="trial-meta"><span class="muted">推荐 Lv.${t.recommend}</span><span class="trial-boss">BOSS ${bossName}</span>${mods.map(m => `<span class="abyss-mod">${m}</span>`).join('')}<span class="trial-reward">🪙${t.reward.gold} 💎${t.reward.gem}</span></div>` : ''}
        </div>
        <div class="trial-go">${!unlocked ? '🔒' : cleared ? '再战 ›' : '挑战 ›'}</div>
      </div>`;
    }).join('');
    return `
      <div class="section-title" style="margin-top:20px;">🌑 深渊 <span class="muted" style="font-weight:400;font-size:11px;">· 叠加机制的终极试炼，专为满练强队设计</span></div>
      <div class="trial-progress muted">当前进度：${max} / ${abyss.length} 层</div>
      ${cards}`;
  },

  /** 深渊出战确认 */
  showAbyssConfirm(idx) {
    const stage = window.GameData.ABYSS[idx];
    if (!stage) return;
    if (Game.state.team.length === 0) { this.toast('请先在「主页」编入出战队伍'); Main.switchScreen('home'); return; }
    const enemyHtml = stage.enemies.map(e => {
      const def = window.GameData.ENEMIES[e.id];
      return `<span style="font-size:11px;background:var(--panel);padding:3px 7px;border-radius:6px;">${def.name} Lv.${e.level}${e.armored ? ' 🛡' : ''}</span>`;
    }).join(' ');
    const teamHtml = Game.state.team.map(uid => {
      const o = Game.getOwned(uid); const c = window.GameData.CHARACTERS[o.charId];
      return `<div class="team-slot filled border-${this.rarityClass(c.rarity)}" style="max-width:64px;">
        <div class="char-portrait"><div class="avatar" style="font-size:26px;">${this.charAvatar(o.charId)}</div>
        <span class="pname">Lv.${o.level}</span></div></div>`;
    }).join('');
    const m = this.openModal(`
      <h2>🌑 ${stage.name}</h2>
      <p class="muted" style="margin:6px 0 12px;">${stage.desc}</p>
      <div class="muted" style="margin-bottom:6px;">敌方阵容 · 推荐 Lv.${stage.recommend}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">${enemyHtml}</div>
      <div class="muted" style="margin-bottom:6px;">我方出战（${Game.state.team.length}/5）</div>
      <div class="team-slots">${teamHtml}</div>
      <div class="close-row">
        <button class="btn secondary" id="ab-cancel">取消</button>
        <button class="btn" id="ab-fight">踏入深渊 ⚔️</button>
      </div>
    `);
    m.querySelector('#ab-cancel').onclick = () => this.closeModal(m);
    m.querySelector('#ab-fight').onclick = () => {
      this.closeModal(m);
      BattleUI.start(stage, () => {
        if (Battle.result === 'win' && idx + 1 > (Game.state.abyssMax || 0)) {
          Game.state.abyssMax = idx + 1;
          Game.save();
        }
        this.renderStages();
      });
    };
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
    const E = window.GameData.ELEMENTS, CL = window.GameData.CLASSES;
    this.rosterFilter = this.rosterFilter || { element: null, team: false, cls: null };
    this.rosterSort = this.rosterSort || 'rarity';
    const f = this.rosterFilter;

    let list = s.roster.filter(o => {
      const c = window.GameData.CHARACTERS[o.charId];
      if (f.element && c.element !== f.element) return false;
      if (f.cls && c.cls !== f.cls) return false;
      if (f.team && !Game.inTeam(o.uid)) return false;
      return true;
    });
    const sortFns = {
      rarity: (a, b) => { const ca = window.GameData.CHARACTERS[a.charId], cb = window.GameData.CHARACTERS[b.charId]; return cb.rarity - ca.rarity || b.level - a.level; },
      level: (a, b) => b.level - a.level || (b.plus || 0) - (a.plus || 0),
      element: (a, b) => { const order = ['fire', 'water', 'wind', 'earth', 'light', 'dark']; return order.indexOf(window.GameData.CHARACTERS[a.charId].element) - order.indexOf(window.GameData.CHARACTERS[b.charId].element); },
    };
    list = list.slice().sort(sortFns[this.rosterSort] || sortFns.rarity);

    // 选中预览（默认列表首位；失效则回退）
    if (!this.rosterSel || !s.roster.find(o => o.uid === this.rosterSel)) this.rosterSel = list[0] ? list[0].uid : null;
    const sel = this.rosterSel ? Game.getOwned(this.rosterSel) : null;

    // 卡片
    const cards = list.map(o => {
      const c = window.GameData.CHARACTERS[o.charId];
      const cos = Game.activeCostumeDef(o);   // 出战服装决定元素/配色徽章
      const inTeam = Game.inTeam(o.uid);
      return `<div class="r2-card border-${this.rarityClass(c.rarity)} ${o.uid === this.rosterSel ? 'sel' : ''}" data-uid="${o.uid}">
        ${inTeam ? '<span class="r2-team-tag">出战</span>' : ''}
        <div class="r2-card-art" style="background:radial-gradient(circle at 50% 30%, ${cos.color}55, transparent);">
          <span class="r2-el">${E[cos.element].icon}</span>
          <span class="r2-star">${'★'.repeat(c.rarity)}</span>
          ${this.charAvatar(o.charId)}
          ${o.plus ? `<span class="plus-badge corner">+${o.plus}</span>` : ''}
        </div>
        <div class="r2-card-name">${c.name}</div>
        <div class="r2-card-lv">Lv.${o.level}</div>
      </div>`;
    }).join('') || '<p class="muted" style="grid-column:1/-1;padding:16px;text-align:center;">没有符合筛选的佣兵</p>';

    // 左侧预览
    let splash, actions = '';
    if (sel) {
      const c = window.GameData.CHARACTERS[sel.charId];
      const cos = Game.activeCostumeDef(sel);
      const inTeam = Game.inTeam(sel.uid);
      const st = Game.computeStats(sel);
      const live = this.LIVE_SPLASH[sel.charId];
      const splashVisual = live
        ? `<video class="r2-live" autoplay loop muted playsinline preload="auto" poster="${c.art || ''}">
             <source src="${live}.mp4?v=${window.ASSET_VER || ''}" type="video/mp4">
             <source src="${live}.webm?v=${window.ASSET_VER || ''}" type="video/webm">
           </video><div class="r2-live-scrim"></div>`
        : `<div class="r2-splash-avatar">${this.charAvatar(sel.charId)}</div>`;
      splash = `
        <div class="r2-splash border-${this.rarityClass(cos.rarity)}" style="background:linear-gradient(180deg, ${cos.color}66 0%, ${cos.color}22 45%, var(--bg) 90%);">
          <span class="r2-splash-el">${E[cos.element].icon}${E[cos.element].name}</span>
          <span class="r2-splash-star">${'★'.repeat(cos.rarity)}</span>
          ${splashVisual}
          <div class="r2-splash-info">
            <div class="r2-splash-name">${c.name}</div>
            <div class="r2-splash-meta">${c.title} · ${CL[c.cls].icon}${CL[c.cls].name} · Lv.${sel.level}</div>
            <div class="r2-splash-grow">突破+${sel.plus || 0} · 觉醒${sel.awaken || 0}★ · 好感Lv${Game.affLevel(sel)} · ⚔${Math.round(st.maxHp * 0.25 + st.atk * 1.5 + st.def)}</div>
          </div>
        </div>`;
      actions = `<div class="r2-splash-actions">
        <button class="btn secondary sm" id="r2-detail">详情养成</button>
        <button class="btn sm ${inTeam ? 'secondary' : 'gold'}" id="r2-deploy">${inTeam ? '移出阵形' : '上 阵'}</button>
      </div>`;
    } else splash = '<div class="r2-splash empty"><div class="muted">还没有佣兵，去招募吧</div></div>';

    // 阵形行（立绘下方）
    const formSlots = Array.from({ length: 5 }, (_, i) => {
      const uid = s.team[i]; const o = uid ? Game.getOwned(uid) : null;
      const c = o ? window.GameData.CHARACTERS[o.charId] : null;
      return `<div class="r2-form-slot ${o ? 'border-' + this.rarityClass(c.rarity) : 'empty'}" data-slot="${i}">
        ${o ? `<div class="r2-fs-art" style="background:radial-gradient(circle at 50% 35%, ${Game.activeColor(o)}55, transparent);">${this.charField(o.charId)}</div>` : '<span class="r2-fs-plus">＋</span>'}
      </div>`;
    }).join('');

    const elemChip = (key, icon) => `<button class="rf-chip ${f.element === key ? 'on' : ''}" data-elem="${key || ''}">${icon}</button>`;
    const clsChip = (key, icon) => `<button class="rf-chip ${f.cls === key ? 'on' : ''}" data-cls="${key || ''}">${icon}</button>`;
    const sortLabel = { rarity: '稀有', level: '等级', element: '元素' }[this.rosterSort];

    this.screenEl.innerHTML = `
      <div class="roster2">
        <div class="r2-filterbar">
          <div class="rf-group">${elemChip(null, '全')}${['fire', 'wind', 'earth', 'water', 'light', 'dark'].map(k => elemChip(k, E[k].icon)).join('')}</div>
          <div class="rf-group">${clsChip(null, '职')}${Object.keys(CL).map(k => clsChip(k, CL[k].icon)).join('')}</div>
          <div class="rf-group">
            <button class="rf-toggle ${f.team ? 'on' : ''}" id="rf-team">仅出战</button>
            <button class="rf-sort" id="rf-sort">排序·${sortLabel}</button>
          </div>
        </div>
        <div class="r2-body">
          <!-- 左：大立绘 + 操作 + 立绘下方的当前阵形 -->
          <div class="r2-left">
            ${splash}
            ${actions}
            <div class="r2-formation">
              <div class="r2-form-head">当前阵形 <span class="muted">· 战力 ⚔${Game.playerPower()}</span></div>
              <div class="r2-form-slots">${formSlots}</div>
            </div>
          </div>
          <!-- 右：所有角色网格 -->
          <div class="r2-grid">${cards}</div>
        </div>
      </div>`;

    // 筛选
    this.screenEl.querySelectorAll('[data-elem]').forEach(b => b.onclick = () => { f.element = b.dataset.elem || null; this.renderRoster(); });
    this.screenEl.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { f.cls = b.dataset.cls || null; this.renderRoster(); });
    this.screenEl.querySelector('#rf-team').onclick = () => { f.team = !f.team; this.renderRoster(); };
    this.screenEl.querySelector('#rf-sort').onclick = () => {
      const order = ['rarity', 'level', 'element'];
      this.rosterSort = order[(order.indexOf(this.rosterSort) + 1) % order.length]; this.renderRoster();
    };
    // 卡片：单击选中（更新左侧预览）
    this.screenEl.querySelectorAll('.r2-card[data-uid]').forEach(card => card.onclick = () => { this.rosterSel = card.dataset.uid; this.renderRoster(); });
    // 动态立绘视频：尝试自动播放，失败则隐藏露出 poster 兜底
    const lv = this.screenEl.querySelector('video.r2-live');
    if (lv) { lv.muted = true; const p = lv.play(); if (p && p.catch) p.catch(() => {}); lv.addEventListener('error', () => { lv.style.display = 'none'; }, { once: true }); }
    // 预览按钮
    const det = this.screenEl.querySelector('#r2-detail');
    if (det) det.onclick = () => this.showCharDetail(this.rosterSel);
    const dep = this.screenEl.querySelector('#r2-deploy');
    if (dep) dep.onclick = () => {
      const r = Game.toggleDeploy(this.rosterSel);
      if (!r.ok) { this.toast(r.msg); return; }
      this.updateResources(); this.renderRoster();
    };
    // 阵形槽点击 → 编队
    this.screenEl.querySelectorAll('.r2-form-slot[data-slot]').forEach(sl => sl.onclick = () => this.showTeamEditor(parseInt(sl.dataset.slot, 10)));
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
      <div class="section-title" style="font-size:14px;">出战服装 <span class="muted" style="font-weight:400;font-size:11px;">· 决定地图行走 / 战斗立绘 / 属性招式</span></div>
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
        <div class="stat-item"><span><img class="px-ico-in" src="art/05_pixellab/ui/icons/hp.png"> 生命</span><span class="sv">${st.maxHp}</span></div>
        <div class="stat-item"><span><img class="px-ico-in" src="art/05_pixellab/ui/icons/atk.png"> 攻击</span><span class="sv">${st.atk}</span></div>
        <div class="stat-item"><span><img class="px-ico-in" src="art/05_pixellab/ui/icons/def.png"> 防御</span><span class="sv">${st.def}</span></div>
        <div class="stat-item"><span><img class="px-ico-in" src="art/05_pixellab/ui/icons/spd.png"> 速度</span><span class="sv">${st.spd}</span></div>
        <div class="stat-item"><span><img class="px-ico-in" src="art/05_pixellab/ui/icons/crit.png"> 暴击</span><span class="sv">${Math.round(st.crit*100)}%</span></div>
        <div class="stat-item"><span>✦ 突破</span><span class="sv">+${o.plus || 0}${o.plus ? ` (属性+${o.plus * 8}%)` : ''}</span></div>
      </div>
      <p class="muted" style="margin:-4px 0 8px;font-size:11px;">突破说明：在「招募」中再次获得该佣兵可提升突破等级（最高 +5），每级 +8% 基础属性。</p>
      ${costumeHtml}
      ${gearHtml}
      <div class="section-title" style="font-size:14px;">战斗技能池 <span class="muted" style="font-weight:400;font-size:11px;">· 普攻 + 出战服装的 2 招（换套即换 kit）</span></div>
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
      const pickups = (pool[5] || []).slice(0, 8).map(cid => {
        const cd = window.GameData.COSTUMES[cid];
        return `<span class="gf-pick border-r5" data-cid="${cid}" title="${cd.charName} · ${cd.costumeName}（点击查看详情）" style="background:radial-gradient(circle at 50% 35%, ${cd.color}55, transparent);">${this.charAvatar(cd.charId, cid)}</span>`;
      }).join('');
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
          <button class="btn gf-pull-btn" id="pull1"><b>抽 1 次</b><span>💎${g.cost}</span></button>
          <button class="btn gold gf-pull-btn" id="pull10"><span class="gf-guar-badge">5★保底</span><b>抽 10 次</b><span>💎${g.cost * 10}</span></button>
        </div>`;
    } else {
      const pickups = (exPool[5] || []).slice(0, 8).map(id => {
        const t = window.GameData.GEAR.ex[id];
        return `<span class="gf-pick border-r5" data-exid="${id}" title="${t ? t.name : ''}（点击查看详情）">${t ? t.icon : '🗡️'}</span>`;
      }).join('') || '<span class="muted">暂无上架</span>';
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
          <button class="btn gf-pull-btn" id="ex-pull1"><b>抽 1 次</b><span>💎${eg.cost}</span></button>
          <button class="btn gold gf-pull-btn" id="ex-pull10"><b>抽 10 次</b><span>💎${eg.cost * 10}</span></button>
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
    // 卡池图标点击 → 详情
    this.screenEl.querySelectorAll('.gf-pick[data-cid]').forEach(el =>
      el.onclick = () => this.showCostumeDetail(el.dataset.cid));
    this.screenEl.querySelectorAll('.gf-pick[data-exid]').forEach(el =>
      el.onclick = () => this.showGearTplDetail(el.dataset.exid));
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
      return `<div class="roster-card border-${this.rarityClass(tpl.rarity)}" data-exid="${r.tplId}" title="点击查看详情">
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
    m.querySelectorAll('.roster-card[data-exid]').forEach(c => c.onclick = () => this.showGearTplDetail(c.dataset.exid));
    m.querySelector('#ex-ok').onclick = () => { this.closeModal(m); this.renderGacha(); };
  },

  costumePoolCard(cid) {
    const cd = window.GameData.COSTUMES[cid];
    return `<div class="roster-card border-${this.rarityClass(cd.rarity)}">
      <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${cd.color}55, transparent);">
        <span class="rarity-badge ${this.rarityClass(cd.rarity)}">${cd.rarity}★</span>
        ${this.charAvatar(cd.charId, cid)}
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
          <div class="pull-art border-${this.rarityClass(cd.rarity)}" data-cid="${r.costumeId}" title="点击查看详情" style="cursor:pointer;background:radial-gradient(circle at 50% 35%, ${cd.color}66, var(--panel));">
            ${this.charAvatar(cd.charId, r.costumeId)}
          </div>
          <div class="pull-stars ${this.rarityClass(cd.rarity)}" style="-webkit-text-fill-color:initial;color:var(--${'r'+r.rarity});">${'★'.repeat(r.rarity)}</div>
          <div class="pull-name">${cd.charName} <span class="muted" style="font-size:13px;">· ${cd.costumeName}</span></div>
          <div class="pull-title">${window.GameData.ELEMENTS[cd.element].icon}${window.GameData.ELEMENTS[cd.element].name} · 招式「${window.GameData.SKILLS[cd.signature].name}」</div>
          ${this.pullTag(r)}
        </div>
        <div class="close-row"><button class="btn" id="pr-ok">确定</button></div>
      `, { noBackdropClose: true });
      const pa = m.querySelector('.pull-art[data-cid]');
      if (pa) pa.onclick = () => this.showCostumeDetail(pa.dataset.cid);
      m.querySelector('#pr-ok').onclick = () => { this.closeModal(m); this.renderGacha(); };
    } else {
      const grid = results.map(r => {
        const cd = window.GameData.COSTUMES[r.costumeId];
        const tag = r.isNew ? 'NEW' : r.newCostume ? '新装' : r.plusUp ? '突破+' + r.plus : '💎' + r.refund;
        const tagBg = r.isNew ? 'var(--gold);color:#241a08' : r.newCostume ? 'var(--gem)' : r.plusUp ? 'var(--accent-2)' : 'var(--panel-2);color:var(--text-dim)';
        return `<div class="roster-card border-${this.rarityClass(r.rarity)}" data-cid="${r.costumeId}" title="点击查看详情">
          <div class="rc-art" style="background:radial-gradient(circle at 50% 35%, ${cd.color}44, transparent);">
            <span class="rarity-badge ${this.rarityClass(r.rarity)}">${r.rarity}★</span>
            ${this.charAvatar(cd.charId, r.costumeId)}
            <span class="in-team-tag" style="background:${tagBg};">${tag}</span>
          </div>
          <div class="rc-info"><div class="rc-name" style="font-size:11px;">${cd.charName}·${cd.costumeName}</div></div>
        </div>`;
      }).join('');
      const best = Math.max(...results.map(r => r.rarity));
      const m = this.openModal(`
        <h2 style="text-align:center;">十连招募结果</h2>
        <p class="muted" style="text-align:center;margin-bottom:12px;">最高稀有度 <b class="${this.rarityClass(best)}" style="padding:1px 6px;border-radius:5px;">${best}★</b> · 点击卡片看详情</p>
        <div class="roster-grid">${grid}</div>
        <div class="close-row"><button class="btn" id="pr-ok">确定</button></div>
      `, { noBackdropClose: true });
      m.querySelectorAll('.roster-card[data-cid]').forEach(c => c.onclick = () => this.showCostumeDetail(c.dataset.cid));
      m.querySelector('#pr-ok').onclick = () => { this.closeModal(m); this.renderGacha(); };
    }
  },

  // ============================================================
  //  福利：签到 / 任务 / 保底兑换 / 商店
  // ============================================================
  // ============================================================
  //  任务板（每日 / 每周）—— 对照 BD2 任务面板
  // ============================================================
  _rwLabel(r) {
    const map = { gold: '🪙', gem: '💎', powder: '✨', spark: '⭐', stone: '🔮', stam: '⚡', coin: '🎟️', ticket: '🎫' };
    const parts = Object.entries(r).map(([k, v]) => k === 'gear' ? '🎁装备' : (map[k] || '') + v);
    return parts.join(' ');
  },
  renderTasks() {
    Game.ensureTasks();
    this.taskTab = this.taskTab || 'daily';
    const tab = this.taskTab;
    const list = Game.taskList(tab);
    const miles = Game.taskMiles(tab);
    const doneCount = Game.taskDoneCount(tab);
    const totalCount = list.length;
    const sideTab = (id, name) => {
      const dot = Game.taskClaimable(id) ? '<span class="tk-dot"></span>' : '';
      return `<button class="tk-tab ${tab === id ? 'on' : ''}" data-ttab="${id}">${name}${dot}</button>`;
    };
    // 区间奖励里程碑轨道
    const maxAt = miles.length ? miles[miles.length - 1].at : 1;
    const fillPct = Math.min(100, doneCount / maxAt * 100);
    const mileNodes = miles.map(m => {
      const left = (m.at / maxAt) * 100;
      const cls = m.claimed ? 'claimed' : (m.reached ? 'ready' : 'lock');
      return `<button class="tk-node ${cls}" data-mile="${m.idx}" style="left:${left}%;">
        <span class="tk-node-rw">${this._rwLabel(m.reward)}</span>
        <span class="tk-node-at">${m.at}</span>
      </button>`;
    }).join('');
    // 任务行
    const rows = list.map(t => {
      const state = t.claimed ? 'claimed' : (t.done ? 'ready' : 'todo');
      const btn = t.claimed
        ? '<span class="tk-claimed">已领取</span>'
        : (t.done
          ? `<button class="tk-act ready" data-claim="${t.id}" title="领取">🤲</button>`
          : (t.go
            ? `<button class="tk-act go" data-go2="${t.go}" title="前往">↗</button>`
            : '<button class="tk-act lock" disabled>🤲</button>'));
      return `<div class="tk-row ${state}">
        <div class="tk-reward"><span class="tk-rico">${t.icon}</span><span class="tk-ramt">${this._rwLabel(t.reward)}</span></div>
        <div class="tk-info">
          <div class="tk-name">${t.name} <span class="tk-prog">${t.cur} / ${t.target}</span></div>
          <div class="tk-desc">${t.desc}</div>
        </div>
        ${btn}
      </div>`;
    }).join('');

    this.screenEl.innerHTML = `
      <div class="task-board">
        <div class="tk-side">
          <div class="tk-side-title">📋 任务</div>
          ${sideTab('daily', '每日任务')}
          ${sideTab('weekly', '每周任务')}
        </div>
        <div class="tk-main">
          <div class="tk-milerow">
            <span class="tk-mile-label">区间奖励</span>
            <div class="tk-track"><div class="tk-track-fill" style="width:${fillPct}%;"></div>${mileNodes}</div>
          </div>
          <div class="tk-list">${rows}</div>
          <div class="tk-foot">
            <span class="muted">⏱ ${Game.taskResetText(tab)}</span>
            <button class="btn ${Game.taskClaimable(tab) ? 'gold' : 'secondary'}" id="tk-all" ${Game.taskClaimable(tab) ? '' : 'disabled'}>全部获得</button>
          </div>
        </div>
      </div>`;

    this.screenEl.querySelectorAll('[data-ttab]').forEach(b => b.onclick = () => { this.taskTab = b.dataset.ttab; this.renderTasks(); });
    this.screenEl.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
      const r = Game.claimTask(tab, b.dataset.claim);
      if (!r.ok) { this.toast(r.msg || '不可领取'); return; }
      this.toast('已领取：' + this._rwLabel(r.reward)); this.updateResources(); this.renderTasks();
    });
    this.screenEl.querySelectorAll('[data-mile]').forEach(b => b.onclick = () => {
      const r = Game.claimTaskMile(tab, parseInt(b.dataset.mile, 10));
      if (!r.ok) { this.toast(r.msg || '不可领取'); return; }
      this.toast('区间奖励：' + this._rwLabel(r.reward)); this.updateResources(); this.renderTasks();
    });
    this.screenEl.querySelectorAll('[data-go2]').forEach(b => b.onclick = () => Main.switchScreen(b.dataset.go2));
    const all = this.screenEl.querySelector('#tk-all');
    if (all) all.onclick = () => {
      const r = Game.claimAllTasks(tab);
      if (!r.ok) { this.toast('没有可领取的奖励'); return; }
      this.toast(`一键领取 ${r.n} 项奖励`); this.updateResources(); this.renderTasks();
    };
  },

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
    if (oa) oa.onclick = () => Main.switchScreen('ach');
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
  // ============================================================
  //  活动中心（Hub）—— 左侧活动列表 + 右侧按类型切换
  // ============================================================
  renderEvent() {
    Game.ensureEvent();
    const hub = Game.EVENT_HUB;
    this.eventSel = this.eventSel && hub.find(e => e.id === this.eventSel) ? this.eventSel : hub[0].id;
    const ev = Game.getEventHub(this.eventSel);

    // 左侧活动列表
    const listHtml = hub.map(e => {
      const dot = Game.eventHubClaimable(e) ? '<span class="evh-dot"></span>' : '';
      return `<button class="evh-item ${e.id === this.eventSel ? 'on' : ''}" data-ev-sel="${e.id}">
        <span class="evh-cd">D-${e.cd}</span>
        <span class="evh-thumb" style="background:linear-gradient(135deg, ${e.color}, ${e.color}55);">${e.art}</span>
        <span class="evh-name">${e.tab}</span>${dot}
      </button>`;
    }).join('');

    // 右侧面板主体（按类型）
    let body = '';
    if (ev.type === 'battle') body = this.renderEventBattle();
    else if (ev.type === 'task') body = this._evTaskBody(ev);
    else if (ev.type === 'login') body = this._evLoginBody(ev);
    else if (ev.type === 'draw') body = this._evDrawBody(ev);
    else if (ev.type === 'bingo') body = this._evBingoBody(ev);

    this.screenEl.innerHTML = `
      <div class="event-hub">
        <div class="evh-list">${listHtml}</div>
        <div class="evh-panel" style="--ev-color:${ev.color};">
          <div class="evh-head" style="background:linear-gradient(120deg, ${ev.color}cc, ${ev.color}33);">
            <div class="evh-head-art">${ev.art}</div>
            <div class="evh-head-txt">
              <div class="evh-head-sub">${ev.sub}</div>
              <div class="evh-head-title">${ev.title}</div>
              <div class="evh-head-cd">⏱ 活动 还剩 ${ev.cd} 天</div>
            </div>
          </div>
          <div class="evh-body">${body}</div>
        </div>
      </div>`;

    this.screenEl.querySelectorAll('[data-ev-sel]').forEach(b => b.onclick = () => { this.eventSel = b.dataset.evSel; this.renderEvent(); });
    if (ev.type === 'battle') this.bindEventBattle();
    else if (ev.type === 'task') this._bindEvTask(ev);
    else if (ev.type === 'login') this._bindEvLogin(ev);
    else if (ev.type === 'draw') this._bindEvDraw(ev);
    else if (ev.type === 'bingo') this._bindEvBingo(ev);
  },

  // ---- 任务型 ----
  _evTaskBody(ev) {
    const list = Game.eventTaskList(ev);
    const rows = list.map(t => {
      const rw = this._rwLabel(t.reward);
      const btn = t.claimed ? '<span class="ac-circle claimed">✓</span>'
        : (t.done ? `<button class="ac-circle ready" data-evtask="${t.id}">🤲</button>` : '<span class="ac-circle lock">🤲</span>');
      return `<div class="ac-row ${t.claimed ? '' : (t.done ? 'ready' : 'todo')}">
        <div class="evt-rw"><span class="evt-rw-ic">🎟️</span><span class="evt-rw-amt">${rw}</span></div>
        <div class="ac-mid"><div class="ac-name">${t.name} <span class="ac-prog">${t.cur} / ${t.target}</span></div>
          <div class="ac-desc">${t.desc}</div></div>
        ${btn}
      </div>`;
    }).join('');
    return `<div class="ac-list">${rows}</div>
      <div class="ac-foot"><button class="btn ${Game.eventHubClaimable(ev) ? 'gold' : 'secondary'}" id="evt-all" ${Game.eventHubClaimable(ev) ? '' : 'disabled'}>全部领取</button></div>`;
  },
  _bindEvTask(ev) {
    this.screenEl.querySelectorAll('[data-evtask]').forEach(b => b.onclick = () => {
      const r = Game.claimEventTask(ev, b.dataset.evtask);
      if (!r.ok) { this.toast(r.msg || '不可领取'); return; }
      this.toast('领取：' + this._rwLabel(r.reward)); this.updateResources(); this.renderEvent();
    });
    const all = this.screenEl.querySelector('#evt-all');
    if (all) all.onclick = () => { const r = Game.claimAllEventTasks(ev); if (!r.ok) { this.toast('没有可领取'); return; } this.toast(`领取 ${r.n} 项`); this.updateResources(); this.renderEvent(); };
  },

  // ---- 登录型 ----
  _evLoginBody(ev) {
    const claimed = Game.eventLoginClaimed(ev);
    const canToday = Game.eventLoginCanClaim(ev);
    const cells = ev.days.map((d, i) => {
      const got = i < claimed;
      const isNext = i === claimed && canToday;
      return `<div class="evl-cell ${got ? 'got' : ''} ${isNext ? 'next' : ''}">
        <div class="evl-day">第${i + 1}天</div>
        <div class="evl-rw">${this._rwLabel(d)}</div>
        ${got ? '<div class="evl-tick">✓</div>' : ''}
      </div>`;
    }).join('');
    return `<div class="evl-grid">${cells}</div>
      <div class="ac-foot"><button class="btn ${canToday ? 'gold' : 'secondary'}" id="evl-claim" ${canToday ? '' : 'disabled'}>${canToday ? '签到领取' : (claimed >= ev.days.length ? '已领完' : '明日再来')}</button></div>`;
  },
  _bindEvLogin(ev) {
    const b = this.screenEl.querySelector('#evl-claim');
    if (b) b.onclick = () => { const r = Game.claimEventLogin(ev); if (!r.ok) { this.toast(r.msg); return; } this.toast(`第${r.day}天签到：${this._rwLabel(r.reward)}`); this.updateResources(); this.renderEvent(); };
  },

  // ---- 抽抽乐 ----
  _evDrawBody(ev) {
    const pool = Game.eventDrawPool(ev);
    const cells = pool.map(p => `<div class="evd-prize ${p.left <= 0 ? 'empty' : ''}">
        <div class="evd-prize-left">还剩 ${p.left} 个</div>
        <div class="evd-prize-ico">${p.icon}</div>
        <div class="evd-prize-name">${p.name}</div>
      </div>`).join('');
    return `<div class="evd-pool">${cells}</div>
      <div class="evd-bar">
        <button class="btn secondary" id="evd-buy">购买抽抽乐券 💎100</button>
        <button class="btn gold" id="evd-draw">抽抽乐 🎟️${Game.drawTickets()}</button>
      </div>`;
  },
  _bindEvDraw(ev) {
    const buy = this.screenEl.querySelector('#evd-buy');
    if (buy) buy.onclick = () => { const r = Game.buyDrawTicket(); if (!r.ok) { this.toast(r.msg); return; } this.toast('购买成功 +1 券'); this.updateResources(); this.renderEvent(); };
    const draw = this.screenEl.querySelector('#evd-draw');
    if (draw) draw.onclick = () => {
      const r = Game.doEventDraw(ev);
      if (!r.ok) { this.toast(r.msg); return; }
      if (window.Sound) Sound.sfx('levelup');
      this.toast(`抽中：${r.prize.icon} ${r.prize.name}`); this.updateResources(); this.renderEvent();
    };
  },

  // ---- 宾果 ----
  _evBingoBody(ev) {
    const rev = new Set(Game.bingoRevealed(ev));
    const cells = ev.cells.map((c, i) => rev.has(i)
      ? `<div class="evb-cell got">✓<span class="evb-cell-rw">${this._rwLabel(c)}</span></div>`
      : `<button class="evb-cell" data-bingo="${i}">?</button>`).join('');
    const lines = Game.bingoLinesCleared(ev);
    const lineRw = ev.lineRewards.map((r, i) => `<div class="evb-line ${i < lines ? 'done' : ''}">${i + 1}线<br>${this._rwLabel(r)}</div>`).join('');
    return `<div class="evb-wrap">
        <div class="evb-board">${cells}</div>
        <div class="evb-side">
          <div class="evb-coin">🎟️ ${Game.state.event.coin}</div>
          <div class="evb-lines">${lineRw}</div>
          <div class="muted" style="font-size:11px;">每格消耗 🎟️${Game.REVEAL_COST}，连成一线得额外奖励</div>
        </div>
      </div>`;
  },
  _bindEvBingo(ev) {
    this.screenEl.querySelectorAll('[data-bingo]').forEach(b => b.onclick = () => {
      const r = Game.revealBingoCell(ev, parseInt(b.dataset.bingo, 10));
      if (!r.ok) { this.toast(r.msg); return; }
      let msg = '翻开：' + this._rwLabel(r.cell);
      if (r.lineReward) msg += ` · 连线奖励 ${this._rwLabel(r.lineReward)}`;
      this.toast(msg); this.updateResources(); this.renderEvent();
    });
  },

  renderEventBattle() {
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
    return `
      <div class="eb-coin" style="margin-bottom:10px;">🎟️ 活动币：<b>${coin}</b></div>
      <div class="section-title" style="font-size:14px;">活动关卡</div>
      <div class="farm-list">${stageCards}</div>
      <div class="section-title" style="font-size:14px;margin-top:14px;">活动商店</div>
      <div class="ev-shop">${shopCards}</div>`;
  },
  bindEventBattle() {
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
  //  游戏卡珍藏集（出战）—— 四大类卡带货架（对照 BD2）
  // ============================================================
  renderGameCards() {
    const cats = Game.gameCardCats();
    const cart = (c) => {
      const lock = !c.owned;
      const badge = c.tag ? c.tag : ('VOL.' + (c.vol || 1));
      return `<button class="gcard ${lock ? 'locked' : ''} ${c.done ? 'done' : ''}"
        ${lock ? '' : `data-go="${c.go || ''}" data-side="${c.side || ''}" data-evsel="${c.evSel || ''}"`}>
        <span class="gcard-badge">${badge}</span>
        <span class="gcard-art">${lock ? '🔒' : c.icon}</span>
        <span class="gcard-strip">${lock ? '？？？' : c.name}</span>
        ${c.done ? '<span class="gcard-clear">✓</span>' : (lock ? '' : '<span class="gcard-plus">＋</span>')}
      </button>`;
    };
    const rows = cats.map(cat => `
      <div class="gc-row">
        <div class="gc-rowhead">
          <span class="gc-rowname">${cat.name} <b>${cat.owned}/${cat.total}</b></span>
          <span class="gc-rowsub muted">${cat.sub}</span>
        </div>
        <div class="gc-shelf">${cat.cards.map(cart).join('')}</div>
      </div>`).join('');
    this.screenEl.innerHTML = `<div class="gamecard-coll">
      <div class="gc-head">🎮 游戏卡珍藏集 <span class="muted" style="font-size:12px;font-weight:400;">· 选择游戏卡开始游玩</span></div>
      ${rows}</div>`;
    this.screenEl.querySelectorAll('.gcard:not(.locked)').forEach(el => el.onclick = () => {
      const evsel = el.dataset.evsel, go = el.dataset.go, side = el.dataset.side;
      if (evsel) { this.eventSel = evsel; Main.switchScreen('event'); return; }
      if (side) { if (window.Story) Story.play(side); return; }
      if (go) { Main.switchScreen(go); return; }
    });
  },

  // ============================================================
  //  玩法卡 · 混战（无尽波次生存）
  // ============================================================
  renderMayhem() {
    const best = Game.mayhemBest();
    const preview = [1, 5, 10, 15].map(w => {
      const r = Game.mayhemWaveReward(w);
      const boss = w % 5 === 0;
      return `<div class="mh-prev ${boss ? 'boss' : ''}"><span class="mh-prev-w">第 ${w} 波${boss ? ' 👑' : ''}</span><span class="mh-prev-rw">🪙${r.gold}${r.gem ? ' 💎' + r.gem : ''}</span></div>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="section-title">混战 · 无尽波次 <span class="muted" style="font-weight:400;font-size:11px;">· 越往后敌人越强，每 5 波出现 BOSS</span></div>
      <div class="mayhem-card">
        <div class="mh-best">🏆 历史最高波数 <b>${best}</b></div>
        <p class="muted" style="font-size:12px;line-height:1.6;">连续挑战波次，胜利自动进入下一波，队伍每波满血再战；越深奖励越高。中途可结算离场，失败则本轮结束。</p>
        <div class="mh-prev-list">${preview}</div>
        <div class="mh-actions">
          <button class="btn gold" id="mh-start">从第 1 波开始</button>
          ${best > 0 ? `<button class="btn" id="mh-resume">从第 ${best + 1} 波冲榜</button>` : ''}
        </div>
      </div>`;
    const st = this.screenEl.querySelector('#mh-start');
    if (st) st.onclick = () => this.startMayhemWave(1);
    const rs = this.screenEl.querySelector('#mh-resume');
    if (rs) rs.onclick = () => this.startMayhemWave(best + 1);
  },
  startMayhemWave(wave) {
    if (!Game.state.team.length) { this.toast('请先编队'); return; }
    const stage = {
      id: 'mayhem_' + wave, name: '混战 · 第 ' + wave + ' 波', mayhem: true, wave,
      enemies: Game.mayhemEnemies(wave), reward: { gold: 0, gem: 0, exp: 0 }, isBoss: wave % 5 === 0,
    };
    BattleUI.start(stage, () => { if (Main.current === 'mayhem') this.renderMayhem(); });
  },

  // ============================================================
  //  玩法卡 · 经营（格鲁菲餐厅，挂机产出营业额）
  // ============================================================
  renderRestaurant() {
    const r = Game.state.restaurant;
    const rate = Game.restaurantRate();
    const pending = Game.restaurantPending();
    const full = Game.restaurantFull();
    const cost = Game.restaurantUpgradeCost();
    const slots = (r.staff || [null, null, null]).map((uid, i) => {
      const o = uid && Game.getOwned(uid);
      const c = o && window.GameData.CHARACTERS[o.charId];
      return o
        ? `<button class="rst-slot filled" data-staff="${i}"><span class="rst-staff-art">${this.charAvatar(o.charId)}</span><span class="rst-staff-name">${c.name}</span></button>`
        : `<button class="rst-slot empty" data-staff="${i}"><span class="rst-staff-art">＋</span><span class="rst-staff-name muted">空缺</span></button>`;
    }).join('');
    this.screenEl.innerHTML = `
      <div class="section-title">格鲁菲餐厅 <span class="muted" style="font-weight:400;font-size:11px;">· 安排员工挂机经营，结算营业额（金币）</span></div>
      <div class="rst-card">
        <div class="rst-top">
          <div class="rst-shop">🍴</div>
          <div class="rst-info">
            <div class="rst-lv">餐厅 Lv.${r.level || 1}</div>
            <div class="rst-rate muted">营业额速率 🪙${rate}/小时 · 满仓 ${Game.RESTAURANT.capHours} 小时</div>
          </div>
        </div>
        <div class="rst-pending">
          <div class="rst-pend-num">🪙 ${pending}</div>
          <div class="muted" style="font-size:11px;">${full ? '已满仓，快来结算！' : '营业额累积中…'}</div>
        </div>
        <button class="btn ${pending > 0 ? 'gold' : 'secondary'}" id="rst-claim" ${pending > 0 ? '' : 'disabled'} style="width:100%;">结算营业额</button>
        <div class="rst-staff-title">员工配置 <span class="muted" style="font-size:11px;font-weight:400;">· 每名在岗员工 +35% 速率</span></div>
        <div class="rst-slots">${slots}</div>
        <button class="btn ${Game.state.gold >= cost ? '' : 'secondary'}" id="rst-up" ${Game.state.gold >= cost ? '' : 'disabled'} style="width:100%;margin-top:10px;">升级餐厅 · 🪙${cost}</button>
      </div>`;
    const cl = this.screenEl.querySelector('#rst-claim');
    if (cl) cl.onclick = () => { const res = Game.claimRestaurant(); if (!res.ok) { this.toast(res.msg); return; } if (window.Sound) Sound.sfx('levelup'); this.toast(`结算营业额 🪙${res.gold}`); this.updateResources(); this.renderRestaurant(); };
    const up = this.screenEl.querySelector('#rst-up');
    if (up) up.onclick = () => { const res = Game.upgradeRestaurant(); if (!res.ok) { this.toast(res.msg); return; } this.toast(`餐厅升级至 Lv.${res.level}`); this.updateResources(); this.renderRestaurant(); };
    this.screenEl.querySelectorAll('[data-staff]').forEach(b => b.onclick = () => this.showRestaurantStaffPicker(parseInt(b.dataset.staff, 10)));
  },
  showRestaurantStaffPicker(slot) {
    const r = Game.state.restaurant;
    const onDuty = new Set((r.staff || []).filter(Boolean));
    const list = Game.state.roster.map(o => {
      const c = window.GameData.CHARACTERS[o.charId];
      const here = onDuty.has(o.uid);
      return `<button class="rst-pick ${here ? 'on' : ''}" data-uid="${o.uid}">
        <span class="rst-pick-art">${this.charAvatar(o.charId)}</span>
        <span class="rst-pick-name">${c.name}</span>${here ? '<span class="rst-pick-tag">在岗</span>' : ''}</button>`;
    }).join('');
    const m = this.openModal(`<h2>安排员工 · 第 ${slot + 1} 岗</h2>
      <div class="rst-pick-grid">${list}</div>
      <div class="close-row"><button class="btn secondary" id="rst-clear">清空该岗</button><button class="btn" id="rst-cancel">关闭</button></div>`, { wide: true });
    m.querySelectorAll('[data-uid]').forEach(b => b.onclick = () => { Game.assignRestaurantStaff(slot, b.dataset.uid); this.closeModal(m); this.updateResources(); this.renderRestaurant(); });
    m.querySelector('#rst-clear').onclick = () => { Game.assignRestaurantStaff(slot, null); this.closeModal(m); this.renderRestaurant(); };
    m.querySelector('#rst-cancel').onclick = () => this.closeModal(m);
  },

  // ============================================================
  //  背包（装备一览）
  // ============================================================
  renderInventory() {
    const s = Game.state;
    this.invTab = this.invTab || 'gear';
    const lead = s.team[0] && Game.getOwned(s.team[0]);
    const leadAvatar = lead ? this.charAvatar(lead.charId) : '🎒';
    const leadColor = lead ? Game.activeColor(lead) : '#b06bff';
    const dots = r => `<div class="bag-rdots ${this.rarityClass(r)}">${'◆'.repeat(r)}</div>`;
    const fmt = n => n >= 100000 ? (n / 1000 | 0) + 'k' : (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : n);

    let cells, count, capLabel;
    if (this.invTab === 'gear') {
      const equipped = new Set();
      s.roster.forEach(o => Object.values(o.equip || {}).forEach(iid => iid && equipped.add(iid)));
      const items = s.inventory.slice().sort((a, b) => { const ta = Game.getGearTpl(a.tpl), tb = Game.getGearTpl(b.tpl); return tb.rarity - ta.rarity || (b.lvl || 0) - (a.lvl || 0); });
      count = items.length;
      capLabel = `${count}/200`;
      cells = items.length ? items.map(g => {
        const tpl = Game.getGearTpl(g.tpl); const eq = equipped.has(g.iid);
        return `<div class="bag-cell clickable border-${this.rarityClass(tpl.rarity)}" data-iid="${g.iid}" title="${tpl.name}${eq ? '（已装备）' : ''}">
          ${dots(tpl.rarity)}
          <div class="bag-ico">${tpl.icon}</div>
          ${g.lvl ? `<span class="bag-lv">+${g.lvl}</span>` : ''}
          ${eq ? '<span class="bag-eq">装</span>' : ''}
        </div>`;
      }).join('') : '<div class="muted bag-empty">背包没有装备，去锻造或副本获取吧</div>';
    } else {
      const mats = [
        { icon: '🪙', name: '金币', qty: s.gold, r: 3 },
        { icon: '💎', name: '宝石', qty: s.gem, r: 5 },
        { icon: I('awaken'), name: '觉醒石', qty: s.awakenStone || 0, r: 4 },
        { icon: I('star_spark'), name: '闪耀之星', qty: s.spark || 0, r: 5 },
        { icon: I('hope_powder'), name: '希望之粉', qty: s.powder || 0, r: 4 },
        { icon: I('ticket'), name: '活动币', qty: (s.event && s.event.coin) || 0, r: 4 },
        { icon: I('stamina_potion'), name: '体力', qty: s.stamina, r: 3 },
      ];
      count = mats.length; capLabel = '材料';
      cells = mats.map(m => `<div class="bag-cell clickable border-${this.rarityClass(m.r)} mat" data-mat="${m.name}" title="${m.name}">
        ${dots(m.r)}<div class="bag-ico">${m.icon}</div><span class="bag-qty">${fmt(m.qty)}</span><div class="bag-cell-name">${m.name}</div>
      </div>`).join('');
    }

    this.screenEl.innerHTML = `
      <div class="bag2">
        <div class="bag-top">
          <div class="bag-tabs">
            <button class="bag-tab ${this.invTab === 'gear' ? 'on' : ''}" data-bag="gear">⚔️ 装备</button>
            <button class="bag-tab ${this.invTab === 'material' ? 'on' : ''}" data-bag="material">🧪 材料</button>
          </div>
          <div class="bag-count muted">${capLabel}</div>
        </div>
        <div class="bag-body">
          <div class="bag-left">
            <div class="bag-char border-r5" style="background:linear-gradient(180deg, ${leadColor}66 0%, ${leadColor}22 45%, var(--bg) 90%);">
              <div class="bag-char-avatar">${leadAvatar}</div>
            </div>
          </div>
          <div class="bag-grid">${cells}</div>
        </div>
        <div class="bag-actions">
          <button class="btn secondary sm" id="bag-forge">🔨 锻造</button>
          ${this.invTab === 'gear' ? '<button class="btn sm" id="bag-dismantle">一键分解 R/SR</button>' : ''}
        </div>
      </div>`;

    this.screenEl.querySelectorAll('[data-bag]').forEach(b => b.onclick = () => { this.invTab = b.dataset.bag; this.renderInventory(); });
    this.screenEl.querySelector('#bag-forge').onclick = () => this.showForge();
    const dis = this.screenEl.querySelector('#bag-dismantle');
    if (dis) dis.onclick = () => {
      const r = Game.dismantleGear();
      this.toast(r.n ? `分解 ${r.n} 件，获得 🪙${r.gold}` : '没有可分解的 R/SR 装备');
      this.updateResources(); this.renderInventory();
    };
    // 点击物品 → 详情
    this.screenEl.querySelectorAll('.bag-cell[data-iid]').forEach(c => c.onclick = () => this.showGearDetail(c.dataset.iid));
    this.screenEl.querySelectorAll('.bag-cell[data-mat]').forEach(c => c.onclick = () => this.showMaterialDetail(c.dataset.mat));
  },

  STAT_LAB: {
    atk: '<img class="px-ico-in" src="art/05_pixellab/ui/icons/atk.png"> 攻击',
    def: '<img class="px-ico-in" src="art/05_pixellab/ui/icons/def.png"> 防御',
    hp:  '<img class="px-ico-in" src="art/05_pixellab/ui/icons/hp.png"> 生命',
    crit:'<img class="px-ico-in" src="art/05_pixellab/ui/icons/crit.png"> 暴击',
    spd: '<img class="px-ico-in" src="art/05_pixellab/ui/icons/spd.png"> 速度' },
  fmtStat(k, v) { return k === 'crit' ? '+' + (v * 100).toFixed(1) + '%' : '+' + Math.round(v); },

  /** 装备详情（点击背包装备格） */
  showGearDetail(iid) {
    const render = (m) => {
      const inst = Game.getGearInst(iid);
      if (!inst) { this.closeModal(m); return; }
      const tpl = Game.getGearTpl(inst.tpl);
      const em = Game.enhanceMult(inst.lvl);
      const typeLab = { weapon: '武器', armor: '防具', accessory: '饰品', ex: '专属武器' }[tpl.type] || '装备';
      const mainHtml = Object.entries(tpl.stats).map(([k, v]) =>
        `<div class="gd-stat"><span>${this.STAT_LAB[k] || k}</span><b>${this.fmtStat(k, v * em)}</b></div>`).join('');
      const subHtml = (inst.subs || []).length
        ? inst.subs.map(sub => `<div class="gd-stat sub"><span>${this.STAT_LAB[sub.k] || sub.k}</span><b>${this.fmtStat(sub.k, sub.v)}</b></div>`).join('')
        : '<div class="muted" style="font-size:11px;padding:4px 0;">该装备无副词条</div>';
      const owner = Game.gearEquippedBy(iid);
      const ownerName = owner ? window.GameData.CHARACTERS[owner.charId].name : null;
      const lvl = inst.lvl || 0, max = Game.GEAR_MAX_LVL;
      const cost = Game.enhanceCost(inst);
      const canEnh = lvl < max && Game.state.gold >= cost;
      m.querySelector('.gd-body').innerHTML = `
        <div class="gd-head">
          <div class="gd-art border-${this.rarityClass(tpl.rarity)}"><span class="gd-ico">${tpl.icon}</span></div>
          <div class="gd-title">
            <div class="gd-name">${tpl.name} ${lvl ? `<span style="color:var(--gold);">+${lvl}</span>` : ''}</div>
            <div class="gd-meta"><span class="rw ${this.rarityClass(tpl.rarity)}" style="font-size:10px;padding:1px 6px;">${window.GameData.GEAR.RLABEL[tpl.rarity]}</span> · ${typeLab}${ownerName ? ` · <span style="color:var(--accent);">${ownerName} 装备中</span>` : ' · 未装备'}</div>
          </div>
        </div>
        <div class="gd-section">主属性（含强化 +${Math.round((em - 1) * 100)}%）</div>
        <div class="gd-stats">${mainHtml}</div>
        <div class="gd-section">副词条（${(inst.subs || []).length}）</div>
        <div class="gd-stats">${subHtml}</div>
        <p class="muted" style="font-size:11px;margin-top:8px;">${tpl.type === 'ex' ? '专属武器：仅对应角色可装备，效果远强于通用装备。' : '通用装备：在「佣兵→详情养成」中为角色装备；三件同稀有度触发套装加成。'}</p>`;
      const eb = m.querySelector('#gd-enhance');
      eb.textContent = lvl >= max ? '已满强化' : `强化 +${lvl + 1}　🪙${cost}`;
      eb.disabled = !canEnh;
      eb.onclick = () => {
        const r = Game.enhanceGear(iid);
        if (!r.ok) { this.toast(r.msg); return; }
        if (window.Sound) Sound.sfx('levelup');
        this.toast(`强化成功 → +${r.lvl}`); this.updateResources(); render(m);
      };
    };
    const m = this.openModal(`<h2>装备详情</h2><div class="gd-body"></div>
      <div class="close-row"><button class="btn secondary" id="gd-close">关闭</button><button class="btn gold" id="gd-enhance">强化</button></div>`);
    render(m);
    m.querySelector('#gd-close').onclick = () => { this.closeModal(m); this.renderInventory(); };
  },

  /** 服装详情（招募卡池 / 结果点击）——只读展示属性 + 专属招式，不需已拥有 */
  showCostumeDetail(costumeId) {
    const cos = window.GameData.COSTUMES[costumeId];
    if (!cos) return;
    const SK = window.GameData.SKILLS;
    const sig = SK[cos.signature];
    const cls = window.GameData.CLASSES[cos.cls] || { name: cos.cls, icon: '' };
    const el = window.GameData.ELEMENTS[cos.element] || { name: '', icon: '' };
    const owned = Game.state.roster.find(o => o.charId === cos.charId);
    const has = owned && Game.ownedCostumeIds(owned).includes(costumeId);
    const g = cos.grow || {};
    const s60 = { hp: Math.round(cos.stats.hp + (g.hp || 0) * 59), atk: Math.round(cos.stats.atk + (g.atk || 0) * 59),
                  def: Math.round(cos.stats.def + (g.def || 0) * 59), spd: cos.stats.spd, crit: cos.stats.crit };
    const statRow = (k, v1, v60) => `<div class="gd-stat"><span>${this.STAT_LAB[k] || k}</span><b>${k === 'crit' ? (v1 * 100).toFixed(0) + '%' : Math.round(v1)}${v60 != null ? ` <span class="muted" style="font-weight:600;">→ Lv60 ${k === 'crit' ? (v60 * 100).toFixed(0) + '%' : Math.round(v60)}</span>` : ''}</b></div>`;
    const tgtLab = { enemySingle: '单体', enemyRow: '一排', enemyAll: '全体敌', allySingle: '单友', allyAll: '全体友', self: '自身' }[sig && sig.target] || '';
    const m = this.openModal(`<h2>服装详情</h2><div class="gd-body">
      <div class="gd-head">
        <div class="gd-art border-${this.rarityClass(cos.rarity)}" style="background:radial-gradient(circle at 50% 35%, ${cos.color}55, transparent);">${this.charAvatar(cos.charId, costumeId)}</div>
        <div class="gd-title">
          <div class="gd-name">${cos.name}</div>
          <div class="gd-meta"><span class="rw ${this.rarityClass(cos.rarity)}" style="font-size:10px;padding:1px 6px;">${cos.rarity}★</span> · ${el.icon}${el.name} · ${cls.icon}${cls.name}${has ? ' · <span style="color:var(--accent);">已拥有</span>' : ''}</div>
        </div>
      </div>
      <div class="gd-section">属性（Lv1 → 满级）</div>
      <div class="gd-stats">
        ${statRow('hp', cos.stats.hp, s60.hp)}${statRow('atk', cos.stats.atk, s60.atk)}${statRow('def', cos.stats.def, s60.def)}
        ${statRow('spd', cos.stats.spd)}${statRow('crit', cos.stats.crit)}
      </div>
      <div class="gd-section">专属招式</div>
      ${sig ? `<div class="cd-skill"><div class="cd-skill-head">${sig.icon || '✨'} <b>${sig.name}</b> <span class="muted">SP${sig.sp || 0} · ${tgtLab}</span></div><div class="cd-skill-desc">${sig.desc || ''}</div></div>` : '<div class="muted">—</div>'}
      <p class="muted" style="font-size:11px;margin-top:8px;">${cos.desc || ''}</p>
      <p class="muted" style="font-size:11px;">抽到服装即解锁该角色；重复获得提升突破等级（最高 +5，每级 +8% 基础属性）。</p>
    </div><div class="close-row"><button class="btn" id="cd-close">关闭</button></div>`);
    m.querySelector('#cd-close').onclick = () => this.closeModal(m);
  },

  /** 装备模板详情（招募卡池 / 未拥有）——只读展示，不需实例 */
  showGearTplDetail(tplId) {
    const tpl = Game.getGearTpl(tplId);
    if (!tpl) return;
    const typeLab = { weapon: '武器', armor: '防具', accessory: '饰品', ex: '专属武器' }[tpl.type] || '装备';
    const ownerName = tpl.owner ? (window.GameData.CHARACTERS[tpl.owner] || {}).name : null;
    const mainHtml = Object.entries(tpl.stats).map(([k, v]) =>
      `<div class="gd-stat"><span>${this.STAT_LAB[k] || k}</span><b>${this.fmtStat(k, v)}</b></div>`).join('');
    const m = this.openModal(`<h2>装备详情</h2><div class="gd-body">
      <div class="gd-head">
        <div class="gd-art border-${this.rarityClass(tpl.rarity)}"><span class="gd-ico">${tpl.icon}</span></div>
        <div class="gd-title">
          <div class="gd-name">${tpl.name}</div>
          <div class="gd-meta"><span class="rw ${this.rarityClass(tpl.rarity)}" style="font-size:10px;padding:1px 6px;">${window.GameData.GEAR.RLABEL[tpl.rarity]}</span> · ${typeLab}${ownerName ? ` · 专属：${ownerName}` : ''}</div>
        </div>
      </div>
      <div class="gd-section">基础属性</div>
      <div class="gd-stats">${mainHtml}</div>
      <p class="muted" style="font-size:11px;margin-top:8px;">${tpl.desc || (tpl.type === 'ex' ? '专属武器：仅对应角色可装备，效果远强于通用装备。' : '通用装备：可强化、可触发三件套加成。')}</p>
    </div><div class="close-row"><button class="btn" id="gtd-close">关闭</button></div>`);
    m.querySelector('#gtd-close').onclick = () => this.closeModal(m);
  },

  MAT_DESC: {
    '金币': { icon: '🪙', desc: '最基础的货币。用于佣兵升级、装备强化、商店购买、阵容养成。', from: '关卡 / 资源副本 / 远征 / 分解装备' },
    '宝石': { icon: '💎', desc: '高级货币。用于招募、购买体力、商店兑换。', from: '通关 / 成就 / 任务 / 活动' },
    '觉醒石': { icon: '🔮', desc: '角色觉醒材料。在「佣兵→详情养成」中消耗，提升全属性（最高 5 星觉醒）。', from: '竞技场胜利 / 秘境远征 / 活动商店' },
    '闪耀之星': { icon: '⭐', desc: '招募里程碑货币。每次招募 +1，集满 200 可自选一套 5★ 服装。', from: '招募' },
    '希望之粉': { icon: '✨', desc: '保底货币。每次招募 +10，集满 200 在商店兑换「必出 5★」。', from: '招募' },
    '活动币': { icon: '🎟️', desc: '限时活动专用货币，在活动商店兑换稀有资源。', from: '限时活动关卡' },
    '体力': { icon: '⚡', desc: '资源副本的行动力，每 5 分钟回复 1 点，上限 120，可用宝石购买。', from: '随时间回复 / 宝石购买' },
  },
  /** 材料详情（点击背包材料格） */
  showMaterialDetail(name) {
    const d = this.MAT_DESC[name]; if (!d) return;
    const m = this.openModal(`
      <div class="gd-head">
        <div class="gd-art border-r5"><span class="gd-ico">${d.icon}</span></div>
        <div class="gd-title"><div class="gd-name">${name}</div><div class="gd-meta muted">材料 · 道具</div></div>
      </div>
      <p style="line-height:1.7;font-size:13px;margin:10px 0;">${d.desc}</p>
      <div class="gd-section">获取途径</div>
      <p class="muted" style="font-size:12px;">${d.from}</p>
      <div class="close-row"><button class="btn" id="md-ok">关闭</button></div>`);
    m.querySelector('#md-ok').onclick = () => this.closeModal(m);
  },

  // ============================================================
  //  图鉴（角色档案：已拥有 + 未解锁）
  // ============================================================
  // ============================================================
  //  珍藏集（Collection）—— 多门类收集进度 + 全队增益（对照 BD2 珍藏集）
  // ============================================================
  renderCollection() {
    const cats = Game.collectionCats();
    const b = Game.collectionBonus();
    // 左侧立绘：取战力最高的已拥有角色
    const C = window.GameData.CHARACTERS, CL = window.GameData.CLASSES;
    let lead = null;
    Game.state.roster.forEach(o => {
      const p = (C[o.charId].rarity * 1000) + o.level + (o.awaken || 0) * 50;
      if (!lead || p > lead._p) lead = Object.assign({ _p: p }, o);
    });
    const lc = lead && C[lead.charId];
    const lcos = lead && Game.activeCostumeDef(lead);
    const splash = lead
      ? `<div class="col-splash border-${this.rarityClass(lc.rarity)}" style="background:linear-gradient(180deg, ${lcos.color}66 0%, ${lcos.color}22 50%, var(--bg) 92%);">
          <div class="col-splash-avatar">${this.charAvatar(lead.charId)}</div>
          <div class="col-splash-info">
            <div class="col-splash-name">${lc.name}</div>
            <div class="col-splash-meta">${lc.title} · ${CL[lc.cls].icon}${CL[lc.cls].name}</div>
          </div>
        </div>`
      : `<div class="col-splash empty"><div class="muted">📖 珍藏室</div></div>`;

    const catCard = (c) => {
      const pct = Math.round(c.pct * 100);
      const done = c.pct >= 1;
      return `<button class="col-cat ${done ? 'done' : ''}" data-cat="${c.id}">
        <span class="col-cat-ico">${c.icon}</span>
        <span class="col-cat-name">${c.name}</span>
        <span class="col-cat-pct">${done ? '<b>MAX</b>' : pct + '%'}</span>
        <span class="col-cat-bar"><span style="width:${pct}%;"></span></span>
      </button>`;
    };

    this.screenEl.innerHTML = `
      <div class="collection">
        <div class="col-left">${splash}</div>
        <div class="col-right">
          <div class="col-head">
            <div class="col-head-title">🏛️ 珍藏集增益 <span class="col-q" title="收集藏品可永久提升全队属性">ⓘ</span></div>
            <div class="col-head-bonus">
              ${b.max ? '<span class="col-bn max">⚔ MAX</span>' : ''}
              <span class="col-bn">全属性 +${b.bonusPct.toFixed(1)}%</span>
              <span class="col-bn alt">总收集 ${b.overallPct.toFixed(1)}%</span>
            </div>
          </div>
          <div class="col-grid">${cats.map(catCard).join('')}</div>
        </div>
      </div>`;
    this.screenEl.querySelectorAll('[data-cat]').forEach(b =>
      b.onclick = () => this.showCollectionCat(b.dataset.cat));
  },

  /** 某门类的藏品清单弹窗 */
  showCollectionCat(catId) {
    const cats = Game.collectionCats();
    const cat = cats.find(c => c.id === catId);
    if (!cat) return;
    const cells = cat.items.map((it, i) => it.owned
      ? `<div class="col-item owned" ${catId === 'char' ? `data-ci="${i}"` : ''}>
          <span class="ci-ico">${it.icon}</span><span class="ci-name">${it.name}</span></div>`
      : `<div class="col-item locked"><span class="ci-ico">🔒</span><span class="ci-name muted">？？？</span></div>`
    ).join('');
    const m = this.openModal(`
      <div class="gd-head"><div class="gd-art border-r5"><span class="gd-ico">${cat.icon}</span></div>
        <div class="gd-title"><div class="gd-name">${cat.name}</div>
          <div class="gd-meta muted">已收集 ${cat.owned}/${cat.total} · ${Math.round(cat.pct * 100)}%</div></div></div>
      <div class="col-item-grid">${cells}</div>
      <div class="close-row"><button class="btn" id="cc-ok">关闭</button></div>`, { wide: true });
    m.querySelector('#cc-ok').onclick = () => this.closeModal(m);
    // 角色门类：点击已拥有角色查看详情
    if (catId === 'char') {
      const ownedChars = Game.state.roster;
      m.querySelectorAll('[data-ci]').forEach(el => {
        const idx = parseInt(el.dataset.ci, 10);
        const charIds = Object.keys(window.GameData.CHARACTERS);
        const cid = charIds[idx];
        const o = ownedChars.find(x => x.charId === cid);
        if (o) el.onclick = () => { this.closeModal(m); this.showCharDetail(o.uid); };
      });
    }
  },

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
  // ============================================================
  //  商店中心（Hub）—— 左侧分类 + 商人立绘 + 商品网格（对照 BD2）
  // ============================================================
  renderShop() {
    Game.ensureDaily();
    const hub = Game.SHOP_HUB;
    this.shopSel = this.shopSel && hub.find(c => c.id === this.shopSel) ? this.shopSel : hub[0].id;
    const cat = Game.getShopCat(this.shopSel);
    const s = Game.state;

    const sideHtml = hub.map(c =>
      `<button class="sp-cat ${c.id === this.shopSel ? 'on' : ''}" data-shopcat="${c.id}">
        <span class="sp-cat-ico">${c.icon}</span><span class="sp-cat-name">${c.name}</span>
      </button>`).join('');

    // 顶部货币（该分类使用的货币 + 通用）
    const curBar = `<span class="sp-cur">${Game.CUR_ICON[cat.cur]} ${Game.curBalance(cat.cur)}</span>`;

    // 商品卡
    const card = (inner) => `<div class="sp-card">${inner}</div>`;
    let cardsHtml = '';
    // 金币商店：先放每日随机装备
    if (cat.daily) {
      cardsHtml += s.shop.slots.map((slot, i) => {
        const tpl = Game.getGearTpl(slot.tpl);
        const sold = s.shop.bought[i];
        return card(`<div class="sp-qty">×1</div>
          <div class="sp-ico border-${this.rarityClass(tpl.rarity)}">${tpl.icon}</div>
          <div class="sp-name">${tpl.name}</div>
          <div class="sp-lim muted">每日刷新</div>
          <button class="sp-price ${sold ? 'sold' : ''}" data-buygear="${i}" ${sold || s.gold < slot.price ? 'disabled' : ''}>
            ${sold ? '已售出' : `🪙 ${slot.price}`}</button>`);
      }).join('');
    }
    // 通用商品
    cardsHtml += cat.items.map(it => {
      const left = Game.shopLeft(it);
      const sold = it.limit && left <= 0;
      const can = !sold && Game.curBalance(it.cur) >= it.price;
      const limTxt = it.limit ? `${{ day: '每日', week: '每周', month: '每月' }[it.period] || ''}限购 ${Game.shopBoughtCount(it)}/${it.limit}` : '不限量';
      const give = this._rwLabel(it.give.gearScale ? { gear: 1 } : it.give) || '神秘奖励';
      return card(`<div class="sp-qty">×1</div>
        <div class="sp-ico">${it.icon}</div>
        <div class="sp-name">${it.name}</div>
        <div class="sp-give muted">${give}</div>
        <div class="sp-lim muted">${limTxt}</div>
        <button class="sp-price ${sold ? 'sold' : ''}" data-buyitem="${it.id}" ${can ? '' : 'disabled'}>
          ${sold ? '已售罄' : `${Game.CUR_ICON[it.cur]} ${it.price}`}</button>`);
    }).join('');

    this.screenEl.innerHTML = `
      <div class="shop-hub">
        <div class="sp-side">${sideHtml}</div>
        <div class="sp-main">
          <div class="sp-head"><span class="sp-title">${cat.icon} ${cat.name}</span>${curBar}</div>
          <div class="sp-stage">
            <div class="sp-merchant">
              <div class="sp-merchant-art">${cat.merchant}</div>
              <div class="sp-bubble">${cat.npc}</div>
            </div>
            <div class="sp-grid">${cardsHtml}</div>
          </div>
        </div>
      </div>`;

    this.screenEl.querySelectorAll('[data-shopcat]').forEach(b => b.onclick = () => { this.shopSel = b.dataset.shopcat; this.renderShop(); });
    this.screenEl.querySelectorAll('[data-buygear]').forEach(b => b.onclick = () => {
      const r = Game.buyShopItem(parseInt(b.dataset.buygear, 10));
      if (!r.ok) { this.toast(r.msg); return; }
      if (window.Sound) Sound.sfx('levelup');
      this.toast(`购买成功：${Game.getGearTpl(r.tpl).name}`); this.updateResources(); this.renderShop();
    });
    this.screenEl.querySelectorAll('[data-buyitem]').forEach(b => b.onclick = () => {
      const r = Game.buyShop2(this.shopSel, b.dataset.buyitem);
      if (!r.ok) { this.toast(r.msg); return; }
      if (window.Sound) Sound.sfx('levelup');
      this.toast('购买成功 · ' + (this._rwLabel(r.give.gearScale ? { gear: 1 } : r.give) || '已入库')); this.updateResources(); this.renderShop();
    });
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
  // ============================================================
  //  成就板（成就 / 成就等级 / 称号）—— 对照 BD2 成就面板
  // ============================================================
  renderAchievements() {
    this.achTab = this.achTab || 'ach';
    const tab = this.achTab;
    const sideTab = (id, name, claimable) =>
      `<button class="ac-tab ${tab === id ? 'on' : ''}" data-atab="${id}">${name}${claimable ? '<span class="tk-dot"></span>' : ''}</button>`;

    let head = '', body = '', foot = '';
    if (tab === 'ach') {
      const list = Game.ACHIEVEMENTS.slice().sort((a, b) => {
        const rank = x => Game.state.achClaimed[x.id] ? 2 : (Game.achValue(x) >= x.target ? 0 : 1);
        return rank(a) - rank(b);
      });
      head = `🏆 成就 <span class="muted" style="font-size:13px;font-weight:400;">${Game.achDoneCount()}/${Game.ACHIEVEMENTS.length}</span>`;
      body = list.map(a => {
        const cur = Game.achValue(a), done = cur >= a.target, claimed = !!Game.state.achClaimed[a.id];
        const pct = Math.min(100, cur / a.target * 100);
        const state = claimed ? 'claimed' : (done ? 'ready' : 'todo');
        const btn = claimed ? '<span class="ac-circle claimed">✓</span>'
          : (done ? `<button class="ac-circle ready" data-claim="${a.id}">🤲</button>`
            : `<span class="ac-circle lock"><span class="ac-ring" style="--p:${pct}"></span>🤲</span>`);
        return `<div class="ac-row ${state}">
          <div class="ac-banner ach">${a.icon}</div>
          <div class="ac-mid">
            <div class="ac-name">${a.name} <span class="ac-prog">${Math.min(cur, a.target)} / ${a.target}</span></div>
            <div class="ac-desc">${a.desc}</div>
            <div class="ac-exp">🏆 成就经验值 ${Game.achExpOf(a)}</div>
          </div>
          ${btn}
        </div>`;
      }).join('');
      foot = `<button class="btn ${Game.achClaimable() ? 'gold' : 'secondary'}" id="ac-all" ${Game.achClaimable() ? '' : 'disabled'}>全部获得</button>`;
    } else if (tab === 'level') {
      const top = Game.achLevel(), prog = Game.achLevelProg();
      head = `🏆 成就等级 <b style="color:var(--gold);">${top}</b>`;
      const hi = top + 5, lo = Math.max(1, top - 6);
      const rows = [];
      for (let lv = hi; lv >= lo; lv--) {
        const r = Game.achLevelReward(lv);
        const reached = lv <= top, claimed = !!(Game.state.achLvClaimed && Game.state.achLvClaimed[lv]);
        const isCur = lv === top + 1;
        const state = claimed ? 'claimed' : (reached ? 'ready' : 'lock');
        const btn = claimed ? '<span class="ac-circle claimed">✓</span>'
          : (reached ? `<button class="ac-circle ready" data-lvl="${lv}">🤲</button>` : '<span class="ac-circle lock">🔒</span>');
        rows.push(`<div class="ac-lv ${state} ${isCur ? 'cur' : ''}">
          <div class="ac-lv-node">${isCur ? `<span class="ac-lv-mark">${prog}</span>` : ''}<span class="ac-lv-name">Lv.${lv}</span></div>
          <div class="ac-lv-rw">${this._rwLabel(r)}</div>
          ${btn}
        </div>`);
      }
      body = `<div class="ac-lv-hint muted">提升成就等级可获得额外奖励。成就等级通过获取成就经验值提升（每 ${Game.ACH_LV_NEED} 点升 1 级）。</div>` + rows.join('');
      foot = `<button class="btn ${Game.achLevelClaimable() ? 'gold' : 'secondary'}" id="ac-all" ${Game.achLevelClaimable() ? '' : 'disabled'}>全部获得</button>`;
    } else {
      const owned = Game.TITLES.filter(t => Game.titleOwned(t.id)).length;
      head = `🏆 称号 <span class="muted" style="font-size:13px;font-weight:400;">${owned}/${Game.TITLES.length}</span>`;
      body = Game.TITLES.map(t => {
        const unlocked = Game.titleUnlocked(t), has = Game.titleOwned(t.id), equipped = Game.currentTitle().id === t.id;
        let btn;
        if (equipped) btn = '<span class="ac-circle equipped">装备中</span>';
        else if (has) btn = `<button class="ac-circle equip" data-equip="${t.id}">装备</button>`;
        else if (unlocked) btn = `<button class="ac-circle ready" data-title="${t.id}">🤲</button>`;
        else btn = '<span class="ac-circle lock">🔒</span>';
        return `<div class="ac-row ${equipped ? 'ready' : (has ? '' : (unlocked ? 'ready' : 'todo'))}">
          <div class="ac-banner title">★</div>
          <div class="ac-mid">
            <div class="ac-name">${t.name}</div>
            <div class="ac-desc">${t.desc}</div>
            <div class="ac-title-chip ${has ? '' : 'locked'}">「${t.name}」</div>
          </div>
          ${btn}
        </div>`;
      }).join('');
      foot = `<button class="btn ${Game.titlesClaimable() ? 'gold' : 'secondary'}" id="ac-all" ${Game.titlesClaimable() ? '' : 'disabled'}>全部获得</button>`;
    }

    this.screenEl.innerHTML = `
      <div class="ach-board">
        <div class="ac-side">
          <div class="ac-side-title">🏆 成就</div>
          ${sideTab('ach', '成就', Game.achClaimable())}
          ${sideTab('level', '成就等级', Game.achLevelClaimable())}
          ${sideTab('title', '称号', Game.titlesClaimable())}
        </div>
        <div class="ac-main">
          <div class="ac-head">${head}</div>
          <div class="ac-list">${body}</div>
          <div class="ac-foot">${foot}</div>
        </div>
      </div>`;

    this.screenEl.querySelectorAll('[data-atab]').forEach(b => b.onclick = () => { this.achTab = b.dataset.atab; this.renderAchievements(); });
    this.screenEl.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
      const r = Game.claimAch(b.dataset.claim);
      if (!r.ok) { this.toast(r.msg || '不可领取'); return; }
      if (window.Sound) Sound.sfx('levelup');
      this.toast(`成就达成！${this._rwLabel(r.reward)} · 🏆经验+${r.exp}`); this.updateResources(); this.renderAchievements();
    });
    this.screenEl.querySelectorAll('[data-lvl]').forEach(b => b.onclick = () => {
      const r = Game.claimAchLevel(parseInt(b.dataset.lvl, 10));
      if (!r.ok) { this.toast(r.msg || '不可领取'); return; }
      this.toast(`等级奖励：${this._rwLabel(r.reward)}`); this.updateResources(); this.renderAchievements();
    });
    this.screenEl.querySelectorAll('[data-title]').forEach(b => b.onclick = () => {
      const id = b.dataset.title; const r = Game.claimTitle(id);
      if (!r.ok) { this.toast(r.msg || '不可领取'); return; }
      Game.equipTitle(id); this.toast(`获得称号「${Game.TITLES.find(t => t.id === id).name}」并装备`); this.updateResources(); this.renderAchievements();
    });
    this.screenEl.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => {
      Game.equipTitle(b.dataset.equip); this.toast('已装备称号'); this.updateResources(); this.renderAchievements();
    });
    const all = this.screenEl.querySelector('#ac-all');
    if (all) all.onclick = () => {
      let r;
      if (tab === 'ach') r = Game.claimAllAch();
      else if (tab === 'level') r = Game.claimAllAchLevels();
      else { let n = 0; Game.TITLES.forEach(t => { if (Game.titleUnlocked(t) && !Game.titleOwned(t.id)) { if (Game.claimTitle(t.id).ok) n++; } }); r = { ok: n > 0, n }; }
      if (!r.ok) { this.toast('没有可领取的奖励'); return; }
      this.toast(`一键领取 ${r.n} 项`); this.updateResources(); this.renderAchievements();
    };
  },

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
            ${this.charAvatar(cd.charId, cid)}
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
