export interface HistoryMessage {
  senderName: string;
  content: string;
}

export function formatHistory(messages: HistoryMessage[]): string {
  return messages.map((message) => `${message.senderName}：${message.content}`).join("\n");
}

