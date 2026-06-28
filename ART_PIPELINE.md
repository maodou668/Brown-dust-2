# 美术生产手册（资产清单 · 分工 · 待办）

> 本文件是高效量产的对照表。**新角色 / 新内容照此清单逐项产出，勿漏。**
> 路径、字段名均与代码一一对应；改动接入方式见每节「接入」。

游戏当前共 **16 个角色** / **10 个敌人(含3 BOSS)** / **6 个战斗场景**。
角色 id：`lecliss justia seir rou helena diana garcia teried lia mina refithea rigenette olstein glacia liatris loen`
敌人 id：`goblin goblin_archer wolf ogre dark_mage revenant dark_knight`（普通）、`demon_lord troll_king shadow_empress`（BOSS）
场景：`forest forest_deep cave ridge castle void`

---

## 一、单个角色 · 完整美术资产清单（对照施工）

| # | 资产 | 路径 / 字段 | 规格 | 负责 | 现状 |
|---|------|------------|------|------|------|
| 1 | **战斗/地图序列帧** | `art/05_pixellab/<char>_field/` + `manifest.json` | 64×64，详见下方 manifest 规格 | **你** | 仅 lecliss |
| 2 | **静态立绘**（详情/编队大图） | `art/01_splash/<char>.png`（建议） | 竖图，透明或裁底 | **你** | 无（占位：渐变+emoji） |
| 3 | **动态立绘**（佣兵详情 splash 动效） | `art/01_splash/<char>_live/`（序列帧或 spine 后议） | 循环动效 | **你** | 无 |
| 4 | **头像**（小框：招募/阵型/编队/剧情缩略） | `CHARACTERS[].art`（指向图片） | 正方 ≥64，脸部居中 | **我**（从立绘/序列帧裁头，脚本自动） | 无（占位：职业 emoji） |
| 5 | **技能/普攻 VFX** | `art/05_pixellab/fx/<effect>/` + manifest | 逐帧 PNG，详见 fx/README | **我**（PixelLab + 接入） | inferno🔥 / 奥术弹🟣 已成 |

### 序列帧 manifest 规格（资产①，你产出的核心）
以 `lecliss_field/manifest.json` 为模板：
- `srcSize` 64×64；`bbox` 内容包围盒 `{x,y,w,h}`（用于居中绘制）
- `dirs`：8 方向 `south, south-east, east, north-east, north, north-west, west, south-west`
- `anims`：
  - **`idle`**：8 方向 × ~9 帧（待机，必须 8 向）
  - **`run`**：8 方向 × ~8 帧（移动，必须 8 向）
  - **`cast` / `attack`**：**仅需 north 方向** × ~8-9 帧（战斗动作；战斗里固定背朝镜头朝上打）
  - 帧文件：`<anim>/<dir>/00.png 01.png …`
- `static`：8 方向各 1 帧（不动时的定格）
- `fps`：`{ idle:6, run:12, cast:12 }`

> **接入**：把目录放好后，在 `js/main.js > BattleUI.FIELD_SPRITE` 和 `js/world.js`
> 各加一行 `<charId>: 'art/05_pixellab/<char>_field'`。这一步我来做（或告诉我目录名即可）。

---

## 二、分工（明确边界）

### 你负责 —— **人物本体**
- 8 方向**静态**（static）
- **待机 idle**（8 方向）
- **移动 run**（8 方向）
- **战斗动作**：攻击 / 施法等，**仅 north 方向**
- **静态立绘**、**动态立绘**

### 我负责 —— **特效 + 接入 + 自动化**
- 每个角色的**普攻 / 技能 VFX**（PixelLab 生成，按 `fx/README.md` 标准流程）
- VFX **接入游戏**（SKILL_VFX 注册、manifest、动画/逻辑握手）—— 已验证可靠
- **头像自动裁切**：从你产出的立绘/序列帧裁脸 → 写入 `CHARACTERS[].art`（脚本批量，零手工）
- 序列帧 **manifest 生成/接入**、动态立绘**播放器**（需要时我写加载代码）

> 协作节奏：你产出一个角色的本体资产 → 丢目录给我 → 我裁头像 + 接 FIELD_SPRITE + 做该角色技能 VFX + 接入 → 我截图验收。

---

