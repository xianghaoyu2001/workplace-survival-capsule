import { type FormEvent, type ReactNode, useState } from "react";

function getStoredToken(): string {
  try {
    return sessionStorage.getItem("maat_admin_token") ?? "";
  } catch {
    return "";
  }
}

export function getAdminToken(): string {
  return getStoredToken();
}

export function AdminGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(getStoredToken);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (token) {
    return <>{children}</>;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    sessionStorage.setItem("maat_admin_token", trimmed);
    setToken(trimmed);
    setError(false);
  }

  return (
    <main className="page-shell" style={{ display: "grid", placeItems: "center", minHeight: "calc(100dvh - 120px)" }}>
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 400, padding: 32, display: "grid", gap: 16 }}>
        <div>
          <span className="section-label">Admin Access</span>
          <h2 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontSize: "1.3rem" }}>管理后台登录</h2>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.6, margin: 0 }}>
          请输入管理员密钥以访问后台。如果你还没有密钥，请联系系统管理员。
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          placeholder="管理员密钥"
          style={{ borderColor: error ? "var(--red)" : undefined }}
          autoFocus
        />
        {error ? <span style={{ color: "var(--red)", fontSize: "0.85rem" }}>请输入密钥</span> : null}
        <button type="submit" className="btn-primary" style={{ width: "100%" }}>
          进入后台
        </button>
      </form>
    </main>
  );
}
