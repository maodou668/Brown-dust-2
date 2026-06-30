# UI 设计统筹 (Design System) —— 棕色尘埃2 风格

> 目标：从"一个框走天下"升级为**有层次、有语境变化、精美**的像素 UI 系统。
> 风格基调：暗炭紫石板 + 冷铁 + 炉火橙宝石 + 暖金，柔和无硬黑描边（与角色立绘一致）。字体：Zpix 像素体（已全局）。

## 0. 设计原则（反单调四条）
1. **层次 Hierarchy**：主行动 > 次级 > 三级，用"华丽度 / 体量 / 金色"区分，不再全用同一个铁框。
2. **语境变化 Context**：稀有度色、元素色、资源色——同类元件按语境换色/换角标。
3. **精美 Polish**：英雄元件加浮雕高光 / 角花 / 宝石；进度条加分段刻度；图标全部像素化（替 emoji）。
4. **节制 Restraint**：最高华丽度只给少数"英雄元件"（出战/招募/SSR），满屏抢眼=另一种单调。

## 1. 元件分级与样式

| 类别 | 元件 | 样式处理 | 资产 | 接入 class |
|---|---|---|---|---|
| **按钮·主** | 出战 / 招募 / 确定 | **金色华丽**：暖金浮雕边 + 高光 + 宝石角，体量最大 | 新生成 `btn_primary_gold` | `.act-btn.primary`/`#fight-btn`/招募键 |
| **按钮·次** | 功能/导航/技能/系统 | 现有炭铁框（保留，已上线） | 现有 `button.png` | `.lobby-btn .skill-btn .res .ghost-btn` |
| **按钮·三** | 返回 / 关闭 / 小操作 | 轻量：仅细描边 + hover 微光，无厚框 | 纯 CSS | `.back-btn .close-row button` |
| **面板·大** | 弹窗/全屏页 | **带标题栏 header**：顶部独立装饰条(角花)+主体，分两段更有层次 | 新生成 `panel_header` + 现有 `panel.png` | `.modal`(加 header)/`.screen` |
| **面板·小** | tooltip/提示 | 轻框（现有 panel 缩小或细线） | 现有 | tooltip |
| **卡片·活动** | 竞技场/资源副本… | 保留配色，换**带角标 ribbon** 的 banner 卡型 | 新生成 `card_ribbon`（4 色染） | `.lr-banner` |
| **卡片·物品** | 角色/装备格 | **稀有度色描边**(R蓝/SR紫/SSR金) + 元素角标 | 新生成 `slot_rarity`(3 色) | `.gear-slot .gcard` |
| **资源胶囊** | 金币/宝石/觉醒石/体力 | 专属像素图标嵌入 + 该资源色微辉 | 图标集 + 现有胶囊 | `.res .res-icon` |
| **进度条** | HP/SP/连携/pity | **专用条框 + 分段刻度**，填充按类型染(HP红绿/SP蓝/连携紫/超杀金) | 新生成 `bar_frame` | `.bar .combo-gauge .pity-bar` |
| **头像框** | 玩家/角色 | 圆角方框 + 等级角标；角色头像稀有度色框 + 元素角标 | 新生成 `avatar_frame` | `.pc-avatar .u-art` |
| **图标** | 功能×11 / 资源×4 / 元素×6 | **像素图标集**替换全部 emoji，统一风格 | PixelLab 批量 | 各 emoji 处 |
| **字体** | 全局 | Zpix 像素体（✅ 已上线）；按层级配字号(标题大/正文小) | woff2 | `body` |

## 2. 需新生成的 PixelLab 资产（按优先级）
1. **金色主按钮** `btn_primary_gold` — `create_ui_asset(elements:["button"], 金色华丽 prompt)`。
2. **面板标题栏** `panel_header` — 顶部装饰条（角花/宝石），配现有 panel 主体。
3. **进度条框** `bar_frame` — 空槽 + 分段刻度（填充用 CSS 渐变染色）。
4. **稀有度格框** `slot_rarity` ×3（蓝/紫/金）— `create_ui_asset` 或单图标对象染色。
5. **活动卡 ribbon** `card_ribbon` — 带角标的 banner 卡。
6. **头像框** `avatar_frame`。
7. **图标集**（最大批）：功能/资源/元素，`create_1_direction_object` 锁风格批量 → 去背景。

## 3. 执行批次（每批：生成→接入→无头自测→部署→验收）
- **批 1 · 层次立起来**：金色主按钮(出战/招募) + 三级轻量钮(返回/关闭) → 立刻有主次。
- **批 2 · 面板升级**：弹窗加标题栏 header。
- **批 3 · 进度条**：HP/SP/连携/超杀 条框 + 分段 + 染色。
- **批 4 · 图标集**：emoji → 像素图标（功能+资源+元素），最出效果、工作量最大。
- **批 5 · 稀有度/头像**：物品格 + 角色头像稀有度色框 + 元素角标。
- **批 6 · 活动卡 ribbon** + 收尾零散。

