# 前端功能规格

## 技术栈

React 19 + TypeScript + Vite 6 + react-router-dom v7 + recharts 2。无全局状态管理。

## 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | HomePage | 营销落地页 |
| `/scenarios` | ScenarioPage | 选择场景 + 输入昵称 |
| `/chat/:sessionId` | ChatPage | 流式对话界面 |
| `/report/:sessionId` | ReportPage | 能力报告 |
| `/admin` | AdminGate → AdminLayout | 管理后台 |
| `/admin/` | DashboardPage | 仪表盘 |
| `/admin/scenarios` | ScenariosPage | 场景编辑 |
| `/admin/prompts` | PromptsPage | 提示词编辑 |
| `/admin/sessions` | SessionsPage | 会话列表 |
| `/admin/sessions/:id` | SessionDetailPage | 会话详情 + 回放 |

所有页面懒加载，包裹在 ErrorBoundary 内。App shell 有 topbar（logo + 导航）。管理后台路由由 AdminGate 保护（检查 sessionStorage 中的 token）。

---

## 数据流

```
ScenarioPage → POST /api/assessment/start → 得到 sessionId → 跳转 /chat/:sessionId
ChatPage    → 挂载时 GET /api/assessment/session/:id 加载历史消息
            → 用户发消息 → POST /api/assessment/message/stream (SSE)
            → SSE 逐事件渲染 → Director 判定结束 → Judge 生成报告
            → 1.5s 后跳转 /report/:sessionId
ReportPage  → 挂载时 GET /api/assessment/report/:id 展示报告
```

---

## API

**base URL:** `import.meta.env.VITE_API_BASE || ""`（空字符串走 Vite 代理 `/api` → `localhost:3000`）

### 测评端

| 函数 | 方法 | 路径 | 说明 |
|------|------|------|------|
| `listScenarios()` | GET | `/api/assessment/scenarios` | 获取所有可用场景 |
| `startAssessment({scenario_id, nickname})` | POST | `/api/assessment/start` | 创建新会话，返回 `{session_id}` |
| `getSession(sessionId)` | GET | `/api/assessment/session/:id` | 会话详情包含所有历史消息 |
| `sendMessageStream(sessionId, content, events)` | POST | `/api/assessment/message/stream` | SS E 流式对话 |
| `getReport(sessionId)` | GET | `/api/assessment/report/:id` | 获取最终报告 |

### SSE 流式 API（核心）

请求体：`{session_id, content}`。

响应是 `ReadableStream`，逐行解析 `event: type` / `data: json` 对：

| event | data | 含义 |
|-------|------|------|
| `speaker` | `{speaker, role}` | 当前发言的 NPC |
| `token` | string | NPC 回复文本的增量片段 |
| `judging` | 无 | 对话结束，Judge 正在生成报告 |
| `done` | `SendMessageResponse` | 完整响应已生成 |
| `error` | string | 错误信息 |

回调接口：`{onSpeaker, onToken, onJudging, onDone, onError}`。

### 管理端 API

所有请求在 header 加 `x-admin-secret`（值来自 sessionStorage）。

| 函数 | 方法 | 路径 |
|------|------|------|
| `getDashboard()` | GET | `/api/admin/dashboard` |
| `listAdminScenarios()` | GET | `/api/admin/scenarios` |
| `updateAdminScenario(id, data)` | PUT | `/api/admin/scenarios/:id` |
| `listPrompts()` | GET | `/api/admin/prompts` |
| `updatePrompt(key, data)` | PUT | `/api/admin/prompts/:key` |
| `listSessions()` | GET | `/api/admin/sessions` |
| `getAdminSessionDetail(id)` | GET | `/api/admin/sessions/:id` |

---

## 类型定义

### `Report`（核心类型）

```typescript
{
  total_score: number;                    // 满分 160
  level: string;                          // "卓越" | "优秀" | "良好" | "合格" | "待提升" | "待人工复核" | "开发调试"
  dimension_scores: Record<string, number>;  // 8 个维度，每维 0-20
  dimension_analysis: Record<string, string>;
  conflict_style: string;                 // "协作型" | "妥协型" | "回避型" | "竞争型" | "混合型"
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  evidence: Array<{dimension: string; quote: string; analysis: string}>;
  radar_chart_data: Array<{name: string; score: number; max: 20}>;
  final_recommendation: string;
  calibration_issues?: string[];
  human_review_required?: boolean;
  human_review_reason?: string;
  mock_generated?: boolean;               // USE_MOCK_LLM 模式标记
  report_status?: "confident" | "provisional" | "unratable" | "debug";
  coverage_status?: {
    covered_dimensions: string[];
    insufficient_dimensions: string[];
    complete: boolean;
  };
  sampling_stats?: {
    scores: number[];     // 5 次采样的总分
    variance: number;     // 总分方差
    dim_variances?: Record<string, number>;  // 每维度的方差
  };
}
```

