# CLAUDE.md —— 项目 Playbook（每次会话先读这里）

> 这是一个 **Brown Dust 2 风格的横版抽卡 RPG**，纯原生 HTML/CSS/JS，部署到 GitHub Pages。
> 本文件让任何一次会话（即使零上下文）都能立刻按既定方法论工作，**不必从头摸索**。
> 配套深入文档：`dev/BALANCE.md`(数值契约) · `dev/ART_PIPELINE.md`(本作美术分工/实例细节) · `dev/GENERIC_ART_PIPELINE.md`(**全美术资产通用流水线**：角色/怪物/地图/UI/特效/立绘，跨游戏可复用) · `art/05_pixellab/fx/README.md`(VFX 流程)。

## 0. 铁律（先记住这几条）
- **分支**：只在 `claude/brown-dust-2-dev-ma6cog` 开发与推送；不开 PR（除非明确要求）。
- **构建前必过数值闸门**：`node scripts/build.js` 会先跑 `balance-validate.js`，越界即拒绝构建。别用 `--no-validate` 绕过。
- **上线循环**（每次改完）：改 `js/*`/`css/*` → bump `index.html` 里的 `ASSET_VER` 和所有 `?v=N`（sed 批量）→ `node scripts/build.js`（重新内联生成 `game.html`）→ commit/push → 轮询线上 `ASSET_VER` 确认（~30-60s 生效）。
- **自测优先于"我觉得"**：能跑脚本/无头浏览器验证的，先验证再下结论。
- **🛑 做事协议（铁律 · 每个任务都照走，用户明确要求写入）**：
  1. **先确认理解**：用户提出需求后，先复述我理解的意思，确认没跑偏（用户常说得不细，缺的细节要**主动问**，别自己猜）。
  2. **给简要方案**：动手前说清"准备怎么干、会产出什么结果、这个结果是否吻合你的要求"，等确认。
  3. **再开工**。
  4. **收尾必核对**：做完对着**原始需求逐条**核对是否全部满足（不是"我觉得好了"，是列出需求项逐个打勾）。
  5. **自测过了再汇报**：能脚本/无头验证的先验证，把验证结果一并汇报。
  - 违反此协议 = 返工。今日返工根因就是：不确认理解、做完不核对、不自测就汇报。
- 提交信息结尾带 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 与 `Claude-Session:` 行；**任何产物里不要出现模型标识**。

## 1. 架构与构建
- 源码：`js/`（audio, data, balance, budget, lore, gear, costumes, game, battle, ui, story, comic, world, main）+ `css/style.css` + `index.html`。
- **线上 web 入口是 `index.html`**（外链 `css/style.css?v=N` + `js/*.js?v=N`）。`scripts/build.js` 另把 CSS+JS 内联成**自包含的 `game.html`**（用于离线/原生壳/单文件分发，非 web 入口）。加载顺序见 build.js 的 `jsFiles`。
  - ⚠️ **CSS 里引用图片用相对路径要小心**：外链的 `css/style.css` 里相对路径相对 `css/` 目录解析 → 引 `art/` 资源要写 `url('../art/...')`；build.js 内联进根目录 `game.html` 时会自动改回 `art/`。**自测 UI 必须测 `index.html`**（线上入口），别只测 `game.html`（内联版会掩盖路径 bug）。
- 本地预览：`python3 -m http.server PORT` 后开 `game.html`（横屏视口，竖屏会显示"请横屏"）。
- 部署：`.github/workflows/pages.yml` —— `validate` job（数值校验+回归）通过后才 `deploy`。**不过不上线**。

## 2. 数值平衡（公式驱动，禁手填）—— 详见 dev/BALANCE.md
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

## 4. 美术分工 —— 详见 dev/ART_PIPELINE.md
- **用户只给**：动态立绘(视频)。**其余美术我全包**(PixelLab)。
- **我出(PixelLab全自动)**：每角色 field 序列帧(8向 idle/run + north 2施法,施法自带VFX) → gnorm归一 → 接入；头像/半身裁切；怪物/BOSS/场景/图标。
- ⚠️ **成功路径(已由 Lecliss 一次过验证，做任何角色前读 dev/ART_PIPELINE.md)**：
  ① 一致性=**锁法A**：Lecliss 作锚，其余 `create_character_state` 从她派生(继承头身比/画风)。
  ② 母图 `v3 / size64 / selective outline / soft shading no black outline / 手不持武器`；**不加**正面对称后缀。
  ②.5 🚦 **母图姿势闸门(铁律)**：出 8 向母图后**先逐角度严格目视检测姿势标准再做动画**——east/west 必须正侧面(只露一条腿一条胳膊侧脸,露第二条腿=带角度不合格),不合格就锁法A换 seed 重派生;**绝不在坏母图上做动画**(加西亚返工三次的教训)。详见 dev/ART_PIPELINE.md §5.5 #6。
  ③ idle 用 **north-west 源**(gnorm IMIR 镜像出 NE，防抖腿)；**走路先建 mid-stride walk-state 再做 walking_cycle**(迈步更自然，用户定法)；东西方向另出 `walk_side` 纯侧面经 `rewalk_generic` 覆盖(防 3/4)；施法描述**直接写技能内容**(自带火焰/奥术 VFX)。⚠️ **walk-state 偶发把斜角朝向画反**(Teried 东接西/SE接SW)，所以**组装后必过"走路朝向闸门"**(见 ④.5)——发现接反就重生成 walk-state 或镜像该向修正，别直接上线。
  ④ 自测闸门 `fd8.js` 脚漂移全向 ≲1.5px 才过；**但 fd8 过≠不抽腿**——背向斜角两腿对称交换时质心不动、fd8 照样过却肉眼乱动(Rou 踩坑)，**必须额外目视 NW+NE idle 横条**确认脚钉地。背向斜角源**别固定 NW**：NW/NE 两个源都生成、取脚稳那个作源镜像另一向。**v3 最多 re-roll 1-2 次还抽腿就上 `scripts/synthnwne.js` 合成呼吸兜底**(脚钉死 0.0px、只上半身起伏)，别无限 re-roll(Rou 定论)。**一个一个做、不批量**，每个自测+用户验收后再下一个。
  ⑤ 接入后必跑 `scripts/uniformsize.js`（按身体高全员归一到统一尺寸+高画布，防带光环角色偏小）；渲染画整幅脚对齐地线（不裁头顶/光环）。**问题→办法清单见 dev/ART_PIPELINE.md §5.5 质量保障 Playbook，做每个角色都主动套用**。

## 5. 自测手法（沿用）
- 无头浏览器：Playwright（`/opt/pw-browsers/.../chrome`，从 `/opt/node22/.../playwright-core` require），**横屏视口**(960×520)，开局先点几次"跳过"过剧情再截图。
- 渲染/裁图：`@napi-rs/canvas`（项目 node_modules，从 scratchpad 跑需 `NODE_PATH=<repo>/node_modules`）。
- PixelLab 出图 ~5-8 分钟：用后台 `sleep` 等待（前台 sleep 被禁），完成后 `get_object` 轮询。

## 6. 待优化（非美术，仅记录）
- 剧情文案 / 漫画 / 角色剧情 **润色**（目前偏生硬，框架大体不变，与用户一起打磨）。

---
**复用到新项目**：把本文件 + `dev/BALANCE.md` + `dev/ART_PIPELINE.md` + `fx/README.md` + 引擎件
(`js/balance.js`, `js/budget.js`, main.js 的 VFX 框架, `scripts/build.js` + 自测脚本) 作为模板克隆过去，
方法论、闸门、测试、文档即刻就位，无需重新摸索。