## 4. 自测要点（沿用）
- 改 CSS 用 `../art/...`（外链）；必测 **index.html**（线上入口），不是 game.html。
- 每批无头截图前后对比；border-image/字体资源回 200；部署后轮询线上 ASSET_VER。

---

# 5. 完整 UI 套装清单 (全 PixelLab 资产 · 覆盖 checklist)

> 用户要求：**全部 UI 元素改用 PixelLab 生成的统一套装**，现有游戏所有涉及 UI 处全部挂上。
> 下表是套装资产全集 + 接入目标 + 状态。分波生成→接入→部署→验收，直到全勾。

| 组 | 资产 | 接入 class | 状态 |
|---|---|---|---|
| 框架 | `panel.png` 大面板 | .modal/.lr-banner/.battle-ctrl | ✅ |
| 框架 | `panel_header.png` 标题栏 | .modal h2 | ✅ |
| 框架 | `tooltip` 小提示框 | tooltip/小弹层 | ⬜ |
| 按钮 | `btn_gold.png` 主金钮 | .lobby-cta/.btn.gold | ✅ |
| 按钮 | `button.png` 次铁钮 | .btn/.lobby-btn/.skill-btn/.res/.ghost-btn | ✅ |
| 按钮 | `tab_on/off` 标签页 | .bag-tab/.gacha-tab/.ac-tab/.col-cat-bar | ⬜ |
| 按钮 | `btn_round` 圆钮 | .act-btn(76圆) | ⬜ |
| 条槽 | `bar_frame` 状态条框 | .bar/.combo-gauge/.pity-bar(替CSS) | 🔄生成中 |
| 格框 | `slot` 物品格 | .gear-slot/.disp-slot/.gcard | ⬜ |
| 格框 | `frame_R/SR/SSR` 稀有度框 | 卡/格 稀有度描边 | ⬜ |
| 格框 | `avatar_frame` 头像框 | .pc-avatar/.u-art/.port-icon | ⬜ |
| 卡片 | `card_ribbon` 活动卡 | .lr-banner(升级) | ⬜ |
| 图标 | 功能×11 任务/珍藏集/锻造/成就/剧情/招募/佣兵/编队/背包/福利/商店 | 各 emoji | 🔄生成中 |
| 图标 | 资源×4 金币/宝石/觉醒石/体力 | .res-icon | ⬜ |
| 图标 | 元素×6 火/水/风/地/光/暗 | .u-elem 等 | ⬜ |
| 杂项 | 红点/NEW/保底 角标 | .red-dot/.gf-guar-badge | ⬜(CSS可) |
| 杂项 | 开关/勾选 | 设置项 | ⬜ |
| 杂项 | 稀有度星 ★ | 卡星级 | ⬜ |

## 生成波次
- **波1**(进行中)：`bar_frame` + 功能图标首批(任务/商店/编队)。
- **波2**：图标补全(功能剩余 + 资源×4 + 元素×6)。
- **波3**：`tab`、`slot`、`avatar_frame`。
- **波4**：稀有度框、活动卡 ribbon、圆钮、tooltip、开关、星。
- 每波：生成→挑候选→去背景/切片→接入对应 class→无头自测→部署→验收。

---

## 6. 套装完成状态 (v174)
全 PixelLab 真资产 + CSS 收尾，主流程 UI 全部挂上、基本零 emoji：
- ✅ 面板 `panel` / 标题栏 `panel_header`（.modal/.lr-banner/.battle-ctrl/.modal h2）
- ✅ 按钮三级：主金 `btn_gold`（出战/抽10次）· 次铁 `button`（.btn/.lobby-btn/.skill-btn/.res/.ghost-btn）· 三轻（.back-btn）· 圆金（.act-btn）
- ✅ 真条槽 `bar_frame`（.combo-gauge/.pity）+ 单位血条/SP（CSS 凹槽亮填充）
- ✅ 标签页 `tab_on/off`（.gacha-tab/.bag-tab/.ac-tab）
- ✅ 图标：功能×11 + 资源×4 + 元素×6（全 emoji→像素，data.js ELEMENTS 单点改）
- ✅ 物品格 `.gear-slot`（CSS 凹槽）· 稀有度框 R蓝/SR紫/SSR金（CSS 辉光）· 玩家头像圆框 `avatar_frame`
- ✅ 全局像素字体 Zpix（68KB 子集）
- 略：活动卡 ribbon（已套 panel 框够用）、tooltip、开关、★（CSS 兜，按需再补）

省额度要点：元素用 `item_descriptions` 一次出 4；稀有度/物品格/三级钮/红点用 CSS；头像框复用已生成 avatar 表。
