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
| **Olstein**（新版,锁法A） | `714eda85-8cc3-4f1e-85ef-4478e387015b` | ⚠️ 名字显示为"Transform into: Powe"。Seir 派生,与 Seir 同 group。run 4向已好,**待回填 run(north)+cast(north)** |
| Refithea | `11f13348-94a9-4a07-8086-c62bf53c3b53` | 已接入(idle+run) |
| Rigenette | `7c54b215-be04-4001-8aad-1ce38e6aaa81` | 已接入(idle) |

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
