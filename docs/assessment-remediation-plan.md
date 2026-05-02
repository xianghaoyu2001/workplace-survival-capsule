# 测评系统整改方案

## 依赖关系总览

```
1. 删任务卡答案泄露 ───────────────────── 无依赖，立即可做
2. 重做维度结构 ───────────────────────── 无依赖，但是 3/4/5 的前置
   └→ 3. 设计刺激覆盖规则 ─────────────── 依赖 2
      └→ 4. 净化 Director 输入 ─────────── 依赖 3
         └→ 5. 修 Judge prompt 结构vs路径 ─ 依赖 2
6. 禁止 mock judge 产出正式报告 ────────── 独立，可并行
7. 加评分信度门槛 ──────────────────────── 独立，可并行
8. 改 NPC 反馈机制 ─────────────────────── 独立，可并行
9. 评分聚合：median→trimmed mean ───────── 独立，可并行
10. 角色命名降级 ───────────────────────── 独立，低优先级
```

并行分组：{1, 2} → {3, 5, 6, 7, 8, 9} → {4} → {10}（后台）

---

## 1. 删任务卡答案泄露 — 严重度：致命

**问题：** `prisma/seed.ts:28` 和 `seed.ts:43` 的 `记住` 段落直接告诉用户怎么做。这会把测验变成"是否按提示执行"。

**文件：** `backend/prisma/seed.ts`

**改动：**

- L28 `记住：对陈总标注assumption，对苏姐先问她的情况再谈条件，对小秋给标准而不是否定。` → 删除整行
- L43 `顺序不能错。先去刘总那里，先理解小林，先承认系统问题。这个分寸比任何流程都重要。` → 删除整行
- `blackboard.service.ts:150-152` constraints 里的 `不要对陈总说'大概/可能/应该'而不标注assumption` 和 `不要把设计稿缺口直接压给苏姐` 和 `不要对小秋说'你水平不行'` — 这些是**测评约束**（防止用户失误），不是操作指南。保留但检查措辞：`不要` 开头的约束是合理的边界规则，但如果写成了 `先做什么再做什么` 就是答案泄露。当前 constraints 是禁止性规则而非指令性步骤，判定为**保留**。
- `blackboard.service.ts:312-316` 同理检查：`不要只谈免单`、`不要对小林先处罚后安抚`、`不要对江师傅只谈'后厨责任'` — 禁止性约束，**保留**。

**验证：** 用改动后的 seed 跑一次完整测评，确认用户看不到任何"你应该怎么做"的指令。


## 2. 重做维度结构 — 严重度：高

**问题：** 场景A的"局势判断/人际分寸/团队意识/诚实度"和场景B的"人情分寸/同理心深度/沟通策略/系统思维"共享大量行为证据，实际可能是 2-3 个因子在重复打分，8 维度是虚胖。

**原则：**
- 每个维度必须有**独立的可观察行为锚点**——同一条用户回复不能同时支撑三个维度的高分
- 维度数不需要硬凑 8 个，6 个独立维度 > 8 个重叠维度
- 两个场景可以共用一套维度（跨场景可比），但每个场景的**行为示例**不同

**建议维度（6维，跨场景通用）：**

| 维度 | 测什么 | 场景A行为锚点 | 场景B行为锚点 |
|------|--------|-------------|-------------|
| 信息获取 | 能否识别关键未知、主动澄清、区分事实与假设 | 向陈总确认哪些数据已确认、标注假设边界 | 向刘总确认他在意的是面子还是流程 |
| 决策结构 | 方案是否有owner/时间/风险/备选 | A/B路径、4点前可交付范围 | 补救层次、每个动作的目标和预期结果 |
| 人际适配 | 对不同角色说不同的话、调整沟通方式 | 对陈总用数据、对苏姐问处境、对小秋给标准 | 对刘总先认错再动作、对小林先理解再指正 |
| 压力表达 | 是否清晰、有结构、不回避 | 承压下的逻辑组织能力 | 同时面对冷怒/低落/防御的表达质量 |
| 责任承担 | 是否展现 ownership，不推责不甩锅 | 自己定方案、说明原因、承担风险 | 承认问题、不找人背锅、主动推进 |
| 系统视角 | 是否看到个体行为背后的结构/流程因素 | 理解苏姐团队负载和扩招驳回 | 看到前厅催单→后厨跳流程→出错的链条 |

