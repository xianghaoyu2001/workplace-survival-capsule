import { useState } from "react";
import type { PromptTemplate } from "../../types/admin";

export function PromptEditor({
  prompt,
  onSave
}: {
  prompt: PromptTemplate;
  onSave: (key: string, data: { content: string; name: string; active: boolean }) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: prompt.name,
    content: prompt.content,
    active: prompt.active
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(prompt.key, draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="admin-card prompt-editor">
      <div className="prompt-editor-head">
        <div>
          <strong>{prompt.key}</strong>
          <span>v{prompt.version}</span>
        </div>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          />
          启用
        </label>
      </div>
      <label>
        名称
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </label>
      <label>
        内容
        <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
      </label>
      <button onClick={save} disabled={saving}>
        {saving ? "保存中" : "保存提示词"}
      </button>
    </article>
  );
}
