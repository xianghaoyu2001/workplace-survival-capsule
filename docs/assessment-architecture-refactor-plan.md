# 测评架构整改执行计划

## 执行状态

已按本计划完成第一轮落地：

- 已建立 Agent View 隔离，NPC / Director / GroupDiscussion 不再读取 `required_final_plan_elements`、`assessment_goals`、`constraints`、完整 `unknowns`、完整 `npc_memory` 或 `hidden_vulnerability`。
- 已新增 Judge-only rubric、coverage slot tracker、coverage status，并接入 Director 链路和最终报告。
- 已将 mock Judge 报告标记为 `debug`，并禁止写入正式 `totalScore`。
- 已将高方差报告标记为 `unratable`，coverage 不足报告标记为 `provisional`。
- 已重写 NPC / Director / StageDirector / BehaviorDetector / GroupDiscussion / Judge prompts，使其定位为模拟测评刺激与反馈诊断，而不是角色扮演游戏。
- 已收紧用户任务卡，去掉显式顺序、关注点和答案清单提示。
- 已更新前端报告和后台详情页，明确区分正式参考报告、观察性反馈、不可评分报告和调试报告。
- 已新增低信息回复收束门槛：连续 3 次数字、空泛短语或明确摆烂回复会直接生成 `unratable`，不再拖到 15 轮。
- 已将 NPC runtime memory 改为结构化字段，只保留数值、待确认点、用户行为信号和回应模式；旧的 `state/relationship` 叙事字段会在合并时被过滤。
- 已将公开 `known_facts` 与 slot `promptIntent` 瘦身为测评刺激信息，减少省赛、试用期、人生经历、正确顺序等叙事噪声。
- 已让 coverage 优先使用 `dimension_evidence`，旧 BehaviorDetector flags 只作为兼容兜底。
- 已完成第二轮场景/人设/目标对齐：runtime blackboard 不再保存 `constraints`、`stakeholders`、`assessment_goals`、`required_final_plan_elements` 和长篇叙事 persona 字段。
- 已压缩两张任务卡的用户可见信息，并让开场白承担“发现相关方”的线索功能；场景 B 去掉年龄、合同金额、白手起家、老关系等与测量无关的背景噪声。
- 已重平衡场景 A 的 16 个测评槽位，NPC 分布由 leader 过度集中调整为 `leader: 6`、`coworker: 5`、`client: 5`，避免能力暴露机会集中在陈总一人身上。
- 已统一场景 A/B 的“承诺边界”定义为跨场景通用能力：在不确定和多方压力下控制保证、责任和风险表述。
- 已同步更新 mock LLM、场景测试、槽位测试和种子数据，确保旧版“面子攻略/正确顺序/叙事背景”不会继续通过测试样例回流。

验证命令：

```bash
npm run backend:build
npm run test
npm run frontend:build
npm run prisma:seed -w backend
```

## 目标定位

当前系统短期应定位为**情境模拟反馈诊断工具**，不是可排名、可用于高利害决策的终结性测评工具。

本次整改的目标不是让 NPC 更像角色扮演，而是让测评链路满足三条底线：

1. **答案不泄露**：评分 rubric、正确答案清单、路径提示不能进入用户可见任务卡，也不能进入 NPC/Director 输入。
2. **刺激可控**：下一轮 NPC 与追问方向由待覆盖测评槽位决定，而不是由前几轮的评分标签和 NPC 好感度自证循环决定。
3. **证据可归因**：Judge 主要依据用户原话与结构化行为证据，不直接把 NPC memory 当作能力证据。

## 原始核心问题（已整改）

### P0 级问题

1. `required_final_plan_elements` 是评分答案清单，曾在 runtime blackboard 中，Director/NPC 可见。
2. `constraints`、`assessment_goals` 中曾混有评分路径，不应传给 NPC/Director。
3. 早期 agent 基本接收完整 blackboard，缺少输入视图隔离。
4. `USE_MOCK_LLM=true` 时曾可能生成 mock Judge 报告，必须明确标记并禁止作为正式成绩。

