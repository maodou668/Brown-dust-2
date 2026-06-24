# art/ · 美术资产目录

> 所有美术源文件与导出资产按门类归档于此。规范见 [`../docs/美术圣经.md`](../docs/美术圣经.md)。
> 风格唯一：**赛璐璐（Cel-shading）**；角色动画唯一管线：**DragonBones**。

## 目录分类

| 目录 | 门类 | 内容 |
| --- | --- | --- |
| `01_splash/` | 立绘 | 全身立绘 PSD（分层）/ PNG，表情差分，UI 头像裁切 |
| `02_dragonbones/` | 角色动画 | DragonBones 工程 + 导出（`*_ske.json` / `*_tex.json` / `*_tex.png`） |
| `03_battle/` | 战斗呈现 | 接地阴影、站位辅助、缩放参考 |
| `04_env/` | 场景元素 | 战斗/大厅背景分层（far/mid/near/ground），主题色板 |
| `05_ui/` | UI 美术 | 切图、图标集、9-slice、字体样例 |
| `06_cg/` | 剧情 CG | 全屏 CG、漫画分镜 |
| `07_vfx/` | 技能特效 | 元素特效序列帧、打击感素材 |
| `_palette/` | 色板 | 主控色板、元素色板、LUT、参考样例 |

## 命名速查（详见美术圣经 §9）
```
char_<id>_<costume>_splash.png      立绘
char_<id>_<costume>_ske.json        骨架
char_<id>_<costume>_tex.png/.json   图集
face_<id>_<expr>.png                表情差分（calm/joy/anger/sad/surprise/shy）
ui_icon_<name>.png                  UI 图标
vfx_<element>_<skill>_###.png       特效序列帧
env_<theme>_<layer>.png             场景层（far/mid/near/ground）
cg_<storyid>.png                    全屏 CG
```

## 接入流程
现状为 emoji / CSS 占位。每个角色按
**立绘 → 分层 → 骨骼绑定 → DragonBones 导出 → 接入运行时（替换 `charAvatar` / 战斗单位）**
顺序逐个替换，先主角后配角，每个替换后跑一次美术圣经 §12 的一致性 QA。
