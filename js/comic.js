// ============================================================
//  漫画演出引擎（条漫式竖向滚动）
//  - 复用 story.js 的风格化立绘与场景背景
//  - 关键剧情以「分镜面板 + 对话气泡 + 旁白框 + 拟声词」呈现
//  - 走「图片优先、占位兜底」管线：面板/角色可后续替换真实漫画美术
// ============================================================

const Comic = {
  root: null,

  /** 打开一话漫画 */
  open(epId) {
    const ep = COMIC[epId];
    if (!ep) return;
    this.build(ep);
  },

  /** Director 的 comic 层入口：直接喂 ep 对象，读完（✕ 或底部按钮）回调 */
  openEp(ep, onDone) {
    this.onDone = onDone || null;
    this.build(ep);
  },

  /** 角色立绘（复用 Story 的占位立绘；指挥官用专属灰袍剪影） */
  charHTML(token) {
    if (!token) return '';
    if (token === 'cmd') {
      return `<div class="port-art" style="--c:#8a8f9c;">
        <div class="port-silhouette"></div>
        <div class="port-icon">🧭</div></div>`;
    }
    // 'IMG:路径' → 直接贴图（场景小人帧/一次性分镜素材）
    if (token.startsWith('IMG:')) {
      return `<img class="comic-img-px" src="${token.slice(4)}?v=${window.ASSET_VER || ''}" alt="">`;
    }
    return window.Story ? Story.portraitHTML(token) : '';
  },

  panelHTML(p) {
    const chars = (p.chars || []).map(c => {
      const x = c.x != null ? c.x : 50;
      const w = c.w || 46;
      const tf = `translateX(-50%)${c.flip ? ' scaleX(-1)' : ''}`;
      const dim = c.dim ? 'filter:brightness(.5) saturate(.7);' : '';
      return `<div class="comic-char" style="left:${x}%;width:${w}%;transform:${tf};${dim}">${this.charHTML(c.who)}</div>`;
    }).join('');

    const narr = p.narr ? `<div class="comic-narr">${p.narr}</div>` : '';
    const bubbles = (p.bubbles || []).map(b => {
      const name = b.speaker ? `<span class="cb-name">${b.speaker}</span>` : '';
      return `<div class="comic-bubble ${b.type || 'speech'} ${b.side || 'left'}">${name}<span class="cb-text">${b.text}</span></div>`;
    }).join('');
    const sfx = p.sfx ? `<div class="comic-sfx ${p.sfxPos || 'br'}">${p.sfx}</div>` : '';
    const h = p.h || (p.tall ? 360 : 240);

    return `<div class="comic-panel bg-${p.bg || 'void'}" style="min-height:${h}px;">
      <div class="comic-art">${chars}${sfx}</div>
      <div class="comic-overlay">${narr}<div class="comic-bubbles">${bubbles}</div></div>
    </div>`;
  },

  build(ep) {
    const old = document.getElementById('comic-screen');
    if (old) old.remove();
    const panels = ep.panels.map(p => this.panelHTML(p)).join('');
    this.root = UI.el(`
      <div id="comic-screen">
        <div class="comic-top">
          <span class="comic-title">📖 ${ep.title}</span>
          <button class="ghost-btn" id="comic-close">✕</button>
        </div>
        <div class="comic-scroll">
          <div class="comic-cover bg-${ep.cover || 'void'}">
            <div class="comic-cover-title">${ep.title}</div>
            <div class="comic-cover-sub">${ep.sub || ''}</div>
          </div>
          ${panels}
          <div class="comic-end">— 完 —<br><span>${ep.end || ''}</span>
            ${this.onDone ? '<br><button class="btn" id="comic-continue" style="margin-top:12px;">继续 ▶</button>' : ''}
          </div>
        </div>
      </div>`);
    document.body.appendChild(this.root);
    const cont = this.root.querySelector('#comic-continue');
    if (cont) cont.onclick = () => this.close();
    if (window.Sound) { Sound.bgm('story'); Sound.sfx('open'); }
    this.root.querySelector('#comic-close').onclick = () => this.close();
    // 进场：面板逐个淡入
    const sc = this.root.querySelector('.comic-scroll');
    sc.scrollTop = 0;
    this.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
  },

  close() {
    if (!this.root) return;
    if (window.Sound) Sound.bgm('home');
    const r = this.root;
    r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).onfinish = () => { r.remove(); };
    this.root = null;
    const cb = this.onDone; this.onDone = null;
    if (cb) setTimeout(cb, 240);
  },
};

