import type { AgentName } from "../types/agent";
import type { Blackboard } from "./blackboard.service";
import { getScenarioRubric, inferScenarioIdFromBlackboard } from "./rubric.service";
import type { CoverageState } from "./slotTracker.service";
import { getUncoveredSlots, summarizeCoverage } from "./slotTracker.service";

type PublicAgentProfile = {
  name: string;
  role: string;
};

type PublicScenarioFacts = {
  user_role: string;
  project: string;
  demo_time: string;
  current_time: string;
  known_facts: string[];
  unknowns: string[];
  completed_features: string[];
  at_risk_features: string[];
  agent_profiles: Record<AgentName, PublicAgentProfile>;
  capability_dimensions?: string[];
};

type PublicFactOptions = {
  includeDimensions?: boolean;
  includeUnknowns?: boolean;
};

function publicProfile(profile: { name: string; role: string }): PublicAgentProfile {
  return {
    name: profile.name,
    role: profile.role
  };
}

function buildPublicScenarioFacts(blackboard: Blackboard, options: PublicFactOptions = {}): PublicScenarioFacts {
  const facts = blackboard.scenario_facts;
  return {
    user_role: facts.user_role,
    project: facts.project,
    demo_time: facts.demo_time,
    current_time: facts.current_time,
    known_facts: facts.known_facts,
    unknowns: options.includeUnknowns ? facts.unknowns : [],
    completed_features: facts.completed_features,
    at_risk_features: facts.at_risk_features,
    agent_profiles: {
      leader: publicProfile(facts.agent_profiles.leader),
      coworker: publicProfile(facts.agent_profiles.coworker),
      client: publicProfile(facts.agent_profiles.client)
    },
    ...(options.includeDimensions ? { capability_dimensions: facts.capability_dimensions } : {})
  };
}

function ownMemory(blackboard: Blackboard, agent: AgentName) {
  const memory = blackboard.npc_memory[agent];
  return {
    [agent]: {
      ...("trust" in memory ? { trust: memory.trust } : {}),
      ...("pressure" in memory ? { pressure: memory.pressure } : {}),
      ...("cooperation" in memory ? { cooperation: memory.cooperation } : {}),
      ...("defensiveness" in memory ? { defensiveness: memory.defensiveness } : {}),
      ...("anxiety" in memory ? { anxiety: memory.anxiety } : {}),
      last_concern: memory.last_concern,
      observed_user_signal: memory.observed_user_signal ?? "not_observed",
      response_mode: memory.response_mode ?? "probe_boundary"
    }
  };
}

function npcStateSummary(blackboard: Blackboard) {
  return {
    leader: {
      trust: blackboard.npc_memory.leader.trust,
      pressure: blackboard.npc_memory.leader.pressure,
      last_concern: blackboard.npc_memory.leader.last_concern,
      observed_user_signal: blackboard.npc_memory.leader.observed_user_signal ?? "not_observed"
    },
    coworker: {
      cooperation: blackboard.npc_memory.coworker.cooperation,
      defensiveness: blackboard.npc_memory.coworker.defensiveness,
      last_concern: blackboard.npc_memory.coworker.last_concern,
      observed_user_signal: blackboard.npc_memory.coworker.observed_user_signal ?? "not_observed"
    },
    client: {
      trust: blackboard.npc_memory.client.trust,
      anxiety: blackboard.npc_memory.client.anxiety,
      last_concern: blackboard.npc_memory.client.last_concern,
      observed_user_signal: blackboard.npc_memory.client.observed_user_signal ?? "not_observed"
    }
  };
}

function coverageState(blackboard: Blackboard): CoverageState | undefined {
  return blackboard.coverage_state;
}

export function buildNpcView(blackboard: Blackboard, agent: AgentName, stimulusInstruction: string) {
  return {
    round: blackboard.round,
    min_round: blackboard.min_round,
    max_round: blackboard.max_round,
    phase: blackboard.phase,
    current_focus: "围绕本轮角色的处境追问用户的判断、边界和下一步。",
    active_agent: agent,
    stimulus_instruction: stimulusInstruction,
    scenario_facts: buildPublicScenarioFacts(blackboard),
    npc_memory: ownMemory(blackboard, agent),
    conversation_control: {
      last_active_agent: blackboard.conversation_control.last_active_agent,
      suggested_next_agent: blackboard.conversation_control.suggested_next_agent
    }
  };
}

export function buildDirectorView(blackboard: Blackboard) {
  return {
    round: blackboard.round,
    phase: blackboard.phase,
    current_focus: "根据场景压力和覆盖状态选择下一轮刺激。",
    scenario_facts: buildPublicScenarioFacts(blackboard),
    conversation_control: {
      last_active_agent: blackboard.conversation_control.last_active_agent,
      suggested_next_agent: blackboard.conversation_control.suggested_next_agent
    },
    npc_state_summary: npcStateSummary(blackboard),
    coverage_state: coverageState(blackboard) ?? null,
    coverage_summary: summarizeCoverage(coverageState(blackboard)),
    uncovered_slots: getUncoveredSlots(coverageState(blackboard))
  };
}

export function buildGroupDiscussionView(blackboard: Blackboard) {
  return {
    round: blackboard.round,
    phase: blackboard.phase,
    current_focus: "保护性检查当前角色选择和场景状态是否矛盾。",
    scenario_facts: buildPublicScenarioFacts(blackboard),
    conversation_control: {
      last_active_agent: blackboard.conversation_control.last_active_agent,
      suggested_next_agent: blackboard.conversation_control.suggested_next_agent
    },
    npc_state_summary: npcStateSummary(blackboard),
    coverage_state: coverageState(blackboard) ?? null,
    coverage_summary: summarizeCoverage(coverageState(blackboard))
  };
}

export function buildJudgeView(blackboard: Blackboard) {
  const scenarioId = inferScenarioIdFromBlackboard(blackboard);
  return {
    scenario_facts: buildPublicScenarioFacts(blackboard, { includeDimensions: true, includeUnknowns: true }),
    rubric: getScenarioRubric(scenarioId),
    user_progress: blackboard.user_progress,
    latest_user_behavior: blackboard.latest_user_behavior,
    evaluation_notes: blackboard.evaluation_notes,
    coverage_state: coverageState(blackboard) ?? null,
    group_discussion_summary: blackboard.group_discussion_summary
  };
}