### 其他类型

```typescript
Scenario: {id, title, description, backgroundForUser, maxRound, groupChatEnabled, groupChatRounds: number[], status, openingMessage?: VisibleReply}
Message: {id, sessionId?, senderType: "user"|"agent", senderName, senderRole?, content, roundIndex, createdAt?}
VisibleReply: {speaker, role, content}
SendMessageResponse: {finished: boolean, reply: VisibleReply, round: number, phase: string, report?: Report, blackboard?: any}
StartAssessmentResponse: {session_id: string, opening_message: VisibleReply, blackboard: any, scenario: Scenario}
SessionDetail: {session, scenario, messages: Message[], group_discussions: GroupDiscussion[], report?: Report}
```

---

## 页面功能

### HomePage (`/`)

静态营销落地页。无数据获取，无交互。
- 标题、副标题、说明文字
- "进入测评"按钮 → 跳转 `/scenarios`
- "管理后台"按钮 → 跳转 `/admin`

### ScenarioPage (`/scenarios`)

- **数据获取：** 挂载时 `listScenarios()`
- **状态：** loading / error / 正常
- **功能：**
  1. 昵称输入框（从 `localStorage` 的 `maat_nickname` 读写）
  2. 场景卡片列表，每张显示标题、描述、标签行
  3. 点击"开始测评"→ 验证昵称非空 → `startAssessment()` → 跳转 `/chat/:sessionId`
  4. 启动中的场景按钮显示 loading 状态并禁用，防止重复提交

### ChatPage (`/chat/:sessionId`)

**核心交互逻辑。**

- **数据获取：** 挂载时 `getSession(sessionId)` 获取历史消息和场景信息
- **布局：** 左列（场景信息）+ 右列（对话区域）
- **左列内容：**
  - 场景标题、描述
  - `backgroundForUser` 文本（用户的任务描述）
  - 轮次进度（当前轮 / 最大轮）
  - "返回场景"链接
- **右列内容：**
  - 状态指示（进行中 / 对方正在回复 / 测评已结束）
  - 消息列表（ChatBubble）
  - 底部输入区域

**消息发送流程（`handleSubmit`）：**
1. 用户消息立即追加到列表（乐观更新）
2. 添加一个"对方正在输入"占位消息
3. 调用 `sendMessageStream()`，传入事件回调
4. **onSpeaker：** 清除占位，显示发言人名称
5. **onToken：** 逐字追加文本到当前 NPC 消息
6. **onJudging：** 对话结束，显示"报告生成中"
7. **onDone：** 若 `finished===true`，1.5s 后跳转 `/report/:sessionId`；否则进入下一轮
8. **onError：** 移除占位，显示错误

**时间压力机制：**
- 每轮 240 秒倒计时（首轮不计时）
- 超时自动提交"（时间到）"
- 最后 25 秒进入警告状态

**消息气泡（ChatBubble）：**
- `senderType === "user"` → 用户消息，右对齐
- `senderType === "agent"` → NPC 消息，左对齐，显示发言人名称+角色
- `senderType === "typing"` → 打字占位动画

**MessageInput：**
- 文本域 + 发送按钮
- Enter 发送（内容为空时禁用）
- 倒计时进度条 + 剩余秒数
- `disabled` 状态（对话结束时禁用）

**状态处理：**
- loading：显示"正在读取场景..."
- error：页内显示错误信息
- 报告完成：显示总分和等级，1.5s 后自动跳转
- 超时：自动发送"（时间到）"

---

### ReportPage (`/report/:sessionId`)

**数据获取：** 挂载时 `getReport(sessionId)`

**功能分区（从上到下顺序）：**

1. **报告头部：**
   - 等级标签（"良好"等）
   - 摘要文字
   - 冲突风格标签
   - 可信度标签（依据 `sampling_stats.variance` 判定：<30 高可信 / <80 中可信 / ≥80 建议人工复审）
   - 若 `report_status === "unratable"`：显示"评分不一致，待人工复核"
   - 若 `report_status === "provisional"`：显示"分数仅供参考"
   - 若 `mock_generated === true` 或 `report_status === "debug"`：显示"开发调试模式"
   - 若 `coverage_status.complete === false`：显示维度覆盖不足提示
   - 总分（大字）+ 满分

2. **采样置信度区：**（有 `sampling_stats` 时显示）
   - 5 个采样分数标签
   - 方差条形图
   - 方差数值 + 可信度文字

3. **覆盖状态区：**（有 `coverage_status` 时显示）
   - 已覆盖维度列表
   - 证据不足维度列表