## 三、剩余未做的美术工作（按板块 + 建议分工）

| 板块 | 具体内容 | 现状 | 建议负责 |
|------|----------|------|----------|
| **怪物（小怪）** | goblin / goblin_archer / wolf / ogre / dark_mage / revenant / dark_knight 的战斗形象 | 👹 emoji 占位 | **我**（PixelLab，敌人用序列帧/单图即可，无需你的精细立绘标准） |
| **BOSS** | demon_lord / troll_king / shadow_empress 大型形象 + 登场演出 | 👹 emoji 占位 | **我** PixelLab 起底；若要更精的 BOSS 立绘可**你**出 |
| **战斗场景背景** | forest / forest_deep / cave / ridge / castle / void 六套 | CSS 渐变 + 粒子 | **我** PixelLab 场景/tileset，或**你**出大图 |
| **地图场景** | 世界地图地块/装饰（world.js） | 程序化 | **我** topdown tileset |
| **剧情立绘** | 剧情对话用的角色立绘/表情差分 | 无 | **你**（与静态立绘同源，可复用） |
| **佣兵动态立绘** | 佣兵详情页 splash 区动效（`.r2-splash`） | 渐变+emoji | 资产**你**出 / 播放器**我**接 |
| **头像（小框）** | 招募「本期上架」、佣兵「当前阵型」、编队槽、剧情缩略 | 职业 emoji | **我**（统一裁切自立绘） |
| **道具/装备图标** | 武器/防具/饰品/专属武器 + 材料 | ⚔️🛡️💍 emoji | **我** PixelLab 小图标（32-64px 物品图） |
| **UI 框架** | 按钮/面板/边框/稀有度框/资源条等 | 纯 CSS（已较完整） | 多数保持 CSS；要做主题包再议，可**你**出或**我**出 9-slice |
| **抽卡/十连演出** | 出货光效、稀有度弹出动画 | 简单 CSS | 可后续，**我** VFX |

> 优先级建议（先做最影响观感的）：①怪物+BOSS形象 ②战斗场景背景 ③头像统一 ④道具图标。
> 这几样我都能用已验证的 PixelLab 流程批量出，你专注角色本体即可。

---

## 四、待优化（**非美术**，仅记录备查）

> 用户已说明：这些大体不变，之后一起润色，先记录做到有数。

- [ ] **剧情文案润色**：目前偏生硬，需逐章打磨（与用户一起，框架不动）
- [ ] **漫画内容润色**：分镜台词/旁白
- [ ] **角色剧情润色**：各角色个人线文本

---

## 五、目录约定速查

```
art/01_splash/<char>.png            静态立绘（你）
art/01_splash/<char>_live/          动态立绘序列帧（你）
art/05_pixellab/<char>_field/       战斗/地图序列帧 + manifest.json（你）
art/05_pixellab/fx/<effect>/        技能 VFX 逐帧 + manifest.json（我）
art/<avatars 目录待定>/<char>.png    头像（我，裁切生成）
art/<enemies 目录待定>/<id>/         怪物/BOSS（我）
```
新增角色接入清单（我执行）：`FIELD_SPRITE` + world.js 注册、`CHARACTERS[].art` 头像、
`SKILL_VFX` 技能特效、跑 `node scripts/build.js`（数值闸门）→ 截图验收 → 提交部署。

---

## 六、Lecliss 完成样板（已全部接入，作每个角色的参照）

Lecliss 是第一个走完全流程的角色，**新角色照此对齐即可**。每个资产 → 接入点：

| 资产 | 文件 | 接入点 | 显示位置 |
|------|------|--------|----------|
| 战斗/地图序列帧 | `art/05_pixellab/lecliss_field/` | `BattleUI.FIELD_SPRITE` + `world.js` | 战斗我方单位、地图主角 |
| 技能 VFX·火 | `art/05_pixellab/fx/fire_explosion/` | `SKILL_VFX.inferno` | 放炼狱业火时 |
| 技能 VFX·奥术 | `art/05_pixellab/fx/arcane_burst/` | `SKILL_VFX.cls_arcane` | 放奥术弹时 |
| 动态立绘（视频） | `art/01_splash/lecliss_live.{mp4,webm}` | `UI.LIVE_SPLASH` | 佣兵详情左侧大框 |
| 头像 | `art/01_splash/lecliss_avatar.png` | `index.html` 的 `.pc-avatar` | 主界面指挥官头像 |
| 半身像 | `art/01_splash/lecliss_bust.png` | `CHARACTERS.lecliss.art`（→`charAvatar`） | 佣兵卡/编队/招募本期上架/抽卡结果/卡池一览/剧情缩略 |

