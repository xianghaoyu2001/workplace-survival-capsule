import type { Message, Scenario } from "@prisma/client";
import { callClientAgent } from "../agents/client.agent";
import { callCoworkerAgent } from "../agents/coworker.agent";
import { callDirectorAgent } from "../agents/director.agent";
import { callGroupDiscussionAgent } from "../agents/groupDiscussion.agent";
import { callJudgeAgent, type JudgeProgressEvent } from "../agents/judge.agent";
import { callLeaderAgent } from "../agents/leader.agent";
import { callNpcAgentStreaming } from "../agents/npc.agent";
import { prisma } from "../db/prisma";
import type { AgentName, GroupDiscussionResult, JudgeReport, NpcResult, VisibleReply } from "../types/agent";
import {
  addGroupSummary,
  applyDetectedBehavior,
  type Blackboard,
  mergeBlackboard,
  mergeNpcMemory
} from "./blackboard.service";
import { buildDirectorView, buildGroupDiscussionView, buildJudgeView, buildNpcView } from "./agentView.service";
import { inferScenarioIdFromBlackboard } from "./rubric.service";
import { evaluateResponseQuality, type ResponseQualityGate } from "./responseQuality.service";
import {
  summarizeCoverage,
  updateCoverageFromDimensionEvidence,
  updateCoverageFromLegacyBehavior
} from "./slotTracker.service";
import { formatHistory } from "../utils/formatHistory";
import { shouldForceGroupDiscussion } from "../utils/groupDiscussionTrigger";
import { stringifyJson } from "../utils/jsonField";
import { createRequestId, log } from "../utils/logger";

// ── Types ──────────────────────────────────────────────

type RuntimeScenario = Omit<Scenario, "groupChatRounds" | "openingMessageJson" | "initialBlackboardJson"> & {
  groupChatRounds: number[];
};

interface RuntimeSession {
  id: string;
  scenarioId: string;
  status: string;
  round: number;
  nickname?: string;
  blackboardState: Blackboard;
  reportJson?: Record<string, unknown> | null;
  groupChatSummary?: Record<string, unknown> | null;
}

interface RunAssessmentTurnParams {
  session: RuntimeSession;
  scenario: RuntimeScenario;
  messages: Message[];
  userMessage: string;
}

interface RunAssessmentTurnResult {
  finished: boolean;
  reply: VisibleReply;
  round: number;
  phase: string;
  report?: unknown;
  blackboard: Blackboard;
}

// ── Helpers ────────────────────────────────────────────

function asAgentName(value: unknown): AgentName {
  return value === "coworker" || value === "client" || value === "leader" ? value : "leader";
}

