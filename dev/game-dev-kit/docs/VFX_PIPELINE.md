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

---

# 用 PixelLab 生成特效的标准流程（已验证，照此走）

火焰爆炸(inferno)就是按这套一次做成的，新特效照搬即可：

1. **生成弹体图** `create_1_direction_object`（size=64，出 16 张候选）。
   - 提示词只写**主体 + 本作画风词**：`soft smooth shading, fine detailed pixels,
     no black outline, thin subtle edges, vibrant anime fantasy spell effect`。
   - ⚠️ 教训：**绝对不要写 `black outline` / `low detailed`** —— 那会出粗黑描边的复古块状，
     和本作精细柔和的立绘对不上（第一版火焰就栽在这）。本作画风=细腻、柔和、无硬描边。
2. **挑候选** `get_object` 看 16 张，挑「最贴画风 + 最像爆炸/能炸开」的；
   `select_object_frames(indices=[..])` 提升为正式对象（免费）。挑不准就下载下来和立绘并排比。
3. **动画化** `animate_object`（mode=v3，frame_count=12 → 存 13 帧）。
   - 动画词强调「亮闪爆发 → 向外扩散 → 干净淡出到烟」，弧线才好看（别让它打旋滞留）。
4. **下载切帧**：13 帧存到 `art/05_pixellab/fx/<effect>/frame_000.png…`，
   再写 `manifest.json`（`fps`、`frames`、`anchor`、`impactFrame`=亮闪那一帧、`scale`）。
   - 用脚本统计每帧不透明像素/亮度找峰值，峰值帧即 `impactFrame`（伤害落点）。
5. **挂技能**：在 `js/main.js > BattleUI.SKILL_VFX` 加一行（见上文），`tint` 配元素色。
6. **验证**：bump 版本→`node scripts/build.js`→本地起 http→Playwright 截命中帧→对比画风→
   `git` 提交推送→轮询线上 ASSET_VER。

> 调试小贴士：MCP 出图约 5-8 分钟，用后台 `sleep` 等待再 `get_object` 轮询，别空转。
> v3 动画倾向「保持物体原位做内部变化」，不会真的炸到铺满屏；把 `impactFrame` 卡在最亮的
> 爆发瞬间扬长避短即可。需要更夸张的扩散可用 `animate_object` 的 `end_frame_base64` 插值法。
