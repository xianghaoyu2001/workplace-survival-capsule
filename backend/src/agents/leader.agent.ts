import { callNpcAgent } from "./npc.agent";

export function callLeaderAgent(params: {
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
  npcInstruction: string;
}) {
  return callNpcAgent({ ...params, agent: "leader" });
}

