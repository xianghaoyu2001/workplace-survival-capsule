/**
 * Escape unescaped control characters (ASCII 0x00–0x1F) inside JSON
 * string literals. LLMs occasionally emit literal newlines or tabs
 * inside string values, which breaks JSON.parse.
 */
function sanitizeStringLiterals(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && code < 0x20) {
      if (code === 0x0a) result += "\\n";
      else if (code === 0x0d) result += "\\r";
      else if (code === 0x09) result += "\\t";
      else result += "\\u" + code.toString(16).padStart(4, "0");
      continue;
    }

    result += ch;
  }

  return result;
}

export function safeParseJSON<T = unknown>(text: string): T {
  if (!text || typeof text !== "string") {
    throw new Error("Model returned empty content");
  }

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  // Pass 1 — direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Pass 2 — extract outmost {…} or […]
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T;
      } catch {
        // fall through to repair
      }
    }

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch {
        // fall through to repair
      }
    }

    // Pass 3 — repair common LLM JSON quirks and retry
    const source = objectMatch?.[0] || arrayMatch?.[0] || cleaned;
    let repaired = sanitizeStringLiterals(source);
    repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

    try {
      return JSON.parse(repaired) as T;
    } catch {
      // Pass 4 — repair truncated JSON (max_tokens cutoff)
      const truncated = repairTruncatedJson(repaired);
      try {
        return JSON.parse(truncated) as T;
      } catch {
        throw new Error(`Unable to parse JSON: ${cleaned.slice(0, 500)}`);
      }
    }
  }
}

/**
 * Attempt to close unclosed strings, arrays, and objects caused by
 * token-limit truncation. Best-effort; callers must still try/catch.
 */
function repairTruncatedJson(text: string): string {
  let inString = false;
  let escaped = false;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === "[") bracketDepth++;
    else if (ch === "]") bracketDepth--;
  }

  let result = text;
  if (inString) result += '"';
  while (bracketDepth > 0) { result += "]"; bracketDepth--; }
  while (braceDepth > 0) { result += "}"; braceDepth--; }

  return result;
}

