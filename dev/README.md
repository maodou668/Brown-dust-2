# dev —— 开发文档与工具知识（**不参与游戏运行**）

> 这里放的是**做这个游戏用的方法论、规范、复用套件**——它们是"工具/知识"，不是"游戏本体"。
> 摘到这个文件夹只为**让游戏目录保持纯净（游戏就是游戏）**；任何代码/构建/CI 都不读取本目录，移动它不影响运行。
> 根目录留的是游戏本身（`index.html` `game.html` `js/` `css/` `art/` `icons/` `manifest` 等）+ `scripts/`（构建/自测工具链）+ `CLAUDE.md`（每次会话入口）+ `README.md`。

## 文档清单
| 文件 | 内容 |
|---|---|
| `BALANCE.md` | 数值契约（技能/属性/装备/敌人预算模型），加内容前必读 |
| `ART_PIPELINE.md` | **本作**美术生产手册 + 16 人实战踩坑/脚本（PixelLab 成功路径，含母图姿势闸门、走路朝向闸门） |
| `GENERIC_ART_PIPELINE.md` | **跨游戏通用**全美术资产流水线（角色/怪物/地图/UI/特效/立绘 + 风格档案） |
| `CHARACTER_PROMPTS.md` | 角色外观提示词集 |
| `ROADMAP.md` | 路线图 |
| `BUILD_NATIVE.md` | Android/iOS 原生壳（Capacitor）构建说明 |
| `game-dev-kit/` | 开新游戏用的"种子套件"（CLAUDE.md 模板 + 通用引擎 + 闸门/CI + 文档模板） |

## 调用约定（移动后路径如何引用）
- 我（AI）读这些文档用仓库相对路径即可：`dev/ART_PIPELINE.md` 等。
- 文档里提到的脚本仍在根目录 `scripts/`（如 `scripts/rundiag.js`），从仓库根运行不变。
- `art/05_pixellab/fx/README.md`（VFX 素材规范）仍随素材留在 `art/` 下，未移动。
- `CLAUDE.md` 顶部「配套深入文档」已指向 `dev/` 下的新位置。
