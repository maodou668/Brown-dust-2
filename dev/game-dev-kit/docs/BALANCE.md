# 数值平衡契约（加内容前必读）

本游戏的数值**全部由公式约束**，不是手填。任何「带数值」的新内容——角色、服装、
装备、敌人、技能——都必须落在预算内，否则 `node scripts/build.js` 与 CI 会**直接失败、拒绝上线**。
这样未来无论谁加内容，都不会偷偷压过老内容（power creep），也不必推翻重来。

> 一句话：**新内容先用助手函数生成 → 跑 `node scripts/balance-validate.js` → 绿了才提交。**

---

## 一、技能（`js/costumes.js` 的 `SIG_SPECS` / `CLASS_SKILL_SPECS`）

不要手填 `power`。只写规格，威力由 `Balance.make()` 反解：

```js
my_skill: { name:'技能名', target:'enemyAll', effect:'damage', sp:4, icon:'🔥',
            inflict:{ type:'burn', turns:2, power:0.5 }, d: p => `造成 ${pct(p)}% 伤害…` },
```

- `target`：`enemySingle/enemyRow/enemyAll/allySingle/allyAll/self`
- `effect`：`damage/heal/shield/buffAtk/buffDef`
- 附带效果（`inflict` 中毒/灼烧/眩晕/沉默、`pierce` 穿透、`knockback` 击退、`extra` 破防/嘲讽）都已计价。
- **校验**：每个实战可达技能的平衡分必须 `|score-1| ≤ 0.18`。`make()` 出来的天然是 1.00。

旧的 `data.js > CHARACTERS[].skills` 技能在服装系统下**已不可达**（实战只用
普攻＋职业技＋服装专属招式），属历史死数据，校验不计入，也不要再给新角色挂这种技能。

## 二、角色 / 服装属性（`js/budget.js` 双轴预算）

属性用「双轴预算」约束，新角色**用助手函数生成**，不要手填 base/grow：

```js
const { base, grow } = Budget.makeCharStats(5, 'mage');            // 标准 5★ 法师
const { base, grow } = Budget.makeCharStats(5, 'defender', { atk:1.35, def:0.85, hp:0.9 }); // 换形：攻坦
```

- **O（进攻）** = `atk × (1+0.6×crit) × 速度轻加权`
- **S（生存）** = `hp × (1+def/100)`（等效血量）
- 每个单位按 `职业×稀有度` 归一后：`O/O_ref + S/S_ref ≈ 2.0`，区间 **[1.65, 2.25]**；
  单轴不超过 **1.70**（不许把全部预算堆一轴 → 不会「既肉又秒」）。
- `shape` 可在**保持总预算**的前提下换形：加攻必须减防/血。坦克可做成 DPS，但总功率不变。
- 稀有度缩放：进攻 `{3:.72, 4:.86, 5:1}`、生存 `{3:.90, 4:.95, 5:1}`（低星也得站得住）。
- 服装稀有度高于角色基础稀有度时，`costumes.js` 会自动按稀有度缺口补偿属性，
  保证 4★ 服装真有 4★ 的预算（不会虚低）。

## 三、装备（`js/gear.js`）

- 通用装备：按部位/稀有度填 `stats`，**装备分**（`atk×1 + def×1.2 + hp/8 + crit×800 + spd×2`）
  不得超过该稀有度上限 `{3:170, 4:230, 5:320}`。
- 专属武器：`exStatsByClass(cls, rarity)` 已按稀有度缩放（5★满值、4★×0.7、3★×0.5），
  不要让低星角色拿到 5★ 强度的武器。

## 四、敌人（`js/data.js > ENEMIES`）

- 普通怪：`O ≤ 340, S ≤ 5200`；BOSS：`O ≤ 720, S ≤ 14000`。
- 关卡内还会按等级成长（`battle.js` 的 grow 公式）与关卡 `mod`（atkMul/hpMul/healCut…）缩放，
  深渊难度梯度已用 `scripts/abyss-probe.js` 精调，改敌人/关卡后请复跑。

## 五、改完必须跑的校验

```bash
node scripts/balance-validate.js   # 数值闸门（技能/服装/装备/敌人），越界即退出 1
node scripts/balance-check.js      # 技能平衡分明细
node scripts/combat-test.js        # 16 角色单挑 + 主线不翻车
node scripts/playtest.js           # 端到端：胜率/节奏/连携/深渊梯度/站位
# 精调关卡/深渊时：
ID=102 N=200 node scripts/stage-probe.js
N=200 node scripts/abyss-probe.js
```

`build.js` 会在打包前自动跑 `balance-validate.js`；CI（`.github/workflows/pages.yml`）会在部署前
跑校验＋回归。**任一不过 → 不上线。** 这是「加内容不破坏平衡」的硬保障。
