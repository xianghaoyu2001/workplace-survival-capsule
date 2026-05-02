import { mockDeepSeekResponse } from "../services/mockLlm.service";
import { log } from "./logger";
import { safeParseJSON } from "./safeParseJSON";

export async function parseAgentJSON<T>(
  raw: string,
  systemPrompt: string,
  userPrompt: string,
  agentName: string
): Promise<T> {
  try {
    return safeParseJSON<T>(raw);
  } catch (error) {
    log("warn", `${agentName} returned invalid JSON; falling back to local mock agent`, {
      error,
      rawPreview: raw.slice(0, 1000)
    });
    const fallback = await mockDeepSeekResponse(systemPrompt, userPrompt);
    return safeParseJSON<T>(fallback);
  }
}