每维度 0-20，总分 120。去掉的"团队意识"和"诚实度"分别被"系统视角"和"信息获取"覆盖。

**文件：**
- `backend/src/services/blackboard.service.ts` — `capability_dimensions` 改为新6维
- `backend/src/prompts/judge.prompt.txt` — 重写维度定义段，每个维度补充"低分样例"和"高分样例"
- `backend/tests/assessment-design.test.ts` — 更新维度断言

**验证：** 跑 10 份真实测评，计算维度间 Pearson 相关系数矩阵。同一用户在同一场景的各维度分数不应全部 >0.85 相关。


## 3. 设计刺激覆盖规则 — 严重度：高

**问题：** 当前 Director 选下一轮 NPC 基于"谁被触及/谁沉默"，不考虑**哪些测评维度还没被观察到**。结果是某些维度可能全程没被触发，用户在这些维度上拿了无依据的分数。

**依赖：** 必须先完成维度结构重做（第2项），因为槽位定义来自维度。

**设计：**

每个维度定义 2-3 个**可触发槽位**。一个槽位 = "当 NPC X 追问方向 Y 时，用户的回应会暴露维度 Z 的能力"。

示例（场景A，维度"信息获取"）：
- 槽位1：陈总追问"这个数字谁确认的" — 观察用户是否标注假设 vs 模糊带过
- 槽位2：苏姐沉默不说负载 — 观察用户是否主动询问她的处境
- 槽位3：小秋说"标准不太一样吧" — 观察用户是否追问"你做过什么类似的"

**槽位追踪器逻辑（加在 blackboard 或独立的 slot tracker）：**

```
slot_coverage: {
  "信息获取": { triggered: true, rounds: [2, 5], quality: "partial" },
  "决策结构": { triggered: false, rounds: [] },
  ...
}
```

Director 输入中增加"当前未覆盖槽位列表"，选择下一轮 NPC 时优先覆盖未触发维度。

**文件（新或改）：**
- `backend/src/services/slot-tracker.ts` — 新建，槽位定义和追踪
- `backend/src/agents/director.agent.ts` — 输入增加 uncovered_slots
- `backend/src/prompts/director.prompt.txt` — 增加槽位覆盖优先级逻辑

**验证：** 单次完整测评（15轮）结束后，检查 `slot_coverage` — 至少 5/6 维度应被触发。


## 4. 净化 Director 输入 — 严重度：高

**问题（修正版）：** 路径依赖是交互测评的固有属性，但 Director 是其中最高杠杆的控制点。如果 Director 的 NPC 选择受行为评价污染，会制造自证预言。解法不是拆 agent，是**输入隔离**。

**依赖：** 必须先有槽位覆盖规则（第3项），因为净化后的 Director 需要知道"要覆盖什么"。

**当前 Director 输入：** 完整 chat history + 完整 blackboard（包含 behavior flags、evaluation_notes、NPC memory states）

**净化后 Director 输入：**
- 完整 chat history（必须保留——不然不知道对话到哪了）
- blackboard 的子集：
  - `scenario_facts`（场景事实）
  - `round` / `phase` / `current_focus`
  - `uncovered_slots`（来自槽位追踪器，不含评分信息）
  - `conversation_control`（上一轮谁说话）
- **不传入的：** `user_progress`（能力标记）、`latest_user_behavior`（行为标签）、`evaluation_notes`（评价证据）、`npc_memory`（NPC 对你的判断）

**文件：**
- `backend/src/services/orchestrator.service.ts` — 构造 Director 入参时过滤 blackboard 字段
- `backend/src/agents/director.agent.ts` — 类型定义更新
- `backend/src/prompts/director.prompt.txt` — 去掉行为标记相关的指令（合并调用中的行为检测部分）

**关于行为检测：** Director 当前合并了行为标记和编排。净化后行为标记可以：
- 选项A：单独一个轻量 BehaviorDetector 调用（已有 legacy 实现），其输出只给 Judge，不给 Director
- 选项B：完全去掉，让 Judge 直接读 chat history（当前 Judge 已经读完整对话）