function messageOrder(a: Message, b: Message): number {
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function shouldFinishByControl(blackboard: Blackboard): boolean {
  const reachedMinimumRounds = blackboard.round >= (blackboard.min_round ?? 8);
  const directorWantsFinish = Boolean(blackboard.conversation_control.should_finish);
  const maxReached = blackboard.round >= blackboard.max_round;
  const coverageStatus = summarizeCoverage(blackboard.coverage_state);

  return maxReached || (reachedMinimumRounds && directorWantsFinish && coverageStatus.complete);
}

// ── Agent selection ────────────────────────────────────

function diversifyAgentSelection(requestedAgent: AgentName, blackboard: Blackboard): AgentName {
  if (requestedAgent !== "leader") return requestedAgent;

  const lastAgent = blackboard.conversation_control.last_active_agent;
  const needsLeaderEscalation =
    blackboard.latest_user_behavior.over_promise || blackboard.latest_user_behavior.unsupported_assumption;

  if (blackboard.round < 1 || lastAgent !== "leader" || needsLeaderEscalation) {
    return requestedAgent;
  }

  return blackboard.user_progress.handled_coworker_conflict ? "client" : "coworker";
}

export function buildFallbackNpcInstruction(activeAgent: AgentName, blackboard: Blackboard): string {
  const profile = blackboard.scenario_facts.agent_profiles[activeAgent];
  const previousAgent = asAgentName(blackboard.conversation_control.last_active_agent);
  const previousProfile = blackboard.scenario_facts.agent_profiles[previousAgent];

  if (activeAgent === "leader") {
    return `由${profile.name}以${profile.role}身份追问用户的判断依据、承诺边界和下一步。不替用户做计划，也不提示标准答案。`;
  }

  return `避免继续由${previousProfile.name}追问。本轮让${profile.name}以${profile.role}身份从自身处境切入，追问用户如何处理边界、责任或预期。不替用户做计划，也不提示标准答案。`;
}

export function resolveGroupDiscussionCorrection(result: GroupDiscussionResult): {
  changed: boolean;
  nextAgent?: AgentName;
  instruction?: string;
  blackboardPatch?: Record<string, unknown>;
} {
  if (result.no_change) return { changed: false };

  if (result.correction) {
    return {
      changed: true,
      nextAgent: result.correction.next_agent,
      instruction: result.correction.instruction,
      blackboardPatch: result.correction.blackboard_patch
    };
  }

  if (result.director_decision || result.blackboard_patch) {
    return {
      changed: true,
      nextAgent: result.director_decision?.next_agent,
      instruction: result.director_decision?.instruction,
      blackboardPatch: result.blackboard_patch
    };
  }

  return { changed: false };
}

async function callSelectedNpc(params: {
  activeAgent: AgentName;
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
  npcInstruction: string;
}): Promise<NpcResult> {
  if (params.activeAgent === "coworker") return callCoworkerAgent(params);
  if (params.activeAgent === "client") return callClientAgent(params);
  return callLeaderAgent(params);
}

// ── Pipeline stages ────────────────────────────────────

async function prepareTurn(
  session: RuntimeSession,
  messages: Message[],
  userMessage: string
) {
  const userRound = session.blackboardState.round;

  const savedUserMessage = await prisma.message.create({
    data: {
      sessionId: session.id,
      senderType: "user",
      senderName: session.nickname || "用户",
      senderRole: "受试者",
      content: userMessage,
      roundIndex: userRound
    }
  });

  const historyMessages = [...messages, savedUserMessage].sort(messageOrder);
  const historyText = formatHistory(historyMessages);

  return { userRound, savedUserMessage, historyMessages, historyText };
}

async function runDirectorChain(
  blackboard: Blackboard,
  historyText: string,
  userMessage: string,
  sessionId: string,
  turnId: string
) {
  const directorView = buildDirectorView(blackboard);
  const directorResult = await callDirectorAgent({
    blackboard: directorView,
    chatHistory: historyText,
    userMessage
  });
  log("info", "Director Agent finished", {
    turnId,
    sessionId,
    activeAgent: directorResult.active_agent,
    phase: directorResult.phase,
    pressureLevel: directorResult.pressure_level,
    triggerGroupDiscussion: Boolean(directorResult.trigger_group_discussion),
    shouldFinish: Boolean(directorResult.should_finish)
  });

  blackboard = mergeBlackboard(blackboard, directorResult.updated_blackboard_patch);
  blackboard = applyDetectedBehavior(blackboard, directorResult.detected_behavior);
  const scenarioId = inferScenarioIdFromBlackboard(blackboard);
  const coverageAfterDimensionEvidence = updateCoverageFromDimensionEvidence(
    blackboard.coverage_state,
    scenarioId,
    directorResult.dimension_evidence,
    blackboard.round + 1
  );
  blackboard = mergeBlackboard(blackboard, {
    coverage_state: updateCoverageFromLegacyBehavior(
      coverageAfterDimensionEvidence,
      scenarioId,
      directorResult.detected_behavior,
      blackboard.round + 1,
      userMessage
    )
  });
  blackboard = mergeBlackboard(blackboard, {
    phase: directorResult.phase,
    pressure_level: directorResult.pressure_level,
    current_focus: directorResult.current_focus,
    conversation_control: {
      suggested_next_agent: directorResult.active_agent,
      trigger_group_discussion: Boolean(directorResult.trigger_group_discussion),
      should_finish: Boolean(directorResult.should_finish),
      finish_reason: directorResult.finish_reason ?? ""
    }
  });

  return { blackboard, directorResult };
}

async function runGroupDiscussionIfNeeded(
  blackboard: Blackboard,
  directorResult: Awaited<ReturnType<typeof runDirectorChain>>["directorResult"],
  scenario: RuntimeScenario,
  historyText: string,
  sessionId: string,
  turnId: string
) {
  const nextRound = blackboard.round + 1;
  const forcedGroupDiscussion = shouldForceGroupDiscussion(blackboard);
  const shouldRun =
    scenario.groupChatEnabled && (Boolean(directorResult.trigger_group_discussion) || forcedGroupDiscussion);

  let activeAgent = asAgentName(directorResult.active_agent);
  let npcInstruction = directorResult.npc_instruction;

  if (!shouldRun) {
    return { blackboard, activeAgent, npcInstruction };
  }

  log("info", "Calling Group Discussion Agent", {
    turnId, sessionId, round: nextRound,
    directorTriggered: Boolean(directorResult.trigger_group_discussion),
    forcedGroupDiscussion
  });

  const directorProposal = {
    active_agent: directorResult.active_agent,
    current_focus: directorResult.current_focus,
    npc_instruction: directorResult.npc_instruction,
    phase: directorResult.phase
  };
  const groupView = buildGroupDiscussionView(blackboard);

  const groupResult = await callGroupDiscussionAgent({
    blackboard: groupView,
    chatHistory: historyText,
    round: nextRound,
    directorProposal
  });

  const groupCorrection = resolveGroupDiscussionCorrection(groupResult);
  log("info", "Group Discussion Agent finished", {
    turnId, sessionId,
    noChange: Boolean(groupResult.no_change),
    changed: groupCorrection.changed,
    nextAgent: groupCorrection.nextAgent
  });

  try {
    await prisma.agentGroupDiscussion.create({
      data: {
        sessionId,
        roundIndex: nextRound,
        phase: directorResult.phase || "group_check",
        inputJson: stringifyJson({ blackboard: groupView, history: historyText, directorProposal }),
        outputJson: stringifyJson(groupResult)
      }
    });
  } catch (gdError) {
    log("warn", "Failed to persist Group Discussion record; continuing without it", { gdError });
  }

  blackboard = addGroupSummary(blackboard, nextRound, groupResult as Record<string, unknown>);

  if (groupCorrection.changed) {
    blackboard = mergeBlackboard(blackboard, groupCorrection.blackboardPatch);
    activeAgent = asAgentName(groupCorrection.nextAgent ?? activeAgent);
    npcInstruction = groupCorrection.instruction ?? npcInstruction;
    blackboard = mergeBlackboard(blackboard, {
      conversation_control: {
        suggested_next_agent: activeAgent,
        trigger_group_discussion: true
      }
    });
  }

  return { blackboard, activeAgent, npcInstruction };
}

async function runNpcTurn(
  blackboard: Blackboard,
  activeAgent: AgentName,
  npcInstruction: string,
  historyText: string,
  userMessage: string,
  sessionId: string,
  turnId: string
) {
  // Diversify agent selection
  const requestedAgent = activeAgent;
  activeAgent = diversifyAgentSelection(activeAgent, blackboard);
  if (activeAgent !== requestedAgent) {
    npcInstruction = buildFallbackNpcInstruction(activeAgent, blackboard);
    log("info", "Adjusted NPC agent to avoid leader overuse", {
      turnId, sessionId, requestedAgent, adjustedAgent: activeAgent,
      lastActiveAgent: blackboard.conversation_control.last_active_agent
    });
  }

  blackboard = mergeBlackboard(blackboard, {
    conversation_control: {
      last_active_agent: activeAgent,
      suggested_next_agent: activeAgent
    }
  });

  log("info", "Calling NPC Agent", { turnId, sessionId, activeAgent });
  const npcView = buildNpcView(blackboard, activeAgent, npcInstruction);

  const npcResult = await callSelectedNpc({
    activeAgent, blackboard: npcView, chatHistory: historyText, userMessage, npcInstruction
  });

  if (!npcResult.visible_reply?.content) {
    throw new Error("NPC Agent response is missing visible_reply.content");
  }

  log("info", "NPC Agent finished", {
    turnId, sessionId,
    speaker: npcResult.visible_reply.speaker,
    replyChars: npcResult.visible_reply.content.length
  });

  return { blackboard, activeAgent, npcResult };
}

async function persistTurn(
  sessionId: string,
  blackboard: Blackboard,
  npcResult: NpcResult,
  historyMessages: Message[],
  nextRound: number
) {
  const savedNpcMessage = await prisma.message.create({
    data: {
      sessionId,
      senderType: "agent",
      senderName: npcResult.visible_reply.speaker,
      senderRole: npcResult.visible_reply.role,
      content: npcResult.visible_reply.content,
      roundIndex: nextRound
    }
  });

  blackboard = mergeNpcMemory(blackboard, npcResult.memory_update);
  blackboard.round = nextRound;

  const fullHistory = formatHistory([...historyMessages, savedNpcMessage].sort(messageOrder));

  return { blackboard, fullHistory };
}

async function finishWithJudge(
  blackboard: Blackboard,
  fullHistory: string,
  session: RuntimeSession,
  directorPhase: string,
  npcReply: VisibleReply,
  turnId: string,
  onReportProgress?: (progress: JudgeProgressEvent) => void
): Promise<RunAssessmentTurnResult> {
  const reportStartedAt = Date.now();
  const emitReportProgress = (progress: Omit<JudgeProgressEvent, "elapsedMs"> & { elapsedMs?: number }) => {
    onReportProgress?.({
      ...progress,
      elapsedMs: progress.elapsedMs ?? Date.now() - reportStartedAt
    });
  };

  emitReportProgress({
    stage: "preparing",
    percent: 5,
    message: "正在整理对话记录、行为证据和 Judge view。"
  });

  log("info", "Calling Judge Agent", {
    turnId, sessionId: session.id,
    historyChars: fullHistory.length,
    finishReason: blackboard.round >= blackboard.max_round
      ? "max_round_reached"
      : blackboard.conversation_control.finish_reason
  });

  const { report, samplingStats } = await callJudgeAgent({
    blackboard: buildJudgeView(blackboard),
    chatHistory: fullHistory,
    groupSummary: blackboard.group_discussion_summary
  }, emitReportProgress);

  log("info", "Judge Agent finished", {
    turnId, sessionId: session.id,
    totalScore: report.total_score,
    samplingVariance: samplingStats.variance,
    samplingScores: samplingStats.scores
  });

  const coverageStatus = summarizeCoverage(blackboard.coverage_state);
  const judgedReport =
    report.report_status === "confident" && !coverageStatus.complete
      ? {
          ...report,
          report_status: "provisional" as const,
          human_review_required: true,
          human_review_reason: report.human_review_reason
            ? `${report.human_review_reason}；测评槽位覆盖不足，报告仅作观察反馈。`
            : "测评槽位覆盖不足，报告仅作观察反馈。"
        }
      : report;

  const reportWithMeta = {
    ...judgedReport,
    coverage_status: coverageStatus,
    sampling_stats: {
      scores: samplingStats.scores,
      variance: Math.round(samplingStats.variance * 100) / 100,
      dim_variances: samplingStats.dimVariances
    }
  };
  const formalTotalScore =
    reportWithMeta.mock_generated || reportWithMeta.report_status !== "confident"
      ? null
      : Math.round(reportWithMeta.total_score);

  emitReportProgress({
    stage: "saving",
    percent: 94,
    message: "正在保存报告并准备跳转。"
  });

  await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      status: "finished",
      round: blackboard.round,
      blackboardState: stringifyJson(blackboard),
      groupChatSummary: stringifyJson(blackboard.group_discussion_summary),
      totalScore: formalTotalScore,
      reportJson: stringifyJson(reportWithMeta),
      endedAt: new Date()
    }
  });

  emitReportProgress({
    stage: "done",
    percent: 100,
    message: "行为观察报告已生成。"
  });

  return {
    finished: true,
    reply: npcReply,
    round: blackboard.round,
    phase: directorPhase,
    report: reportWithMeta,
    blackboard
  };
}