4. **维度能力区：**
   - 每个维度的水平条形图（分数/20）
   - 若有维度方差则显示

5. **雷达图区：** 基于 `radar_chart_data` 的 8 维雷达图（recharts）

6. **维度分析区：** 每维度一张卡片，含维度的文本分析

7. **优势 / 风险 / 建议：** 三组列表

8. **关键证据区：** 证据卡片列表，每张含维度标签、用户原话引用、分析文字

9. **发展建议区：** `final_recommendation`

10. "再测一次"链接 → 跳转 `/scenarios`

**状态处理：**
- loading：显示"正在生成评估报告..."
- error：显示错误 + "返回场景列表"链接
- `report_status === "unratable"`：分数区域淡化处理，醒目位置提示人工复核

---

### AdminLayout + AdminGate

**AdminGate：** 检查 `sessionStorage.getItem("maat_admin_token")`。无 token 时渲染登录表单（密码输入 + "进入后台"按钮），有 token 时渲染子组件。

**AdminLayout：** 侧边栏导航 + 内容区（Outlet）

**侧边栏导航链接：**
- 仪表盘（/admin）
- 场景（/admin/scenarios）
- 提示词（/admin/prompts）
- 会话（/admin/sessions）

---

### DashboardPage (`/admin/`)

- 挂载时 `getDashboard()`
- 4 个统计卡片：总会话数、进行中、已完成、平均分
- 维度平均分列表（每个维度水平条形图）

**状态处理：** loading 时显示占位符 "-"，error 时显示错误，无数据时显示"暂无已完成会话"。

---

### ScenariosPage (`/admin/scenarios`)

- 挂载时 `listAdminScenarios()`
- 每个场景一个编辑器卡片
- 每个 ScenarioEditor：标题 input、描述 textarea、backgroundForUser textarea、maxRound input、保存按钮
- 保存后调 `updateAdminScenario()` 并刷新列表

---

### PromptsPage (`/admin/prompts`)

- 挂载时 `listPrompts()`
- 每个提示词一个编辑器卡片
- 每个 PromptEditor：key 名称（只读）、name input、content textarea（等宽字体）、active checkbox、保存按钮
- 保存后调 `updatePrompt()` 并刷新列表

---

### SessionsPage (`/admin/sessions`)

- 挂载时 `listSessions()`
- 顶部：统计摘要（总数 / 进行中 / 已完成）
- 筛选器（客户端筛选）：
  - 文本搜索（匹配会话 ID、场景标题、用户昵称）
  - 状态下拉（全部 / 进行中 / 已完成 / 已超时）
  - 场景下拉（全部 / 具体场景名）
- 表格（SessionTable）：会话 ID（链接）、场景标题、状态标签、轮次、分数、开始时间、操作（"查看"链接）
- 空筛选结果：显示无匹配提示

---

### SessionDetailPage (`/admin/sessions/:id`)

- 挂载时 `getAdminSessionDetail(id)`
- 会话摘要：状态标签、轮次、总分、报告状态
- 评分概览（若有报告）：与 ReportPage 相同的评分展示（维度条形图、雷达图、优势/风险/建议、证据链）
- 无报告时：显示"会话未结束"或"报告数据缺失"
- 消息回放（SessionReplay）：按时间顺序展示所有 ChatBubble
- 群聊记录（GroupDiscussionPanel）：折叠面板列表，每次群聊显示轮次、阶段、原始 JSON
- 黑板状态：`<details>` 折叠展示完整 blackboard JSON

---

## 场景呈现配置（`scenarioPresentation.ts`）

将场景 ID 映射到结构化元数据。用于 ChatPage 左栏和 ScenarioPage 卡片。

```typescript
getScenarioPresentation(input: string | Scenario) => {
  badge: string;       // 如 "会议室压力"
  tagline: string;     // 如 "信息辨别 · 交付切分 · 备选方案 · 压力表达"
  accent: string;      // 强调色 hex
}
```

通过两阶段识别：先查 ID 映射表，再模糊匹配场景文本中的关键词。

两个场景：
- `project_demo_crisis`（画图场景）：badge="会议室压力", accent="#0d9488"
- `coffee_shop_complaint`（餐厅场景）：badge="人情危机", accent="#c2410c"

---

## 报告状态优先级

一个 report 可能同时有多个状态标记，前端按以下优先级处理：

1. `report_status === "unratable"` → 最优先：不出正式分数，醒目提示人工复核
2. `mock_generated === true` 或 `report_status === "debug"` → 第二：标记为开发调试
3. `report_status === "provisional"` → 第三：分数仅供参考
4. `coverage_status?.complete === false` → 第四：维度覆盖不足
5. `sampling_stats.variance >= 80` → 第五：建议人工复审
6. 其余 → 正常展示