建议选项B——减少一次调用，且 Judge 读原文做判断比依赖 Director 的中间标记更准确。

**验证：** 两次测评使用相同的用户输入序列，Director 产出相同（确定性 NPC 选择，不受前一轮行为评价干扰）。


## 5. 修 Judge prompt：结构要素 vs 指定路径 — 严重度：中

**问题：** Judge prompt 没有示范"不同路径但同样高分"的案例。Judge 可能把"没走默认顺序"误判为"方案质量差"。

**依赖：** 维度定义（第2项），因为评分反例需要基于新维度。

**改动：** `backend/src/prompts/judge.prompt.txt`

在评分原则段增加反例：

```
## 路径独立性

以下两组示例——路径不同，分数相同。评分看质量不看路径：

场景A 例1（默认路径，高分）：
用户说"陈总，三件事确认了两件假设"、对苏姐先问负载再谈条件、给小秋三个VI标准 → 覆盖三角色，有结构，高分。

场景A 例2（非默认路径，同样高分）：
用户说"陈总，设计稿缺口我没法4点前保证。建议：先用数据幻灯片替代设计页，标注'assumption-待设计确认'。同时跟苏姐约明天上午沟通她组的优先级，不要求她今天出人。小秋今晚跟我对一下你的概念稿，我现场给标准。" → 坦诚未知、自己承担、保护了苏姐资源、给了小秋方向。路径完全不同于默认，但覆盖三角色、有owner、有风险说明、主动标注假设。同样高分。

场景A 例3（默认路径，低分）：
用户说"陈总放心，设计稿我找苏姐借人肯定搞定。小秋可以做。" → 走了"借人"路径，但对陈总无依据承诺、对苏姐直接要人没问处境、对小秋只说能做不给标准。覆盖表面但质量低。低分。
```

**验证：** 用三组反例直接测 LLM judge：例1和例2应接近同分，例3显著低于前两者。


## 6. 禁止 mock judge 产出正式报告 — 严重度：高

**问题：** 当 DeepSeek API 不可用时，fallback 到一个基于 boolean flag 的公式打分（`mockLlm.service.ts:697-704`）。这是两个完全不同的测量工具，产出的分数不可比。用户不知道自己被"降级评分"了。

**改动：**

`backend/src/agents/judge.agent.ts` — `callJudgeAgentOnce` 中：

```typescript
// 当前：LLM 失败 → parseAgentJSON 内部 fallback 到 mock
// 改为：LLM 失败 → 抛出明确错误，不 fallback
```

`backend/src/services/orchestrator.service.ts` — `finishWithJudge`：

```typescript
// 当前：正常返回 report
// 改为：try/catch callJudgeAgent，失败时返回 { status: "scoring_failed", reason: "..." }
// 前端 ReportPage 增加"评分失败"状态展示
```

`frontend/src/pages/ReportPage.tsx` — 新增评分失败状态 UI：显示"评分服务暂时不可用，请稍后重试"并提供重试按钮。保留已有的对话记录，用户可以回看过程但不能看到假分数。

Mock judge 函数保留但重命名为 `generateDebugReport`，仅在开发环境手动触发时使用，不进入生产流程。

**验证：** 模拟 DeepSeek API 不可用场景，确认前端显示评分失败而非静默 fallback。


## 7. 加评分信度门槛 — 严重度：高

**问题：** 5 次采样方差再大也照常出报告。方差极大时（如 [60, 85, 110, 135, 155]），无论用什么聚合方式都没有意义——Judge 之间根本没有共识。

**改动：** `backend/src/agents/judge.agent.ts`

在 `callJudgeAgent` 返回前增加分级：

```typescript
const COEFFICIENT_OF_VARIATION = totalStdDev / trimmedMean;

if (cv > 0.25 || totalVariance > 200) {
  // 拒不出分
  return { status: "unratable", samplingStats };
}
if (totalVariance > 100) {
  // 降级为 provisional，前端加醒目警告
  return { status: "provisional", report: finalReport, samplingStats };
}
// 正常出分
return { status: "confident", report: finalReport, samplingStats };
```

用变异系数（CV = 标准差/均值）替代纯方差阈值——60 分尺度上的方差 80 和 120 分尺度上的方差 80 含义完全不同。

