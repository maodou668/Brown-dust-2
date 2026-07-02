// ============================================================
//  《掌灯人》主线剧本（剧本 DSL，由 js/director.js 执行）
//  写作规矩见 story/圣经v2_掌灯人.md §4 行为卡 + §5 台词铁律。
//  op: adv(beats) / scene(cfg) / battle(stage) / comic(ep) / wait
// ============================================================

const SCRIPTS = {

  // ---------- 序章 · 点灯（垂直切片：五种演出各用一次） ----------
  prologue: [

    // 幕0 · ADV+CG：委托书特写
    { op: 'adv', beats: [
      { cg: 'art/06_story/cg/contract.png', text: '护送单。烛河镇，到磨坊桥。活人一名——卡佳。' },
      { cg: 'art/06_story/cg/contract.png', text: '报酬栏的数字被划掉过两次。一次比一次低。' },
      { text: '出发前，雇主只提了一个要求：走夜路。' },
    ]},

    // 幕1 · 场景演出：夜路行进 + 低语（实景图 + 泰瑞德提灯光晕）
    { op: 'scene', bg: 'forest', bgImg: 'art/06_story/scenes/night_road.png', night: true,
      actors: {
        teried: { sprite: 'teried', x: 14, y: 66, dir: 'east', glow: true },
        katja:  { sprite: 'katja',  x: 8,  y: 71, dir: 'east' },
        mina:   { sprite: 'mina',   x: 3,  y: 67, dir: 'east' },
      },
      steps: [
        { t: 'narr', text: '烛河镇外的林道。灯提在最前面。' },
        { t: 'move', who: 'teried', to: [40, 62], dur: 2400 },
        { t: 'move', who: 'katja',  to: [34, 68], dur: 2400 },
        { t: 'move', who: 'mina',   to: [28, 63], dur: 2400 },
        { t: 'wait', ms: 300 },
        { t: 'whisper', who: 'katja' },
        { t: 'face', who: 'katja', dir: 'west' },
        { t: 'wait', ms: 1400 },
        { t: 'face', who: 'teried', dir: 'west' },
        { t: 'say',  who: 'teried', text: '……饿了？前面镇上有卖热汤的。' },
        { t: 'say',  who: 'mina',  text: '（小声）前辈，她看的那边，没有路。' },
        { t: 'wait', ms: 600 },
        { t: 'face', who: 'katja', dir: 'east' },
        { t: 'say',  who: 'katja', text: '……没什么。走吧。' },
        { t: 'face', who: 'teried', dir: 'east' },
        { t: 'move', who: 'teried', to: [78, 62], dur: 2600 },
        { t: 'move', who: 'katja',  to: [72, 68], dur: 2600 },
        { t: 'move', who: 'mina',   to: [66, 63], dur: 2600 },
        { t: 'narr', text: '后半段路，没有人再说话。' },
      ],
    },

    // 幕2 · 战前对白 → 战斗（战中插话）→ 战后
    { op: 'adv', beats: [
      { bg: 'forest', bgImg: 'art/06_story/scenes/night_road.png', text: '磨坊桥前。三盏白灯拦在路中间。白灯，是教会的颜色。' },
      { speaker: '缉捕队长', text: '例行核对。这位女士的名字，在今年的名册上。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '名册上是个名字。人，在我们这。' },
      { speaker: '缉捕队长', text: '那就换个说法——把教会的东西留下。' },
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
      { bg: 'forest', bgImg: 'art/06_story/scenes/night_road.png', text: '白灯灭了两盏。剩下那盏，米娜捡起来，吹熄了。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '灯是好灯。就是主人不像话。' },
    ]},

    // 幕3 · ADV：交接（接应人立绘全程用正常版——此时玩家没有对照物）
    { op: 'adv', beats: [
      { bg: 'town', bgImg: 'art/06_story/scenes/town_gate.png', clear: true, text: '磨坊桥。桥那头，就是交接的镇子。' },
      { who: 'N:npc_meeter', side: 'right', speaker: '接应人', text: '可算到了！卡佳小姐吧？路上冷坏了吧。' },
      { who: 'N:npc_meeter', side: 'right', speaker: '接应人', text: '屋子备好了，炉子烧着。镇上人都盼着新邻居呢。' },
      { speaker: '卡佳', text: '……嗯。送到这就行。谢谢你们。' },
      { speaker: '指挥官', text: '（工钱袋，在手里。）',
        choice: [
          { t: '把工钱塞还给卡佳', flag: 'pro_paid_back' },
          { t: '收下工钱' },
        ] },
      { if: 'pro_paid_back', speaker: '卡佳', text: '……你们这样干活的，赚不到钱。（把钱袋推回来，只抽走一枚）买灯油。' },
      { ifNot: 'pro_paid_back', speaker: '卡佳', text: '钱货两讫。……是这么说的吧。再见。' },
      { text: '她走上桥。没有回头。' },
    ]},

    // 幕4 · 条漫：三格同构图
    { op: 'comic', ep: {
      title: '序章 · 点灯',
      sub: '掌灯人 · 主线',
      cover: 'town',
      end: '灯还亮着。',
      panels: [
        { bg: 'town', bgImg: 'art/06_story/scenes/town_gate.png', narr: '卡佳走进了镇门。', chars: [{ who: 'IMG:art/05_pixellab/katja_field/idle/north/00.png', x: 50, w: 22 }], h: 260 },
        { bg: 'town', bgImg: 'art/06_story/scenes/town_gate.png', narr: '三步之后，街上一个人也没有。', sfx: '……', sfxPos: 'tr', h: 260 },
        { bg: 'town', bgImg: 'art/06_story/scenes/town_gate.png', narr: '门内，一排人面向镇口站着。为首的，还在笑。', chars: [
          { who: 'N:npc_meeter_odd', x: 50, w: 13 },
          { who: 'N:npc_meeter_odd', x: 28, w: 10, dim: true },
          { who: 'N:npc_meeter_odd', x: 72, w: 10, dim: true },
        ], tall: true },
      ],
    }},

    // 幕5 · ADV：回程结算（吃饭分账 + 收尾钩子）
    { op: 'adv', beats: [
      { bg: 'forest', bgImg: 'art/06_story/scenes/campfire.png', clear: true, text: '回程。篝火。工钱摊在石头上分。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '米娜的药材钱，从我这份里扣。记账上。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '账上你已经欠到明年了！' },
      { if: 'pro_paid_back', who: 'teried', side: 'left', speaker: '泰瑞德', text: '……钱少一份，饭不能少。明天进镇，我请。' },
      { ifNot: 'pro_paid_back', who: 'teried', side: 'left', speaker: '泰瑞德', text: '今天的钱是干净的。睡吧。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '指挥官。那个镇子的人……笑起来，是不是都一个样子？' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '……睡吧。明天还有单。' },
      { clear: true, text: '那晚的灯，留到了天亮。—— 序章 · 完' },
    ]},
  ],
};

window.SCRIPTS = SCRIPTS;