### P1 级问题

1. merged Director 同时做行为检测和刺激选择，行为判断会污染下一轮测量条件。
2. BehaviorDetector flags 与新 8 维度曾存在脱节风险。
3. 停止规则曾偏轮次，不基于维度槽位覆盖和证据质量。
4. NPC prompt 中曾有部分因果攻略式人设表达，容易变成评分开关。

### 已完成但需要保留验收的项

1. Judge 自动 mock fallback 已关闭。
2. Judge 聚合已改为 5 采样修剪均值。
3. 采样信度门槛已加入基础版本。
4. 前端场景图、场景标签、同源代理等前置问题已处理。

## 总体改造策略

先做**信息隔离**，再做**槽位覆盖**，最后做**Director/NPC prompt 重构**。

原因：如果不先隔离 agent 输入，后续新增槽位系统也可能继续把正确答案塞给 NPC 和 Director，污染会换一种形式继续存在。

## Phase 0：正式性与泄露兜底

### 0.1 禁止 mock Judge 产出正式成绩

**目标：** 显式 mock 模式可以用于开发演示，但不能写入正式 `totalScore`。

**文件：**

- `backend/src/agents/judge.agent.ts`
- `backend/src/services/orchestrator.service.ts`
- `backend/src/types/agent.ts`
- `frontend/src/types/assessment.ts`
- `frontend/src/pages/ReportPage.tsx`
- `frontend/src/pages/admin/SessionDetailPage.tsx`

**改动：**

1. `JudgeReport` 增加：

```ts
mock_generated?: boolean;
report_status?: "confident" | "provisional" | "unratable" | "debug";
```

2. `USE_MOCK_LLM=true` 且调用 Judge 时：
   - 不写正式 `totalScore`；或
   - 报告强制 `mock_generated: true`、`report_status: "debug"`，前端醒目标记“本地模拟报告，非正式评分”。

3. `finishWithJudge` 持久化时：
   - `mock_generated === true` 时 `totalScore` 写 `null`。
   - `report_status === "unratable"` 时 `totalScore` 写 `null`。

**验收：**

- `USE_MOCK_LLM=true` 跑完整流程，报告可看，但列表/数据库正式成绩为空。
- 前端显示 debug/mock 警告。

### 0.2 移除 runtime blackboard 中的答案清单

**目标：** `required_final_plan_elements` 不再被 Director/NPC 看到。

**文件：**

- `backend/src/services/blackboard.service.ts`
- 新建 `backend/src/services/rubric.service.ts`

**改动：**

1. 从 `Blackboard` 中移除或弃用 `required_final_plan_elements`。
2. 在 `rubric.service.ts` 中按场景定义 Judge-only rubric：

```ts
export interface ScenarioRubric {
  scenarioId: string;
  requiredElements: string[];
  dimensionDefinitions: Record<string, string>;
  disqualifyingRisks: string[];
}
```

3. `JudgeView` 可读取 rubric；`NpcView` 和 `DirectorView` 不可读取。

**验收：**

- `NpcView` / `DirectorView` 序列化内容中不包含 `required_final_plan_elements` 或其旧字段内容。
- 测试断言场景 B 的“先问初衷”“先承认系统问题”不会出现在 NPC/Director view。

### 0.3 拆分 constraints

**目标：** 区分公开事实边界和评分路径。

**文件：**

- `backend/src/services/blackboard.service.ts`
- `backend/src/services/rubric.service.ts`

**改动：**

1. `constraints` 拆为：
   - `public_constraints`：环境事实、硬截止、合规安全边界。
   - `rubric_constraints`：评分用路径风险，只给 Judge/rubric。
2. 删除或迁移路径式内容：
   - “先问初衷”
   - “先承认系统问题”
   - “给标准而不是否定”
   - “A/B 方案”

**验收：**

- NPC/Director 可见内容只包含公开边界，不包含“正确处理顺序”。

## Phase 1：Agent View 输入隔离

