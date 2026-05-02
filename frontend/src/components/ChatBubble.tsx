import type { Message } from "../types/assessment";

export function ChatBubble({ message }: { message: Message }) {
  const isUser = message.senderType === "user";
  const isTyping = message.senderType === "typing";
  const avatar = isUser ? (message.senderName || "我").slice(0, 1) : message.senderName.slice(0, 1);

  return (
    <article className={`chat-bubble ${isUser ? "chat-bubble-user" : "chat-bubble-agent"} ${isTyping ? "chat-bubble-typing" : ""}`}>
      <div className="bubble-avatar">{avatar}</div>
      <div className="bubble-body">
        <div className="bubble-meta">
          <strong>{message.senderName}</strong>
          {message.senderRole ? <span>{message.senderRole}</span> : null}
        </div>
        {isTyping ? (
          <div className="typing-dots" aria-label="对方正在输入">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <p>{message.content}</p>
        )}
      </div>
    </article>
  );
}