function createUnratableReport(blackboard: Blackboard, gate: ResponseQualityGate): JudgeReport {
  const dimensions = blackboard.scenario_facts.capability_dimensions;
  const dimensionScores = Object.fromEntries(dimensions.map((dimension) => [dimension, 0]));
  const dimensionAnalysis = Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      "用户连续回复缺少可观察判断、取舍或行动信息，本轮测评无法形成有效维度评分。"
    ])
  );
  const coverageStatus = summarizeCoverage(blackboard.coverage_state);
  const quotedTurns = gate.lowInformationTurns.map((turn) => turn.content.trim()).filter(Boolean);

  return {
    total_score: 0,
    level: "无法评分",
    dimension_scores: dimensionScores,
    dimension_analysis: dimensionAnalysis,
    conflict_style: "无法判断",
    summary: "本次测评因连续低信息回复被提前收束。系统没有调用 Judge 生成正式分数。",
    strengths: [],
    risks: ["连续回复缺少可观察行为证据，无法判断管理情境下的真实能力表现。"],
    suggestions: ["重新测评时，请用完整句说明你的判断依据、取舍、边界和下一步动作。"],
    evidence: quotedTurns.length
      ? quotedTurns.map((quote) => ({
          dimension: "作答有效性",
          quote,
          analysis: "该回复无法提供足够的测评证据。"
        }))
      : [{
          dimension: "作答有效性",
          quote: "连续低信息回复",
          analysis: "该回复无法提供足够的测评证据。"
        }],
    radar_chart_data: dimensions.map((dimension) => ({ name: dimension, score: 0, max: 20 })),
    final_recommendation: "建议重新开始一次有效作答。本次结果不能用于正式评价或比较。",
    human_review_required: true,
    human_review_reason: gate.reason === "explicit_withdrawal"
      ? "用户明确表达退出或停止测评。"
      : `用户连续 ${gate.consecutiveLowInformation} 次低信息回复，测评证据不足。`,
    mock_generated: false,
    report_status: "unratable",
    coverage_status: coverageStatus
  };
}

