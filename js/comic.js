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

  /** 角色立绘（复用 Story 的占位立绘；指挥官用专属灰袍剪影） */
  charHTML(token) {
    if (!token) return '';
    if (token === 'cmd') {
      return `<div class="port-art" style="--c:#8a8f9c;">
        <div class="port-silhouette"></div>
        <div class="port-icon">🧭</div></div>`;
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
          <div class="comic-end">— 完 —<br><span>${ep.end || ''}</span></div>
        </div>
      </div>`);
    document.body.appendChild(this.root);
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
};

window.Comic = Comic;
window.COMIC = COMIC;
