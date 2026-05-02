import { describe, expect, it } from "vitest";
import { createInitialBlackboard } from "../src/services/blackboard.service";
import { buildDirectorView, buildJudgeView, buildNpcView } from "../src/services/agentView.service";

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe("agent input views", () => {
  it("keeps NPC view free of scoring rubric and other NPC memory", () => {
    const blackboard = createInitialBlackboard(10, "coffee_shop_complaint");
    const view = buildNpcView(blackboard, "client", "追问用户如何处理边界，不给完整方案。");
    const json = serialized(view);

    expect(json).not.toContain("required_final_plan_elements");
    expect(json).not.toContain("assessment_goals");
    expect(json).not.toContain("user_progress");
    expect(json).not.toContain("latest_user_behavior");
    expect(json).not.toContain("evaluation_notes");
    expect(json).not.toContain("先问初衷再给出品复核标准");
    expect(json).not.toContain("先承认系统问题再一起定方案");
    expect(json).not.toContain("hidden_vulnerability");
    expect(view.scenario_facts.unknowns).toEqual([]);
    expect(Object.keys(view.npc_memory)).toEqual(["client"]);
  });

  it("keeps Director view free of behavior labels and answer lists", () => {
    const blackboard = createInitialBlackboard(10, "project_demo_crisis");
    const view = buildDirectorView(blackboard);
    const json = serialized(view);

    expect(json).not.toContain("required_final_plan_elements");
    expect(json).not.toContain("assessment_goals");
    expect(json).not.toContain("user_progress");
    expect(json).not.toContain("latest_user_behavior");
    expect(json).not.toContain("evaluation_notes");
    expect(json).not.toContain("苏姐协作条件");
    expect(json).not.toContain("小秋的设计标准和方向");
    expect(json).not.toContain("不要把设计稿缺口直接压给苏姐");
    expect(json).not.toContain("hidden_vulnerability");
    expect(view.scenario_facts.unknowns).toEqual([]);
    expect(view.uncovered_slots.length).toBeGreaterThan(0);
    expect(view.uncovered_slots[0]).toHaveProperty("promptIntent");
  });

  it("keeps Judge view rubric-aware without directly exposing NPC memory", () => {
    const blackboard = createInitialBlackboard(10, "coffee_shop_complaint");
    const view = buildJudgeView(blackboard);
    const json = serialized(view);

    expect(json).toContain("requiredElements");
    expect(json).toContain("现场影响控制和可见补救方式");
    expect(json).toContain("latest_user_behavior");
    expect(json).toContain("evaluation_notes");
    expect(json).toContain("coverage_state");
    expect(json).not.toContain("npc_memory");
    expect(json).not.toContain("前厅后厨衔接、流程责任和专业边界仍未确认");
  });
});
