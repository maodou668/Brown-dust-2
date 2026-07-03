// ============================================================
//  《掌灯人》主线剧本（剧本 DSL，由 js/director.js 执行）
//  ⚠️ 文案分工：台词/旁白由用户终审改写，本文件内文本均为工程草稿口径。
//  op: adv(beats) / scene(cfg) / battle(stage) / comic(ep) / wait
// ============================================================

// 主线章节表（章节选择弹窗 UI.showMainStory 用）
window.MAIN_CHAPTERS = [
  { id: 'prologue', title: '序章 · 点灯', desc: '一桩护送单' },
  { id: 'chapter1', title: '第一章 · 空屋', desc: '磨坊的叔叔', needs: 'prologue' },
];

const SCRIPTS = {

  // ---------- 序章 · 点灯（垂直切片：五种演出各用一次） ----------
  prologue: [

    // 幕0 · ADV+CG：委托书特写
    { op: 'adv', beats: [
      { text: '护送单。烛河镇到磨坊桥，活人一名，卡佳。' },
      { text: '报酬那栏划掉过两次：四十银改二十五，二十五改十二。第二道墨还没干透。' },
      { text: '雇主没露面。单子背面多一行小字：走夜路，灯别灭。' },
    ]},

    // 幕1 · 场景演出：夜路行进 + 低语（Diorama v3：雨夜密林 + 泰瑞德提灯）
    { op: 'scene', bg: 'forest',
      stage: (() => {
        const T = 'art/06_story/tiles/';
        const P = 'art/06_story/props/';
        const R = rs => { const a = Array(49).fill('0'); for (const [s, e] of rs) for (let i = s; i <= e; i++) a[i] = '1'; return a.join(''); };
        const rep = (n, f) => Array.from({ length: n }, f);
        const roadGrid = [
          ...rep(9, () => R([])),
          R([[5, 7], [22, 24], [38, 40]]),
          ...rep(4, () => R([[0, 48]])),
          R([[11, 13], [29, 31], [43, 45]]),
          ...rep(6, () => R([])),
        ];
        return {
        pxScale: 2, actorScale: 1,
        mute: 0.28, gloom: 'rgb(152,166,160)', tone: 'rgba(30,50,80,.10)',
        night: true, rain: true,
        cam: { x: 18, y: 54 },
        map: {
          tile: 32,
          layers: [
            { sheet: T + 'grass_var.png', fullVar: [
              [0,0],[0,0],[0,0],[32,0],[0,0],[64,0],[0,0],[0,0],[96,0],[0,0],[128,0],[0,0],[0,0],[160,0],[0,0],[32,0],
            ] },
            { sheet: T + 'road_grass.png', lut: T + 'road_grass.lut.json', grid: roadGrid },
          ],
        },
        props: [
          // 北侧密林（压向路缘，遮天蔽日）
          { img: P + 'tree_oak.png',  x: 2,    y: 6.5, s: 0.9 },
          { img: P + 'tree_dead.png', x: 5.5,  y: 8.5, s: 0.75 },
          { img: P + 'tree_oak.png',  x: 8,    y: 5,   s: 0.7 },
          { img: P + 'tree_oak.png',  x: 12,   y: 8,   s: 0.95 },
          { img: P + 'tree_dead.png', x: 16.5, y: 6,   s: 0.8 },
          { img: P + 'tree_oak.png',  x: 20,   y: 8.8, s: 0.85 },
          { img: P + 'tree_oak.png',  x: 24.5, y: 5.5, s: 0.75 },
          { img: P + 'tree_dead.png', x: 28,   y: 8.2, s: 0.9 },
          { img: P + 'tree_oak.png',  x: 32,   y: 6.8, s: 0.8 },
          { img: P + 'tree_oak.png',  x: 36.5, y: 8.6, s: 0.92 },
          { img: P + 'tree_dead.png', x: 40,   y: 5.8, s: 0.72 },
          { img: P + 'tree_oak.png',  x: 44,   y: 8,   s: 0.85 },
          { img: P + 'tree_oak.png',  x: 47.5, y: 6,   s: 0.78 },
          { img: P + 'rocks.png',     x: 14,   y: 9.6, s: 0.3 },
          { img: P + 'rocks.png',     x: 34.5, y: 9.4, s: 0.35 },
          // 南侧密林（前景更大，剪影感）
          { img: P + 'tree_oak.png',  x: 3.5,  y: 17.5, s: 1.0 },
          { img: P + 'tree_dead.png', x: 8.5,  y: 15.8, s: 0.85 },
          { img: P + 'tree_oak.png',  x: 13,   y: 18.5, s: 1.05 },
          { img: P + 'tree_oak.png',  x: 18.5, y: 16,   s: 0.9 },
          { img: P + 'tree_dead.png', x: 23,   y: 18.8, s: 0.95 },
          { img: P + 'tree_oak.png',  x: 27.5, y: 16.2, s: 0.88 },
          { img: P + 'tree_oak.png',  x: 32.5, y: 18.2, s: 1.0 },
          { img: P + 'tree_dead.png', x: 37,   y: 15.6, s: 0.8 },
          { img: P + 'tree_oak.png',  x: 41.5, y: 18.6, s: 1.05 },
          { img: P + 'tree_oak.png',  x: 46,   y: 16.4, s: 0.9 },
          // 路边遗物：歪斜的旧栅栏、石堆
          { img: P + 'fence_rail.png', x: 10.5, y: 14.6, s: 0.28 },
          { img: P + 'fence_rail.png', x: 30,   y: 14.4, s: 0.28 },
          { img: P + 'rocks.png',      x: 21,   y: 14.8, s: 0.28 },
        ],
        };
      })(),
      actors: {
        teried: { sprite: 'teried', x: 8, y: 55, dir: 'east', glow: true },
        katja:  { sprite: 'katja',  x: 4, y: 58, dir: 'east' },
        mina:   { sprite: 'mina',   x: 1, y: 53, dir: 'east' },
      },
      steps: [
        { t: 'narr', text: '烛河镇外的林道。泰瑞德把灯挑在队伍最前面，出门前刚添满的油。' },
        { t: 'say',  who: 'teried', text: '夜路就一条规矩：路边有谁喊你，喊什么名字都别应。' },
        { t: 'say',  who: 'teried', text: '去年有个脚夫应了一声。人还在，会走路会吃饭。他老婆说那不是他。' },
        { t: 'camera', x: 42, y: 54, scale: 1, dur: 2600 },
        { t: 'move', who: 'teried', to: [38, 54], dur: 2600 },
        { t: 'move', who: 'katja',  to: [33, 58], dur: 2600 },
        { t: 'move', who: 'mina',   to: [28, 53], dur: 2600 },
        { t: 'wait', ms: 300 },
        { t: 'whisper', who: 'katja' },
        { t: 'face', who: 'katja', dir: 'west' },
        { t: 'wait', ms: 1400 },
        { t: 'face', who: 'teried', dir: 'west' },
        { t: 'say',  who: 'teried', text: '……饿了？前面镇上有卖热汤的。' },
        { t: 'say',  who: 'mina',  text: '（小声）前辈，她看的那边没有路，全是灌木。' },
        { t: 'wait', ms: 600 },
        { t: 'face', who: 'katja', dir: 'east' },
        { t: 'say',  who: 'katja', text: '……没什么。走吧。' },
        { t: 'face', who: 'teried', dir: 'east' },
        { t: 'camera', x: 72, y: 54, scale: 1, dur: 2800 },
        { t: 'move', who: 'teried', to: [74, 54], dur: 2800 },
        { t: 'move', who: 'katja',  to: [69, 58], dur: 2800 },
        { t: 'move', who: 'mina',   to: [64, 53], dur: 2800 },
        { t: 'narr', text: '后半段路没人说话。只有灯芯偶尔爆一声。' },
      ],
    },

    // 幕2 · 战前对白 → 战斗（战中插话）→ 战后
    { op: 'adv', beats: [
      { bg: 'forest', text: '磨坊桥前，三盏白灯在路中间排成一排。教会的灯——白得不冒一点烟。' },
      { speaker: '缉捕队长', text: '例行核对。这位女士的名字在今年的名册上，第一页。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '名册上那是三个字。人在我们这儿。' },
      { speaker: '缉捕队长', text: '那就换个说法。把教会的东西留下，你们走你们的。' },
    ]},
    { op: 'battle', stage: {
      id: 'sc_prologue', name: '磨坊桥 · 缉捕队', isBoss: false,
      enemies: [
        { char: 'loen',   level: 1, name: '圣烛缉捕兵' },
        { char: 'garcia', level: 2, name: '缉捕队长' },
        { char: 'loen',   level: 1, name: '圣烛缉捕兵' },
      ],
      mod: { atkMul: 0.65, hpMul: 0.55 },   // 教学战：新档双人 lv1 必赢，回合数控制在 4-6
      reward: { gold: 120, gem: 30, exp: 40 },
      interject: { frac: 0.5, speaker: '缉捕队长', text: '她报过名了！你们抢的，是教会的东西——' },
    }},
    { op: 'adv', beats: [
      { bg: 'forest', text: '白灯灭了两盏。最后一盏倒在桥板上还亮着，米娜捡起来，吹了三口才吹熄。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '灯是好灯。就是主人不像话。' },
      { text: '米娜蹲下去翻缉捕兵的腰包：半袋盐，一小瓶灯油，一册名单。盐和油她揣进自己包里。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '名单给你，指挥官。第一页真有卡佳。……后面还有小半本没划掉的。' },
    ]},

    // 幕3 · ADV：交接（接应人立绘全程用正常版——此时玩家没有对照物）
    { op: 'adv', beats: [
      { bg: 'town', clear: true, text: '磨坊桥。桥那头的镇门虚掩着，门缝里漏出一条暖黄的光。' },
      { who: 'N:npc_meeter', side: 'right', speaker: '接应人', text: '可算到了！卡佳小姐吧？快别在风口上站着。' },
      { who: 'N:npc_meeter', side: 'right', speaker: '接应人', text: '屋子给你备好了，炉子烧了一整晚。镇上人都念叨你呢——说你腌的酸菜是一绝。' },
      { text: '卡佳在桥中间停了半步。很短，短得只有走在最后的人才看得见。' },
      { speaker: '卡佳', text: '……嗯。送到这就行。' },
      { speaker: '指挥官', text: '（工钱袋，在手里。）',
        choice: [
          { t: '把工钱塞还给卡佳', flag: 'pro_paid_back' },
          { t: '收下工钱' },
        ] },
      { if: 'pro_paid_back', speaker: '卡佳', text: '……你们这样干活的，攒不下钱。' },
      { if: 'pro_paid_back', text: '她把钱袋原样推了回来，只抽走一枚银币，捏在手心里看了看。' },
      { if: 'pro_paid_back', speaker: '卡佳', text: '这枚我收下。给你们买灯油。' },
      { ifNot: 'pro_paid_back', speaker: '卡佳', text: '钱货两讫。……是这么说的吧，你们干这行的。' },
      { text: '她走上桥，没回头。她身后，镇门比刚才开大了一些。' },
    ]},

    // 幕4 · 条漫：三格同构图
    { op: 'comic', ep: {
      title: '序章 · 点灯',
      sub: '掌灯人 · 主线',
      cover: 'town',
      end: '灯还亮着。',
      panels: [
        { bg: 'town', narr: '卡佳走进了镇门。', chars: [{ who: 'IMG:art/05_pixellab/katja_field/idle/north/00.png', x: 50, w: 22 }], h: 260 },
        { bg: 'town', narr: '三步之后，街上一个人也没有。炉火的光还亮着。', sfx: '……', sfxPos: 'tr', h: 260 },
        { bg: 'town', narr: '门内站着一排人，脸都朝着镇口。为首的还在笑——和刚才那个笑，一模一样。', chars: [
          { who: 'N:npc_meeter_odd', x: 50, w: 13 },
          { who: 'N:npc_meeter_odd', x: 28, w: 10, dim: true },
          { who: 'N:npc_meeter_odd', x: 72, w: 10, dim: true },
        ], tall: true },
      ],
    }},

    // 幕5 · ADV：回程结算（吃饭分账 + 收尾钩子）
    { op: 'adv', beats: [
      { bg: 'forest', clear: true, text: '回程在林子边上扎营。工钱摊在石头上，分成三小堆。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '米娜的药材钱，从我这份里扣。记账上。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '账上你已经欠到明年开春了！' },
      { text: '泰瑞德把灯油罐倒过来晃了晃，就着火光眯眼估分量。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '明天进镇先买油。这单挣的，小半得喂灯。' },
      { if: 'pro_paid_back', who: 'teried', side: 'left', speaker: '泰瑞德', text: '……钱少一份，饭不能少。明天进镇我请，谁也别跟我抢着付。' },
      { ifNot: 'pro_paid_back', who: 'teried', side: 'left', speaker: '泰瑞德', text: '今天这钱挣得干净。睡吧。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '指挥官，我一直在想那个接头的人。他跟我们说了那么半天话……' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '……我没见他眨过一次眼。一次都没有。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '……睡吧。明天还有单。' },
      { clear: true, text: '那晚的灯留到了天亮，没人去省那点灯油。—— 序章 · 完' },
    ]},
  ],
  // ---------- 第一章 · 空屋（全村都认识磨坊的叔叔；查无此人） ----------
  chapter1: [

    // 幕0 · ADV+CG：村民凑钱的委托书
    { op: 'adv', beats: [
      { text: '委托书。字迹歪歪扭扭，落款按了十一个红手印。' },
      { text: '"请掌灯的来看看磨坊的叔叔。他最近不对。"' },
      { text: '报酬一栏写着：全村凑的，一共三十七银，先付一半。' },
    ]},

    // 幕1 · 场景演出：白天进村（Diorama v3 · PixelLab 全自产锚点风格A + 构图规范）
    { op: 'scene', bg: 'town',
      stage: (() => {
        const T = 'art/06_story/tiles/';
        const P = 'art/06_story/props/';
        const R = rs => { const a = Array(45).fill('0'); for (const [s, e] of rs) for (let i = s; i <= e; i++) a[i] = '1'; return a.join(''); };
        const rep = (n, f) => Array.from({ length: n }, f);
        const roadGrid = [
          ...rep(9, () => R([])),
          ...rep(2, () => R([[20, 23], [33, 36]])),
          ...rep(2, () => R([[17, 28], [33, 36]])),
          R([[17, 28], [33, 36], [3, 4], [10, 11], [30, 31]]),
          ...rep(4, () => R([[0, 38]])),
          R([[7, 8], [14, 15], [20, 21], [28, 29], [36, 37]]),
          ...rep(8, () => R([])),
        ];
        return {
        pxScale: 2, actorScale: 1,
        mute: 0.24, gloom: 'rgb(203,214,203)', tone: 'rgba(60,95,80,.07)',
        cam: { x: 22, y: 52 },
        map: {
          tile: 32,
          layers: [
            { sheet: T + 'grass_var.png', fullVar: [
              [0,0],[0,0],[0,0],[32,0],[0,0],[64,0],[0,0],[0,0],[96,0],[0,0],[128,0],[0,0],[0,0],[160,0],[0,0],[32,0],
            ] },   // L0 草地基底（锚点+5变体散布）
            { sheet: T + 'road_grass.png', lut: T + 'road_grass.lut.json', grid: roadGrid },   // L1 土路
          ],
        },
        props: [
          // 北缘树线（收边，疏密不均）
          { img: P + 'tree_oak.png',  x: 3,    y: 2.6, s: 0.7 },
          { img: P + 'tree_dead.png', x: 8,    y: 2.2, s: 0.6 },
          { img: P + 'tree_oak.png',  x: 13.5, y: 2.9, s: 0.62 },
          { img: P + 'tree_oak.png',  x: 16.8, y: 1.8, s: 0.5 },
          { img: P + 'tree_dead.png', x: 39.5, y: 2.7, s: 0.65 },
          { img: P + 'tree_oak.png',  x: 39.2, y: 4.8, s: 0.55 },
          // 坟场（磨坊西侧林缘）
          { img: P + 'tree_dead.png', x: 28.6, y: 4.6, s: 0.62 },
          { img: P + 'graves.png',    x: 30.4, y: 5.6, s: 0.55 },
          { img: P + 'tree_dead.png', x: 32.6, y: 3.9, s: 0.5 },
          // 院A · 木构民房（门朝南接支路）+ 院界栅栏（门前留口）
          { img: P + 'house_timber.png', x: 21.5, y: 9,    s: 0.8 },
          { img: P + 'fence_rail.png',   x: 16.9, y: 10.3, s: 0.28 },
          { img: P + 'fence_rail.png',   x: 18.5, y: 10.3, s: 0.28 },
          { img: P + 'fence_rail.png',   x: 24.6, y: 10.3, s: 0.28 },
          { img: P + 'fence_rail.png',   x: 26.2, y: 10.3, s: 0.28 },
          { img: P + 'tree_oak.png',     x: 25.9, y: 7.2,  s: 0.55 },
          { img: P + 'firewood.png',     x: 18.6, y: 8.9,  s: 0.5 },
          // 磨坊（焦点建筑，支路引导视线）+ 干草车
          { img: P + 'windmill_big.png', x: 35,  y: 9,   s: 0.62 },
          { img: P + 'hay_cart.png', x: 32.3, y: 13.4, s: 0.5 },
          // 院B · 石屋（临主路）+ 灯柱
          { img: P + 'house_stone.png', x: 10,   y: 13.7, s: 0.75 },
          { img: P + 'lantern.png',     x: 13.2, y: 13.5, s: 0.45, glow: { r: 2.6 } },
          { img: P + 'fence_rail.png',  x: 6.8,  y: 13.9, s: 0.28 },
          { img: P + 'crate_barrel.png', x: 12.2, y: 13.6, s: 0.4 },
          // 广场：水井 + 灯柱
          { img: P + 'well.png',     x: 22.5, y: 12.4, s: 0.38 },
          { img: P + 'lantern.png',  x: 26.6, y: 11.7, s: 0.45, glow: { r: 2.6 } },
          // 主路南侧栅栏段（草地上，压路缘）
          { img: P + 'fence_rail.png', x: 3.6,  y: 18.6, s: 0.28 },
          { img: P + 'fence_rail.png', x: 5.2,  y: 18.6, s: 0.28 },
          { img: P + 'fence_rail.png', x: 30.6, y: 18.4, s: 0.28 },
          { img: P + 'fence_rail.png', x: 32.2, y: 18.4, s: 0.28 },
          { img: P + 'rocks.png',      x: 12.5, y: 19,   s: 0.28 },
          { img: P + 'rocks.png',      x: 38.6, y: 11,   s: 0.35 },
          // 南缘树林（三簇 + 大留白，簇内大小错落）
          { img: P + 'tree_oak.png',  x: 2,    y: 20.8, s: 0.82 },
          { img: P + 'tree_oak.png',  x: 4.6,  y: 22.6, s: 0.58 },
          { img: P + 'tree_dead.png', x: 6.6,  y: 21.2, s: 0.66 },
          { img: P + 'tree_oak.png',  x: 3.4,  y: 25,   s: 0.72 },
          { img: P + 'tree_oak.png',  x: 17.5, y: 23.6, s: 0.85 },
          { img: P + 'tree_oak.png',  x: 20.6, y: 21.6, s: 0.6 },
          { img: P + 'tree_dead.png', x: 22.8, y: 24.6, s: 0.68 },
          { img: P + 'tree_oak.png',  x: 33.5, y: 21.2, s: 0.75 },
          { img: P + 'tree_oak.png',  x: 36.8, y: 23,   s: 0.62 },
          { img: P + 'tree_dead.png', x: 39,   y: 20.6, s: 0.55 },
          { img: P + 'tree_oak.png',  x: 35.2, y: 25.4, s: 0.85 },
          // 西缘
          { img: P + 'tree_oak.png',  x: 1,   y: 7,  s: 0.7 },
          { img: P + 'tree_dead.png', x: 1.5, y: 12, s: 0.55 },
          // 东缘树线收口
          { img: P + 'tree_oak.png',  x: 43,   y: 8,    s: 0.72 },
          { img: P + 'tree_dead.png', x: 43.5, y: 12.5, s: 0.6 },
          { img: P + 'tree_oak.png',  x: 42.6, y: 17.5, s: 0.68 },
          { img: P + 'tree_oak.png',  x: 43.4, y: 23,   s: 0.78 },
        ],
        };
      })(),
      actors: {
        teried:   { sprite: 'teried',   x: 3,  y: 57, dir: 'east' },
        mina:     { sprite: 'mina',     x: 1,  y: 60, dir: 'east' },
        villager: { sprite: 'villager', x: 54, y: 51, dir: 'west' },
      },
      steps: [
        { t: 'narr', text: '灰蒙蒙的上午。鸡在栅栏边刨食，烟囱都冒着烟。看上去是个活的村子。' },
        { t: 'camera', x: 50, y: 52, scale: 1, dur: 2800 },
        { t: 'move', who: 'teried', to: [47, 56], dur: 2800 },
        { t: 'move', who: 'mina',   to: [41, 59], dur: 2200 },
        { t: 'say',  who: 'villager', text: '掌灯的吧？可把你们盼来了。' },
        { t: 'say',  who: 'villager', text: '磨坊在村东头。叔叔人好，就是最近不对。' },
        { t: 'say',  who: 'teried', text: '哪里不对？' },
        { t: 'wait', ms: 900 },
        { t: 'say',  who: 'villager', text: '……就是不对。你们看了就知道。' },
        { t: 'narr', text: '问第三个人，答的还是这两个字。全村像商量好了一样。' },
      ],
    },

    // 幕2 · ADV：挨家打听（口供对不上 + 复问机制首秀）
    { op: 'adv', beats: [
      { bg: 'town', clear: true, text: '村长家。屋里烧着奶茶，很香。' },
      { who: 'N:npc_headman', side: 'right', speaker: '村长', text: '叔叔啊。高个，人瘦，在磨坊住了二十年喽。娃娃们都吃过他烤的饼。' },
      { speaker: '指挥官', text: '（问：他姓什么？）' },
      { who: 'N:npc_headman', side: 'right', speaker: '村长', text: '姓……嗐，你看我这记性。都叫叔叔，叫了二十年。' },
      { bg: 'town', clear: true, text: '隔壁院子。妇人在收晾了一半的衣裳。' },
      { who: 'N:npc_wife', side: 'right', speaker: '村妇', text: '叔叔？矮墩墩的那个呀，胳膊粗。七年前逃荒来的，磨坊空着，就住下了。' },
      { who: 'mina', side: 'left', speaker: '米娜', text: '（小声）村长说他又高又瘦，住了二十年。' },
      { speaker: '指挥官', text: '（再核一遍。）',
        choice: [
          { t: '再问村长一遍叔叔的样子', flag: 'c1_reask' },
          { t: '直接去磨坊' },
        ] },
      { if: 'c1_reask', bg: 'town', clear: true, text: '又回到村长家。奶茶还是那个香法。' },
      { if: 'c1_reask', who: 'N:npc_headman', side: 'right', speaker: '村长', text: '叔叔啊。高个，人瘦，在磨坊住了二十年喽。娃娃们都吃过他烤的饼。' },
      { if: 'c1_reask', who: 'mina', side: 'left', speaker: '米娜', text: '（小声）……一个字都没变。连"喽"都在原来的地方。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '去磨坊。' },
    ]},

    // 幕3 · 场景演出：磨坊内部
    { op: 'scene', bg: 'cave', 
      actors: {
        teried: { sprite: 'teried', x: 12, y: 86, dir: 'east', glow: true },
        mina:   { sprite: 'mina',   x: 4,  y: 89, dir: 'east' },
      },
      steps: [
        { t: 'narr', text: '门没锁。灰有小腿厚，地上只有一种脚印——他们自己的。' },
        { t: 'move', who: 'teried', to: [40, 85], dur: 2000 },
        { t: 'move', who: 'mina',   to: [32, 88], dur: 2000 },
        { t: 'camera', scale: 1.5, x: 55, y: 55, dur: 900 },
        { t: 'narr', text: '长桌上摆着十一副碗筷。碗里的灰和地上一样厚。' },
        { t: 'say',  who: 'teried', text: '十一副。和委托书上的手印一个数。' },
        { t: 'say',  who: 'mina', text: '这屋里有股药味。熬过很多年的那种……我在别的地方闻到过。' },
        { t: 'wait', ms: 800 },
        { t: 'whisper', who: 'mina' },
        { t: 'say',  who: 'mina', text: '……楼上。' },
        { t: 'camera', scale: 1, x: 50, y: 50, dur: 700 },
      ],
    },

    // 幕4 · 战斗：磨坊里的东西（战中插话用村民的原话）
    { op: 'battle', stage: {
      id: 'sc_chapter1', name: '磨坊 · 二楼', isBoss: false,
      enemies: [
        { id: 'wolf', level: 3, name: '从梁上下来的东西' },
        { id: 'dark_mage', level: 4, name: '磨坊里的东西' },
        { id: 'wolf', level: 3, name: '从梁上下来的东西' },
      ],
      mod: { atkMul: 0.85, hpMul: 0.8 },
      reward: { gold: 180, gem: 40, exp: 60 },
      interject: { frac: 0.5, speaker: '磨坊里的东西', text: '叔叔人好。就是最近，不对。' },
    }},

    // 幕5 · ADV：收尾（真相处置选择支 + 身世钩子）
    { op: 'adv', beats: [
      { bg: 'town', clear: true, text: '出磨坊的时候，全村人都等在坡下。十一个人，站得整整齐齐。' },
      { who: 'N:npc_headman', side: 'right', speaker: '村长', text: '解决了？叔叔他……能安生了？' },
      { speaker: '指挥官', text: '（怎么答。）',
        choice: [
          { t: '告诉他们：磨坊里从来没住过人', flag: 'c1_truth' },
          { t: '收下尾款：解决了' },
        ] },
      { if: 'c1_truth', who: 'N:npc_headman_odd', side: 'right', speaker: '村长', text: '……没住过人？你这话说的。娃娃们的饼，是谁烤的？' },
      { if: 'c1_truth', text: '十一个人都在点头。没有一个人的眼睛在看磨坊。' },
      { ifNot: 'c1_truth', who: 'N:npc_headman', side: 'right', speaker: '村长', text: '好，好。剩下的十八银半，你们点点。' },
      { ifNot: 'c1_truth', text: '钱是十一家凑的，铜板银角混在一起，还带着体温。' },
      { bg: 'forest', clear: true, text: '当晚在村外扎营。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '十一副碗筷……我老家吃席也这么摆。谁家有事，全村凑一桌。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '可他们凑的这一桌，主位上是空的。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '那股药味我想起来了。我梦里学方子的那间屋，就是那个味。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '……我从来没跟你们说过，教我方子的婆婆，住在哪。' },
      { clear: true, text: '灯拨亮了一格。—— 第一章 · 完' },
    ]},
  ],

};

window.SCRIPTS = SCRIPTS;
