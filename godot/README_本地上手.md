# Godot 本地上手（3 步，10 分钟）

## 1. 装编辑器
去 https://godotengine.org/download 下载 **Godot 4.x**（不要 .NET 版），Windows 就是一个 exe，双击即用，免安装。

## 2. 打开工程
克隆/拉取本仓库后，打开 Godot → 「导入」→ 选仓库里的 `godot/project.godot` → 打开。
首次打开会自动导入资源（几十秒）。按 **F5** 运行，方向键移动测试角色。

## 3. 拖场景（你的主战场）
左侧「场景」树里展开 **World** 节点——每栋房子/树/井/灯都是一个可选中的节点：
- **鼠标拖动** = 挪位置（吸附可在顶部磁铁图标开，建议 16px 网格）；
- 右侧「检查器」改 `scale` = 改大小；
- `Ctrl+D` 复制一棵树/一段栅栏，拖到想要的位置；
- 灯柱下面的 `light_*` 节点是光源，`energy`/`texture_scale` 调亮度和照射范围。
改完 **Ctrl+S 保存**，然后正常 git 提交推送即可——我在云端能读到你的摆放。

## 地面怎么改
地面（草地/土路）由 `scenes/village_map.json` 驱动（Ground/Road 两个 TileMapLayer 上挂了
`ground_builder.gd` 自动铺）。想改路的走向：告诉我改哪（我改 web 定义后重新生成同步），
或者进阶玩法——选中 Road 节点，把 script 清掉后直接用 Godot 的瓦片画笔手画。

## 云端分工
- 我：生成资产（PixelLab）、按剧情铺场景初版、写逻辑、`scripts/gen-godot-scene.js` 从 web 地图定义同步生成本场景。
- 你：编辑器里拖拽微调摆放、验收。
- 云端自测：`SHOT=out.png xvfb-run tools/godot --path godot scenes/village.tscn`（无显示器截图）。
