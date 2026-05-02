import { callNpcAgent } from "./npc.agent";

export function callClientAgent(params: {
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
  npcInstruction: string;
}) {
  return callNpcAgent({ ...params, agent: "client" });
}

