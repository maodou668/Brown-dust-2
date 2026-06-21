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
    this.beats = beats;
    this.idx = 0;
    this.onDone = () => { this.markSeen(id); if (onDone) onDone(); };
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

  /** 立绘 HTML：图片优先，风格化占位兜底 */
  portraitHTML(token) {
    if (!token) return '';
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

    // 背景
    if (beat.bg && beat.bg !== this.curBg) {
      this.curBg = beat.bg;
      const bg = this.root.querySelector('#story-bg');
      bg.className = 'story-bg bg-' + beat.bg;
      bg.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 400 });
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
        if (beat.who.startsWith('E:')) col = window.GameData.ENEMIES[beat.who.slice(2)].color;
        else col = window.GameData.CHARACTERS[beat.who].color;
      }
      nameEl.style.color = col;
    } else {
      box.classList.add('narration');
      nameEl.style.display = 'none';
    }

    this.typeText(beat.text || '');
  },

  /** 逐字打字机效果 */
  typeText(text) {
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
    }, 28);
    this._fullText = text;
  },

  advance() {
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
//  剧情脚本
//  beat: { bg, who, side, speaker, text, clear }
//   - bg: 场景背景 id（省略则沿用上一个）
//   - who: 立绘 token（角色 id，或 'E:敌人id'）
//   - side: 'left' | 'right'（立绘位置）
//   - speaker: 名牌文字（省略=旁白，居中无名牌）
//   - clear: true 时清空两侧立绘
// ============================================================
const STORY = {
  // ---------- 序章 ----------
  prologue: [
    { bg: 'void', text: '——大陆历 1024 年。' },
    { bg: 'castle', text: '魔王巴尔自封印中苏醒，魔物如潮水般涌出，吞噬着边境的村庄。' },
    { bg: 'town', text: '人们将最后的希望，寄托于各地佣兵团。' },
    { bg: 'forest', who: 'teried', side: 'left', speaker: '泰瑞德',
      text: '又是一群哥布林……自从魔王醒来，这片森林就再没安宁过。' },
    { who: 'mina', side: 'right', speaker: '米娜',
      text: '泰瑞德前辈，别冲太前！我的药剂……还只够撑两三次治疗。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德',
      text: '放心。我答应过要保护你，也答应过要亲手了结那个魔王。' },
    { speaker: '泰瑞德', text: '哪怕只有我们两个人起步，这个佣兵团，也会一点点壮大。' },
    { who: 'mina', side: 'right', speaker: '米娜',
      text: '嗯！那就……从眼前这群魔物开始吧，指挥官！' },
    { clear: true, bg: 'forest', text: '——你的佣兵团，自此启程。' },
  ],

  // ---------- 关卡前剧情 ----------
  stage1: [
    { bg: 'forest', who: 'teried', side: 'left', speaker: '泰瑞德',
      text: '艾尔玛森林的入口。哥布林的数量比平时多得多。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '它们好像在守着什么……小心点！' },
  ],
  stage2: [
    { bg: 'forest_deep', text: '越往森林深处，空气越是阴冷。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '前辈，那边的阴影里……有眼睛在看着我们！' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '暗影狼。看来今晚的猎物，是我们。' },
  ],
  stage3: [
    { bg: 'cave', text: '废弃矿洞深处，沉重的脚步声在岩壁间回荡。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '食人魔……还有黑暗法师在替它撑腰。这是硬仗。' },
  ],
  stage4: [
    { bg: 'ridge', text: '诅咒山脊。狂风裹着腐臭，盘踞此地的巨魔王缓缓睁开了眼。' },
    { who: 'E:troll_king', side: 'right', speaker: '巨魔王', text: '渺小的人类……也敢踏上本王的领地？' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '越过你，我们才能抵达魔王城。让开，或者倒下。' },
  ],
  stage5: [
    { bg: 'castle', text: '魔王城，王座之间。一切罪恶的源头近在眼前。' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔',
      text: '哦？竟有凡人闯到了这里。有点意思……让本王看看，你们的觉悟值不值这条路。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '这一刻，我等了太久了。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '前辈，大家都在！我们……一定能赢！' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '巴尔！今天，就是你的终焉！' },
  ],

  // ---------- 终章（击败魔王后） ----------
  epilogue: [
    { bg: 'castle', text: '魔王巴尔的身影，在炽白的圣光中缓缓消散。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '结束了……真的结束了。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '我们……我们做到了，前辈！' },
    { clear: true, bg: 'town', text: '数日之后，边境的村庄重新升起了袅袅炊烟。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '但这不是终点。只要还有人需要佣兵团，我们就继续走下去。' },
    { who: 'lecliss', side: 'right', speaker: '莉可莉丝', text: '啰嗦。要走就走，别又煮那锅黑暗炖菜。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '喂——！那叫秘制好吗！' },
    { clear: true, bg: 'forest', text: '佣兵团的故事，未完待续……' },
  ],

  // ---------- 角色支线 ----------
  side_teried: [
    { bg: 'town', text: '黄昏，佣兵团临时驻地。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '我从小就听着勇者的故事长大……可现实里，勇者也得先学会怎么不让队友饿肚子。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '噗——前辈你昨天那锅炖菜，真的……很有「勇气」。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '咳。总之，我答应过村里的大家，一定会把魔王的事了结。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '这条路也许很长，但只要还有人愿意跟着我……我就绝不会停下。' },
    { clear: true, text: '少年的梦想，正一步步长出筋骨。' },
  ],
  side_mina: [
    { bg: 'forest_deep', text: '战斗后的夜里，米娜独自整理着她的药箱。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '今天……又差点没接上前辈的伤。我还是太慢了。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '米娜。今天要不是你那瓶药，我早就倒下了。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '前辈……！' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '别小看自己。你递出的每一瓶药，都是我们能继续走下去的理由。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '嗯……！我会更努力的，绝对！' },
    { clear: true, text: '胆小的少女，正悄悄变得可靠。' },
  ],
  side_lecliss: [
    { bg: 'cave', text: '营火旁，莉可莉丝盯着跳动的火苗，久久出神。' },
    { who: 'lecliss', side: 'left', speaker: '莉可莉丝', text: '火……带走了我的一切。可也是火，让我活了下来。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '莉可莉丝？' },
    { who: 'lecliss', side: 'left', speaker: '莉可莉丝', text: '别误会。我只是在想——这一次，我要用这团火，护住点什么。' },
    { who: 'lecliss', side: 'left', speaker: '莉可莉丝', text: '所以，别死在我面前。否则我饶不了你。' },
    { clear: true, text: '毒舌的魔女，藏着最滚烫的温柔。' },
  ],
  side_justia: [
    { bg: 'castle', text: '圣殿的残垣前，贾丝蒂亚单膝跪地，默然良久。' },
    { who: 'justia', side: 'left', speaker: '贾丝蒂亚', text: '骑士团已经不在了……只剩我一人，守着这份誓约。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '你不是一个人。我们都在。' },
    { who: 'justia', side: 'left', speaker: '贾丝蒂亚', text: '……是啊。这一次，我守护的不再是冰冷的教条，而是……活生生的同伴。' },
    { who: 'justia', side: 'left', speaker: '贾丝蒂亚', text: '那么，我的盾，便有了新的意义。' },
    { clear: true, text: '最后的圣骑士，找到了新的誓约。' },
  ],
  side_seir: [
    { bg: 'town', text: '深夜的屋顶，希尔独自擦拭着她的弓。' },
    { who: 'seir', side: 'left', speaker: '希尔', text: '欠人情，是会要命的……我早就学会了一个人活。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '希尔姐姐！我带了宵夜~要一起吃吗？' },
    { who: 'seir', side: 'left', speaker: '希尔', text: '……（沉默了半晌）随你。' },
    { clear: true, text: '独行的射手，第一次没有拒绝那份递来的温度。' },
  ],
  side_helena: [
    { bg: 'forest', text: '清晨，海莲娜在林间挥剑练习，剑风带起满地落叶。' },
    { who: 'helena', side: 'left', speaker: '海莲娜', text: '剑这东西，慢一分就会害死同伴。所以我只追求「快」。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '能……教教我吗？' },
    { who: 'helena', side: 'left', speaker: '海莲娜', text: '哈！有志气。记住——剑要快，心要稳。护着想护的人，剑才有意义。' },
    { clear: true, text: '疾风剑士的剑，始终指向正义。' },
  ],
};

window.Story = Story;
window.STORY = STORY;