### 1.1 新建 agent view 服务

**文件：** `backend/src/services/agentView.service.ts`

**核心原则：** 不传 `Partial<Blackboard>`，而是传严格类型，避免未来字段新增后意外泄露。

```ts
export interface PublicScenarioFacts {
  user_role: string;
  project: string;
  demo_time: string;
  current_time: string;
  known_facts: string[];
  unknowns: string[];
  completed_features: string[];
  at_risk_features: string[];
  public_constraints: string[];
  agent_profiles: Record<AgentName, PublicAgentProfile>;
}

export interface NpcView {
  round: number;
  phase: string;
  current_focus: string;
  scenario_facts: PublicScenarioFacts;
  active_agent: AgentName;
  active_profile: PublicAgentProfile;
  own_memory: unknown;
  stimulus_instruction: string;
}

export interface DirectorView {
  round: number;
  phase: string;
  current_focus: string;
  scenario_facts: PublicScenarioFacts;
  conversation_control: {
    last_active_agent: string;
    suggested_next_agent: string;
  };
  npc_state_summary: Record<AgentName, unknown>;
  coverage_state: unknown;
  uncovered_slots: unknown[];
}

export interface JudgeView {
  scenario_facts: PublicScenarioFacts;
  rubric: ScenarioRubric;
  dimension_evidence: unknown;
  risk_flags: unknown;
  coverage_state: unknown;
}
```

### 1.2 NPC View

**NPC 可以看：**

- 自己 persona 的公开部分。
- 自己 memory。
- 公开场景事实。
- 本轮 stimulus instruction。
- 对话历史。

**NPC 不可以看：**

- `assessment_goals`
- `required_final_plan_elements`
- `rubric_constraints`
- `user_progress`
- `latest_user_behavior`
- `evaluation_notes`
- 其他 NPC 的 hidden vulnerability
- 其他 NPC 的完整 memory
- `capability_dimensions`

**文件：**

- `backend/src/agents/npc.agent.ts`
- `backend/src/services/orchestrator.service.ts`
- `backend/src/services/agentView.service.ts`

### 1.3 Director View

**Director 可以看：**

- 公开场景事实。
- 上一轮角色。
- 最小 NPC 状态摘要。
- 覆盖状态和未覆盖槽位。

**Director 不可以看：**

- `user_progress`
- `latest_user_behavior`
- `evaluation_notes`
- Judge rubric
- `required_final_plan_elements`
- 具体评分维度答案

### 1.4 Judge View

**Judge 可以看：**

- 用户完整对话。
- BehaviorDetector 产出的维度证据。
- 场景公开事实。
- Judge-only rubric。
- 覆盖状态。

**Judge 不直接看：**

- `npc_memory`
- NPC 对用户的 trust/anxiety/cooperation
- NPC relationship 文案

Judge 可以引用 NPC 的 visible reply 作为上下文，但不能把 NPC memory 当成能力证据。

### 1.5 测试

新增测试文件：`backend/tests/agent-view.test.ts`

必须覆盖：

1. `buildNpcView` 不包含 `assessment_goals`。
2. `buildNpcView` 不包含 `required_final_plan_elements`。
3. `buildNpcView` 不包含 `user_progress`。
4. `buildNpcView` 不包含其他 NPC memory。
5. `buildDirectorView` 不包含 `latest_user_behavior`。
6. `buildDirectorView` 不包含 `evaluation_notes`。
7. `buildJudgeView` 不包含 `npc_memory`。

## Phase 2：任务卡降 cue

**文件：** `backend/prisma/seed.ts`

### 场景 A

当前任务卡直接列出三个人和核心线索。改为更克制：

```text
现在是下午1:30。下午4点VP陈总要向CEO做Q3方案汇报。

目前最大的问题是：汇报中关键的三页数据可视化设计稿还没出来。数据已经有了，框架也有了，但没有设计稿，陈总没法向CEO呈现。

汇报负责人、协作资源方和具体执行者会从不同角度追问你的判断。

你需要在120分钟内形成一个可执行的应对，并在多方追问中说明你的判断、取舍和下一步。
```