async function finishAsUnratable(
  blackboard: Blackboard,
  session: RuntimeSession,
  gate: ResponseQualityGate,
  turnId: string
): Promise<RunAssessmentTurnResult> {
  const reply: VisibleReply = {
    speaker: "系统",
    role: "测评控制",
    content: gate.reason === "explicit_withdrawal"
      ? "你已结束本次测评。本次不会生成正式分数。"
      : "连续几轮回复缺少可观察判断，本次测评无法继续形成有效评分，系统已提前收束。"
  };
  const endedRound = blackboard.round + 1;
  const finishedBlackboard = mergeBlackboard(blackboard, {
    conversation_control: {
      should_finish: true,
      finish_reason: gate.reason
    }
  });
  finishedBlackboard.round = endedRound;
  const report = createUnratableReport(finishedBlackboard, gate);

  await prisma.message.create({
    data: {
      sessionId: session.id,
      senderType: "agent",
      senderName: reply.speaker,
      senderRole: reply.role,
      content: reply.content,
      roundIndex: endedRound
    }
  });

  await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      status: "finished",
      round: endedRound,
      blackboardState: stringifyJson(finishedBlackboard),
      groupChatSummary: stringifyJson(finishedBlackboard.group_discussion_summary),
      totalScore: null,
      reportJson: stringifyJson(report),
      endedAt: new Date()
    }
  });

  log("info", "Assessment finished as unratable", {
    turnId,
    sessionId: session.id,
    reason: gate.reason,
    consecutiveLowInformation: gate.consecutiveLowInformation
  });

  return {
    finished: true,
    reply,
    round: endedRound,
    phase: finishedBlackboard.phase,
    report,
    blackboard: finishedBlackboard
  };
}

