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
        { t: 'say',  who: 'teried', text: '夜路就一条规矩：路边有谁喊你，喊什么名字都别应。' },
        { t: 'say',  who: 'teried', text: '去年有个脚夫应了一声。人还在，会走路会吃饭。他老婆说那不是他。' },
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
      { text: '米娜蹲下去翻缉捕兵的腰包：半袋盐，一小瓶灯油，一册名单。盐和油她揣进自己包里。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '名单给你，指挥官。第一页真有卡佳。……后面还有小半本没划掉的。' },
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
      { cg: 'art/06_story/cg/contract2.png', text: '委托书。字迹歪歪扭扭，落款按了十一个红手印。' },
      { cg: 'art/06_story/cg/contract2.png', text: '"请掌灯的来看看磨坊的叔叔。他最近不对。"' },
      { text: '报酬一栏写着：全村凑的，一共三十七银，先付一半。' },
    ]},

    // 幕1 · 场景演出：白天进村
    { op: 'scene', bg: 'town', bgImg: 'art/06_story/scenes/village_day.png',
      actors: {
        teried:   { sprite: 'teried',   x: 6,  y: 66, dir: 'east' },
        mina:     { sprite: 'mina',     x: 1,  y: 68, dir: 'east' },
        villager: { sprite: 'villager', x: 62, y: 64, dir: 'west' },
      },
      steps: [
        { t: 'narr', text: '灰蒙蒙的上午。鸡在栅栏边刨食，烟囱都冒着烟。看上去是个活的村子。' },
        { t: 'move', who: 'teried', to: [40, 65], dur: 2200 },
        { t: 'move', who: 'mina',   to: [33, 67], dur: 2200 },
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
      { bg: 'town', bgImg: 'art/06_story/scenes/village_day.png', clear: true, text: '村长家。屋里烧着奶茶，很香。' },
      { who: 'N:npc_headman', side: 'right', speaker: '村长', text: '叔叔啊。高个，人瘦，在磨坊住了二十年喽。娃娃们都吃过他烤的饼。' },
      { speaker: '指挥官', text: '（问：他姓什么？）' },
      { who: 'N:npc_headman', side: 'right', speaker: '村长', text: '姓……嗐，你看我这记性。都叫叔叔，叫了二十年。' },
      { bg: 'town', bgImg: 'art/06_story/scenes/village_day.png', clear: true, text: '隔壁院子。妇人在收晾了一半的衣裳。' },
      { who: 'N:npc_wife', side: 'right', speaker: '村妇', text: '叔叔？矮墩墩的那个呀，胳膊粗。七年前逃荒来的，磨坊空着，就住下了。' },
      { who: 'mina', side: 'left', speaker: '米娜', text: '（小声）村长说他又高又瘦，住了二十年。' },
      { speaker: '指挥官', text: '（再核一遍。）',
        choice: [
          { t: '再问村长一遍叔叔的样子', flag: 'c1_reask' },
          { t: '直接去磨坊' },
        ] },
      { if: 'c1_reask', bg: 'town', bgImg: 'art/06_story/scenes/village_day.png', clear: true, text: '又回到村长家。奶茶还是那个香法。' },
      { if: 'c1_reask', who: 'N:npc_headman', side: 'right', speaker: '村长', text: '叔叔啊。高个，人瘦，在磨坊住了二十年喽。娃娃们都吃过他烤的饼。' },
      { if: 'c1_reask', who: 'mina', side: 'left', speaker: '米娜', text: '（小声）……一个字都没变。连"喽"都在原来的地方。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '去磨坊。' },
    ]},

    // 幕3 · 场景演出：磨坊内部
    { op: 'scene', bg: 'cave', bgImg: 'art/06_story/scenes/mill_interior.png',
      actors: {
        teried: { sprite: 'teried', x: 12, y: 70, dir: 'east', glow: true },
        mina:   { sprite: 'mina',   x: 4,  y: 72, dir: 'east' },
      },
      steps: [
        { t: 'narr', text: '门没锁。灰有小腿厚，地上只有一种脚印——他们自己的。' },
        { t: 'move', who: 'teried', to: [42, 68], dur: 2000 },
        { t: 'move', who: 'mina',   to: [34, 71], dur: 2000 },
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
      { bg: 'town', bgImg: 'art/06_story/scenes/village_day.png', clear: true, text: '出磨坊的时候，全村人都等在坡下。十一个人，站得整整齐齐。' },
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
      { bg: 'forest', bgImg: 'art/06_story/scenes/campfire.png', clear: true, text: '当晚在村外扎营。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '十一副碗筷……我老家吃席也这么摆。谁家有事，全村凑一桌。' },
      { who: 'teried', side: 'left', speaker: '泰瑞德', text: '可他们凑的这一桌，主位上是空的。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '那股药味我想起来了。我梦里学方子的那间屋，就是那个味。' },
      { who: 'mina', side: 'right', speaker: '米娜', text: '……我从来没跟你们说过，教我方子的婆婆，住在哪。' },
      { clear: true, text: '灯拨亮了一格。—— 第一章 · 完' },
    ]},
  ],

};

window.SCRIPTS = SCRIPTS;