> ✅ 已全部接入并验证。**可选未做**（非必须）：①普攻(basic_attack)无专属 VFX，用通用受击表现即可；
> ②替换服装「霜华(水/frost_nova)」若想有独立外观，需另出一套序列帧+VFX（属 ALT 服装，额外工作）。

### 关键经验（沿用）
- **静态立绘可不做**：用**动态立绘（视频）**效果更好；视频转 mp4+webm（480p 静音）放 `art/01_splash/<char>_live.*`。
- **小框的头像/半身别用 T-pose 母图裁**（显僵硬）——从**动态立绘视频里挑"姿势帧"**（全身可见、特效适中那一帧）裁，更好看。这步我来做。
- 头像/半身我用脚本抠底裁切并接入；你只需给我**白底全身立绘**（用于裁切+切 8 向）+ **动态立绘视频**。

---

## 七、其他 15 个角色 · 立绘生成提示词（你出图用）

> 用法：每个角色 = `主体描述` + 下面的 `通用风格后缀`（保证全员风格统一）。配 `负面词`。
> 出**白底、全身、头到脚、居中**的图——方便我切 8 向 + 裁头像/半身。性别是建议，可按你设定调整。

### ⭐ 母图生成黄金公式（PixelLab，**已实测，照抄**）
> 折腾很久才定下来的关键：PixelLab 默认会给**侧身/扭胯/脚朝斜**的姿势，和 Lecliss 那张**正面对称母图**对不上。
> 必须在提示词**最后追加这串"正面对称后缀"**，才能逼出正脸、对称、脚朝正前的母图（同 Lecliss 大小/风格）。

**最终母图提示词 = `角色形容词`（见下表/上一节给的词）+ 正面对称后缀（v2，实测锁定更稳）：**
```
, PERFECTLY SYMMETRICAL FRONT VIEW, dead-on-forward perspective, axis-symmetrical composition, facing directly forward, looking directly at viewer, no side-turn, no 3/4 view, no isometric tilt, flat 2D projection
```
- 大小 / 画风 / 一致性 → 用 **PixelLab 内部工具**（一致性参考图设定为 Lecliss 母图）即可，提示词里**不用**再写尺寸/风格约定。
- 缺了这串后缀 → 出斜身/扭胯/3-4 视角，没法当母图。**这是 PixelLab 出母图的硬性步骤，别省。**
- 旧版后缀（也能用，但 v2 锁正面更稳）：`perfectly symmetrical body, absolute symmetry, …, facing directly forward 90 degrees`。

**通用风格后缀（每个都加）**：
`, anime fantasy gacha RPG character splash art, full body head-to-toe, standing confident dynamic pose, ornate detailed fantasy outfit, soft cel shading, clean smooth lineart, vibrant colors, plain solid white background, character centered, 2.5D mobile gacha game art, masterpiece, best quality, high detail`

**负面词**：
`extra limbs, deformed hands, blurry, low quality, watermark, text, multiple characters, cluttered background, cropped, out of frame, weapon in hands, holding weapon, gripping weapon, held object in hands, clutter in hands`
> （负面词只禁**手持**武器，不禁背负/佩戴件——故 `sword/bow` 不放进负面词，否则会把背负的剑/箭袋也压掉。）

> **深化提示词（Lecliss 同颗粒度，照抄）**：覆盖发型/眼睛/头饰 → 服装(配色+元素纹样+胸口/腰带宝石) → 手套/腿靴 → 表情/主题，
> 末尾统一 `clean lineart, polished`。**生成时 = 下面整段 + 第七节 v2 正面对称后缀**；大小/画风/一致性交给 PixelLab 内部工具。
> ⚠️ **手上不持任何武器/物件**（手持件生成质量极差）：双手一律 `empty open hands, not holding any weapon or item`。
> **武器改为"背负/佩戴"**（worn，不占手、不进手部生成）来保留职业身份：战士→剑背在背上 `sheathed across the back`、坦克→盾背在背上 `shield mounted on back`、游侠→箭袋背在背上 `quiver on back`；法师/治疗靠法袍+元素宝石+主题氛围表达。
> 负面词只禁**手持**（weapon in hands / holding / gripping），不禁背负件。
> 已完成：**Lecliss**（参照模板）。**Justia 重做中**（提示词见下，须贴合已接入那版：金色太阳光环/白金铠/蓝披风/太阳纹圆盾）。

