export const DIMENSION_LABELS: Record<string, string> = {
  empathy: "共情能力",
  emotional_control: "情绪控制",
  problem_solving: "问题解决",
  negotiation: "谈判推进",
  organizational_perspective: "组织视角",
  information_gathering: "信息获取",
  decision_structure: "决策结构",
  interpersonal_adaptation: "人际适配",
  pressure_expression: "压力表达",
  ownership: "责任承担",
  systems_perspective: "系统视角"
};

export const DIMENSION_PALETTE = [
  "#b63f2e",
  "#6f7d3a",
  "#8d5f26",
  "#9b3b45",
  "#2f6f68",
  "#5f6472",
  "#7a4a28",
  "#353934"
];

export function getDimensionLabel(key: string): string {
  return DIMENSION_LABELS[key] ?? key;
}

export function getDimensionColor(dimensions: string[], key: string): string {
  const idx = dimensions.indexOf(key);
  return DIMENSION_PALETTE[idx >= 0 ? idx % DIMENSION_PALETTE.length : 0];
}
