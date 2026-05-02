import type { AgentName } from "../types/agent";

export type EvidenceQuality = "none" | "partial" | "clear";
export type SlotStatus = "unseen" | "probed" | "evidenced" | "insufficient";

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
  status: SlotStatus;
  evidenceQuality: EvidenceQuality;
  rounds: number[];
  evidenceQuotes: string[];
}

export interface CoverageState {
  scenarioId: string;
  slots: Record<string, SlotCoverage>;
  coveredDimensions: string[];
  insufficientDimensions: string[];
}

export interface CoverageStatus {
  covered_dimensions: string[];
  insufficient_dimensions: string[];
  complete: boolean;
}

export interface DimensionEvidence {
  dimension: string;
  quality: EvidenceQuality | string;
  quote?: string;
  reason?: string;
}

const projectDemoSlots: SlotDefinition[] = [
  { id: "A_INFO_LEADER", scenarioId: "project_demo_crisis", dimension: "信息辨别", npcTarget: "leader", promptIntent: "暴露用户是否能说明事实、未知和假设的区分依据。", priority: 5 },
  { id: "A_INFO_SCOPE", scenarioId: "project_demo_crisis", dimension: "信息辨别", npcTarget: "client", promptIntent: "暴露用户面对执行者信息不足时如何澄清、标注或延迟判断。", priority: 4 },
  { id: "A_DELIVERY_SCOPE", scenarioId: "project_demo_crisis", dimension: "交付切分", npcTarget: "leader", promptIntent: "暴露用户是否能区分硬截止前范围和后续补齐范围。", priority: 4 },
  { id: "A_DELIVERY_RISK", scenarioId: "project_demo_crisis", dimension: "交付切分", npcTarget: "client", promptIntent: "暴露用户是否能把执行者可交付范围、反馈节奏和后续补齐拆开。", priority: 4 },
  { id: "A_ALTERNATIVE_A", scenarioId: "project_demo_crisis", dimension: "备选方案", npcTarget: "leader", promptIntent: "暴露用户是否能提出可行路径并说明取舍依据。", priority: 4 },
  { id: "A_ALTERNATIVE_B", scenarioId: "project_demo_crisis", dimension: "备选方案", npcTarget: "coworker", promptIntent: "暴露用户在关键条件不成立时如何调整方案。", priority: 4 },
  { id: "A_BOUNDARY_PROMISE", scenarioId: "project_demo_crisis", dimension: "承诺边界", npcTarget: "leader", promptIntent: "暴露用户是否能识别不能说满的承诺。", priority: 4 },
  { id: "A_BOUNDARY_CHANGE", scenarioId: "project_demo_crisis", dimension: "承诺边界", npcTarget: "coworker", promptIntent: "暴露用户对协作资源的承诺是否保留条件、风险和边界。", priority: 4 },
  { id: "A_UPWARD_STRUCTURE", scenarioId: "project_demo_crisis", dimension: "向上对齐", npcTarget: "leader", promptIntent: "暴露用户向上沟通时是否能组织事实、判断和下一步。", priority: 4 },
  { id: "A_UPWARD_OWNER", scenarioId: "project_demo_crisis", dimension: "向上对齐", npcTarget: "coworker", promptIntent: "暴露用户是否能把协作承诺转化为可向上同步的责任安排。", priority: 4 },
  { id: "A_LATERAL_LOAD", scenarioId: "project_demo_crisis", dimension: "横向协商", npcTarget: "coworker", promptIntent: "暴露用户是否考虑协作方资源负载和约束。", priority: 5 },
  { id: "A_LATERAL_EXCHANGE", scenarioId: "project_demo_crisis", dimension: "横向协商", npcTarget: "coworker", promptIntent: "暴露用户是否能提出对等交换、边界和责任安排。", priority: 4 },
  { id: "A_JUNIOR_STANDARD", scenarioId: "project_demo_crisis", dimension: "新人赋能", npcTarget: "client", promptIntent: "暴露用户是否能给低资历成员明确执行边界。", priority: 5 },
  { id: "A_JUNIOR_TRUST", scenarioId: "project_demo_crisis", dimension: "新人赋能", npcTarget: "client", promptIntent: "暴露用户是否能给低资历成员反馈节奏和自主空间。", priority: 4 },
  { id: "A_PRESSURE_STRUCTURE", scenarioId: "project_demo_crisis", dimension: "压力表达", npcTarget: "leader", promptIntent: "暴露用户在追问下是否能保持结构化表达。", priority: 4 },
  { id: "A_PRESSURE_RECOVER", scenarioId: "project_demo_crisis", dimension: "压力表达", npcTarget: "client", promptIntent: "暴露用户在执行者不确定或焦虑时是否仍能稳定推进和补充依据。", priority: 3 }
];

