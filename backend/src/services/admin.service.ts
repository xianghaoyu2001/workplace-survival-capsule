import { prisma } from "../db/prisma";
import {
  normalizeDiscussion,
  normalizeScenario,
  normalizeSession,
  parseJsonField,
  stringifyJson
} from "../utils/jsonField";

type ReportShape = {
  dimension_scores?: Record<string, number>;
};

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

export async function getDashboardData() {
  const [totalSessions, completedSessions, runningSessions, finishedSessions] = await Promise.all([
    prisma.assessmentSession.count(),
    prisma.assessmentSession.count({ where: { status: "finished" } }),
    prisma.assessmentSession.count({ where: { status: "running" } }),
    prisma.assessmentSession.findMany({
      where: { status: "finished" },
      select: { totalScore: true, reportJson: true }
    })
  ]);

  const reports = finishedSessions.map((session) =>
    parseJsonField<ReportShape | null>(session.reportJson, null)
  );
  // 动态聚合所有报告中的维度（兼容新旧评测体系）
  const allDimensionKeys = new Set<string>();
  for (const report of reports) {
    if (report?.dimension_scores) {
      for (const key of Object.keys(report.dimension_scores)) {
        allDimensionKeys.add(key);
      }
    }
  }
  const dimensions = [...allDimensionKeys];
  const averageDimensionScores: Record<string, number> = {};

  for (const dimension of dimensions) {
    averageDimensionScores[dimension] = average(
      reports
        .map((report) => report?.dimension_scores?.[dimension])
        .filter((score): score is number => typeof score === "number")
    );
  }

  return {
    total_sessions: totalSessions,
    completed_sessions: completedSessions,
    running_sessions: runningSessions,
    average_score: average(
      finishedSessions
        .map((session) => session.totalScore)
        .filter((score): score is number => typeof score === "number")
    ),
    average_dimension_scores: averageDimensionScores
  };
}

export async function listScenarios() {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { createdAt: "asc" }
  });
  return scenarios.map(normalizeScenario);
}

export async function updateScenario(id: string, data: Record<string, unknown>) {
  const allowed = {
    title: data.title,
    description: data.description,
    backgroundForUser: data.backgroundForUser,
    maxRound: data.maxRound,
    groupChatEnabled: data.groupChatEnabled,
    groupChatRounds: data.groupChatRounds === undefined ? undefined : stringifyJson(data.groupChatRounds),
    status: data.status
  };

  const scenario = await prisma.scenario.update({
    where: { id },
    data: Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined))
  });

  return normalizeScenario(scenario);
}

export async function listPrompts() {
  return prisma.promptTemplate.findMany({
    orderBy: [{ key: "asc" }, { version: "desc" }]
  });
}

export async function updatePrompt(key: string, data: { content?: string; name?: string; active?: boolean }) {
  const current = await prisma.promptTemplate.findUnique({ where: { key } });
  if (!current) {
    throw new Error("Prompt template not found");
  }

  return prisma.promptTemplate.update({
    where: { key },
    data: {
      name: data.name ?? current.name,
      content: data.content ?? current.content,
      active: data.active ?? current.active,
      version: { increment: data.content && data.content !== current.content ? 1 : 0 }
    }
  });
}

const ABANDONED_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function listSessions() {
  const sessions = await prisma.assessmentSession.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      user: true,
      scenario: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } }
    }
  });

  // Auto-abandon sessions that are "running" with no activity for > 30 minutes
  const now = Date.now();
  const abandonedIds: string[] = [];

  for (const session of sessions) {
    if (session.status !== "running") continue;
    const lastActivity =
      session.messages.length > 0
        ? new Date(session.messages[0].createdAt).getTime()
        : new Date(session.startedAt).getTime();
    if (now - lastActivity > ABANDONED_TIMEOUT_MS) {
      abandonedIds.push(session.id);
    }
  }

  if (abandonedIds.length > 0) {
    await prisma.assessmentSession.updateMany({
      where: { id: { in: abandonedIds } },
      data: { status: "abandoned", endedAt: new Date() }
    });
  }

  return sessions.map((session) => ({
    ...normalizeSession(session),
    status: abandonedIds.includes(session.id) ? "abandoned" : session.status,
    scenario: normalizeScenario(session.scenario)
  }));
}

export async function getSessionDetail(sessionId: string) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
      scenario: true,
      messages: { orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }] },
      groupDiscussions: { orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }] }
    }
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const normalizedSession = normalizeSession(session);

  return {
    session: {
      ...normalizedSession,
      scenario: normalizeScenario(session.scenario)
    },
    messages: session.messages,
    group_discussions: session.groupDiscussions.map(normalizeDiscussion),
    report: normalizedSession.reportJson
  };
}