// ============================================================
//  漫画脚本（改编自轻小说《烬火行纪》第一卷）
//  panel: { bg, chars:[{who,x,w,flip,dim}], narr, bubbles:[{speaker,text,type,side}], sfx, sfxPos, h, tall }
//   - type: speech(对话) | thought(心声) | shout(呐喊/呼喊)
// ============================================================
const COMIC = {
  ep_prologue: {
    title: '序章 · 烬火启程',
    sub: '改编自《烬火行纪》第一卷',
    cover: 'forest',
    end: '——「烬火行纪」序章',
    panels: [
      { bg: 'void', narr: '大陆历一〇二四年。天空，开始落下一种褐色的尘。', sfx: '簌——', sfxPos: 'tr', h: 200 },
      { bg: 'void', narr: '被魔物碰过的东西会褪色、变脆，最后散成褐色的粉末。草会，树会……人也会。', h: 200 },
      { bg: 'castle', narr: '就在这片尘里，魔王巴尔从封印中醒来。', chars: [{ who: 'E:demon_lord', x: 52, w: 56 }], sfx: 'ゴ ゴ ゴ', tall: true },
      { bg: 'forest', narr: '艾尔玛森林的早上。', chars: [{ who: 'mina', x: 30, w: 42 }], bubbles: [{ speaker: '米娜', text: '前辈——！它咬住我的药箱了！', type: 'shout', side: 'left' }], sfx: 'ダッ', sfxPos: 'bl' },
      { bg: 'forest', chars: [{ who: 'teried', x: 60, w: 46 }], bubbles: [{ speaker: '泰瑞德', text: '米娜，蹲下！', type: 'shout', side: 'right' }], sfx: 'キィン', sfxPos: 'tr' },
      { bg: 'forest', chars: [{ who: 'teried', x: 55, w: 46 }], narr: '獠牙逼到他腰前——剑，收不回来了。', sfx: '！', sfxPos: 'tr' },
      { bg: 'forest', narr: '这时，身后传来一个很轻的声音。', bubbles: [{ speaker: '？？？', text: '右脚，往后退半步。', type: 'speech', side: 'left' }], h: 200 },
      { bg: 'forest', chars: [{ who: 'teried', x: 50, w: 46 }], narr: '泰瑞德照做了。哥布林扑了个空，自己撞上了他的剑尖。', sfx: 'ザシュッ', sfxPos: 'br' },
      { bg: 'forest', narr: '一棵老树的影子里，站着一个旅人。', chars: [{ who: 'cmd', x: 50, w: 44 }], tall: true },
      { bg: 'forest', chars: [{ who: 'cmd', x: 50, w: 44 }], bubbles: [{ speaker: '指挥官', text: '它扑过来之前，重心先往右偏了。', type: 'speech', side: 'left' }, { speaker: '指挥官', text: '你们两个，扛不住第二波。', type: 'speech', side: 'left' }] },
      { bg: 'forest', narr: '雾里，十几双绿幽幽的眼睛，一个接一个亮起来。', sfx: 'ギラッ', sfxPos: 'tr', tall: true },
      { bg: 'forest', chars: [{ who: 'teried', x: 38, w: 44 }, { who: 'cmd', x: 72, w: 40, dim: true }], narr: '旅人站在他身后半步，不动手，只说话。每一句，都正好比危险早半拍。', sfx: 'ドガッ', sfxPos: 'bl' },
      { bg: 'forest', chars: [{ who: 'teried', x: 50, w: 46 }], narr: '最后一只魔物，散成了褐尘。', bubbles: [{ speaker: '泰瑞德', text: '太强了……你这本事，正是我缺的！', type: 'speech', side: 'right' }] },
      { bg: 'forest', chars: [{ who: 'teried', x: 48, w: 48 }], bubbles: [{ speaker: '泰瑞德', text: '我要拉起一支佣兵团，亲手了结那个魔王！', type: 'shout', side: 'left' }], tall: true },
      { bg: 'forest', chars: [{ who: 'cmd', x: 52, w: 44 }], bubbles: [{ speaker: '指挥官', text: '梦想太大，路会很长。会死人。', type: 'speech', side: 'right' }] },
      { bg: 'forest', chars: [{ who: 'teried', x: 50, w: 46 }], bubbles: [{ speaker: '泰瑞德', text: '所以我才需要一个，能让大家都活着走到最后的——指挥官。', type: 'speech', side: 'left' }] },
      { bg: 'forest', chars: [{ who: 'teried', x: 36, w: 44 }, { who: 'cmd', x: 66, w: 42 }], narr: '旅人伸出了手。「接下来的路，我陪你们走一段。」', sfx: 'ぐっ', sfxPos: 'br' },
      { bg: 'forest', chars: [{ who: 'mina', x: 24, w: 38 }, { who: 'teried', x: 50, w: 42 }, { who: 'cmd', x: 76, w: 38 }], narr: '大陆历一〇二四年的一个早上，一支日后会被很多人记住的佣兵团，就这么开张了。', tall: true },
    ],
  },

  ep_twist: {
    title: '终章 · 魔王的真相',
    sub: '改编自《烬火行纪》第一卷终章',
    cover: 'castle',
    end: '——第一卷《启程之烬》 完',
    panels: [
      { bg: 'castle', narr: '魔王城，王座大厅。一路血战，他们终于站到了巴尔面前。', chars: [{ who: 'E:demon_lord', x: 54, w: 56 }], sfx: 'ゴゴゴ', sfxPos: 'tr', tall: true },
      { bg: 'castle', chars: [{ who: 'teried', x: 40, w: 46 }], bubbles: [{ speaker: '泰瑞德', text: '巴尔！今天，就是你的终点！', type: 'shout', side: 'left' }], sfx: 'カッ', sfxPos: 'tr' },
      { bg: 'castle', narr: '天翻地覆的一战。佣兵团一次次倒下，又一次次在彼此的守护下站起。', sfx: 'ドオオン', sfxPos: 'br', tall: true },
      { bg: 'castle', chars: [{ who: 'E:demon_lord', x: 50, w: 54 }], narr: '当狂暴的巴尔，还是被逼上了王座——他却做了一件谁也没想到的事。他笑了。', bubbles: [{ speaker: '巴尔', text: '……你以为，打倒我，就完了？', type: 'speech', side: 'right' }], sfx: 'クッ…', sfxPos: 'bl' },
      { bg: 'castle', chars: [{ who: 'E:demon_lord', x: 50, w: 54 }], bubbles: [{ speaker: '巴尔', text: '我不是这片大陆的征服者。我是「她」的——狱卒。', type: 'speech', side: 'right' }], tall: true },
      { bg: 'castle', narr: '褐尘，是「她」的呼吸。尘埋满大陆之日，就是永夜女皇涅夫提斯，睁眼之时。', sfx: '…………', sfxPos: 'br', tall: true },
      { bg: 'castle', chars: [{ who: 'E:demon_lord', x: 50, w: 54 }], bubbles: [{ speaker: '巴尔', text: '本王，是封她那把锁上，最后一道正在生锈的齿。', type: 'speech', side: 'right' }] },
      { bg: 'castle', chars: [{ who: 'teried', x: 44, w: 46 }], bubbles: [{ speaker: '泰瑞德', text: '所以……我们打倒你，反而让永夜来得更快了？', type: 'speech', side: 'left' }], sfx: '!?', sfxPos: 'tr' },
      { bg: 'castle', chars: [{ who: 'E:demon_lord', x: 50, w: 52, dim: true }], bubbles: [{ speaker: '巴尔', text: '替本王，看着点那扇门……撑住啊，凡人。', type: 'thought', side: 'right' }], sfx: 'サラ…', sfxPos: 'bl' },
      { bg: 'town', narr: '魔王城外，褐尘暂歇。东方，撑开了一线黎明。', chars: [{ who: 'cmd', x: 26, w: 36 }, { who: 'teried', x: 52, w: 40 }, { who: 'lecliss', x: 78, w: 36 }], bubbles: [{ speaker: '泰瑞德', text: '旅程没结束——才刚刚开始！下一站，永夜！', type: 'shout', side: 'left' }], tall: true },
    ],
  },

  ep_nightfall: {
    title: '永夜将明 · 女皇的摇篮曲',
    sub: '改编自《烬火行纪》第二卷终章',
    cover: 'castle',
    end: '——第二卷《永夜将明》 完',
    panels: [
      { bg: 'void', narr: '魔王陨落后，天没有亮。村镇一个接一个沉睡——人们闭上眼，再没醒来，嘴里哼着同一支摇篮曲。', sfx: '…呢喃…', sfxPos: 'tr', tall: true },
      { bg: 'forest_deep', narr: '白衣的圣女，提着一盏光。她走过的地方，褐尘像怕光一样退开。', chars: [{ who: 'refithea', x: 50, w: 46 }], bubbles: [{ speaker: '蕾菲西亚', text: '是有人，在哄整个世界睡过去。', type: 'speech', side: 'right' }] },
      { bg: 'void', narr: '永夜回廊。佣兵团，走向那扇虚掩的黑曜石大门。', chars: [{ who: 'teried', x: 30, w: 36 }, { who: 'refithea', x: 55, w: 34 }, { who: 'cmd', x: 78, w: 32, dim: true }], tall: true },
      { bg: 'castle', narr: '涅夫提斯坐在褐尘凝成的王座上，疲惫、温柔，像一位守夜太久、自己也快睡着的母亲。', chars: [{ who: 'E:shadow_empress', x: 52, w: 54 }], sfx: '……', sfxPos: 'tr', tall: true },
      { bg: 'castle', chars: [{ who: 'E:shadow_empress', x: 50, w: 52 }], bubbles: [{ speaker: '涅夫提斯', text: '这世界在受苦。我只想给它一场安眠……这难道，不是慈悲吗？', type: 'speech', side: 'right' }] },
      { bg: 'void', narr: '回廊为莉可莉丝，浮现出烬火镇的虚影。「回家吧，」幻影里的母亲招手，「歇歇吧，别再打仗了。」', chars: [{ who: 'lecliss', x: 50, w: 44, dim: true }], sfx: '…来呀…', sfxPos: 'bl', tall: true },
      { bg: 'castle', chars: [{ who: 'teried', x: 35, w: 40 }, { who: 'lecliss', x: 68, w: 40 }], narr: '泰瑞德一把攥住她的手腕。', bubbles: [{ speaker: '泰瑞德', text: '那不是真的。握着你手的我们，才是真的！', type: 'shout', side: 'left' }] },
      { bg: 'castle', chars: [{ who: 'mina', x: 50, w: 44 }], bubbles: [{ speaker: '米娜', text: '醒着会疼……但假的安睡，再温柔我也不要！我要醒着，跟大家一起！', type: 'shout', side: 'right' }], tall: true },
      { bg: 'castle', chars: [{ who: 'teried', x: 50, w: 46 }], bubbles: [{ speaker: '泰瑞德', text: '替这世界决定它该不该醒着的，是每个愿意揉揉眼继续走的人。这一次，我们选——醒着！', type: 'shout', side: 'left' }], tall: true },
      { bg: 'castle', narr: '一场没有恨意、却最为惨烈的战斗。当暗潮第一次裂开——一剑，刺穿了那片温柔的黑。', chars: [{ who: 'E:shadow_empress', x: 50, w: 52, dim: true }], sfx: 'ドオオン', sfxPos: 'br', tall: true },
      { bg: 'castle', chars: [{ who: 'E:shadow_empress', x: 50, w: 48, dim: true }], bubbles: [{ speaker: '涅夫提斯', text: '原来，有人愿意为了「醒着」疼成这样……替我，看看天亮的样子吧。', type: 'thought', side: 'right' }], sfx: 'サラ…', sfxPos: 'bl' },
      { bg: 'town', narr: '一千年的永夜，被彻底打碎。褐尘散尽，黎明铺满整片天空。', chars: [{ who: 'teried', x: 30, w: 36 }, { who: 'mina', x: 54, w: 32 }, { who: 'lecliss', x: 76, w: 34 }], bubbles: [{ speaker: '泰瑞德', text: '真亮啊。', type: 'speech', side: 'left' }], tall: true },
    ],
  },
};

window.Comic = Comic;
window.COMIC = COMIC;
