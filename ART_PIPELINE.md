# 美术生产手册 —— PixelLab 成功路径（精简版）

> **唯一可信流程**：一个角色一条龙做完 → 自测 → 用户验收 → 再下一个。**不批量**（避免失控）。
> 此流程由 **Lecliss 一次过**验证（idle 脚漂移 0.2–1.3px、走路有步幅、施法自带特效）。
> 配套脚本（在 `scripts/`，跑前置 `NODE_PATH=$(pwd)/node_modules`）：
> `gnorm.js`(归一器) · `fd8.js`(脚漂移自测) · `synthidle.js`(合成呼吸兜底) · `skillcap.js`(游戏内技能配对自测)。
> 上线循环见 `CLAUDE.md`。

游戏 16 角色：`lecliss(锚) justia seir rou helena diana garcia teried lia mina refithea rigenette olstein glacia liatris loen`

---

## 0. 分工
- **我（PixelLab 全自动）**：每角色 field 序列帧（8 向 idle + 8 向 run + north 向 2 个施法，施法自带 VFX）→ gnorm 归一 → 接入 → 头像/半身裁切。怪物/BOSS/场景/图标同理我出。
- **你给**：**动态立绘（视频）**。其余美术我包。

---

## 1. 一致性 = 锁法A（核心，必守）
- 锚角色 **Lecliss**（已用 `create_character` v3 生成，id `31beeaf4`）。
- **其余 15 个一律从锚派生**：`create_character_state(source=Lecliss, edit_description="<该角色外观, 见§5>", use_color_palette_from_reference=false)` → 继承同一头身比/画风/骨架 → 全员一致。
- ❌ 不要对每个角色单独 `create_character`（v3 忽略 `proportions`，头身比会逐个漂移——这是早期"画风不统一"的根因）。

---

## 2. 母图参数
- `mode: v3` · `size: 64` · `view: low top-down` · `outline: selective outline` · `detail: high detail`
- 提示词**结尾固定**：`empty open hands not holding any weapon, soft smooth shading, no black outline, clean lineart`
- ❌ **不加**任何"正面对称/front view"后缀（8 向角色自己会转向，加了反而坏）。
- ❌ **别用**默认 `single color black outline`（出粗黑块，和柔和立绘不搭）。
- **手上不持武器**（手持件生成质量极差）；武器改**背负**：剑 `sheathed across the back`、盾 `mounted on the back`、箭袋 `quiver on the back`；法师/治疗靠法袍+元素宝石表达。

---

## 3. 动作（全部 `animate_character mode=v3`）
**镜像省额度**：每个动作只生成 **5 个源方向**，gnorm 自动镜像其余 3 向（东↔西、东北↔西北、东南↔西南；南/北不可镜像）。

### ① idle（循环，8 向）
```
animate_character(char, animation_name="idle",
  action_description="standing idle, breathing gently with a subtle relaxed sway",
  directions=["south","south-east","east","north","north-west"], frame_count=6)
```
- ⚠️ 背向斜角用 **north-west 当源**（直接生成 north-east 会抖腿，v3 quirk）；gnorm 用 **IMIR** 表把 NW 镜像成 NE。

