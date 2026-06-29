# CLAUDE.md —— 项目 Playbook（每次会话先读这里）

> 这是一个 **Brown Dust 2 风格的横版抽卡 RPG**，纯原生 HTML/CSS/JS，部署到 GitHub Pages。
> 本文件让任何一次会话（即使零上下文）都能立刻按既定方法论工作，**不必从头摸索**。
> 配套深入文档：`BALANCE.md`(数值契约) · `ART_PIPELINE.md`(美术分工) · `art/05_pixellab/fx/README.md`(VFX 流程)。

## 0. 铁律（先记住这几条）
- **分支**：只在 `claude/brown-dust-2-dev-ma6cog` 开发与推送；不开 PR（除非明确要求）。
- **构建前必过数值闸门**：`node scripts/build.js` 会先跑 `balance-validate.js`，越界即拒绝构建。别用 `--no-validate` 绕过。
- **上线循环**（每次改完）：改 `js/*`/`css/*` → bump `index.html` 里的 `ASSET_VER` 和所有 `?v=N`（sed 批量）→ `node scripts/build.js`（重新内联生成 `game.html`）→ commit/push → 轮询线上 `ASSET_VER` 确认（~30-60s 生效）。
- **自测优先于"我觉得"**：能跑脚本/无头浏览器验证的，先验证再下结论。
- 提交信息结尾带 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 与 `Claude-Session:` 行；**任何产物里不要出现模型标识**。

## 1. 架构与构建
- 源码：`js/`（audio, data, balance, budget, lore, gear, costumes, game, battle, ui, story, comic, world, main）+ `css/style.css` + `index.html`。
- `scripts/build.js` 把 CSS+JS 内联进**自包含的 `game.html`**（线上实际加载它）。加载顺序见 build.js 的 `jsFiles`。
- 本地预览：`python3 -m http.server PORT` 后开 `game.html`（横屏视口，竖屏会显示"请横屏"）。
- 部署：`.github/workflows/pages.yml` —— `validate` job（数值校验+回归）通过后才 `deploy`。**不过不上线**。

## 2. 数值平衡（公式驱动，禁手填）—— 详见 BALANCE.md
- **技能**：`js/balance.js` 的 `Balance.make(spec)` 反解威力，平衡分须 `|score-1|≤0.18`。
- **属性**：`js/budget.js` 双轴预算（O 进攻 / S 生存），按 职业×稀有度 归一，`O/Oref+S/Sref≈2.0`。新角色用 `Budget.makeCharStats(rarity,cls,shape)` 生成。
- **装备/敌人**：装备分上限 / 敌人 O,S 理智带。
- **闸门**：`node scripts/balance-validate.js`（越界 exit 1，已接入 build + CI）。
- 自测脚本：`balance-check.js`(技能分) · `combat-test.js`(单挑+主线) · `playtest.js`(端到端胜率/节奏/深渊梯度) · `abyss-probe.js`/`stage-probe.js`(高采样精调关卡)。改数值/关卡后必跑。

## 3. 技能特效 VFX（动画/逻辑握手）—— 详见 art/05_pixellab/fx/README.md
- **原则**：战斗逻辑瞬时算完且权威；伤害的视觉表现（掉血/飘字）缓存，等特效"命中帧 impactFrame"再 flush，做到画面与扣血同步。
- 代码：`js/main.js > BattleUI`。注册表 `SKILL_VFX`（技能 id → {castMs, telegraphMs, star, burst, tint}）；逐帧 PNG 播放器 + 程序化兜底；`handleEvent` 拆即时/可延迟事件。
- 素材：`art/05_pixellab/fx/<effect>/frame_NNN.png` + `manifest.json{fps,frames,anchor,impactFrame,scale}`。
- **PixelLab 出图流程**（已验证，照走）：`create_1_direction_object`(size64,16候选) → 挑 → `animate_object`(v3,12帧) → 下载切帧 → 写 manifest（脚本统计亮度峰值定 impactFrame）→ 挂 SKILL_VFX → 截图验收。
- ⚠️ **画风教训**：提示词**别写** `black outline`/`low detailed`（出粗黑块状，和本作精细柔和立绘对不上）；写 `soft smooth shading, fine detailed pixels, no black outline, anime fantasy spell effect`。

## 4. 美术分工 —— 详见 ART_PIPELINE.md
- **用户只给**：动态立绘(视频)。**其余美术我全包**(PixelLab)。
- **我出(PixelLab全自动)**：每角色 field 序列帧(8向 idle/run + north 2施法,施法自带VFX) → gnorm归一 → 接入；头像/半身裁切；怪物/BOSS/场景/图标。
- ⚠️ **成功路径(已由 Lecliss 一次过验证，做任何角色前读 ART_PIPELINE.md)**：
  ① 一致性=**锁法A**：Lecliss 作锚，其余 `create_character_state` 从她派生(继承头身比/画风)。
  ② 母图 `v3 / size64 / selective outline / soft shading no black outline / 手不持武器`；**不加**正面对称后缀。
  ③ idle 用 **north-west 源**(gnorm IMIR 镜像出 NE，防抖腿)；走路**先建 mid-stride 状态**再做 walking_cycle(run 用 north-east 源)；施法描述**直接写技能内容**(自带火焰/奥术 VFX)。
  ④ 自测闸门 `fd8.js` 脚漂移全向 ≲1.5px 才过；**但 fd8 过≠不抽腿**——背向斜角两腿对称交换时质心不动、fd8 照样过却肉眼乱动(Rou 踩坑)，**必须额外目视 NW+NE idle 横条**确认脚钉地。背向斜角源**别固定 NW**：NW/NE 两个源都生成、取脚稳那个作源镜像另一向(Rou 是 NE 稳)。**一个一个做、不批量**，每个自测+用户验收后再下一个。

## 5. 自测手法（沿用）
- 无头浏览器：Playwright（`/opt/pw-browsers/.../chrome`，从 `/opt/node22/.../playwright-core` require），**横屏视口**(960×520)，开局先点几次"跳过"过剧情再截图。
- 渲染/裁图：`@napi-rs/canvas`（项目 node_modules，从 scratchpad 跑需 `NODE_PATH=<repo>/node_modules`）。
- PixelLab 出图 ~5-8 分钟：用后台 `sleep` 等待（前台 sleep 被禁），完成后 `get_object` 轮询。

## 6. 待优化（非美术，仅记录）
- 剧情文案 / 漫画 / 角色剧情 **润色**（目前偏生硬，框架大体不变，与用户一起打磨）。

---
**复用到新项目**：把本文件 + `BALANCE.md` + `ART_PIPELINE.md` + `fx/README.md` + 引擎件
(`js/balance.js`, `js/budget.js`, main.js 的 VFX 框架, `scripts/build.js` + 自测脚本) 作为模板克隆过去，
方法论、闸门、测试、文档即刻就位，无需重新摸索。
