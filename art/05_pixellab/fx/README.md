# 技能特效素材投放规范（VFX drop-in）

把逐帧 PNG 放到 `art/05_pixellab/fx/<effect>/`，游戏会自动加载并替换内置的程序化兜底特效。
当前火法 inferno 用到两个特效：`hexstar`（脚下六芒星预警）、`fire_explosion`（居中爆炸）。

## 目录结构
```
art/05_pixellab/fx/hexstar/
  manifest.json
  frame_000.png
  frame_001.png
  ...
art/05_pixellab/fx/fire_explosion/
  manifest.json
  frame_000.png
  ...
```
- 帧文件名：`frame_` + 3 位补零序号 + `.png`（从 000 开始连续）。
- 透明背景 PNG；建议正方形画布，特效内容居中。

## manifest.json 字段
```json
{
  "fps": 24,            // 播放帧率
  "frames": 18,         // 总帧数（必须与实际 PNG 数量一致）
  "anchor": "center",   // 仅作记录；实际锚点由技能时间线指定（六芒星=脚下，爆炸=居中）
  "impactFrame": 9,     // ★命中帧：第几帧是“爆炸命中”——敌人就在这一帧掉血+飘字
  "scale": 1.4          // 相对敌人单位宽度的整体缩放
}
```

`impactFrame` 是动画与逻辑「握手」的锚点：引擎按 `impactFrame / fps` 算出命中时刻，
到点把本次技能的伤害（掉血、伤害数字、破防/灼烧等）一次性放出，做到画面与扣血严丝合缝。
六芒星无需 impactFrame（它是预警，不触发伤害）。

## 新技能接特效
在 `js/main.js` 的 `BattleUI.SKILL_VFX` 里加一条：
```js
技能id: { castMs: 380, telegraphMs: 460, star: 'hexstar', burst: 'fire_explosion', tint: '#ff6a2a' },
```
- `castMs`：角色施法收招时长（之后才出六芒星）
- `telegraphMs`：六芒星预警持续多久后爆炸
- `star` / `burst`：用哪个特效目录（爆炸的 impactFrame 决定伤害落点）
- 多目标技能（如全体）会对每个被命中的敌人各放一份，伤害在爆炸命中帧统一结算。

素材没到位时，引擎用内置 canvas 程序化特效（六芒星 + 烈焰爆炸）兜底，握手逻辑完全一致，
所以你可以先看到时序效果，之后把 PNG 丢进来即“无缝替换”，零改代码。