### ② walk（循环，8 向）—— 必须先建「迈步状态」
直接做 run 会"南向腿朝别处、北向转头"。根治：先定一个迈步静态姿势再做循环。
1. `create_character_state(该角色, edit_description="mid-stride walking pose, one leg stepping forward, arms swinging naturally, <角色标识词>", use_color_palette_from_reference=true)`
2. 在该**状态**上：
```
animate_character(walkstate, animation_name="walk",
  action_description="walking cycle loop, legs striding forward in the facing direction, smooth seamless loop, subtle natural gait",
  directions=["south","south-east","east","north-east","north"], frame_count=8)
```
- ⚠️ 背向斜角用 **north-east 当源**（run 用 **MIR** 表，与 idle 的 IMIR 相反）。
- ⚠️ **east/west 走路必须正侧面(Diana/Helena/Rou 踩坑)**：迈步状态的 east 旋转常漂成「3/4 正面(朝右下 SE)」，导致 run east/west 不是标准正侧面、和 idle 对不上。**根治**：east 走路别用迈步状态，改在**基础角色**(其 east 旋转是干净正侧面)上单独生成 `animate_character(基础角色, animation_name="walk_side", action="walking cycle loop in pure side-profile view facing directly to the right, the body stays in side view not turning toward the camera, legs striding forward and back along the ground, smooth seamless loop", directions=["east"], frame_count=8)`，再用 `scripts/rewalk_ew.js` 同款逻辑把 run/east(直取,丢首帧) + run/west(镜像) 重组进 `<char>_field`。组装后**目视 run east/west 横条要和 idle east/west 同朝向**(正侧面迈步,不转向镜头)。

### ③ casts（一次性，仅 north）—— 描述里直接写技能内容，PixelLab 把特效画进帧
- 招牌技：`animation_name="castsig", action="casting a blazing inferno spell, raising both hands"`
- 职业技：`animation_name="castcls", action="class_skill, thrusting one hand forward casting an arcane fire bolt"`
- **命名约定**（让 gnorm 的 CASTMAP 通用）：招牌技动作**以 `casting` 开头**、职业技**以 `class_skill` 开头**。
- 动作含元素/技能内容 → 帧里**自带火焰/奥术 VFX**，省去单独做特效。`directions=["north"], frame_count=6`。

> 并发：PixelLab 一次塞太多会卡死，**同时 ≤4 个 job**；任务偶尔静默掉，下载发现缺帧就重发。

---

## 4. 组装（gnorm）
1. group 下载**最终一致**：轮询下载直到「主角色有 idle+2 casts」且「走路状态有 walking_cycle」再组装（否则缺帧）。
2. 把走路状态的 `walking_cycle*` 文件夹复制进主角色的 `animations/`（同一 group 内，主角色 + 1 个走路状态，按文件夹名 `walking_cycle` 区分即可）。
3. 跑归一器：
```
node gnorm.js <char> <mergedDir> '{"cast_class":"class_skill","cast":"casting"}'
```
   - 归一到 Lecliss `bbox 59×46 / 64 画布`，底对齐+居中；
   - idle 用 **IMIR**(NW→NE 镜像)；run **优先** `walking_cycle` 文件夹并用 **MIR**(NE→NW)；casts 按 CASTMAP 分类成 `cast`/`cast_class`。
4. 输出 `art/05_pixellab/<char>_field/` + `manifest.json` → 接 `BattleUI.FIELD_SPRITE` + `world.js`。

---

## 5. 自测闸门（过了才给用户/部署）
1. **脚漂移**：`node fd8.js <char> idle` → 全 8 向 ≲1.5px 才算站稳（Lecliss 0.2–1.3）。超标=该向抽腿 → 重 roll 那个源方向，或 `node synthidle.js <char>` 合成呼吸兜底。
   - ⚠️ **fd8 达标 ≠ 不抽腿**：背向斜角若两腿**对称交换**，质心几乎不动、fd8 照样 1.x px 过关，但肉眼明显乱动（Rou 踩过坑）。**必须额外目视 NW+NE idle 序列帧**(渲成横条)，确认双脚钉地、只有上半身呼吸。
   - ⚠️ **背向斜角源的选法**：**别固定用 NW 源**。NW 和 NE **两个源都生成**(提示词都加 `both feet firmly planted flat on the ground and motionless, legs and lower body perfectly still, only upper body and head sway gently with breathing`)，**横条对比取脚钉地不转身的那个作源**，再镜像出另一向。gnorm 默认 IMIR 用 NW 源，若该角色 NE 才稳，就走 `scripts/reidle2.js` 单独重组这俩方向。
   - 🔑 **v3 压不住就上合成呼吸(Rou 定论，别反复 re-roll)**：某些角色的背向斜角(NW/NE) v3 **怎么 roll 腿都有残留位移**(Rou 试了 3 轮)。**最多 re-roll 1-2 次**，还抽腿就直接 `scripts/synthnwne.js`——取一张脚钉地静态帧，程序化只对上半身做垂直起伏(呼吸)，腿脚每帧锁死，脚漂移 0.0px、物理上不可能抽腿，正是"下半身不动只有上半身呼吸"。这是终极兜底，不要在 v3 上无限纠缠。