### 场景 B

```text
你是珍味轩餐厅的值班经理。

今晚8号桌是重要客人宴请。第二道菜出现出品问题，问题菜品已经撤下，现场尚未失控。

客人、后厨学徒和后厨主管会从不同角度追问你的处理。

你需要在现场压力下做出判断，并说明你的取舍和下一步。
```

**验收：**

- 用户任务卡不直接出现“刘总丢面子”“小林需要先理解”“江师傅要系统问题被承认”等答案结构。

## Phase 3：BehaviorDetector 与新维度对齐

**文件：**

- `backend/src/prompts/behavior-detector.prompt.txt`
- `backend/src/types/agent.ts`
- `backend/src/services/blackboard.service.ts`

### 3.1 输出结构

```ts
export interface DimensionEvidence {
  observed: boolean;
  quality: "none" | "partial" | "clear";
  evidence: Array<{
    quote: string;
    reason: string;
    round?: number;
  }>;
}

export interface BehaviorDetectionResult {
  dimension_evidence: Record<string, DimensionEvidence>;
  risk_flags: {
    over_promise: boolean;
    blame_shifting: boolean;
    unsupported_assumption: boolean;
    avoidance?: boolean;
  };
  summary?: string;
}
```

### 3.2 场景 A 槽位示例

| 维度 | 可观察行为 |
| --- | --- |
| 信息辨别 | 区分确认项、未知项、假设项 |
| 交付切分 | 区分 4 点前必须交付与后续补齐 |
| 备选方案 | 提出替代路径与触发条件 |
| 承诺边界 | 说明不能保证什么、变化如何同步 |
| 向上对齐 | 给上级可上会的信息结构 |
| 横向协商 | 对协作方提出互惠条件和边界 |
| 新人赋能 | 给新人明确执行边界而非替他做 |
| 压力表达 | 被追问时保持结构化回应 |

### 3.3 场景 B 槽位示例

| 维度 | 可观察行为 |
| --- | --- |
| 利害识别 | 识别客人、员工、厨房三方利害 |
| 现场止损 | 先控制可见现场影响 |
| 规则边界 | 食品安全、复核、补偿规则不失守 |
| 承诺边界 | 不甩锅、不说满、不空泛保证 |
| 面子修复 | 处理客人在同伴面前的体面损失 |
| 员工修复 | 处理责任、初衷和后续标准 |
| 后厨协同 | 与资深后厨建立专业协同 |
| 系统改进 | 从事故提炼流程机制 |

## Phase 4：槽位覆盖追踪

**文件：** `backend/src/services/slotTracker.service.ts`

### 4.1 数据结构

```ts
export interface SlotDefinition {
  id: string;
  scenarioId: string;
  dimension: string;
  npcTarget: AgentName;
  promptIntent: string;
  priority: number;
}

export interface SlotCoverage {
  slotId: string;
  dimension: string;
  status: "unseen" | "probed" | "evidenced" | "insufficient";
  evidenceQuality: "none" | "partial" | "clear";
  rounds: number[];
  evidenceQuotes: string[];
}

export interface CoverageState {
  slots: Record<string, SlotCoverage>;
  coveredDimensions: string[];
  insufficientDimensions: string[];
}
```

### 4.2 规则

1. 每个场景 8 维，每维至少 2 个槽位。
2. 每轮 BehaviorDetector 更新 coverage。
3. Director 只看 uncovered slots，不看评分标签。
4. 收束条件：
   - 至少 6/8 维有 `partial` 以上证据。
   - 核心风险槽位不能全为空。
   - `min_round` 只是底线，不是充分条件。

### 4.3 报告状态

报告增加：

```ts
coverage_status?: {
  covered_dimensions: string[];
  insufficient_dimensions: string[];
  complete: boolean;
};
```

覆盖不足时报告标记为 `provisional`。

## Phase 5：Director 污染拆分

### 5.1 短期方案：merged Director + 输入隔离