**贾丝蒂亚 Justia · 5★ 光·坦克**
`Beautiful anime-style holy paladin knight girl. Long flowing golden-blonde hair, bright noble golden eyes, a radiant golden sun-ray halo glowing behind her head. Ornate white and gold radiant plate armor with layered pauldrons and intricate gold filigree, a flowing deep-blue cape, a glowing warm-gold light gem on the breastplate and on the belt buckle, a large ornate round holy shield with a golden sun emblem mounted on her back. White and gold armored gauntlets, empty open hands, not holding any weapon or item. White-and-gold armored thigh-high boots with blue trim. Dignified confident protective expression, radiant holy light theme, clean lineart, polished.`

**希尔 Seir · 5★ 暗·游侠**
`Beautiful anime-style dark ranger huntress girl. Long sleek silver-violet hair in a high ponytail with side bangs, sharp piercing violet eyes, a small crescent-moon ornament with faint purple glow on the side of her head. Form-fitting black and deep-violet leather assassin outfit with a layered shoulder cloak, a glowing violet shadow gem on the chest and on the belt, a quiver of arrows on her back, intricate dark-purple shadow patterns. Black fingerless leather gloves, empty open hands, not holding any weapon or item. Black thigh-high leather boots with violet trim. Cool confident deadly expression, swirling dark shadow theme, clean lineart, polished.`

**蕾菲西亚 Refithea · 5★ 光·治疗**
`Beautiful anime-style holy saintess girl. Very long flowing pale-gold hair with soft waves, gentle radiant golden eyes, a glowing golden halo ring floating behind her head. Elegant floor-length white and gold ceremonial priestess robe with layered flowing sleeves and intricate gold sacred filigree, a glowing warm-gold light gem on the chest and on the waist sash. White lace gloves, empty open hands, not holding any weapon or item. White-gold trimmed shoes under the long robe. Serene graceful divine expression, soft holy light theme, clean lineart, polished.`

**莉洁奈特 Rigenette · 5★ 风·战士**
`Beautiful anime-style sky knight commander girl. Long sky-blue hair flowing as if caught in wind, bright confident cyan eyes, a small feathered wing ornament on the side of her head. Sleek azure and white elegant knight armor with layered shoulder pauldrons and a flowing white cape, a glowing pale-blue wind gem on the chest and on the belt buckle, a slender longsword sheathed across her back, delicate silver wind-swirl patterns. Black and silver armored gloves, empty open hands, not holding any weapon or item. White armored thigh-high boots with cyan trim. Commanding elegant confident expression, swirling wind-streak theme, clean lineart, polished.`

**奥尔斯坦 Olstein · 5★ 地·坦克（男）**
`Powerful anime-style veteran male fortress guardian. Short greying tan hair with a thick well-groomed beard, stern steadfast amber eyes, a weathered scar across one cheek. Massive heavy bronze and tan fortress plate armor with thick layered pauldrons and earthen-gold engravings, a glowing amber earth gem set in the breastplate and on the belt, an enormous tower shield mounted on his back. Heavy armored gauntlets, empty open hands, not holding any weapon or item. Heavy tan armored greaves with stone-textured plating. Immovable stoic resolute expression, solid earth-stone theme, clean lineart, polished.`

**萝 Rou · 4★ 光·治疗**
`Beautiful anime-style gentle young priestess girl. Soft shoulder-length mint-green hair with a small side braid, kind warm teal eyes, a small glowing leaf-and-light ornament on the side of her head. Flowing white and mint-green healing robe with a soft layered skirt and gold trim, a glowing soft-green light gem on the chest and on the waist ribbon, delicate sacred patterns. White fingerless gloves, empty open hands, not holding any weapon or item. White-and-mint trimmed boots. Gentle caring warm-smiling expression, soft restorative light theme, clean lineart, polished.`

