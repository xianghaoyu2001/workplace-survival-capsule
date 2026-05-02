import type { GroupDiscussion } from "../../types/assessment";

export function GroupDiscussionPanel({ discussions }: { discussions: GroupDiscussion[] }) {
  if (!discussions.length) {
    return <p className="muted">暂无群聊记录。</p>;
  }

  return (
    <div className="group-panel">
      {discussions.map((discussion) => (
        <details key={discussion.id} className="discussion-item">
          <summary>
            第 {discussion.roundIndex} 轮 · {discussion.phase}
          </summary>
          <pre>{JSON.stringify(discussion.outputJson, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}
