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

**最终母图提示词 = `角色形容词`（见下表/上一节给的词）+ 正面对称后缀：**
```
, perfectly symmetrical body, absolute symmetry, dead-on-forward perspective, symmetrical stance, feet pointing straight forward, central non-tilted pose, facing directly forward 90 degrees
```
- 大小 / 画风 / 一致性 → 用 **PixelLab 内部工具**（一致性参考图设定为 Lecliss 母图）即可，提示词里**不用**再写尺寸/风格约定。
- 缺了这串后缀 → 出斜身/扭胯，没法当母图。**这是 PixelLab 出母图的硬性步骤，别省。**

**通用风格后缀（每个都加）**：
`, anime fantasy gacha RPG character splash art, full body head-to-toe, standing confident dynamic pose, ornate detailed fantasy outfit, soft cel shading, clean smooth lineart, vibrant colors, plain solid white background, character centered, 2.5D mobile gacha game art, masterpiece, best quality, high detail`

**负面词**：
`extra limbs, deformed hands, blurry, low quality, watermark, text, multiple characters, cluttered background, cropped, out of frame`

| 角色 | 主体描述（接上面后缀） |
|------|------------------------|
| 贾丝蒂亚 5★ 光·坦克 | a noble female holy paladin knight, long golden blonde hair, golden eyes, ornate white-and-gold radiant plate armor, holding a large glowing holy shield, gold accents (#ffd35a), dignified protective aura, holy light particles |
| 希尔 5★ 暗·游侠 | a sleek female dark ranger, long silver-violet hair, sharp purple eyes, dark violet hooded leather assassin outfit, holding an ornate black longbow, violet accents (#a06bff), cool deadly confidence, shadow wisps |
| 萝 4★ 光·治疗 | a gentle young priestess, soft mint-green and white hair, kind teal eyes, flowing white-and-gold holy robe, holding a healing staff with a glowing orb, mint accents (#7affc4), warm caring smile, soft holy light |
| 海莲娜 4★ 风·战士 | an agile female wind swordswoman, short cyan-blue hair, bright blue eyes, light blue-and-white swift armor, wielding a slender curved sword, cyan accents (#5ad1ff), swift energetic stance, wind gusts |
| 黛安娜 4★ 水·法师 | a calm female water mage, long deep-blue hair, cool blue eyes, elegant blue-and-silver mage robe, holding a water staff orb, blue accents (#5a9fff), composed serene expression, flowing water magic |
| 加西亚 4★ 地·坦克 | a sturdy male earth guardian, short brown hair, brown eyes, heavy rugged stone-plated brown armor, carrying a massive tower shield, earthy brown-gold accents (#c9a05a), rock-solid grounded stance, earth rock fragments |
| 泰瑞德 3★ 火·战士 | a hopeful young male novice swordsman, messy orange-red hair, warm orange eyes, simple light leather warrior outfit with red accents, holding a steel sword, orange accents (#ff8b5a), eager balanced rookie vibe, faint fire sparks |
| 莉亚 3★ 地·游侠 | a keen female plains hunter, green ponytail hair, green eyes, light leather ranger outfit with leaf nature motifs, holding a wooden longbow, green accents (#a0d15a), sharp focused gaze, earthy nature aura |
| 米娜 3★ 风·治疗 | a cute petite young alchemist girl, short aqua-teal twin-tails, big teal eyes, light apothecary dress with potion pouches, holding a glowing potion flask, aqua accents (#7affe0), cheerful innocent expression, soft wind sparkles |
| 蕾菲西亚 5★ 光·治疗 | a divine female saintess, long pale-gold hair, gentle golden eyes, elegant ornate white-and-gold holy dress with a radiant halo, holding a sacred staff, gold accents (#ffe7a0), serene graceful divine aura, miracle holy light |
| 莉洁奈特 5★ 风·战士 | a noble female sky knight commander, long sky-blue hair, bright blue eyes, sleek azure-and-white elegant knight armor, wielding a slender longsword, sky-blue accents (#7ad6ff), commanding elegant poise, wind streaks |
| 奥尔斯坦 5★ 地·坦克 | a massive veteran male fortress guardian, short grey-and-tan hair with a beard, stern eyes, immense heavy fortress plate armor, carrying an enormous tower shield, tan-gold accents (#d4a85a), immovable stoic stance, earth stone aura |
| 格蕾西亚 4★ 水·法师 | a quiet female ice sorceress, long pale icy-blue and white hair, cold pale-blue eyes, frost-themed blue-and-white mage robe, holding an ice-crystal staff, icy accents (#9bd6ff), reserved cold expression, frost and ice crystals |
| 莉亚特丽丝 4★ 火·游侠 | a sharp female crimson sniper, red-orange hair, fierce orange eyes, sleek crimson-and-black ranger outfit, holding an ornate flaming bow, crimson accents (#ff7a5a), confident deadly smirk, burning ember effects |
| 罗恩 3★ 光·战士 | an upright passionate young male dawn knight, golden-blond hair, bright determined eyes, golden-and-white dawn knight armor, holding a longsword, gold accents (#ffd97a), heroic earnest determination, dawn light glow |

> 动态立绘视频：用同一套设定 + 你那套视频生成流程，做一个 ~10s 的循环展示（脸部→姿势揭示→施法特效），
> 我从里面挑姿势帧裁头像/半身、把视频接进佣兵详情大框。