**海莲娜 Helena · 4★ 风·战士**
`Beautiful anime-style swift wind swordswoman girl. Short layered cyan-blue hair with windswept side bangs, bright lively blue eyes, a small glowing wind-feather ornament on the side of her head. Light teal and white agile swordswoman battle outfit with a single light silver shoulder pauldron, a flowing scarf and a layered short skirt, a glowing cyan wind gem on the chest and on the belt, a slender curved sword sheathed across her back, sleek silver wind-streak patterns. Black fingerless gloves, empty open hands, not holding any weapon or item. Teal-trimmed thigh-high boots built for speed. Energetic spirited confident expression, fast wind-gust theme, clean lineart, polished.`

**黛安娜 Diana · 4★ 水·法师**
`Beautiful anime-style calm water mage girl. Long straight deep-blue hair with a single side braid, cool composed blue eyes, a small glowing water-droplet ornament on the side of her head. Elegant blue and silver mage robe with flowing layered sleeves and a long skirt, a glowing blue water gem on the chest and on the belt clasp, flowing wave patterns along the hem. Blue fingerless gloves, empty open hands, not holding any weapon or item. Blue-and-silver trimmed boots under the robe. Serene cool intelligent expression, flowing water-magic theme, clean lineart, polished.`

**加西亚 Garcia · 4★ 地·坦克（男）**
`Sturdy anime-style young male earth guardian. Short rugged brown hair, determined earthy-brown eyes, a small stone-shard ornament on his shoulder guard. Heavy rugged brown plate armor with rocky textured plating and thick layered pauldrons, a glowing amber earth gem on the breastplate and on the belt, a massive round tower shield mounted on his back. Heavy brown armored gauntlets, empty open hands, not holding any weapon or item. Heavy stone-plated greaves. Rock-solid dependable steadfast expression, grounded earth-stone theme, clean lineart, polished.`

**格蕾西亚 Glacia · 4★ 水(冰)·法师**
`Beautiful anime-style quiet ice sorceress girl. Long pale icy-blue and white hair with crystalline strands, cold pale-blue eyes, a small glowing ice-crystal ornament on the side of her head. Elegant white and frost-blue mage robe with a layered snowflake-patterned skirt and fur-trimmed collar, a glowing pale-blue ice gem on the chest and on the belt, delicate frost patterns. White fingerless gloves, empty open hands, not holding any weapon or item. White thigh-high boots with frost-blue trim. Reserved cool calm expression, freezing frost-and-ice theme, clean lineart, polished.`

**莉亚特丽丝 Liatris · 4★ 火·游侠**
`Beautiful anime-style crimson fire sniper girl. Long flowing red-orange hair tied back with loose side strands, fierce burning orange eyes, a small glowing ember ornament on the side of her head. Sleek crimson and black ranger outfit with a fitted bodice and a layered short skirt with flame trim, a glowing orange flame gem on the chest and on the belt, a quiver of arrows on her back, ember-spark patterns. Black fingerless gloves, empty open hands, not holding any weapon or item. Black thigh-high boots with crimson flame trim. Confident sharp deadly-smirking expression, burning ember-fire theme, clean lineart, polished.`

**泰瑞德 Teried · 3★ 火·战士（男）**
`Spirited anime-style young male apprentice swordsman. Messy orange-red hair, warm eager orange eyes, a small flame-spark ornament on his collar. Simple but sturdy light leather warrior outfit with red and orange accents and a short shoulder cape, a small glowing orange flame gem on the chest belt, a simple steel sword sheathed across his back, faint flame trim. Brown leather fingerless gloves, empty open hands, not holding any weapon or item. Brown leather boots with orange trim. Eager hopeful determined rookie expression, faint warm-fire theme, clean lineart, polished.`

**莉亚 Lia · 3★ 地·游侠**
`Beautiful anime-style cheerful grassland huntress girl. Green hair in a practical braided ponytail with a few loose strands, bright lively green eyes, a small leaf ornament on the side of her head, light freckles. Light green and brown leather hunting outfit with nature-leaf motifs and a layered short skirt, a glowing green earth gem on the chest and on the belt, a quiver of arrows on her back, vine patterns. Brown fingerless gloves, empty open hands, not holding any weapon or item. Brown leather thigh-high boots with green trim. Cheerful sharp friendly expression, fresh nature-earth theme, clean lineart, polished.`

