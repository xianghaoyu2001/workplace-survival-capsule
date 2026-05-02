import type { Message } from "@prisma/client";

export interface LowInformationTurn {
  content: string;
  reason: string;
}

export interface ResponseQualityGate {
  shouldTerminate: boolean;
  reason: string;
  consecutiveLowInformation: number;
  lowInformationTurns: LowInformationTurn[];
}

const substringLowInformationPhrases = [
  "不知道",
  "不清楚",
  "不会",
  "没想好",
  "没思路",
  "看情况",
  "随便",
  "都行",
  "无所谓",
  "摆烂",
  "放弃",
  "算了",
  "不答",
  "不想答",
  "不知道怎么说"
];

const exactLowInformationPhrases = [
  "继续",
  "下一步",
  "跳过",
  "ok",
  "yes",
  "no",
  "idk"
];

function normalizeReply(content: string): string {
  return content.trim().replace(/\s+/g, " ").toLowerCase();
}

export function classifyUserReply(content: string): LowInformationTurn | null {
  const normalized = normalizeReply(content);

  if (!normalized) {
    return { content, reason: "empty_reply" };
  }

  if (/^[\d\s.,，。！？!?、-]+$/.test(normalized)) {
    return { content, reason: "numeric_or_punctuation_only" };
  }

  if (normalized.length <= 2) {
    return { content, reason: "too_short" };
  }

  if (
    exactLowInformationPhrases.includes(normalized) ||
    substringLowInformationPhrases.some((phrase) => normalized === phrase || normalized.includes(phrase))
  ) {
    return { content, reason: "explicit_non_answer" };
  }

  return null;
}

export function isExplicitWithdrawal(content: string): boolean {
  const normalized = normalizeReply(content);
  return [
    "退出",
    "结束",
    "不测了",
    "停止",
    "stop",
    "quit",
    "exit"
  ].some((phrase) => normalized === phrase || normalized.includes(phrase));
}

export function evaluateResponseQuality(messages: Message[], currentUserMessage: string): ResponseQualityGate {
  const userMessages = messages
    .filter((message) => message.senderType === "user")
    .map((message) => message.content);

  const latestTurns = [...userMessages, currentUserMessage];
  const lowInformationTurns: LowInformationTurn[] = [];
  let consecutiveLowInformation = 0;

  for (let index = latestTurns.length - 1; index >= 0; index -= 1) {
    const lowInfo = classifyUserReply(latestTurns[index]);
    if (!lowInfo) break;
    lowInformationTurns.unshift(lowInfo);
    consecutiveLowInformation += 1;
  }

  const explicitWithdrawal = isExplicitWithdrawal(currentUserMessage);
  const shouldTerminate = explicitWithdrawal || consecutiveLowInformation >= 3;

  return {
    shouldTerminate,
    reason: explicitWithdrawal ? "explicit_withdrawal" : shouldTerminate ? "consecutive_low_information_replies" : "",
    consecutiveLowInformation,
    lowInformationTurns
  };
}