const restaurantSlots: SlotDefinition[] = [
  { id: "B_STAKEHOLDER_MAP", scenarioId: "coffee_shop_complaint", dimension: "利害识别", npcTarget: "leader", promptIntent: "暴露用户是否能识别现场相关方和不同利害。", priority: 5 },
  { id: "B_STAKEHOLDER_CONFLICT", scenarioId: "coffee_shop_complaint", dimension: "利害识别", npcTarget: "client", promptIntent: "暴露用户如何权衡客人、员工和后厨之间的冲突。", priority: 4 },
  { id: "B_DAMAGE_CONTROL", scenarioId: "coffee_shop_complaint", dimension: "现场止损", npcTarget: "leader", promptIntent: "暴露用户是否能说明现场影响控制和即时动作。", priority: 5 },
  { id: "B_DAMAGE_SEQUENCE", scenarioId: "coffee_shop_complaint", dimension: "现场止损", npcTarget: "leader", promptIntent: "暴露用户是否能解释处理顺序背后的判断依据。", priority: 4 },
  { id: "B_RULE_SAFETY", scenarioId: "coffee_shop_complaint", dimension: "规则边界", npcTarget: "client", promptIntent: "暴露用户是否能守住食品安全和出品复核边界。", priority: 5 },
  { id: "B_RULE_COMPENSATION", scenarioId: "coffee_shop_complaint", dimension: "规则边界", npcTarget: "leader", promptIntent: "暴露用户是否能区分补偿、承诺和门店规则边界。", priority: 4 },
  { id: "B_PROMISE_CUSTOMER", scenarioId: "coffee_shop_complaint", dimension: "承诺边界", npcTarget: "leader", promptIntent: "暴露用户面对客人压力时是否能控制承诺边界。", priority: 5 },
  { id: "B_PROMISE_STAFF", scenarioId: "coffee_shop_complaint", dimension: "承诺边界", npcTarget: "coworker", promptIntent: "暴露用户是否能说明员工、厨房和自己之间的责任边界。", priority: 4 },
  { id: "B_FACE_REPAIR", scenarioId: "coffee_shop_complaint", dimension: "面子修复", npcTarget: "leader", promptIntent: "暴露用户是否能处理公开场合中的体面损失。", priority: 5 },
  { id: "B_FACE_VISIBLE_ACTION", scenarioId: "coffee_shop_complaint", dimension: "面子修复", npcTarget: "leader", promptIntent: "暴露用户是否能提出现场可见的补救动作。", priority: 4 },
  { id: "B_STAFF_INTENT", scenarioId: "coffee_shop_complaint", dimension: "员工修复", npcTarget: "coworker", promptIntent: "暴露用户是否能区分员工初衷、责任和纠错边界。", priority: 5 },
  { id: "B_STAFF_STANDARD", scenarioId: "coffee_shop_complaint", dimension: "员工修复", npcTarget: "coworker", promptIntent: "暴露用户是否能给员工清晰标准和后续纠错方式。", priority: 4 },
  { id: "B_KITCHEN_TRUST", scenarioId: "coffee_shop_complaint", dimension: "后厨协同", npcTarget: "client", promptIntent: "暴露用户是否能与资深后厨建立专业协同。", priority: 5 },
  { id: "B_KITCHEN_FRONT_BACK", scenarioId: "coffee_shop_complaint", dimension: "后厨协同", npcTarget: "client", promptIntent: "暴露用户是否能识别前厅后厨衔接中的流程问题。", priority: 4 },
  { id: "B_SYSTEM_PROCESS", scenarioId: "coffee_shop_complaint", dimension: "系统改进", npcTarget: "client", promptIntent: "暴露用户是否能把事故转化为流程机制改进。", priority: 5 },
  { id: "B_SYSTEM_REVIEW", scenarioId: "coffee_shop_complaint", dimension: "系统改进", npcTarget: "leader", promptIntent: "暴露用户是否能安排复盘、责任和防复发机制。", priority: 3 }
];

export function getSlotDefinitions(scenarioId: string): SlotDefinition[] {
  return scenarioId === "coffee_shop_complaint" ? restaurantSlots : projectDemoSlots;
}

export function createInitialCoverageState(scenarioId: string): CoverageState {
  const slots = Object.fromEntries(
    getSlotDefinitions(scenarioId).map((slot) => [
      slot.id,
      {
        slotId: slot.id,
        dimension: slot.dimension,
        status: "unseen" as const,
        evidenceQuality: "none" as const,
        rounds: [],
        evidenceQuotes: []
      }
    ])
  );
  return computeCoverageSummary({ scenarioId, slots, coveredDimensions: [], insufficientDimensions: [] });
}

function qualityRank(quality: EvidenceQuality): number {
  if (quality === "clear") return 2;
  if (quality === "partial") return 1;
  return 0;
}

function computeCoverageSummary(state: CoverageState): CoverageState {
  const dimensions = [...new Set(Object.values(state.slots).map((slot) => slot.dimension))];
  const coveredDimensions = dimensions.filter((dimension) =>
    Object.values(state.slots).some((slot) => slot.dimension === dimension && qualityRank(slot.evidenceQuality) >= 1)
  );
  return {
    ...state,
    coveredDimensions,
    insufficientDimensions: dimensions.filter((dimension) => !coveredDimensions.includes(dimension))
  };
}

