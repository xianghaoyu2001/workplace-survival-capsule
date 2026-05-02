import { describe, expect, it } from "vitest";
import {
  createInitialCoverageState,
  getSlotDefinitions,
  getUncoveredSlots,
  summarizeCoverage,
  updateCoverageFromDimensionEvidence,
  updateCoverageFromLegacyBehavior
} from "../src/services/slotTracker.service";

describe("slot coverage tracker", () => {
  it("creates a scenario-specific coverage state", () => {
    const state = createInitialCoverageState("project_demo_crisis");

    expect(Object.keys(state.slots)).toHaveLength(16);
    expect(state.coveredDimensions).toEqual([]);
    expect(getUncoveredSlots(state)).toHaveLength(16);
    expect(summarizeCoverage(state)).toEqual({
      covered_dimensions: [],
      insufficient_dimensions: expect.any(Array),
      complete: false
    });
  });

  it("keeps project demo measurement opportunities distributed across NPCs", () => {
    const counts = getSlotDefinitions("project_demo_crisis").reduce<Record<string, number>>((acc, slot) => {
      acc[slot.npcTarget] = (acc[slot.npcTarget] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts).toEqual({ leader: 6, coworker: 5, client: 5 });
    expect(getUncoveredSlots(createInitialCoverageState("project_demo_crisis")).slice(0, 3).map((slot) => slot.npcTarget))
      .toEqual(["leader", "coworker", "client"]);
  });

  it("maps legacy detected behavior into measurement slot evidence", () => {
    const state = createInitialCoverageState("coffee_shop_complaint");
    const updated = updateCoverageFromLegacyBehavior(
      state,
      "coffee_shop_complaint",
      {
        clarified_scope: true,
        handled_coworker_conflict: true,
        managed_client_expectation: true
      },
      3,
      "我会先稳住现场，再分别处理员工和后厨。"
    );

    expect(updated.coveredDimensions).toHaveLength(3);
    expect(getUncoveredSlots(updated)).toHaveLength(13);
    expect(Object.values(updated.slots).filter((slot) => slot.status === "evidenced")).toHaveLength(3);
    expect(JSON.stringify(updated)).toContain("我会先稳住现场");
  });

  it("uses dimension evidence directly before falling back to legacy flags", () => {
    const state = createInitialCoverageState("project_demo_crisis");
    const updated = updateCoverageFromDimensionEvidence(
      state,
      "project_demo_crisis",
      [{
        dimension: "横向协商",
        quality: "clear",
        quote: "我会先确认对方团队负载，再谈交换条件和责任边界。",
        reason: "用户说明了协作负载、交换条件和责任边界。"
      }],
      2
    );

    expect(updated.coveredDimensions).toEqual(["横向协商"]);
    expect(Object.values(updated.slots).filter((slot) => slot.evidenceQuality === "clear")).toHaveLength(1);
    expect(JSON.stringify(updated)).toContain("对方团队负载");
  });

  it("marks coverage complete only after enough distinct dimensions are observed", () => {
    let state = createInitialCoverageState("project_demo_crisis");
    state = updateCoverageFromLegacyBehavior(
      state,
      "project_demo_crisis",
      {
        used_given_facts: true,
        clarified_scope: true,
        proposed_viable_alternative: true,
        stated_assumptions: true,
        gave_owner: true
      },
      4,
      "我先区分确认项和假设项，并准备备用方案。"
    );

    expect(summarizeCoverage(state).complete).toBe(false);

    state = updateCoverageFromLegacyBehavior(
      state,
      "project_demo_crisis",
      {
        handled_coworker_conflict: true,
        managed_client_expectation: true
      },
      5,
      "我会分别和协作方、新人确认边界。"
    );

    expect(summarizeCoverage(state).complete).toBe(true);
  });
});
