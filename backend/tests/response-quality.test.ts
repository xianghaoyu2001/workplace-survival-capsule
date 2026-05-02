import { describe, expect, it } from "vitest";
import type { Message } from "@prisma/client";
import { classifyUserReply, evaluateResponseQuality } from "../src/services/responseQuality.service";

function userMessage(content: string): Message {
  return {
    id: `msg_${content}`,
    sessionId: "session",
    senderType: "user",
    senderName: "用户",
    senderRole: "受试者",
    content,
    roundIndex: 1,
    createdAt: new Date()
  };
}

describe("response quality gate", () => {
  it("classifies numeric-only and explicit non-answers as low information", () => {
    expect(classifyUserReply("7")?.reason).toBe("numeric_or_punctuation_only");
    expect(classifyUserReply("不知道")?.reason).toBe("explicit_non_answer");
    expect(classifyUserReply("我会先确认事实，再说明风险和下一步。")).toBeNull();
  });

  it("terminates after three consecutive low-information user replies", () => {
    const gate = evaluateResponseQuality([userMessage("7"), userMessage("9")], "9");

    expect(gate.shouldTerminate).toBe(true);
    expect(gate.reason).toBe("consecutive_low_information_replies");
    expect(gate.consecutiveLowInformation).toBe(3);
  });

  it("terminates immediately when the user explicitly withdraws", () => {
    const gate = evaluateResponseQuality([], "我不测了，退出");

    expect(gate.shouldTerminate).toBe(true);
    expect(gate.reason).toBe("explicit_withdrawal");
  });
});
