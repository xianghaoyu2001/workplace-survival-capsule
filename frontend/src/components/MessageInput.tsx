import { type FormEvent, useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit: (content: string) => Promise<void>;
  timeRemaining: number;
  timeWarning: boolean;
}

const TURN_TIME_LIMIT = 240;

export function MessageInput({ disabled, onSubmit, timeRemaining, timeWarning }: Props) {
  const [content, setContent] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent || disabled) return;
    setContent("");
    await onSubmit(cleanContent);
  }

  const barPercent = Math.round((timeRemaining / TURN_TIME_LIMIT) * 100);
  // Green (hue 120) → yellow → red (hue 0) based on remaining time
  const hue = (barPercent / 100) * 120;
  const timerColor = `hsl(${hue}, 65%, 44%)`;

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <div className="message-input-field">
        <textarea
          value={content}
          disabled={disabled}
          onChange={(event) => setContent(event.target.value)}
          aria-label="输入本轮测评回应"
          placeholder="输入你的回应。说明你先处理什么、怎么沟通、边界在哪、依据是什么。"
        />
        <div className="timer-bar">
          <div className="timer-bar-fill" style={{ width: `${barPercent}%`, background: timerColor }} />
        </div>
        <div className="timer-legend">
          <span>本轮剩余</span>
          <span className={timeWarning ? "timer-legend-warning" : ""}>
            {timeRemaining}s
          </span>
        </div>
      </div>
      <button disabled={disabled || !content.trim()} type="submit">
        发送
      </button>
    </form>
  );
}