**米娜 Mina · 3★ 风·治疗**
`Cute anime-style petite young alchemist girl. Short aqua-teal hair in twin-tails with small clips, big round innocent teal eyes, a small bubble-and-leaf ornament on the side of her head. Light apothecary dress with an apron and many small potion pouches on the belt, a glowing aqua gem on the chest and on the belt, soft mint patterns. Short white gloves, empty open hands, not holding any weapon or item. Short aqua-teal boots with white trim. Cheerful innocent slightly-clumsy expression, soft wind-sparkle theme, clean lineart, polished.`

**罗恩 Loen · 3★ 光·战士（男）**
`Earnest anime-style young male dawn knight. Neat golden-blond hair, bright determined eyes, a small sunrise ornament on his shoulder pauldron. Polished golden and white knight armor with layered pauldrons and a flowing short cape, a glowing warm-gold light gem on the breastplate and on the belt, a longsword sheathed across his back, dawn-ray engravings. Gold and white armored gauntlets, empty open hands, not holding any weapon or item. Golden armored greaves with white trim. Upright heroic passionate expression, warm dawn-light theme, clean lineart, polished.`

> 动态立绘视频：用同一套设定 + 你那套视频生成流程，做一个 ~10s 的循环展示（脸部→姿势揭示→施法特效），
> 我从里面挑姿势帧裁头像/半身、把视频接进佣兵详情大框。

---

## 八、PixelLab 直生产配方（Claude 用 MCP 全自动跑通，照走）

> Seir 全程由 MCP 跑通验证。

### ⚠️ 0. 两条硬性纪律（实测踩坑总结，必守）
- **并发 ≤4**：PixelLab 后端一次塞太多任务会**系统性卡在 95% 挂起**（实测一次发 10 个 → 全部卡死、互相堵）。**同时最多 4 个 job，出完再发下一批**；`run` 偶尔只出参考帧需重发。
- **锁画风 / 锁头身比**（关键！否则逐角色头身比漂移、画风变）：
  - 根因：`create_character` 的 **v3 模式忽略 `proportions`**（文档明示），所以头身比不可控、逐个漂移。
  - **锁法 A（推荐，最强一致）**：用 **`create_character_state(参考角色, edit_description="新角色完整外观", use_color_palette_from_reference=false)`** —— 以一个已认可的锚角色（如 Lecliss/Seir）派生，**继承其头身比/体型/画风**，只改外观与配色。全员都从同一锚派生 → 整列统一。
  - **锁法 B（备选）**：改 **`mode: standard` + 固定 `proportions`**（自定义如 `{"type":"custom","head_size":1.4,"legs_length":0.85,...}` 或 `preset chibi`）+ 固定 `outline/shading/detail/view/size`。standard **不忽略** proportions，头身比锁死；代价是细节略低于 v3。
  - 落地前先 **A/B 各测 1 个**与现有 Seir 对比，选更贴的那条，全批统一用。

**① 母图（create_character）**
- `mode: v3`（最高质量，Lecliss-v3 同源）·`view: low top-down`·`outline: selective outline`·`detail: high detail`
- ⚠️ **千万别用默认 `single color black outline`** —— 出粗黑块，和本作柔和立绘对不上（这就是 UI 里跑偏的元凶）。提示词里再写 `soft smooth shading, no black outline`。
- `description` = 第七节深化提示词（**不加**正面对称后缀——8 向角色自己会转向）。
- `size: 80`（→ 160 画布，细节足；field 归一到 64，半身/头像也够裁）。

**② 动作（animate_character）—— 用 v3 自定义，别用模板**
- 模板（template）套骨架，细节角色易崩（用户实测差）。**一律 `mode: v3` + `action_description`**（就是出好 idle 的同一引擎）。
- 待机：`"standing idle, breathing gently with a subtle relaxed sway"`
- 跑动：`"running forward, smooth natural run cycle, legs striding, arms bent and held steady close to the body, no crossing arms"`
  - ⚠️ 别写 `arms swinging` —— 会让手臂往身体中间乱晃（南向尤其明显）。
