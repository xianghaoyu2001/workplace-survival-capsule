import { callDeepSeek } from "../services/llm.service";
import { getPromptContent } from "../services/prompt.service";
import type { BehaviorDetectionResult, StageDirectorResult } from "../types/agent";
import { parseAgentJSON } from "../utils/parseAgentJSON";
import { renderTemplate } from "../utils/renderTemplate";

export async function callStageDirectorAgent(params: {
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
  behaviorDetection: BehaviorDetectionResult;
}): Promise<StageDirectorResult> {
  const directorPrompt = await getPromptContent("stage-director");
  const input = renderTemplate(
    `
Behavior detection:
{behavior_detection}

Blackboard:
{blackboard}

Chat history:
{chat_history}

User reply:
{user_message}
`,
    {
      behavior_detection: JSON.stringify(params.behaviorDetection, null, 2),
      blackboard: JSON.stringify(params.blackboard, null, 2),
      chat_history: params.chatHistory,
      user_message: params.userMessage
    }
  );

  const raw = await callDeepSeek({
    systemPrompt: directorPrompt,
    userPrompt: input,
    model: process.env.DEEPSEEK_FAST_MODEL,
    temperature: 0.2,
    maxTokens: 1600,
    jsonMode: true,
    thinking: false,
    timeoutMs: 90000
  });

  return parseAgentJSON<StageDirectorResult>(raw, directorPrompt, input, "StageDirector Agent");
}
