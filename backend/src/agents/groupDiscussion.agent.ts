import { callDeepSeek } from "../services/llm.service";
import { getPromptContent } from "../services/prompt.service";
import type { GroupDiscussionResult } from "../types/agent";
import { parseAgentJSON } from "../utils/parseAgentJSON";
import { renderTemplate } from "../utils/renderTemplate";

export async function callGroupDiscussionAgent(params: {
  blackboard: unknown;
  chatHistory: string;
  round: number;
  directorProposal: {
    active_agent: string;
    current_focus: string;
    npc_instruction: string;
    phase: string;
  };
}): Promise<GroupDiscussionResult> {
  const groupPrompt = await getPromptContent("group-discussion");
  const input = renderTemplate(
    `
Round: {round}

Director proposal:
{director_proposal}

Blackboard:
{blackboard}

Chat history:
{chat_history}
`,
    {
      round: String(params.round),
      director_proposal: JSON.stringify(params.directorProposal, null, 2),
      blackboard: JSON.stringify(params.blackboard, null, 2),
      chat_history: params.chatHistory
    }
  );

  const raw = await callDeepSeek({
    systemPrompt: groupPrompt,
    userPrompt: input,
    model: process.env.DEEPSEEK_FAST_MODEL,
    temperature: 0.3,
    maxTokens: 1300,
    jsonMode: true,
    thinking: false,
    timeoutMs: 90000
  });

  return parseAgentJSON<GroupDiscussionResult>(raw, groupPrompt, input, "Group Discussion Agent");
}