**前端：** `ReportPage.tsx` 处理三种状态 — 正常报告 / 暂定报告（加橙色警告条）/ 无法评分（显示原因 + 人工复审入口）。

**验证：** 构造 5 份分歧极大的 mock report（手动改分数），确认系统拒不出分。


## 8. 改 NPC 反馈机制 — 严重度：中

**问题：** NPC prompt 里的示例台词（如小秋的"三点！记住了"、苏姐的"你说到点子上了"）在 NPC 被"正确回应"时触发积极反馈，间接向用户泄露了"你做对了"的信号。这会引导用户往特定路径靠拢。

**改动：**

NPC prompt 中的**对话示例**替换为**触发条件 + 反应边界**：

```
# 当前（client.prompt.txt L17）：
> "三点！首页数据图表、结论在标题上、颜色不超过三种。记住了，今晚交给你。"

# 改为：
触发：用户给了具体标准 → 反应：表现出获得方向感（如确认细节、问实施问题），但不要用"记住了""好厉害"等评价性语言
触发：用户否定小秋能力 → 反应：退缩、沉默，但不说"那就算了"
触发：用户模糊敷衍（"你先做"）→ 反应：追问"具体怎么做"
```

每个 NPC 的示例台词保留 1-2 句展示**语**风（不是内容），其余改为条件反应描述。

**文件：**
- `backend/src/prompts/client.prompt.txt`
- `backend/src/prompts/coworker.prompt.txt`
- `backend/src/prompts/leader.prompt.txt`

**验证：** 用两个不同策略（默认路径 vs 非默认路径）各跑一次，检查 NPC 回复中是否出现同等级别的积极/消极反馈。两者应收到大致相当的反馈密度。


## 9. 评分聚合：median → trimmed mean — 严重度：低

**问题：** `judge.agent.ts:137` 用的是 `sampleMedian`（排序取中间值），但注释和用户意图是修剪均值（去 min/max 后中间3个取平均）。虽然对多数数据差异不大，但注释与实现不一致会在排查时误导。

**改动：**

`backend/src/agents/judge.agent.ts`：
- L86-89 `sampleMedian` → `trimmedMean`（排序去首尾取中间3个的算术平均）
- L137 `sampleMedian(rawScores)` → `trimmedMean(rawScores)`
- L160-166 维度分数和总分统一 `Math.round(score * 100) / 100`
- 总分 = sum(roundedDimScores)，不独立 round（保证恒等式）
- L175 日志 `"per-dimension median"` → `"per-dimension trimmed mean"`
- L132/L143/L159 注释更新

`backend/tests/judge-agent.test.ts`（新建）：
- Mock `callDeepSeek` 返回 5 份含不同维度分数的 report
- 调用 `callJudgeAgent()` 验证最终 `dimension_scores` 是修剪均值
- 测试用例用 `[2, 4, 7, 8, 10]`：trimmed mean = 6.33, median = 7，确保能区分

**验证：** 测试通过。跑 3 次真实测评对比新旧聚合方式的分数差异。


## 10. 角色命名降级 — 严重度：低

**问题：** `client` 在 fallback 逻辑中混有字面客户语义（"退款""重做"），与场景A的 client=小秋 不匹配。抽象本身对 LLM 不是问题，但代码没有完全贯彻这个抽象。

**改动（低优先级，不阻塞以上任何项）：**
- 长期考虑将 `leader/coworker/client` 改为更结构化的 slot 名如 `stakeholder_a / stakeholder_b / stakeholder_c` 或保持现状但清理 fallback 中的字面客户语义
- 短期：只修 `mockLlm.service.ts` 中 fallback NPC instruction 的硬编码客户语义

**文件：** `backend/src/services/mockLlm.service.ts`（相关 fallback 函数）


## 实施顺序

```
Week 1:  #1（删答案）+ #2（重做维度）+ #9（trimmed mean）+ #6（禁 mock judge）
Week 2:  #3（槽位覆盖规则）+ #5（Judge 反例）+ #7（信度门槛）
Week 3:  #4（净化 Director 输入）+ #8（NPC 反馈机制）
Week 4:  集成测试 + 10 份真实测评效度验证
Later:   #10（角色命名）
```

第1周的四项无相互依赖，可并行推进。
