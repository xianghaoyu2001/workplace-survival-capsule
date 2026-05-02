import type { AgentName, NpcResult } from "../types/agent";

const genericBannedPatterns = [
  /完整方案如下/,
  /最佳方案是/,
  /我建议你们/,
  /你们可以这样/,
  /我来安排/,
  /我帮你安排/,
  /我替你/,
  /分工如下/,
  /计划如下/,
  /排期如下/,
  /我来负责.*你来/,
  /我们可以这样分工/,
  /我去协调/,
  /我给你排/,
  /我来定.*分工/,
  /你按这个计划执行/,
  /你直接对.*说/,
  /口径.*我.*写/,
  /沟通稿.*我.*写/,
  /话术.*我.*写/
];

function patternsForAgent(agent: AgentName): RegExp[] {
  return genericBannedPatterns;
}

export function findNpcBoundaryViolation(agent: AgentName, content: string): string | null {
  const pattern = patternsForAgent(agent).find((candidate) => candidate.test(content));
  return pattern ? pattern.source : null;
}

function getAgentProfile(blackboard: unknown, agent: AgentName, fallback: { speaker: string; role: string }) {
  const profile = (blackboard as {
    scenario_facts?: {
      agent_profiles?: Record<AgentName, { name?: string; role?: string }>;
    };
  })?.scenario_facts?.agent_profiles?.[agent];

  return {
    speaker: profile?.name ?? fallback.speaker,
    role: profile?.role ?? fallback.role
  };
}

export function createBoundarySafeNpcResult(agent: AgentName, blackboard?: unknown): NpcResult {
  if (agent === "client") {
    const profile = getAgentProfile(blackboard, agent, { speaker: "客户方", role: "对端角色" });
    return {
      visible_reply: {
        speaker: profile.speaker,
        role: profile.role,
        content: "我不需要泛泛承诺，只需要知道你现在准备怎么处理、依据是什么、哪些风险你不能保证。"
      },
      memory_update: {
        client: {
          trust: 2,
          anxiety: 5,
          last_concern: "需要看到具体判断而非泛泛承诺",
          observed_user_signal: "boundary_violation_fallback",
          response_mode: "request_concrete_judgment_and_risk_boundary"
        }
      }
    };
  }

  if (agent === "coworker") {
    const profile = getAgentProfile(blackboard, agent, { speaker: "同事", role: "平级" });
    return {
      visible_reply: {
        speaker: profile.speaker,
        role: profile.role,
        content: "我可以配合，但你得先说清楚我具体负责到什么程度，以及出了问题时责任边界怎么划。不要把整体风险都压到我这边。"
      },
      memory_update: {
        coworker: {
          cooperation: 2,
          defensiveness: 4,
          last_concern: "需要明确配合边界和失败责任",
          observed_user_signal: "boundary_violation_fallback",
          response_mode: "probe_collaboration_boundary_and_responsibility"
        }
      }
    };
  }

  const profile = getAgentProfile(blackboard, agent, { speaker: "负责人", role: "上级" });
  return {
    visible_reply: {
      speaker: profile.speaker,
      role: profile.role,
      content: "我现在要的是你的判断。你准备怎么处理、风险在哪里、哪些承诺不能说满，讲清楚。"
    },
    memory_update: {
      leader: {
        trust: 2,
        pressure: 5,
        last_concern: "需要用户自己给出可执行方案而非泛泛表态",
        observed_user_signal: "boundary_violation_fallback",
        response_mode: "press_evidence_boundary_and_owner"
      }
    }
  };
}
