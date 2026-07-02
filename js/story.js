// ============================================================
//  叙事演出引擎（视觉小说式对话系统）+ 剧情脚本
//  阶段一：BD2「剧情」精髓的代码实现
//  - 全屏场景背景、左右立绘位、名牌、旁白、逐字演出、点按推进、跳过
//  - 立绘走「图片优先，风格化占位兜底」的可替换美术管线
// ============================================================

const Story = {
  root: null,
  beats: [],
  idx: 0,
  onDone: null,
  typing: false,
  typer: null,
  curBg: 'void',
  portraits: { left: null, right: null },

  /** 该剧情是否已看过 */
  seen(id) {
    return Game.state.seenStory && Game.state.seenStory.includes(id);
  },

  markSeen(id) {
    Game.state.seenStory = Game.state.seenStory || [];
    if (!Game.state.seenStory.includes(id)) {
      Game.state.seenStory.push(id);
      Game.save();
    }
  },

  /** 播放一段剧情；播完调用 onDone */
  play(id, onDone) {
    const beats = STORY[id];
    if (!beats || !beats.length) { if (onDone) onDone(); return; }
    this.playBeats(beats, () => { this.markSeen(id); if (onDone) onDone(); });
  },

  /** 播放任意 beat 数组（Director 的 adv 层入口，不写 seen 记录） */
  playBeats(beats, onDone) {
    this.beats = beats;
    this.idx = 0;
    this.choosing = false;
    this.onDone = onDone || null;
    if (window.Sound) Sound.bgm('story');
    this.curBg = 'void';
    this.portraits = { left: null, right: null };
    this.build();
    this.render();
  },

  build() {
    const old = document.getElementById('story-screen');
    if (old) old.remove();
    this.root = UI.el(`
      <div id="story-screen">
        <div class="story-bg" id="story-bg"></div>
        <div class="bfx-particles" id="story-fx"></div>
        <div class="story-portrait left"  id="port-left"></div>
        <div class="story-portrait right" id="port-right"></div>
        <button class="story-skip" id="story-skip">跳过 ▶▶</button>
        <div class="story-dialogue" id="story-box">
          <div class="story-name" id="story-name"></div>
          <div class="story-text" id="story-text"></div>
          <div class="story-next" id="story-next">▼</div>
        </div>
      </div>`);
    document.body.appendChild(this.root);

    // 点按推进（点对话区或背景）
    this.root.addEventListener('click', (e) => {
      if (e.target.closest('#story-skip')) return;
      this.advance();
    });
    this.root.querySelector('#story-skip').onclick = (e) => {
      e.stopPropagation();
      this.finish();
    };
  },

  /** 场景氛围粒子（与战斗复用同一套样式） */
  spawnParticles(scene) {
    const box = this.root && this.root.querySelector('#story-fx');
    if (!box) return;
    const type = ({ forest: 'leaf', forest_deep: 'leaf', cave: 'ember', castle: 'ember', town: 'ember', ridge: 'snow' })[scene] || 'mote';
    let html = '';
    for (let i = 0; i < 14; i++) {
      const left = Math.random() * 100;
      const dur = 7 + Math.random() * 7;
      const delay = -Math.random() * dur;
      const size = 6 + Math.random() * 8;
      html += `<span class="bfx ${type}" style="left:${left}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
    }
    box.innerHTML = html;
  },

  /** 立绘 HTML：图片优先，风格化占位兜底 */
  portraitHTML(token) {
    if (!token) return '';
    // 剧情 NPC 立绘：'N:文件名' → art/06_story/portraits/<文件名>.png（差分=另一个文件名，如 xxx_odd）
    if (token.startsWith('N:')) {
      const V = window.ASSET_VER || '';
      return `<img class="port-img" src="art/06_story/portraits/${token.slice(2)}.png?v=${V}" alt="">`;
    }
    let def, icon, color, name;
    if (token.startsWith('E:')) {
      def = window.GameData.ENEMIES[token.slice(2)];
      icon = '👹'; color = def.color; name = def.name;
    } else {
      def = window.GameData.CHARACTERS[token];
      icon = window.GameData.CLASSES[def.cls].icon;
      color = def.color; name = def.name;
    }
    // 预留真实立绘：若数据含 art 字段则用图片
    if (def && def.art) {
      return `<img class="port-img" src="${def.art}" alt="${name}">`;
    }
    // 风格化占位立绘：渐变人形 + 大图标
    const elem = def.element ? window.GameData.ELEMENTS[def.element].icon : '';
    return `
      <div class="port-art" style="--c:${color};">
        <div class="port-silhouette"></div>
        <div class="port-icon">${icon}</div>
        <div class="port-elem">${elem}</div>
      </div>`;
  },

  render() {
    const beat = this.beats[this.idx];
    if (!beat) { this.finish(); return; }
    // 条件 beat（轻度选择支的分支台词）：不满足则跳过
    if ((beat.if && !(window.Director && Director.flag(beat.if))) ||
        (beat.ifNot && window.Director && Director.flag(beat.ifNot))) {
      this.idx++; this.render(); return;
    }

    // 背景
    if (beat.bg && beat.bg !== this.curBg) {
      this.curBg = beat.bg;
      const bg = this.root.querySelector('#story-bg');
      bg.className = 'story-bg bg-' + beat.bg;
      bg.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 400 });
      this.spawnParticles(beat.bg);
    } else if (this.idx === 0) {
      this.spawnParticles(this.curBg);
    }

    // 立绘进出场
    if (beat.clear) this.portraits = { left: null, right: null };
    if (beat.who) {
      const side = beat.side || 'left';
      this.portraits[side] = beat.who;
    }
    ['left', 'right'].forEach(side => {
      const el = this.root.querySelector('#port-' + side);
      const tok = this.portraits[side];
      el.innerHTML = this.portraitHTML(tok);
      el.classList.toggle('empty', !tok);
      // 说话人高亮，非说话人压暗
      const speaking = beat.who === tok || (!beat.who && false);
      el.classList.toggle('dim', !!tok && beat.who && beat.who !== tok);
      if (tok && !el.dataset.shown) {
        el.animate([{ transform: `translateY(20px) scale(.96)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 350 });
        el.dataset.shown = '1';
      }
      if (!tok) delete el.dataset.shown;
    });

    // 名牌 + 旁白样式
    const box = this.root.querySelector('#story-box');
    const nameEl = this.root.querySelector('#story-name');
    if (beat.speaker) {
      box.classList.remove('narration');
      nameEl.style.display = 'block';
      nameEl.textContent = beat.speaker;
      // 名牌颜色随角色
      let col = '#b06bff';
      if (beat.who) {
        if (beat.who.startsWith('E:')) col = (window.GameData.ENEMIES[beat.who.slice(2)] || {}).color || col;
        else if (beat.who.startsWith('N:')) col = '#9aa0ae';
        else col = (window.GameData.CHARACTERS[beat.who] || {}).color || col;
      }
      nameEl.style.color = col;
    } else {
      box.classList.add('narration');
      nameEl.style.display = 'none';
    }

    // CG 层（全屏图 + Ken Burns 缓动；beat.cg = 图片路径，下一个无 cg 的 beat 自动收起）
    let cgEl = this.root.querySelector('#story-cg');
    if (beat.cg) {
      if (!cgEl) {
        cgEl = UI.el('<div id="story-cg"><img decoding="async"></div>');
        this.root.insertBefore(cgEl, this.root.querySelector('#story-box'));
      }
      const im = cgEl.querySelector('img');
      const src = beat.cg + '?v=' + (window.ASSET_VER || '');
      if (im.getAttribute('src') !== src) { im.src = src; im.className = 'kenburns'; }
    } else if (cgEl) cgEl.remove();

    // 低语（圣经 W2）：无名牌、文本固定 …………、逐字 1/3 速
    if (beat.whisper) {
      box.classList.add('narration', 'whisper');
      nameEl.style.display = 'none';
      if (window.Sound && Sound.sfx) { try { Sound.sfx('whisper'); } catch (e) {} }
      this.typeText('…………', 96);
      return;
    }
    box.classList.remove('whisper');

    this.typeText(beat.text || '');

    // 选择支（轻度）：beat.choice = [{t:'文案', flag:'flag名'}]
    const oldCh = this.root.querySelector('#story-choice');
    if (oldCh) oldCh.remove();
    if (beat.choice) {
      this.choosing = true;
      const ch = UI.el(`<div id="story-choice">${beat.choice.map((c, i) =>
        `<button class="story-choice-btn" data-ci="${i}">${c.t}</button>`).join('')}</div>`);
      this.root.appendChild(ch);
      ch.querySelectorAll('button').forEach(b => b.onclick = (ev) => {
        ev.stopPropagation();
        const opt = beat.choice[parseInt(b.dataset.ci, 10)];
        if (opt.flag && window.Director) Director.setFlag(opt.flag);
        ch.remove();
        this.choosing = false;
        this.advance();
      });
    }
  },

  /** 逐字打字机效果 */
  typeText(text, interval) {
    const el = this.root.querySelector('#story-text');
    const next = this.root.querySelector('#story-next');
    next.style.opacity = 0;
    this.typing = true;
    el.textContent = '';
    let i = 0;
    clearInterval(this.typer);
    this.typer = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(this.typer);
        this.typing = false;
        next.style.opacity = 1;
      }
    }, interval || 28);
    this._fullText = text;
  },

  advance() {
    if (this.choosing) return;   // 选择支挂起时禁点按推进
    if (this.typing) {
      // 第一次点：立即显示全文
      clearInterval(this.typer);
      this.root.querySelector('#story-text').textContent = this._fullText;
      this.typing = false;
      this.root.querySelector('#story-next').style.opacity = 1;
      return;
    }
    this.idx++;
    if (this.idx >= this.beats.length) { this.finish(); return; }
    this.render();
  },

  finish() {
    clearInterval(this.typer);
    if (window.Sound && !(window.BattleUI && BattleUI.root)) Sound.bgm('home');
    if (this.root) {
      this.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => {
        if (this.root) this.root.remove();
        this.root = null;
      };
    }
    const cb = this.onDone;
    this.onDone = null;
    if (cb) setTimeout(cb, 280);
  },
};