2. **静态 sheet**：渲染 idle 8 向 + run 8 向 + cast 肉眼过：同一个人 / 不乱腿 / 施法有特效。
3. **游戏内技能配对**（必做）：`node skillcap.js`（Playwright 驱动真实战斗）让该角色放**两个技能**（职业技 + 招牌技），截图验证：
   - 招牌技 → `cast` 动画；职业技(`cls_*`) → `cast_class` 动画（triggerCast 按 `CLASS_SKILL_OF` 选）；
   - VFX 元素与技能一致（招牌技 VFX = `BASE_SIG[char]` 那个；职业技 = `cls_*`）；不串、不缺。
   - 角色的招牌技 id 见 `costumes.js > BASE_SIG`；务必确认该 id 在 `main.js > SKILL_VFX` 有对应项（全 16 + 5 职业技现已齐全）。
4. `node scripts/build.js`（数值闸门）→ bump `ASSET_VER`+`?v=` → commit/push → 轮询线上 → **发图给用户验收** → 过了再做下一个角色。

---

## 5.5 质量保障 Playbook —— 问题 → 办法（每个角色都按此「先发制人」，别等用户发现）

> 这些是已踩坑并验证的修法。**做每个角色时主动套用**，不是出了问题才补。配套脚本都在 `scripts/`。

| # | 症状 | 根因 | 办法（脚本） | 先发制人步骤 |
|---|------|------|------|------|
| 1 | 背向斜角 idle **抽腿/乱动**（NW/NE） | v3 对背向斜角两腿对称交换；fd8 质心不动照样过 | NW、NE **两源都生成**取脚稳者镜像(`reidle2.js`)；**v3 最多 roll 1-2 次**还抖就 `synthnwne.js` 合成呼吸(脚钉死 0.0px) | 生成 idle 时 NW+NE 都出；**目视横条**确认脚钉地，不只看 fd8 |
| 2 | **east/west 走路**朝向偏成 3/4 正面(SE/SW) | 迈步状态的 east 旋转漂成正面 | 在**基础角色**(正侧面 east)上单独生成 `walk_side`，`rewalk_ew.js` 重组 run/east+west(镜像) | 走路组装后**目视 run east/west 必须和 idle east/west 同朝向**(正侧面) |
| 3 | 移动时**头顶/光环被裁** | 渲染只裁固定 bbox(y 上界)，超出被切 | 渲染改**画整幅、脚对齐地线**(world.js 已改) | 量 `所有动作所有帧` 的最高内容，确认渲染不裁顶 |
| 4 | 角色**大小不统一**(带大光环者偏小) | gnorm 按「整体外接框(含光环)」填满 → 光环吃高度、身体被压小 | `uniformsize.js` 按**身体高**(脚→头顶,排除光环)归一到统一值 + 高画布(64×72,脚 y=64) | 接入后跑 `uniformsize.js`；目视全队同框，身体等高 |
| 5 | 技能名/动作/VFX **不对**(如水法师第2技能是通用奥术弹) | 通用职业技不贴人设 | `costumes.js > CLASS_SKILL_OVERRIDE` 给该角色换专属技；缺 VFX 用 `create_1_direction_object→animate_object` 做 | skillcap 验证两技能动画+VFX 配对；元素与人设一致 |

**通用收尾**：`uniformsize.js` 是**全员归一**步骤——任何角色接入后都要跑一遍(它读各角色身体高、统一到同一值)，保证全队同框等高。

