# PixelLab 角色 ID 权威台账

> ⚠️ 后续所有 MCP 操作（animate / create_character_state / download）**一律按下表的精确 ID**，
> **绝不按名字搜索**（账号里存在重名/丑名，按名字搜会抓错版本）。
>
> 重要：**游戏运行只读仓库里的 `*_field/` 本地图片，不依赖任何 PixelLab ID**。
> 下表仅用于我（Claude）发新生成任务时定位正确的源角色。

账号 project: `8e6f8b9d-6f8b-4a06-9e09-3b061cfaba77`

## ✅ 权威角色（在用）

| 角色 | PixelLab ID | 备注 |
|---|---|---|
| **Seir**（锚定母本/Anchor） | `5f48540d-f2b9-4708-9715-3e193a4d7f7d` | 锁法A 的派生源。18anim。group(+1) |
| Refithea | `11f13348-94a9-4a07-8086-c62bf53c3b53` | 已接入(idle+run) |
| Rigenette | `7c54b215-be04-4001-8aad-1ce38e6aaa81` | 已接入(idle) |

### 锁法A 派生角色（均 Seir 派生,同 group；名字显示为 "Transform into: …" 丑名,**一律按 ID 操作**）

| 角色 | PixelLab ID | 状态 |
|---|---|---|
| Olstein | `714eda85-8cc3-4f1e-85ef-4478e387015b` | ✅ 完整(run8+cast),已接入 |
| Rou | `b91599ac-752d-4696-b5b5-a425f698ba8c` | ✅ 完整,已接入 |
| Helena | `86ce22e1-d8e5-4186-b083-8d7fc60a863d` | ✅ 完整,已接入 |
| Diana | `55669573-e41e-41ff-8453-cecb2069734d` | ✅ 完整,已接入 |
| Garcia | `840cd2e7-c0c6-4370-853e-7e98e8e254f9` | ✅ 完整,已接入 |
| Teried | `551ca763-32f5-4173-a398-cff1449ae3a6` | ✅ 完整,已接入 |
| Lia | `94181d7b-d16e-45c5-97d4-5e68b394c5bd` | ✅ 完整,已接入 |
| Mina | `1807ef74-470e-44ed-ab58-a80a6a757d8a` | ✅ 完整,已接入 |
| Glacia | `11f2ade0-272a-48e4-bba1-66913a18c16c` | ✅ 完整,已接入 |
| Liatris | `835024bb-4529-4242-8aed-fcb83a3f269f` | ✅ 完整,已接入 |
| Loen | `004441e3-c4d9-43ff-b599-355cd188c7cf` | ✅ 完整,已接入 |

> ⚠️ 多角色同 group,**单角色下载的 zip 会打包全组**,且 "Beautiful…" 类名字截断后无法区分。
> 重新提取某角色时,用其**唯一 cast 文件夹签名**定位(如 healing_light/wind_slash/water_spell/
> ice_spell/flame_arrow/nature_arrow/potion_sparkle/fire_slash/holy_light),不要靠 "Transform_into_Beau_N" 文件夹名。

## ❌ 已废弃（请勿使用 / 待删）

| 名字 | PixelLab ID | 原因 |
|---|---|---|
| Olstein（旧） | `1383dcc0-6bcb-4444-a6ff-98094003f09a` | 头身比错/画风漂移,被 `714eda85` 取代 |
| Helena（旧） | `c17998f5-19b0-428c-9fbb-8281cb68fe5a` | 头身比/画风问题,待用锁法A重做 |
| Rou（旧） | `1d74c2b0-1315-40e0-adf7-d7e53b52d350` | 同上,待用锁法A重做 |
| Beautiful anime-style holy paladin… | `9aae9bac-…` / `ba62577f-…` | 旧账号遗留失败稿 |
| Beautiful anime-style dark ranger… | `d86fb1fe-…` | 旧遗留(Seir 早期稿) |

## 量产规则（锁法A）

1. 新角色一律 `create_character_state(character_id=<Seir 5f48540d…>, edit_description=<形容词>)`，
   继承 Seir 的头身比+像素画风。引入新配色时 `use_color_palette_from_reference=false`。
2. 动画：`animate_character(<新角色ID>, mode=v3)` 生成 **run** 5 源向(south,north,east,north-east,south-east)
   + **cast** north；其余向由 `gnorm.js` 镜像。idle 用静态 rotation 兜底（省 job）。
3. **并发 ≤4**（>4 后端必卡 95%）。下载前先 `get_character` 确认 pending jobs == 0（否则下载竞速拿到半成品）。