// ============================================================
//  剧情脚本（内容已清空 —— 等待新剧本填入）
//  ⚠️ 剧情正文由用户重写后喂入；此处只保留格式与空壳，游戏照常运行
//     （STORY 里缺失的 id 会被 play() 直接跳过，不会报错）。
//
//  一句台词 = 一个 beat 对象：{ bg, who, side, speaker, text, clear }
//   - bg     : 场景背景 id（省略=沿用上一个）。可选：void/forest/forest_deep/cave/castle/town/ridge
//   - who    : 立绘 token = 角色代号（如 'lecliss'），或敌人 'E:敌人id'。省略=不改立绘
//   - side   : 'left' | 'right'（立绘站位）
//   - speaker: 名牌上的名字（省略=居中旁白，无名牌）
//   - text   : 这句话/这段旁白的文字
//   - clear  : true 时清空两侧立绘
//
//  场景写法示例（喂料时照这个格式给我即可）：
//    prologue: [
//      { bg:'forest', text:'旁白：森林深处……' },
//      { who:'teried', side:'left', speaker:'泰瑞德', text:'……' },
//      { speaker:'指挥官', text:'……' },   // 指挥官只有名牌、无立绘
//    ],
//
//  可用角色代号 ↔ 立绘，见 story/剧本喂料模板.md 的技术清单。
// ============================================================
const STORY = {};

window.Story = Story;
window.STORY = STORY;