---

## 6. 各角色外观（派生用 `edit_description`，前面加 `Transform into: `）

**贾丝蒂亚 Justia · 5★ 光·坦克**
Beautiful anime holy paladin knight girl, long flowing golden-blonde hair, bright noble golden eyes, a radiant golden sun-ray halo behind her head, ornate white and gold radiant plate armor with layered pauldrons and gold filigree, a flowing deep-blue cape, a glowing warm-gold light gem on the breastplate and belt, a round holy shield with a golden sun emblem mounted on her back, white-and-gold gauntlets and thigh-high boots with blue trim, dignified protective expression.

**希尔 Seir · 5★ 暗·游侠**
Beautiful anime dark ranger huntress girl, long sleek silver-violet hair in a high ponytail, sharp violet eyes, a small crescent-moon ornament with faint purple glow on the side of her head, form-fitting black and deep-violet leather assassin outfit with a layered shoulder cloak, a glowing violet shadow gem on the chest and belt, a quiver on her back, black fingerless gloves, black thigh-high leather boots with violet trim, cool deadly expression.

**蕾菲西亚 Refithea · 5★ 光·治疗**
Beautiful anime holy saintess girl, very long flowing pale-gold hair, gentle radiant golden eyes, a glowing golden halo ring behind her head, elegant floor-length white and gold priestess robe with layered flowing sleeves and gold sacred filigree, a glowing warm-gold light gem on the chest and waist sash, white lace gloves, white-gold trimmed shoes, serene graceful divine expression.

**莉洁奈特 Rigenette · 5★ 风·战士**
Beautiful anime sky knight commander girl, long sky-blue hair flowing as if in wind, bright cyan eyes, a small feathered wing ornament on the side of her head, sleek azure and white knight armor with layered pauldrons and a flowing white cape, a glowing pale-blue wind gem on the chest and belt, a slender longsword sheathed across her back, black-and-silver gloves, white thigh-high boots with cyan trim, commanding elegant expression.

**奥尔斯坦 Olstein · 5★ 地·坦克（男）**
Powerful anime veteran male fortress guardian, short greying tan hair with a thick beard, stern amber eyes, a scar across one cheek, massive heavy bronze and tan fortress plate armor with thick pauldrons and earthen-gold engravings, a glowing amber earth gem on the breastplate and belt, an enormous tower shield mounted on his back, heavy gauntlets and tan greaves with stone texture, immovable stoic expression.

**萝 Rou · 4★ 光·治疗**
Beautiful anime gentle young priestess girl, soft shoulder-length mint-green hair with a side braid, kind warm teal eyes, a small glowing leaf-and-light ornament on the side of her head, flowing white and mint-green healing robe with a soft layered skirt and gold trim, a glowing soft-green light gem on the chest and waist ribbon, white fingerless gloves, white-and-mint boots, gentle warm-smiling expression.

**海莲娜 Helena · 4★ 风·战士**
Beautiful anime swift wind swordswoman girl, short layered cyan-blue hair with windswept bangs, bright blue eyes, a small wind-feather ornament on the side of her head, light teal and white agile battle outfit with one silver shoulder pauldron, a flowing scarf and short layered skirt, a glowing cyan wind gem on the chest and belt, a slender curved sword sheathed across her back, black fingerless gloves, teal-trimmed thigh-high boots, energetic confident expression.

**黛安娜 Diana · 4★ 水·法师**
Beautiful anime calm water mage girl, long straight deep-blue hair with a side braid, cool blue eyes, a small water-droplet ornament on the side of her head, elegant blue and silver mage robe with flowing layered sleeves and long skirt, a glowing blue water gem on the chest and belt clasp, wave patterns along the hem, blue fingerless gloves, blue-silver boots, serene intelligent expression.

