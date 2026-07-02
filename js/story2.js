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
      { cg: 'art/06_story/cg/contract.png', text: '护送单。烛河镇到磨坊桥，活人一名，卡佳。' },
      { cg: 'art/06_story/cg/contract.png', text: '报酬那栏划掉过两次：四十银改二十五，二十五改十二。第二道墨还没干透。' },
      { text: '雇主没露面。单子背面多一行小字：走夜路，灯别灭。' },
    ]},

    // 幕1 · 场景演出：夜路行进 + 低语（实景图 + 泰瑞德提灯光晕）
    { op: 'scene', bg: 'forest', bgImg: 'art/06_story/scenes/night_road.png', night: true,
      actors: {
        teried: { sprite: 'teried', x: 14, y: 66, dir: 'east', glow: true },
        katja:  { sprite: 'katja',  x: 8,  y: 71, dir: 'east' },
        mina:   { sprite: 'mina',   x: 3,  y: 67, dir: 'east' },
      },
      steps: [
        { t: 'narr', text: '烛河镇外的林道。泰瑞德把灯挑在队伍最前面，出门前刚添满的油。' },
        { t: 'move', who: 'teried', to: [40, 62], dur: 2400 },
        { t: 'move', who: 'katja',  to: [34, 68], dur: 2400 },
        { t: 'move', who: 'mina',   to: [28, 63], dur: 2400 },
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
        { t: 'move', who: 'teried', to: [78, 62], dur: 2600 },
        { t: 'move', who: 'katja',  to: [72, 68], dur: 2600 },
        { t: 'move', who: 'mina',   to: [66, 63], dur: 2600 },
        { t: 'narr', text: '后半段路没人说话。只有灯芯偶尔爆一声。' },
      ],
    },

    // 幕2 · 战前对白 → 战斗（战中插话）→ 战后
    { op: 'adv', beats: [
      { bg: 'forest', bgImg: 'art/06_story/scenes/night_road.png', text: '磨坊桥前，三盏白灯在路中间排成一排。教会的灯——白得不冒一点烟。' },
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
      { bg: 'forest', bgImg: 'art/06_story/scenes/night_road.png', text: '白灯灭了两盏。最后一盏倒在桥板上还亮着，米娜捡起来，吹了三口才吹熄。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '灯是好灯。就是主人不像话。' },
    ]},

    // 幕3 · ADV：交接（接应人立绘全程用正常版——此时玩家没有对照物）
    { op: 'adv', beats: [
      { bg: 'town', bgImg: 'art/06_story/scenes/town_gate.png', clear: true, text: '磨坊桥。桥那头的镇门虚掩着，门缝里漏出一条暖黄的光。' },
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
        { bg: 'town', bgImg: 'art/06_story/scenes/town_gate.png', narr: '卡佳走进了镇门。', chars: [{ who: 'IMG:art/05_pixellab/katja_field/idle/north/00.png', x: 50, w: 22 }], h: 260 },
        { bg: 'town', bgImg: 'art/06_story/scenes/town_gate.png', narr: '三步之后，街上一个人也没有。炉火的光还亮着。', sfx: '……', sfxPos: 'tr', h: 260 },
        { bg: 'town', bgImg: 'art/06_story/scenes/town_gate.png', narr: '门内站着一排人，脸都朝着镇口。为首的还在笑——和刚才那个笑，一模一样。', chars: [
          { who: 'N:npc_meeter_odd', x: 50, w: 13 },
          { who: 'N:npc_meeter_odd', x: 28, w: 10, dim: true },
          { who: 'N:npc_meeter_odd', x: 72, w: 10, dim: true },
        ], tall: true },
      ],
    }},

    // 幕5 · ADV：回程结算（吃饭分账 + 收尾钩子）
    { op: 'adv', beats: [
      { bg: 'forest', bgImg: 'art/06_story/scenes/campfire.png', clear: true, text: '回程在林子边上扎营。工钱摊在石头上，分成三小堆。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '米娜的药材钱，从我这份里扣。记账上。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '账上你已经欠到明年开春了！' },
      { if: 'pro_paid_back', who: 'teried', side: 'left', speaker: '泰瑞德', text: '……钱少一份，饭不能少。明天进镇我请，谁也别跟我抢着付。' },
      { ifNot: 'pro_paid_back', who: 'teried', side: 'left', speaker: '泰瑞德', text: '今天这钱挣得干净。睡吧。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '指挥官，我一直在想那个接头的人。他跟我们说了那么半天话……' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '……我没见他眨过一次眼。一次都没有。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '……睡吧。明天还有单。' },
      { clear: true, text: '那晚的灯留到了天亮，没人去省那点灯油。—— 序章 · 完' },
    ]},
  ],
};

window.SCRIPTS = SCRIPTS;
