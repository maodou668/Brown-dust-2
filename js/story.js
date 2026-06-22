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
//  剧情脚本
//  beat: { bg, who, side, speaker, text, clear }
//   - bg: 场景背景 id（省略则沿用上一个）
//   - who: 立绘 token（角色 id，或 'E:敌人id'）
//   - side: 'left' | 'right'（立绘位置）
//   - speaker: 名牌文字（省略=旁白，居中无名牌）
//   - clear: true 时清空两侧立绘
// ============================================================
const STORY = {
  // ---------- 序章（改编自小说第一卷·楔子 + 第一章） ----------
  prologue: [
    { bg: 'void', text: '——大陆历一〇二四年。' },
    { bg: 'void', text: '阿斯忒拉大陆的天空，开始落下一种褐色的尘。' },
    { bg: 'void', text: '它不是沙，也不是灰。被魔物碰过的东西会褪色、变脆，最后散成这种褐色的粉末。' },
    { bg: 'void', text: '草会，树会，城墙会……人也会。' },
    { bg: 'castle', text: '就在这片尘里，魔王巴尔从封印中醒来，魔物像潮水一样涌出，吞掉一个又一个边境村庄。' },
    { bg: 'town', text: '人们把最后的希望，押在了各地的佣兵团身上。' },
    { bg: 'forest', who: 'teried', side: 'left', speaker: '泰瑞德',
      text: '又是一群哥布林……自从尘开始落，这片森林就再没安宁过。' },
    { who: 'mina', side: 'right', speaker: '米娜',
      text: '泰瑞德前辈，别冲太前！我的药剂……只够撑两三次治疗了！' },
    { clear: true, bg: 'forest', text: '魔物从四面合围。就在獠牙逼近泰瑞德腰际的刹那——' },
    { speaker: '？？？', text: '（一个极轻的声音，在他脑后响起）……右脚，后撤半步。' },
    { bg: 'forest', text: '他几乎是本能地照做了。獠牙擦着衣摆扑空，自己撞上了泰瑞德递出的剑尖。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '你……怎么知道它会从右边来的？' },
    { speaker: '指挥官', text: '它的重心，在你看见它之前，就先偏了。' },
    { speaker: '指挥官', text: '你们两个人，撑不住第二波。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '第、第二波……？（雾里，幽绿的眼睛一双双亮起）' },
    { clear: true, bg: 'forest', text: '那个旅人一直站在泰瑞德身后半步，不动手，只说话。每一句，都正好比危险早半拍。' },
    { bg: 'forest', text: '最后一只魔物散成褐尘、被风卷走，泰瑞德一屁股坐到地上，却咧开嘴笑了。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '太强了……喂，你那个本事，是「指挥」吧？这正是我缺的东西！' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '我叫泰瑞德。一个还没什么名气的见习剑士。但我有一个梦想——' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '我要组建一支佣兵团。在这个连天上都落着尘的世道里，成为别人走投无路时第一个想起的名字。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '然后，亲手了结那个让世界变成这样的魔王。' },
    { speaker: '指挥官', text: '（注视着少年良久）……梦想太大，路会很长。会死人。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '我知道。所以我才需要一个，能让大家都活着走到最后的——指挥官。' },
    { speaker: '指挥官', text: '这一仗的报酬，我收下了。接下来的路，我陪你们走一段。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '我是米娜！会配药、会治伤，胆子小……但是我跑得很快！' },
    { clear: true, bg: 'forest', text: '大陆历一〇二四年的一个早上，一支日后会被很多人记住的佣兵团，就这么三个人，悄悄开张了。' },
  ],

  // ---------- 关卡前剧情（改编自小说第一卷） ----------
  stage1: [
    { bg: 'forest', who: 'teried', side: 'left', speaker: '泰瑞德',
      text: '艾尔玛森林的入口。哥布林的数量，比平时多得多。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '它们好像在守着什么……小心点！' },
    { speaker: '指挥官', text: '它们的重心都朝着森林深处。守的不是地方——是「路」。我们要的，正是那条路。' },
  ],
  stage2: [
    { bg: 'forest_deep', text: '越往森林深处，空气越是阴冷，落下的褐尘也越密。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '前辈，那边的阴影里……有眼睛在看着我们！' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '暗影狼。看来今晚的猎物，是我们。' },
    { speaker: '指挥官', text: '别和狼群比速度。把它们引到树后，让它们挤成一团，再一起收拾。' },
  ],
  stage3: [
    { bg: 'cave', text: '废弃矿洞深处，岩壁上爬满了褐色的尘，像活的一样，从石缝里渗出来、铺开去。' },
    { who: 'diana', side: 'right', speaker: '黛安娜', text: '不对。这不是自然现象。这些尘里，有某种……「意志」。它在主动侵蚀这座山。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '意志？' },
    { who: 'diana', side: 'right', speaker: '黛安娜', text: '就像有谁，在用它，把这座山一点一点变成自己的一部分。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '那只食人魔浑身也爬满了尘……它的眼睛里，没有野兽的凶光，只有被操纵的空洞。' },
    { speaker: '指挥官', text: '打。但小心——它不是在为自己而战，是在为那些尘而战。' },
  ],
  stage4: [
    { bg: 'ridge', text: '诅咒山脊。狂风里裹着腐臭。被褐尘泡了一千年的巨魔王，缓缓睁开了眼。' },
    { who: 'E:troll_king', side: 'right', speaker: '巨魔王', text: '渺小的人类……也敢踏上本王的领地？' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '越过你，我们才能抵达魔王城。让开，或者倒下。' },
    { speaker: '指挥官', text: '它太硬，正面破不了防。但它每次大吼前，左肩的旧伤会先绷紧——那是尘没能填满的唯一一道缝。' },
    { who: 'diana', side: 'right', speaker: '黛安娜', text: '……数据不会骗人。我信你。凿那道缝。' },
  ],
  stage5: [
    { bg: 'castle', text: '魔王城，王座大厅。城堡上空的褐尘浓得化不开，像一道永远不会天亮的夜。' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔',
      text: '哦？竟有凡人闯到了这里。有点意思……让本王看看，你们的觉悟，值不值这条路。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '这一刻，我等了太久了。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '前辈，大家都在！我们……一定能赢！' },
    { speaker: '指挥官', text: '他血量过半会陷入狂暴。在那之前，把所有火力，都压上去。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '巴尔！今天，就是你的终焉！' },
  ],

  // ---------- 终章（击败魔王后 · 改编自小说第一卷终章「烬火不灭」） ----------
  epilogue: [
    { bg: 'castle', text: '巴尔庞大的身躯开始崩解。可这位魔王，却做出了谁也没料到的举动——他笑了。' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔', text: '不错……很多年没有，被逼到这个份上了。凡人，你以为打倒我，就结束了？' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '我知道你不是源头。矿洞里的那家伙，已经告诉我了。「她」，对吧。' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔', text: '……连这个都知道了。那本王，就送你们最后一程吧。听好了——' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔', text: '我不是这片大陆的征服者。我是「她」的……狱卒。' },
    { clear: true, bg: 'castle', text: '整座大殿，死一般地寂静。' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔', text: '一千年来，本王盘踞此地、散布褐尘，扮演你们眼中的魔王……为的不是毁灭，而是「拖住时间」。' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔', text: '褐尘，是「她」的呼吸。尘埋满大陆之日，便是永夜女皇涅夫提斯，从一千年长眠中睁眼之时。' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔', text: '而本王，是封印她的那把锁上，最后一道正在生锈的齿。如今，这道齿，被你们打断了。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '所以……我们打倒你，反而让永夜来得更快了……？' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔', text: '但也许，这未必是坏事。锁本就会锈。与其等它自己断、那时无人能挡——倒不如，断在你们这群还愿意拼命的傻瓜手里。' },
    { who: 'E:demon_lord', side: 'right', speaker: '魔王 · 巴尔', text: '替本王，看着点那扇门……也替这片，本王守了一千年的大陆。撑住啊，凡人。' },
    { clear: true, bg: 'castle', text: '灰烬升腾，散入那片凝固了千年的夜。而那片夜，第一次，裂开了一道缝隙——' },
    { clear: true, bg: 'town', text: '魔王城外，褐尘暂歇。东方，一线微光固执地撑开了漆黑的天际。那是黎明。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '指挥官……我们是不是，做错了？' },
    { speaker: '指挥官', text: '没有。我们没有让末日降临——我们只是，把那扇门，从黑暗手里，抢到了我们自己手里。' },
    { speaker: '指挥官', text: '门会开。永夜会来。涅夫提斯会醒。但这一次，门后等着她的，是一群会主动迎上去的人。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '说得好！听见了吗，各位——旅程没有结束，才刚刚开始！下一站，永夜！' },
    { clear: true, bg: 'forest', text: '后世的吟游诗人，会把这一年称作「烬火之年」。因为正是这一年，一团微不足道的火，第一次照亮了通往黎明的路。' },
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
    { who: 'lecliss', side: 'left', speaker: '莉可莉丝', text: '……我的家乡，叫烬火镇。十一年前，一夜大火，三百二十七个人，全化成了一镇的褐尘。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '莉可莉丝……' },
    { who: 'lecliss', side: 'left', speaker: '莉可莉丝', text: '只有我活了下来。火停在离我一掌远的地方——从那夜起，就有一簇火，住进了我掌心，再没离开。' },
    { who: 'lecliss', side: 'left', speaker: '莉可莉丝', text: '我恨它。可它也是我唯一信得过的东西。这一次……我要用这团火，护住点什么。' },
    { who: 'lecliss', side: 'left', speaker: '莉可莉丝', text: '所以，别死在我面前。否则我饶不了你。' },
    { clear: true, text: '在烬火里诞生、孤独燃烧了十一年的火，终于有了愿意为之燃烧的人。' },
  ],
  side_justia: [
    { bg: 'castle', text: '圣盾骑士团早已在战火中覆灭。贾丝蒂亚，是它的最后一人。' },
    { who: 'justia', side: 'left', speaker: '贾丝蒂亚', text: '「以身为盾，护尔等周全。」这是骑士团覆灭那日，我立下的誓。只要还有一人需要守护，盾就不能放下。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '可你一个人，守不过来。' },
    { who: 'justia', side: 'left', speaker: '贾丝蒂亚', text: '……是。' },
    { speaker: '指挥官', text: '让我们做你盾后的那条路。你护着我们，我们也护着你。' },
    { who: 'justia', side: 'left', speaker: '贾丝蒂亚', text: '（郑重地横盾于身前）……我的盾，自此，为你们而立。' },
    { clear: true, text: '骑士献盾之礼——「我愿以此身，立于你等之前」。' },
  ],
  side_seir: [
    { bg: 'town', text: '灰环镇的暗巷。希尔偷走了佣兵团护送的药材，却不是为了钱。' },
    { who: 'seir', side: 'left', speaker: '希尔', text: '巷子深处，有一群染了瘟病、却请不起药的孩子。这批药，是给他们的。' },
    { who: 'seir', side: 'left', speaker: '希尔', text: '……别误会。我只是不想欠这镇子人情。等他们好了，我马上就走。一个人，最自在。' },
    { speaker: '指挥官', text: '（当夜，发现她正笨拙地替一个孩子掖好被角）一个人最自在，是吧。' },
    { who: 'seir', side: 'left', speaker: '希尔', text: '闭、闭嘴！我只是顺手！' },
    { speaker: '指挥官', text: '前面的路上，还有很多请不起药的人。他们也需要，一支从不失手的箭。' },
    { who: 'seir', side: 'left', speaker: '希尔', text: '……黑夜里，我从不失手。跟不上的话，可别怪我不等。' },
    { clear: true, text: '独行的射手，以她别扭的方式，成了这群人中的一员。' },
  ],
  side_helena: [
    { bg: 'forest', text: '清晨，海莲娜在林间挥剑练习，剑风带起满地落叶。' },
    { who: 'helena', side: 'left', speaker: '海莲娜', text: '剑这东西，慢一分就会害死同伴。所以我只追求「快」。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '能……教教我吗？' },
    { who: 'helena', side: 'left', speaker: '海莲娜', text: '哈！有志气。记住——剑要快，心要稳。护着想护的人，剑才有意义。' },
    { clear: true, text: '疾风剑士的剑，始终指向正义。' },
  ],
  side_rou: [
    { bg: 'town', text: '神殿的回廊里，萝正轻声为受伤的旅人祈祷。' },
    { who: 'rou', side: 'left', speaker: '萝', text: '光告诉我……这世上的痛，没有一种是该被独自承受的。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '萝姐姐，你总是这么温柔……' },
    { who: 'rou', side: 'left', speaker: '萝', text: '因为有人也曾这样温柔地，把我从黑暗里牵了出来呀。' },
    { clear: true, text: '她把曾得到的温柔，加倍还给了世界。' },
  ],
  side_diana: [
    { bg: 'cave', text: '深夜，黛安娜在摇曳的烛光下翻阅着古老的魔导书。' },
    { who: 'diana', side: 'left', speaker: '黛安娜', text: '魔法本是冰冷的公式……我研究它，只为求知。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '可你今天那道水墙，救了我们所有人。' },
    { who: 'diana', side: 'left', speaker: '黛安娜', text: '……是吗。原来「为他人施法」，会让这冰冷的公式，变得有点温度。' },
    { clear: true, text: '天才法师，第一次为「知识」之外的东西心动。' },
  ],
  side_garcia: [
    { bg: 'ridge', text: '战后的山脊，加西亚独自检查着布满裂痕的巨盾。' },
    { who: 'garcia', side: 'left', speaker: '加西亚', text: '……盾裂了，没关系。只要人没倒。' },
    { who: 'mina', side: 'right', speaker: '米娜', text: '加西亚先生，你又把伤口藏起来了！让我看看！' },
    { who: 'garcia', side: 'left', speaker: '加西亚', text: '……（沉默片刻）谢谢。下次，我还会挡在前面。' },
    { clear: true, text: '沉默如山的男人，用脊背写下了承诺。' },
  ],
  side_lia: [
    { bg: 'forest', text: '草原的风穿过林梢，莉亚仰头眯眼，搭弓瞄准远方。' },
    { who: 'lia', side: 'left', speaker: '莉亚', text: '在部族里，独自狩猎的人走不远。要走远，就得有同伴。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '所以你才加入我们？' },
    { who: 'lia', side: 'left', speaker: '莉亚', text: '嗯！你们就是我的新部族啦。这一箭，为大家而射！' },
    { clear: true, text: '草原的女猎手，找到了新的族人。' },
  ],
  side_refithea: [
    { bg: 'castle', text: '圣山之巅，蕾菲西亚俯瞰着被永夜笼罩的大地。' },
    { who: 'refithea', side: 'left', speaker: '蕾菲西亚', text: '魔王虽除，黑暗却仍在蔓延……这一次的敌人，更加深沉。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '圣女大人，您愿意与我们同行吗？' },
    { who: 'refithea', side: 'left', speaker: '蕾菲西亚', text: '当然。只要还有一束光值得守护，我就不会停下祈祷。' },
    { who: 'refithea', side: 'left', speaker: '蕾菲西亚', text: '把你们的伤痛交给我吧——让我们一起，把光带回这片土地。' },
    { clear: true, text: '圣女的加入，为佣兵团点亮了永夜中的灯火。' },
  ],
  side_rigenette: [
    { bg: 'ridge', text: '苍空之下，莉洁奈特拔剑，剑光快得几乎看不见残影。' },
    { who: 'rigenette', side: 'left', speaker: '莉洁奈特', text: '苍空骑士团……如今只剩我一人了。' },
    { who: 'helena', side: 'right', speaker: '海莲娜', text: '同为追求「快」的剑客，我懂那份孤独。' },
    { who: 'rigenette', side: 'left', speaker: '莉洁奈特', text: '哼，难得遇上能跟上我剑速的人。那就——并肩飞驰吧。' },
    { clear: true, text: '两道疾风，自此交汇成同一阵风暴。' },
  ],
  side_olstein: [
    { bg: 'cave', text: '营地最外围，奥尔斯坦如一座沉默的雕像般伫立守夜。' },
    { who: 'olstein', side: 'left', speaker: '奥尔斯坦', text: '我守了一辈子的防线，从未让身后之人倒下。' },
    { who: 'teried', side: 'right', speaker: '泰瑞德', text: '不累吗？一直站在最前面。' },
    { who: 'olstein', side: 'left', speaker: '奥尔斯坦', text: '累。但只要身后还有想守护的人，这双脚，就不会退后半步。' },
    { clear: true, text: '「不动」之名，是用一生的脊梁换来的。' },
  ],

  // ---------- 第二部 · 关卡剧情 ----------
  stage6: [
    { bg: 'forest_deep', text: '魔王陨落数月后，边境却被一层挥之不去的永夜笼罩。' },
    { who: 'refithea', side: 'right', speaker: '蕾菲西亚', text: '这些亡魂……是被某种力量强行从安息中唤醒的。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '又是黑暗……看来魔王，并不是终点。' },
    { who: 'refithea', side: 'right', speaker: '蕾菲西亚', text: '小心。真正的源头，恐怕还藏在永夜的最深处。' },
  ],
  stage7: [
    { bg: 'castle', text: '永夜回廊的尽头，暗影女皇涅夫提斯端坐于黑曜王座之上。' },
    { who: 'E:shadow_empress', side: 'right', speaker: '暗影女皇 · 涅夫提斯', text: '哦……是你们终结了那头蠢熊巴尔？真是帮了本皇一个忙呢。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '原来魔王，也只是你的一枚棋子……' },
    { who: 'E:shadow_empress', side: 'right', speaker: '暗影女皇 · 涅夫提斯', text: '永夜，才是这世界的归宿。来吧，做本皇王座下，第一批长眠的祭品。' },
    { who: 'rigenette', side: 'left', speaker: '莉洁奈特', text: '废话太多了。我的剑，可不会等你说完。' },
  ],

  // ---------- 第二部 · 结局 ----------
  epilogue2: [
    { bg: 'castle', text: '随着女皇的哀鸣消散，笼罩边境的永夜，终于裂开了一道曙光。' },
    { who: 'refithea', side: 'right', speaker: '蕾菲西亚', text: '光……回来了。大地，终于能够安睡了。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '从一个魔王，到一位女皇……我们走得比想象中更远。' },
    { clear: true, bg: 'town', text: '佣兵团的名字，开始在大陆的每个角落被人传颂。' },
    { who: 'teried', side: 'left', speaker: '泰瑞德', text: '但只要还有黑暗，我们的旅途，就不会结束。' },
    { who: 'rigenette', side: 'right', speaker: '莉洁奈特', text: '那就继续飞驰吧。下一阵风，已经在路上了。' },
    { clear: true, bg: 'forest', text: '——佣兵团的传说，仍在续写。' },
  ],
};

window.Story = Story;
window.STORY = STORY;