**加西亚 Garcia · 4★ 地·坦克（男）**
Sturdy anime young male earth guardian, short rugged brown hair, determined earthy-brown eyes, heavy rugged brown plate armor with rocky textured plating and thick pauldrons, a glowing amber earth gem on the breastplate and belt, a massive round tower shield mounted on his back, heavy brown gauntlets and stone-plated greaves, rock-solid dependable expression.

**格蕾西亚 Glacia · 4★ 水(冰)·法师**
Beautiful anime quiet ice sorceress girl, long pale icy-blue and white hair with crystalline strands, cold pale-blue eyes, a small ice-crystal ornament on the side of her head, elegant white and frost-blue mage robe with a snowflake-patterned skirt and fur-trimmed collar, a glowing pale-blue ice gem on the chest and belt, white fingerless gloves, white thigh-high boots with frost-blue trim, reserved calm expression.

**莉亚特丽丝 Liatris · 4★ 火·游侠**
Beautiful anime crimson fire sniper girl, long red-orange hair tied back with loose side strands, fierce burning orange eyes, a small ember ornament on the side of her head, sleek crimson and black ranger outfit with a fitted bodice and short skirt with flame trim, a glowing orange flame gem on the chest and belt, a quiver on her back, black fingerless gloves, black thigh-high boots with crimson flame trim, confident sharp-smirking expression.

**泰瑞德 Teried · 3★ 火·战士（男）**
Spirited anime young male apprentice swordsman, messy orange-red hair, warm eager orange eyes, simple sturdy light leather warrior outfit with red and orange accents and a short shoulder cape, a small glowing orange flame gem on the chest belt, a simple steel sword sheathed across his back, brown leather fingerless gloves, brown boots with orange trim, eager hopeful rookie expression.

**莉亚 Lia · 3★ 地·游侠**
Beautiful anime cheerful grassland huntress girl, green hair in a braided ponytail, bright lively green eyes, a small leaf ornament on the side of her head and light freckles, light green and brown leather hunting outfit with leaf motifs and a short layered skirt, a glowing green earth gem on the chest and belt, a quiver on her back, brown fingerless gloves, brown thigh-high boots with green trim, cheerful friendly expression.

**米娜 Mina · 3★ 风·治疗**
Cute anime petite young alchemist girl, short aqua-teal hair in twin-tails with small clips, big round innocent teal eyes, a small bubble-and-leaf ornament on the side of her head, light apothecary dress with an apron and many small potion pouches on the belt, a glowing aqua gem on the chest and belt, short white gloves, short aqua-teal boots with white trim, cheerful innocent slightly-clumsy expression.

**罗恩 Loen · 3★ 光·战士（男）**
Earnest anime young male dawn knight, neat golden-blond hair, bright determined eyes, polished golden and white knight armor with layered pauldrons and a flowing short cape, a glowing warm-gold light gem on the breastplate and belt, a longsword sheathed across his back, gold-and-white gauntlets and golden greaves with white trim, upright heroic passionate expression.

> 每条末尾按 §2 统一加：`empty open hands not holding any weapon, soft smooth shading, no black outline, clean lineart`。

---

## 7. 目录约定
```
art/05_pixellab/<char>_field/       战斗/地图序列帧 + manifest.json（我，PixelLab→gnorm）
art/05_pixellab/fx/<effect>/        独立技能 VFX（仅在施法没自带特效时才单独做）
art/01_splash/<char>_live.{mp4,webm}  动态立绘视频（你给）→ 我裁头像/半身、接 LIVE_SPLASH
```
接入清单（我执行）：`FIELD_SPRITE`+`world.js` 注册 → 头像/半身裁切写 `CHARACTERS[].art` →
`node scripts/build.js` → bump 版本 → commit/push → 线上验收。

---

## 8. 现状
- ✅ **Lecliss** —— 锚角色，全套完成并线上验收（v122）。新角色照此对齐。
- ⬜ 其余 15 个：逐个派生（§1 锁法A）→ §3 动作 → §4 组装 → §5 自测 → 用户验收 → 下一个。
- 待优化（非美术，记录）：剧情/漫画/角色文案润色。
