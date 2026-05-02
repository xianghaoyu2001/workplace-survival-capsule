import type { AgentName } from "../types/agent";

export interface ScenarioRubric {
  scenarioId: string;
  requiredElements: string[];
  dimensionDefinitions: Record<string, string>;
  disqualifyingRisks: string[];
}

export function inferScenarioIdFromBlackboard(blackboard: {
  scenario_facts?: {
    user_role?: string;
    project?: string;
  };
}): string {
  const text = `${blackboard.scenario_facts?.user_role ?? ""}\n${blackboard.scenario_facts?.project ?? ""}`;
  return /值班经理|珍味轩|8号桌|后厨|刘总/.test(text) ? "coffee_shop_complaint" : "project_demo_crisis";
}

const projectDemoRubric: ScenarioRubric = {
  scenarioId: "project_demo_crisis",
  requiredElements: [
    "硬截止前交付范围与后续补齐范围",
    "设计稿缺口的可行路径、替代路径和触发条件",
    "协作方资源负载、交换条件和责任边界",
    "低资历执行者的执行边界、参考标准和反馈节奏",
    "风险与不确定项说明"
  ],
  dimensionDefinitions: {
    信息辨别: "区分确认事实、未知项和假设项。",
    交付切分: "区分硬截止前可交付内容和后续补齐内容。",
    备选方案: "提出可执行主路径、替代路径、触发条件和风险。",
    承诺边界: "在不确定和多方压力下，控制保证、责任和风险表述。",
    向上对齐: "给上级可上会的信息结构。",
    横向协商: "对协作方体现互惠、边界和责任承担。",
    新人赋能: "给新人明确执行边界和信任空间。",
    压力表达: "在追问下保持结构化、稳定表达。"
  },
  disqualifyingRisks: ["无依据承诺", "推责", "把未知说成确定", "直接打击弱势方自尊"]
};

const restaurantRubric: ScenarioRubric = {
  scenarioId: "coffee_shop_complaint",
  requiredElements: [
    "现场影响控制和可见补救方式",
    "员工责任、纠错方式和复核标准",
    "后厨协同、流程责任和专业边界",
    "前厅后厨流程改进",
    "今晚处理与长期改进的区分"
  ],
  dimensionDefinitions: {
    利害识别: "识别客人面子、员工信心、厨房信任三类利害。",
    现场止损: "先控制现场可见影响和服务风险。",
    规则边界: "在食品安全、复核、补偿规则内灵活处理。",
    承诺边界: "在不确定和多方压力下，控制保证、责任和风险表述。",
    面子修复: "处理客人在同伴面前的体面损失。",
    员工修复: "处理员工责任、初衷和后续标准。",
    后厨协同: "与资深后厨建立专业协同。",
    系统改进: "把事故转化为可执行流程机制。"
  },
  disqualifyingRisks: ["无原则补偿", "甩锅给员工", "只追责不处理现场", "食品安全边界失守"]
};

export function getScenarioRubric(scenarioId: string): ScenarioRubric {
  return scenarioId === "coffee_shop_complaint" ? restaurantRubric : projectDemoRubric;
}

export function getAgentNamesByScenario(scenarioId: string): Record<AgentName, string> {
  return scenarioId === "coffee_shop_complaint"
    ? { leader: "刘总", coworker: "小林", client: "江师傅" }
    : { leader: "陈总", coworker: "苏姐", client: "小秋" };
}
