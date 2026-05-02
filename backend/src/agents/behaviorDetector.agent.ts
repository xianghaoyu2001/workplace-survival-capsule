import { callDeepSeek } from "../services/llm.service";
import { getPromptContent } from "../services/prompt.service";
import type { BehaviorDetectionResult } from "../types/agent";
import { parseAgentJSON } from "../utils/parseAgentJSON";
import { renderTemplate } from "../utils/renderTemplate";

export async function callBehaviorDetectorAgent(params: {
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
}): Promise<BehaviorDetectionResult> {
  const detectorPrompt = await getPromptContent("behavior-detector");
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
    systemPrompt: detectorPrompt,
    userPrompt: input,
    model: process.env.DEEPSEEK_FAST_MODEL,
    temperature: 0.1,
    maxTokens: 1300,
    jsonMode: true,
    thinking: false,
    timeoutMs: 90000
  });

  return parseAgentJSON<BehaviorDetectionResult>(raw, detectorPrompt, input, "BehaviorDetector Agent");
}
