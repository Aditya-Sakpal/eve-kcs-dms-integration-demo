import type { AuthSession, ChatPayloadDefaults, StreamEvent } from "../types";

interface ChatArgs {
  session: AuthSession;
  sessionId: string;
  message: string;
  defaults: ChatPayloadDefaults;
  signal?: AbortSignal;
  onEvent: (event: StreamEvent) => void;
}

// Streams the agent's response line-by-line.
//
// The kcs/api/v1/agent/chat endpoint speaks an ad-hoc SSE-ish protocol where each line
// is `<code>:<json>` (see test-dms-mcp.ps1 Render-StreamLine for the same parsing).
//   0  text delta (string JSON)
//   b  tool start ({ toolName })
//   9  tool args ({ args })
//   a  tool result ({ result })
//   e  finish ({ finishReason })
//   2  agent_error (array of { type, error })
export async function streamChat({
  session,
  sessionId,
  message,
  defaults,
  signal,
  onEvent,
}: ChatArgs): Promise<void> {
  const resp = await fetch("/api/kcs/api/v1/agent/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      tenant_id: session.tenantId,
      max_loops: defaults.maxLoops,
      max_tokens: defaults.maxTokens,
    }),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    onEvent({
      kind: "error",
      error: `HTTP ${resp.status} ${resp.statusText}${text ? ` — ${text}` : ""}`,
    });
    return;
  }
  if (!resp.body) {
    onEvent({ kind: "error", error: "Response body was empty." });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const rawLine = buffer.slice(0, newlineIdx).trimEnd();
      buffer = buffer.slice(newlineIdx + 1);
      if (!rawLine) continue;

      const event = parseLine(rawLine);
      if (event) onEvent(event);
    }
  }

  // flush any trailing partial line
  if (buffer.trim()) {
    const event = parseLine(buffer.trim());
    if (event) onEvent(event);
  }
}

function parseLine(line: string): StreamEvent | null {
  if (line.length < 2 || line[1] !== ":") return null;
  const code = line[0];
  const payload = line.slice(2);

  try {
    switch (code) {
      case "0": {
        // Text delta — JSON-encoded string.
        const text = JSON.parse(payload);
        return typeof text === "string" ? { kind: "text", delta: text } : null;
      }
      case "b": {
        const data = JSON.parse(payload);
        return { kind: "tool_call_start", toolName: String(data.toolName ?? "<unknown>") };
      }
      case "9": {
        const data = JSON.parse(payload);
        return { kind: "tool_call_args", args: data.args };
      }
      case "a": {
        const data = JSON.parse(payload);
        return { kind: "tool_call_result", result: data.result };
      }
      case "e": {
        const data = JSON.parse(payload);
        return { kind: "done", finishReason: data.finishReason ?? null };
      }
      case "2": {
        const data = JSON.parse(payload);
        if (Array.isArray(data)) {
          for (const el of data) {
            if (el?.type === "agent_error" && typeof el.error === "string") {
              return { kind: "error", error: el.error };
            }
          }
        }
        return null;
      }
      default:
        return null;
    }
  } catch {
    // malformed line — ignore rather than crash
    return null;
  }
}