- `frame_count: 8`，**显式传 `directions` 全集**（v3 默认只出 south）。
- 一次最多 ~10 个并发 job；8 向一发占满，第二个动作要等前一个出完再排。

**②b 走/跑动画——先建「迈步状态」再做循环（关键！修走路怪异）**
> 实测：直接从 idle 生成 walk/run，模型对「该朝向怎么迈腿」理解松散 → **南向迈腿朝别处、北向背身还回头**。
> 解法（来自 PixelLab 官方教程，已 A/B 验证 loen 走路明显变好）：**先 `create_character_state` 定一个"迈步中"静态姿势，再在该状态上生成循环走**，腿脚被锚定在正确朝向。
1. **建状态**：`create_character_state(角色, edit_description="mid-stride walking pose, one leg stepping forward, arms swinging naturally, <角色唯一标识词>", use_color_palette_from_reference=true)`。
   - ⚠️ `edit_description` 末尾**加该角色唯一标识词**（如 `dark ranger huntress`/`bronze fortress guardian`）：① 强化身份保持画风 ② 让 group 下载里文件夹名唯一（否则全叫 `mid-stride_walking_p` 无法区分，同 Beau 重名坑）。
   - `use_color_palette_from_reference=true` 锁色板，防衣服变色。
2. **循环走**：在该状态上 `animate_character(mode=v3, action="walking cycle loop, legs striding forward in the facing direction, smooth seamless loop, subtle natural gait", frame_count=8)`，5 源向。
3. **组装**：状态是独立 sibling 角色；归一化时把状态的 `walking_cycle*` 帧当作 run（**删掉原角色的旧 `running*` 文件夹**再并入），其余 idle/cast 仍取原角色。`gnorm` 照常**丢第 0 帧**（参考帧）即得干净循环——这就是 A/B 里你认可的那版。
- 循环类（walk/run/idle）首尾要接得上；一次性类（attack/cast）不必。

**②c 动画通用纪律 + 按动作类型速查（PixelLab 官方教程精华，必读，防重蹈覆辙）**
> 来源：用户分析的 PixelLab 官方教程（YouTube `LcJQQwltQ2Q`）。核心思想：**起点干净 + 用「状态」锚定姿势 + 循环类保首尾 + 南向先验收再镜像**。

**A. 五阶段总流程**（每做一个新角色都照此顺序，别跳步）
1. **母图**：`create_character` 出 8 向静态。提示词具体，**加 `no held items / not holding any weapon`** 方便做通用动作。
2. **风格一致性扩张**：不要逐个独立 `create_character` 重抽（v3 忽略 proportions→画风/头身比漂）。**用 `create_character_state` 从同一锚角色派生（锁法A）**——等效于教程的「从风格参考生成」，继承头身比/体型/画风/骨架。（教程的网页流还教：贴边裁参考图、可叠多张参考图增强风格、勾 Remove background；我们用 state 派生已覆盖此目的。）
3. **拆成 8 向实体**：派生出的角色本身就是 8 向，跳过。
4. **建状态（关键）**：动画前先用 `create_character_state` 定**该动作的静态起始姿势**（`mid-walk` / `mid-run` / `guard stance` 等），`use_color_palette_from_reference=true` 锁色。**这是修「腿朝别处/北向转头」的根治手段**——直接从 idle 让模型猜动作会跑偏。
5. **做动画**：在状态上 `animate_character`。

**B. 通用纪律（所有动作都适用）**
- **模型**：永远 `mode=v3`（比 template/pro 更便宜、更好、帧数更多）。**绝不用 template**（套骨架，细节角色崩）。
- **起点必须干净**：母图/状态若有噪点/瑕疵，先清理再做动画——**起点脏 → 后续所有帧全崩**。
- **南向先行、验收、再扩展**：先只出 **south** → 看 → 不行就 **重抽(retry)** → south 满意后再出其余方向。**别一上来 8 向并发**（坏了浪费 8 份额度）。
- **镜像红线**：只镜像**已验收干净**的帧。东↔西、东北↔西北、东南↔西南可镜像；南/北不可。**绝不对没清理的坏帧镜像**（坏帧翻倍）。
- **frame_count**：6 或 8（9 也兼容）。
- **手臂**：跑步写 `arms bent and held steady close to the body, no crossing arms`；**别写 `arms swinging`**（南向手臂往中间乱晃）。走路用「迈步状态」时 `arms swinging naturally` 可接受（状态已锚住姿势）。

