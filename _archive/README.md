# _archive —— 历史/废弃文件归档区（**不参与游戏运行与构建**）

> 这里是从主仓库摘出来的**已废弃方法、失败尝试、一次性实验、过期文档**。
> **目的**：让游戏目录保持纯净（`index.html` / `game.html` / `js/` 14 件 / `css/` / `scripts/` 活跃工具 / `art/` 资产才是游戏本体），
> 同时把**会误导的旧内容**（尤其是和现行 PixelLab 流程冲突的旧美术方案）隔离出去。
>
> ⚠️ **本目录内任何文件都不要再用于现行流程**。需要现行做法请看：`CLAUDE.md` · `ART_PIPELINE.md` · `GENERIC_ART_PIPELINE.md` · `BALANCE.md`。
> 这里的东西**保留只为追溯历史**；删了也不影响游戏，留着是怕以后想回看当初为什么放弃某条路。
> 归档不影响调用：游戏构建（`scripts/build.js` 只内联 `js/` 里写死的 14 个文件）与 CI 都不引用本目录。

## demos/ —— 早期 demo 网页（已废弃，无人引用）
`anim-test / chibi-demo / dragonbones-demo / pixellab-demo / rig-demo / sprite-demo / video-demo`.html
早期验证各种动画方案的独立网页。现已全部被自包含的 `game.html` 取代，主游戏不引用它们。

## js-legacy/ —— 放弃的 DragonBones 骨骼/精灵方案
`dragonbones-lite.js · rig.js · sprite-actor.js · sprite-anim.js`
最初想用 **DragonBones 2D 骨骼动画 + 切件重组** 做角色（见 tasks #1–4 的"切件/骨架/rig"），
后来**整体改用 PixelLab 逐帧精灵**，这套就废了。这 4 个 js **不在 `build.js` 的内联清单里**，只被 `demos/` 里的死网页引用。

## scripts/ —— 一次性/实验性/废弃脚本（仓库里无任何引用）
- `_pl*.js`：早期 PixelLab 出图的临时拼图/对比/证明脚本（scratch）。
- `*meowa*.js`：早期测试角色 "meowa" 的生成脚本（非正式角色）。
- `chibi-*.js`：放弃的 chibi（大头）画风尝试。
- `db-*.js · gen-db-template.js · rig-*.js`：DragonBones/骨骼方案配套（同 js-legacy 一起废弃）。
- `gen-art*.js · gen-chars.js · gen-icon.js`：PixelLab 之前的程序化/AI 生成实验。
- `pixellab-animate/pack/pack-field/poll.js`：早期手写的 PixelLab API 封装，已被 MCP 流程 + `gnorm.js` 取代。
- `contact-sheet.js · recover-sprites.js · render8.py · video-to-sheet.js`：一次性工具。
  （注：`video-to-sheet.js` 是视频转序列帧工具，原为已废弃的 sprite-anim 方案写的；若将来做立绘视频接入[§F]需要类似能力，可回这里取来改造。）

> 仍在用的活跃脚本都留在 `scripts/`：构建/CI（`build.js` `build-web.js` `balance-validate.js` `balance-check.js` `combat-test.js`）、
> 美术管线（`gnorm.js` `uniformsize.js` `rewalk_generic.js` `reidle_generic.js` `reidle2.js` `rewalk_ew.js` `synthnwne.js` `synthidle.js`）、
> 自测闸门（`fd8.js` `rundiag.js` `skillcap.js` `playtest.js` `abyss-probe.js` `stage-probe.js` `stat-analyze.js`）、PixelLab 助手 `pixellab.js`。

## docs-stale/old-docs/ —— 过期/冲突文档
- `数值平衡.md`：早期数值说明，已被根目录 `BALANCE.md` 取代。
- `美术圣经.md`：**老美术规范，明确要求"DragonBones 2D 骨骼动画 + 赛璐璐"**，与现行 PixelLab 逐帧流程**直接冲突**，
  留在 `docs/` 会误导。现行权威是 `ART_PIPELINE.md` + `GENERIC_ART_PIPELINE.md`。