1. Director 输入只用 `DirectorView`。
2. Director 输出的 `behavior_evidence` 不写入下一轮 Director 可见状态。
3. `evaluation_notes` 不再由 Director patch 进入 runtime blackboard。

### 5.2 长期方案：拆成三段

```text
User reply
  -> BehaviorDetector: 只产 dimension_evidence + risk_flags
  -> SlotController: 根据 coverage_state 选择下一槽位
  -> StageDirector: 把槽位转成 NPC instruction
  -> NPC
```

**最终状态：**

- BehaviorDetector 不选 NPC。
- SlotController 不评价用户。
- StageDirector 不读评分结果。
- NPC 不读 rubric。

## Phase 6：NPC prompt 降游戏化

**文件：**

- `backend/src/prompts/leader.prompt.txt`
- `backend/src/prompts/coworker.prompt.txt`
- `backend/src/prompts/client.prompt.txt`

### 6.1 改写原则

1. “软肋”改为“关注点 / 压力源 / 反应边界”。
2. 不写 `用户做到 X -> NPC 正向 Y` 的攻略公式。
3. 示例台词只保留语气风格，不展示正确路径奖励。
4. 所有 NPC 禁止使用：
   - “说到点子上”
   - “顺序对了”
   - “没过关”
   - “标准答案”
   - “你做得很好”

### 6.2 示例

当前：

```text
得到清楚边界→能稳定发挥。
```

改为：

```text
反应边界：
- 听到具体边界时，会追问实施细节并表现出方向感。
- 听到模糊否定时，会退缩或沉默。
- 被敷衍时，会继续追问自己具体该做什么。
```

## Phase 7：报告定位修正

**文件：**

- `backend/src/agents/judge.agent.ts`
- `frontend/src/pages/ReportPage.tsx`
- `frontend/src/pages/admin/SessionDetailPage.tsx`

### 7.1 文案

把报告从“正式评分”改为“本次情境行为观察”。

建议调整：

- `total_score` 展示为“参考指数”。
- `level` 展示为“观察区间”。
- 雷达图标题改为“本次情境中的行为证据分布”。
- 高方差 / 覆盖不足 / mock 生成时显著降级。

### 7.2 状态

```ts
report_status:
  | "confident"
  | "provisional"
  | "unratable"
  | "debug";
```

## Phase 8：测试与验收

### 8.1 单元测试

新增：

- `backend/tests/agent-view.test.ts`
- `backend/tests/slot-tracker.test.ts`
- `backend/tests/mock-judge.test.ts`
- 更新 `backend/tests/assessment-design.test.ts`

### 8.2 必须通过的断言

1. NPC view 不含评分答案。
2. Director view 不含行为标签。
3. Judge view 不直接含 NPC memory。
4. required elements 只出现在 rubric/Judge view。
5. mock Judge 不写正式成绩。
6. coverage 不足时报告降级。
7. 5 采样高分歧时报告降级或拒绝出分。

### 8.3 回归命令

```bash
npm run backend:build
npm run test
npm run frontend:build
npm run prisma:seed -w backend
```

## 推荐实施顺序

```text
1. Phase 0：mock 正式性 + required elements 隔离 + constraints 拆分
2. Phase 1：agent view 隔离 + view 测试
3. Phase 2：任务卡降 cue + seed
4. Phase 3：BehaviorDetector 维度证据结构
5. Phase 4：slot tracker + coverage state
6. Phase 5：Director 输入隔离与证据流拆分
7. Phase 6：NPC prompt 降游戏化
8. Phase 7：报告文案与状态 UI
9. Phase 8：端到端测试与回归
```

## 风险控制

1. 先保留旧字段兼容，不在第一步大规模删类型。
2. 新 view 服务先只用于 agent 入参，数据库结构尽量后置。
3. `user_progress` 可短期保留作为旧 mock/测试兼容字段，但不再给 Director/NPC。
4. slot tracker 初期可作为 report meta，不强制改变所有流程；确认稳定后再接管停止规则。
