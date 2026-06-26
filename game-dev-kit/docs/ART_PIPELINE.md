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