// ── Main orchestrator ──────────────────────────────────

export async function runAssessmentTurn({
  session,
  scenario,
  messages,
  userMessage
}: RunAssessmentTurnParams): Promise<RunAssessmentTurnResult> {
  const turnId = createRequestId("turn");
  const startedAt = Date.now();

  log("info", "Assessment turn started", {
    turnId, sessionId: session.id, round: session.blackboardState.round, userMessageChars: userMessage.length
  });

  if (session.status !== "running") {
    throw new Error("This assessment session has already finished");
  }

  // 1. Save user message and build history
  const { historyText, historyMessages } = await prepareTurn(session, messages, userMessage);

  const responseQuality = evaluateResponseQuality(messages, userMessage);
  if (responseQuality.shouldTerminate) {
    return finishAsUnratable(session.blackboardState, session, responseQuality, turnId);
  }

  log("info", "Calling Director Agent", { turnId, sessionId: session.id, historyChars: historyText.length });

  // 2. Director (single merged call)
  const { blackboard: bbAfterDirector, directorResult } = await runDirectorChain(
    session.blackboardState, historyText, userMessage, session.id, turnId
  );

  // 3. Group discussion (conditional)
  const { blackboard: bbAfterGroup, activeAgent: agentAfterGroup, npcInstruction: instrAfterGroup } =
    await runGroupDiscussionIfNeeded(bbAfterDirector, directorResult, scenario, historyText, session.id, turnId);

  // 4. NPC turn
  const { blackboard: bbAfterNpc, npcResult } = await runNpcTurn(
    bbAfterGroup, agentAfterGroup, instrAfterGroup, historyText, userMessage, session.id, turnId
  );

  // 5. Persist NPC message and compute finish status
  const nextRound = bbAfterNpc.round + 1;
  const { blackboard, fullHistory } = await persistTurn(session.id, bbAfterNpc, npcResult, historyMessages, nextRound);

  const finished = shouldFinishByControl(blackboard);

  // 6. Finish with Judge or continue
  if (finished) {
    return finishWithJudge(blackboard, fullHistory, session, directorResult.phase, npcResult.visible_reply, turnId);
  }

  await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      round: blackboard.round,
      blackboardState: stringifyJson(blackboard),
      groupChatSummary: stringifyJson(blackboard.group_discussion_summary)
    }
  });

  log("info", "Assessment turn finished", {
    turnId, sessionId: session.id, round: blackboard.round, durationMs: Date.now() - startedAt
  });

  return {
    finished: false,
    reply: npcResult.visible_reply,
    round: blackboard.round,
    phase: directorResult.phase,
    blackboard
  };
}

