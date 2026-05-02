import { callNpcAgent } from "./npc.agent";

export function callCoworkerAgent(params: {
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
  npcInstruction: string;
}) {
  return callNpcAgent({ ...params, agent: "coworker" });
}