**C. 按动作类型速查（最重要：循环 vs 一次性 的"首帧"处理不同）**

| 动作 | 类型 | 起始状态 | 提示词要点 | 首帧/循环处理 |
|---|---|---|---|---|
| **idle 待机** | 循环 | 可直接做 | `idle breathing, really subtle, no extra stuff, loop` | 保首尾衔接；gnorm 保留全帧。⚠️ **north-east idle 腿会乱动**（v3 quirk）：**改生成 north-west idle 作源，gnorm 用 IMIR 把 NW 镜像成 NE**（已全角色验收，见下「②d」） |
| **walk/run 走跑** | 循环 | **必须先建 mid-stride/mid-run 状态** | `walking cycle loop, legs striding forward in the facing direction, smooth seamless loop` | 教程：循环类**保留第一帧**强制首尾相接；我们 gnorm 用 mid-state 后**丢参考帧第0帧**那版已 A/B 验收最顺，按此即可 |
| **cast 施法** | 一次性 | 摆招起手姿势即可 | 具体招式动作，如 `swinging sword in a wide cleave` | **不保留第一帧**（一次性不必首尾接）；播完回 idle |
| **attack 普攻** | 一次性 | 同上 | `slashing/thrusting forward` | 同 cast |

> 一句话记忆：**循环动作（idle/walk/run）= 保首尾顺滑；一次性动作（attack/cast）= 不用管首尾，播完归位。**

**②d north-east idle 修复 + 旧 run 弃用（本会话踩坑沉淀，必看）**
- **NE idle 腿乱动**：v3 直接生成 north-east 的 idle，腿部会鬼畜抖动。解决：**只生成 north-west idle**（`directions:["north-west"]`，动作 `standing idle, breathing gently with a subtle relaxed sway`），归一化时 gnorm 用 `IMIR` 表把 NW 水平镜像成 NE（idle 专用镜像表，区别于 run 的 `MIR`）。东北↔西北本就是合法镜像对，画风一致、腿稳。全 16 角色已按此重做并线上验收。
- **旧 run 弃用**：早期在「主角色」上直接做的 `run`（未用迈步状态）方向是错的（腿朝别处/背面转头）。新走路一律在 `mid-stride 状态`角色上做 `walking_cycle`。**gnorm 的 runFs 优先匹配文件夹名含 `walking_cycle` 的**（状态机走路），匹配不到才回退旧 `run/walk/march`——所以主角色上残留的旧 run 会被自动忽略，不必手删。
- **组装消歧（md5 法，零歧义）**：Seir group 一次性下载含 ~30 个角色文件夹，名字泛化（`Transform_into_Beau` 等重名）。用**每个 charId 的 `rotations/south.png` 的 md5** 精确匹配「主角色 dir」与「mid-stride 走路状态 dir」（主/走状态姿势不同，md5 不同，天然区分）。脚本：`scratchpad/assemble.js`（主组）+ `assemble_std.js`（refithea/rigenette 独立组）。

**③ 镜像省额度（在归一化这步做，不花 PixelLab 额度）**
- 水平翻转可复用的 6 个方向：**东↔西、东北↔西北、东南↔西南**。南/北涉及正背面**不能**镜像。
- 所以每个动作**只需生成 5 个方向**（south, north, + 每对取一侧，如 west/north-east/south-east 或 east/...），其余 3 个我翻转得到。约省 37% 动作额度。
- 翻转在 64 画布上做（已居中+底对齐，翻转后脚线/居中不变）；注意翻转会把不对称细节（箭袋/披风偏侧）也镜像，上述 6 向可接受。

**④ 归一接入**：每方向以该向**旋转图 contentBox** 为基线，缩放到 Lecliss `bbox(59×46)`、底对齐、居中 → 64 画布；写 manifest（`fps {idle:8, run:12}`）→ 注册 `BattleUI.FIELD_SPRITE[charId]` → 测试台 `anim-test.html` 验收。

**成本参考**：v3 母图 ~2-9 gen；每个 v3 动作 = 4 gen/方向。母图+idle(5向)+run(5向) ≈ 45 gen/角色（用镜像后）。