export function getUncoveredSlots(state: CoverageState | undefined): SlotDefinition[] {
  if (!state) return [];
  return getSlotDefinitions(state.scenarioId)
    .filter((slot) => state.slots[slot.id]?.evidenceQuality === "none")
    .sort((a, b) => b.priority - a.priority);
}

export function summarizeCoverage(state: CoverageState | undefined): CoverageStatus {
  if (!state) {
    return { covered_dimensions: [], insufficient_dimensions: [], complete: false };
  }
  return {
    covered_dimensions: state.coveredDimensions,
    insufficient_dimensions: state.insufficientDimensions,
    complete: state.coveredDimensions.length >= 6
  };
}

function dimensionsFromLegacyBehavior(scenarioId: string, detectedBehavior: Record<string, boolean>): string[] {
  const isRestaurant = scenarioId === "coffee_shop_complaint";
  const dimensions: string[] = [];

  if (detectedBehavior.used_given_facts || detectedBehavior.identified_core_flow) {
    dimensions.push(isRestaurant ? "利害识别" : "信息辨别");
  }
  if (detectedBehavior.clarified_scope || detectedBehavior.separated_must_have_from_optional) {
    dimensions.push(isRestaurant ? "现场止损" : "交付切分");
  }
  if (detectedBehavior.proposed_viable_alternative || detectedBehavior.gave_risk_plan) {
    dimensions.push(isRestaurant ? "系统改进" : "备选方案");
  }
  if (detectedBehavior.honest_risk_with_fallback || detectedBehavior.stated_assumptions) {
    dimensions.push("承诺边界");
  }
  if (detectedBehavior.gave_owner || detectedBehavior.gave_timeline) {
    dimensions.push(isRestaurant ? "现场止损" : "向上对齐");
  }
  if (detectedBehavior.handled_coworker_conflict) {
    dimensions.push(isRestaurant ? "员工修复" : "横向协商");
  }
  if (detectedBehavior.managed_client_expectation) {
    dimensions.push(isRestaurant ? "后厨协同" : "新人赋能");
  }
  if (detectedBehavior.pressure_resistant || detectedBehavior.takes_ownership) {
    dimensions.push(isRestaurant ? "承诺边界" : "压力表达");
  }

  return [...new Set(dimensions)];
}

function normalizeEvidenceQuality(quality: string | undefined): EvidenceQuality {
  if (quality === "clear" || quality === "partial" || quality === "none") return quality;
  return "none";
}

export function updateCoverageFromDimensionEvidence(
  state: CoverageState | undefined,
  scenarioId: string,
  dimensionEvidence: DimensionEvidence[] | undefined,
  round: number
): CoverageState {
  const next = state ?? createInitialCoverageState(scenarioId);
  if (!dimensionEvidence || dimensionEvidence.length === 0) {
    return next;
  }

  const validDimensions = new Set(getSlotDefinitions(scenarioId).map((slot) => slot.dimension));
  const slots = { ...next.slots };

  for (const evidence of dimensionEvidence) {
    if (!validDimensions.has(evidence.dimension)) continue;
    const quality = normalizeEvidenceQuality(evidence.quality);
    if (quality === "none") continue;

    const target =
      getSlotDefinitions(scenarioId).find((slot) =>
        slot.dimension === evidence.dimension &&
        qualityRank(slots[slot.id]?.evidenceQuality ?? "none") < qualityRank(quality)
      ) ??
      getSlotDefinitions(scenarioId).find((slot) => slot.dimension === evidence.dimension);
    if (!target) continue;

    const current = slots[target.id];
    slots[target.id] = {
      ...current,
      status: "evidenced",
      evidenceQuality: quality,
      rounds: current.rounds.includes(round) ? current.rounds : [...current.rounds, round],
      evidenceQuotes: evidence.quote
        ? [...current.evidenceQuotes, evidence.quote.slice(0, 200)]
        : current.evidenceQuotes
    };
  }

  return computeCoverageSummary({ ...next, slots });
}

export function updateCoverageFromLegacyBehavior(
  state: CoverageState | undefined,
  scenarioId: string,
  detectedBehavior: Record<string, boolean> | undefined,
  round: number,
  quote: string
): CoverageState {
  const next = state ?? createInitialCoverageState(scenarioId);
  if (!detectedBehavior) {
    return next;
  }

  const dimensions = dimensionsFromLegacyBehavior(scenarioId, detectedBehavior);
  const slots = { ...next.slots };
  for (const dimension of dimensions) {
    const target = getSlotDefinitions(scenarioId).find((slot) => slot.dimension === dimension && slots[slot.id]?.evidenceQuality === "none");
    if (!target) continue;
    const current = slots[target.id];
    slots[target.id] = {
      ...current,
      status: "evidenced",
      evidenceQuality: "partial",
      rounds: [...current.rounds, round],
      evidenceQuotes: quote ? [...current.evidenceQuotes, quote.slice(0, 200)] : current.evidenceQuotes
    };
  }

  return computeCoverageSummary({ ...next, slots });
}
