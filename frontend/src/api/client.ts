const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();
const apiBase = configuredApiBase ? configuredApiBase.replace(/\/$/, "") : "";

function createRequestId() {
  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const requestId = createRequestId();
  const startedAt = performance.now();
  const method = options.method ?? "GET";
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  const responseRequestId = response.headers.get("x-request-id") || data?.requestId || requestId;
  const durationMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    console.error("[api:error]", {
      requestId: responseRequestId,
      method,
      path,
      status: response.status,
      durationMs,
      data
    });
    throw new Error(`${data?.error ?? `HTTP ${response.status}`} (requestId: ${responseRequestId})`);
  }

  return data as T;
}
