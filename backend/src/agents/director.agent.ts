import { callDeepSeek } from "../services/llm.service";
import { getPromptContent } from "../services/prompt.service";
import type { DirectorResult } from "../types/agent";
import { parseAgentJSON } from "../utils/parseAgentJSON";
import { renderTemplate } from "../utils/renderTemplate";

interface MergedDirectorOutput extends DirectorResult {
  behavior_evidence?: Array<{
    behavior: string;
    quote: string;
    reason: string;
  }>;
}

function sanitizeDirectorPatch(patch?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!patch || typeof patch !== "object") return patch;

  const {
    assessment_goals: _assessmentGoals,
    required_final_plan_elements: _requiredFinalPlanElements,
    scenario_facts: _scenarioFacts,
    user_progress: _userProgress,
    latest_user_behavior: _latestUserBehavior,
    npc_memory: _npcMemory,
    coverage_state: _coverageState,
    ...safePatch
  } = patch;

  return safePatch;
}

/**
 * Single merged Director call: combines behavior detection and stage direction.
 * Its blackboard patch is sanitized so the LLM cannot mutate scoring state,
 * rubric fields, or NPC memory.
 */
export async function callDirectorAgent(params: {
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
}): Promise<DirectorResult> {
  const directorPrompt = await getPromptContent("director");
  const input = renderTemplate(
    `
Blackboard:
{blackboard}

Chat history:
{chat_history}

User reply:
{user_message}
`,
    {
      blackboard: JSON.stringify(params.blackboard, null, 2),
      chat_history: params.chatHistory,
      user_message: params.userMessage
    }
  );

  const raw = await callDeepSeek({
    systemPrompt: directorPrompt,
    userPrompt: input,
    model: process.env.DEEPSEEK_FAST_MODEL,
    temperature: 0.15,
    maxTokens: 2200,
    jsonMode: true,
    thinking: false,
    timeoutMs: 90000
  });

  const result = await parseAgentJSON<MergedDirectorOutput>(raw, directorPrompt, input, "Director Agent");

  if (result.behavior_evidence && result.behavior_evidence.length > 0) {
    const patch = result.updated_blackboard_patch ?? {};
    const notes = (patch.evaluation_notes ?? {}) as {
      strengths?: unknown[];
      risks?: unknown[];
      evidence?: unknown[];
    };
    result.updated_blackboard_patch = {
      ...patch,
      evaluation_notes: {
        strengths: notes.strengths ?? [],
        risks: notes.risks ?? [],
        evidence: [
          ...(notes.evidence ?? []),
          ...result.behavior_evidence.map(
            (item) => `${item.behavior}: ${item.quote}，${item.reason}`
          )
        ]
      }
    };
  }

  result.updated_blackboard_patch = sanitizeDirectorPatch(result.updated_blackboard_patch);
  return result;
}

/**
 * Legacy two-call Director kept as fallback: BehaviorDetector then StageDirector.
 */
export async function callLegacyDirectorAgent(params: {
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
}): Promise<DirectorResult> {
  const { callBehaviorDetectorAgent } = await import("./behaviorDetector.agent");
  const { callStageDirectorAgent } = await import("./stageDirector.agent");

  const behaviorDetection = await callBehaviorDetectorAgent(params);
  const stageResult = await callStageDirectorAgent({
    ...params,
    behaviorDetection
  });

  const stagePatch = stageResult.updated_blackboard_patch ?? {};
  const stageNotes = (stagePatch.evaluation_notes ?? {}) as {
    strengths?: unknown[];
    risks?: unknown[];
    evidence?: unknown[];
  };
  const mergedPatch = sanitizeDirectorPatch({
    ...stagePatch,
    evaluation_notes: {
      strengths: stageNotes.strengths ?? [],
      risks: stageNotes.risks ?? [],
      evidence: [
        ...(stageNotes.evidence ?? []),
        ...behaviorDetection.evidence.map(
          (item) => `${item.behavior}: ${item.quote}，${item.reason}`
        )
      ]
    }
  });

  return {
    ...stageResult,
    detected_behavior: behaviorDetection.detected_behavior,
    updated_blackboard_patch: mergedPatch
  };
}