// ── Streaming orchestrator ─────────────────────────────

export interface StreamingTurnEvents {
  onSpeaker: (speaker: string, role: string) => void;
  onToken: (token: string) => void;
  onJudging?: () => void;
  onReportProgress?: (progress: JudgeProgressEvent) => void;
  onDone: (result: RunAssessmentTurnResult) => void;
  onError: (message: string) => void;
}

export async function runAssessmentTurnStreaming({
  session,
  scenario,
  messages,
  userMessage,
  events
}: RunAssessmentTurnParams & { events: StreamingTurnEvents }): Promise<void> {
  const turnId = createRequestId("turn");
  const startedAt = Date.now();

  log("info", "Assessment turn started (streaming)", {
    turnId, sessionId: session.id, round: session.blackboardState.round, userMessageChars: userMessage.length
  });

  try {
    if (session.status !== "running") {
      events.onError("This assessment session has already finished");
      return;
    }

    // 1. Prepare
    const { historyText, historyMessages } = await prepareTurn(session, messages, userMessage);

    const responseQuality = evaluateResponseQuality(messages, userMessage);
    if (responseQuality.shouldTerminate) {
      const result = await finishAsUnratable(session.blackboardState, session, responseQuality, turnId);
      events.onSpeaker(result.reply.speaker, result.reply.role);
      for (const char of result.reply.content) {
        events.onToken(char);
      }
      events.onDone(result);
      return;
    }

    log("info", "Calling Director Agent", { turnId, sessionId: session.id, historyChars: historyText.length });

    // 2. Director (single merged call)
    const { blackboard: bbAfterDirector, directorResult } = await runDirectorChain(
      session.blackboardState, historyText, userMessage, session.id, turnId
    );

    // 3. Select agent (diversification based on Director's decision)
    let activeAgent = asAgentName(directorResult.active_agent);
    let npcInstruction = directorResult.npc_instruction;
    const requestedAgent = activeAgent;
    activeAgent = diversifyAgentSelection(activeAgent, bbAfterDirector);
    if (activeAgent !== requestedAgent) {
      npcInstruction = buildFallbackNpcInstruction(activeAgent, bbAfterDirector);
      log("info", "Adjusted NPC agent to avoid leader overuse", {
        turnId, sessionId: session.id, requestedAgent, adjustedAgent: activeAgent
      });
    }

    let blackboard = mergeBlackboard(bbAfterDirector, {
      conversation_control: {
        last_active_agent: activeAgent,
        suggested_next_agent: activeAgent
      }
    });

    // 4. Hot path: start NPC streaming immediately — don't wait for GroupDisc
    // GroupDisc runs in background and its correction applies to the NEXT turn.
    const shouldRunGD =
      scenario.groupChatEnabled &&
      (Boolean(directorResult.trigger_group_discussion) || shouldForceGroupDiscussion(blackboard));

    let gdPromise: Promise<GroupDiscussionResult> | null = null;
    if (shouldRunGD) {
      const directorProposal = {
        active_agent: directorResult.active_agent,
        current_focus: directorResult.current_focus,
        npc_instruction: directorResult.npc_instruction,
        phase: directorResult.phase
      };
      const groupView = buildGroupDiscussionView(blackboard);

      gdPromise = callGroupDiscussionAgent({
        blackboard: groupView,
        chatHistory: historyText,
        round: blackboard.round + 1,
        directorProposal
      });
    }

    // 5. NPC streaming — hot path, user sees text as fast as possible
    log("info", "Calling NPC Agent (streaming)", { turnId, sessionId: session.id, activeAgent });
    const activeProfile = blackboard.scenario_facts.agent_profiles[activeAgent];
    events.onSpeaker(activeProfile.name, activeProfile.role);
    const npcView = buildNpcView(blackboard, activeAgent, npcInstruction);

    const npcResult = await callNpcAgentStreaming({
      agent: activeAgent,
      blackboard: npcView,
      chatHistory: historyText,
      userMessage,
      npcInstruction,
      onToken: events.onToken
    });

    if (!npcResult.visible_reply?.content) {
      events.onError("NPC Agent response is missing visible_reply.content");
      return;
    }

    log("info", "NPC Agent finished (streaming)", {
      turnId, sessionId: session.id,
      speaker: npcResult.visible_reply.speaker,
      replyChars: npcResult.visible_reply.content.length
    });

    // 6. Wait for background GroupDisc and apply correction to blackboard
    //    Correction affects the NEXT turn, not the current NPC reply.
    if (gdPromise) {
      try {
        const groupResult = await gdPromise;
        const groupCorrection = resolveGroupDiscussionCorrection(groupResult);
        log("info", "Group Discussion Agent finished (background)", {
          turnId, sessionId: session.id,
          noChange: Boolean(groupResult.no_change),
          changed: groupCorrection.changed,
          nextAgent: groupCorrection.nextAgent
        });

        try {
          const groupView = buildGroupDiscussionView(blackboard);
          await prisma.agentGroupDiscussion.create({
            data: {
              sessionId: session.id,
              roundIndex: blackboard.round + 1,
              phase: directorResult.phase || "group_check",
              inputJson: stringifyJson({
                blackboard: groupView,
                history: historyText,
                directorProposal: {
                  active_agent: directorResult.active_agent,
                  current_focus: directorResult.current_focus,
                  npc_instruction: directorResult.npc_instruction,
                  phase: directorResult.phase
                }
              }),
              outputJson: stringifyJson(groupResult)
            }
          });
        } catch (gdError) {
          log("warn", "Failed to persist Group Discussion record (streaming); continuing without it", { gdError });
        }

        blackboard = addGroupSummary(blackboard, blackboard.round + 1, groupResult as Record<string, unknown>);

        if (groupCorrection.changed) {
          blackboard = mergeBlackboard(blackboard, groupCorrection.blackboardPatch);
          blackboard = mergeBlackboard(blackboard, {
            conversation_control: {
              suggested_next_agent: groupCorrection.nextAgent ?? activeAgent,
              trigger_group_discussion: true
            }
          });
        }
      } catch (gdError) {
        log("warn", "Group Discussion failed in background; continuing without correction", { gdError });
      }
    }

    // 7. Persist and finish
    const nextRound = blackboard.round + 1;
    const { blackboard: finalBb, fullHistory } = await persistTurn(
      session.id, blackboard, npcResult, historyMessages, nextRound
    );

    const finished = shouldFinishByControl(finalBb);

    if (finished) {
      events.onJudging?.();
      const result = await finishWithJudge(
        finalBb,
        fullHistory,
        session,
        directorResult.phase,
        npcResult.visible_reply,
        turnId,
        events.onReportProgress
      );
      events.onDone(result);
      return;
    }

    await prisma.assessmentSession.update({
      where: { id: session.id },
      data: {
        round: finalBb.round,
        blackboardState: stringifyJson(finalBb),
        groupChatSummary: stringifyJson(finalBb.group_discussion_summary)
      }
    });

    log("info", "Assessment turn finished (streaming)", {
      turnId, sessionId: session.id, round: finalBb.round, durationMs: Date.now() - startedAt
    });

    events.onDone({
      finished: false,
      reply: npcResult.visible_reply,
      round: finalBb.round,
      phase: directorResult.phase,
      blackboard: finalBb
    });
  } catch (error) {
    log("error", "Assessment turn streaming failed", { turnId, error });
    events.onError(error instanceof Error ? error.message : "Internal error");
  }
}
