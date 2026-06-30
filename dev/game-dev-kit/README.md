# 🎮 Game Dev Kit —— 复用开发套件（怎么用看这里）

这是从「棕色尘埃 2 风格抽卡 RPG」项目里沉淀出的**方法论 + 通用引擎 + 闸门/CI + 文档**，
目的：开新游戏项目时**不用再从头跟 AI 摸索这些路径**。

> 本地把这个文件夹（或它的压缩包 `game-dev-kit.tar.gz`）存好。**每开一个新项目，照「使用方法」喂一遍即可。**

---

## 里面有什么

| 文件 | 作用 | 复用方式 |
|------|------|----------|
| `CLAUDE.md.template` | **项目 Playbook 模板** | 复制为新项目根目录 `CLAUDE.md`，替换 `<占位>`。Claude Code 每次会话自动加载它，AI 一进项目就懂规矩。 |
| `engine/balance.js` | 技能威力公式模型 | 几乎可直接用，按本作**重校准常数**（文件头有说明）。 |
| `engine/budget.js` | 角色/装备/敌人**双轴数值预算** | 同上；改 `CLASS_REF60` 等参考值。 |
| `engine/vfx-framework.reference.js` | 技能特效**动画/逻辑握手**框架 | 参考实现，整段挪进你的战斗 UI，对接头部列的几个宿主钩子。 |
| `scripts/build.js` | 内联构建 + **数值闸门**（越界拒绝构建） | 改资源路径即可。 |
| `scripts/balance-validate.js` | 校验技能/属性/装备/敌人是否越界 | 跟随 budget/balance。 |
| `scripts/stat-analyze.js` | 数值预算**校准助手**（统计现有内容分布） | 校准新作数值时用。 |
| `ci/pages.yml` | GitHub Pages 部署 + **validate 闸门**（不过不上线） | 放到 `.github/workflows/`，改分支名。 |
| `docs/BALANCE.md` | 数值契约（加内容前必读） | 复制进新项目。 |
| `docs/ART_PIPELINE.md` | 美术资产清单 + 分工 | 复制进新项目，按新作角色改。 |
| `docs/VFX_PIPELINE.md` | PixelLab 出特效**标准流程**（含画风教训） | 直接复用。 |

---

## 使用方法（开新项目的准备工作）

### 方式 A（推荐）：做成你自己的「模板仓库」，以后 clone 即用
一次性操作：
1. 把本套件 push 成你 GitHub 上的一个仓库，例如 `game-template`。
2. 以后开新项目：`git clone game-template 新项目名` → 改 `CLAUDE.md` 占位 → 开工。
3. 因为带着 `CLAUDE.md`，**新会话的 AI 自动就懂这套方法论**，无需你复述。

### 方式 B：本地存这个文件夹，开新项目时「喂」给 AI
每开一个新项目，对 AI 说（一句话即可）：
> 「这是我们的开发套件，按里面的 `CLAUDE.md.template` 和 `docs/` 建立项目方法论：
> 复制 CLAUDE.md 到根目录并替换占位，接入 `engine/` 的 balance/budget/VFX 框架，
> 用 `scripts/` 的构建闸门和 `ci/pages.yml`。先读 docs 三份再动手。」

然后把这个文件夹（或压缩包）放进新项目目录 / 拖给它即可。

### 你需要在本地存的东西
**就存这一个 `game-dev-kit/` 文件夹（或 `game-dev-kit.tar.gz`）。** 这就是你的"种子"。
- 方式 A：存一次、push 成仓库，以后 `git clone` 不用再管本地副本。
- 方式 B：每次把它拷进新项目根目录，让 AI 照着搭。

---

## 新项目第一天，让 AI 按这个顺序做
1. 复制 `CLAUDE.md.template` → 根 `CLAUDE.md`，填本项目的 技术栈/分支/路径/部署方式。
2. 放好 `engine/balance.js` + `engine/budget.js`，**按本作角色重校准常数**（跑 `stat-analyze.js` 看分布）。
3. 接 `scripts/build.js` 闸门 + `ci/pages.yml`（改分支名）。
4. 战斗里需要技能特效时，挪入 `vfx-framework.reference.js`，按 `docs/VFX_PIPELINE.md` 用 PixelLab 出图接入。
5. 美术按 `docs/ART_PIPELINE.md` 分工推进。

---

## 注意（边界说明，别误期待）
- **可直接复用**：方法论(CLAUDE.md/docs)、数值引擎(balance/budget)、构建闸门、CI 模式、VFX 流程。
- **需要按新作重写**：具体的**战斗内核、角色/关卡数据、UI**（这些和玩法强绑定，是模板不是成品）。
- 即「**脚手架、闸门、测试套路、文档、方法论**现成；**游戏内容本身**仍要按新作做」——但你不再从零摸索"该怎么搭、怎么测、怎么不崩盘、怎么出特效"。
