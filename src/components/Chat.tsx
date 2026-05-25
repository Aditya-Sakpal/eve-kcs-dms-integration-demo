import { useEffect, useRef, useState } from "react";
import { streamChat } from "../api/agent";
import type { AuthSession, ChatPayloadDefaults, Message } from "../types";
import { StreamMessage } from "./StreamMessage";

interface Props {
  session: AuthSession;
  defaults: ChatPayloadDefaults;
  onDefaultsChange: (d: ChatPayloadDefaults) => void;
  sessionId: string;
  onNewSession: () => void;
  pendingPrompt: string;
  onPromptConsumed: () => void;
}

export function Chat({
  session,
  defaults,
  onDefaultsChange,
  sessionId,
  onNewSession,
  pendingPrompt,
  onPromptConsumed,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // External "sample question" picks land in pendingPrompt.
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      onPromptConsumed();
    }
  }, [pendingPrompt, onPromptConsumed]);

  // Autoscroll on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      toolCalls: [],
      isStreaming: false,
    };
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      toolCalls: [],
      isStreaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    // Tracks open tool turns by name so we can attach args/result to the right one.
    // Simple FIFO is enough — the agent rarely runs two of the same tool concurrently
    // in a turn.
    const openByName = new Map<string, number>(); // tool name -> index in toolCalls

    await streamChat({
      session,
      sessionId,
      message: text,
      defaults,
      signal: controller.signal,
      onEvent: (ev) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === assistantMsg.id);
          if (idx === -1) return prev;
          const next = [...prev];
          const cur = { ...next[idx] };
          cur.toolCalls = [...cur.toolCalls];

          switch (ev.kind) {
            case "text":
              cur.content = cur.content + ev.delta;
              break;
            case "tool_call_start":
              cur.toolCalls.push({ toolName: ev.toolName });
              openByName.set(ev.toolName, cur.toolCalls.length - 1);
              break;
            case "tool_call_args": {
              const openIdx = lastOpenIndex(cur.toolCalls);
              if (openIdx !== -1) {
                cur.toolCalls[openIdx] = { ...cur.toolCalls[openIdx], args: ev.args };
              }
              break;
            }
            case "tool_call_result": {
              const openIdx = lastUnresolvedIndex(cur.toolCalls);
              if (openIdx !== -1) {
                cur.toolCalls[openIdx] = { ...cur.toolCalls[openIdx], result: ev.result };
              }
              break;
            }
            case "done":
              cur.isStreaming = false;
              cur.finishReason = ev.finishReason;
              break;
            case "error":
              cur.isStreaming = false;
              cur.error = ev.error;
              break;
          }

          next[idx] = cur;
          return next;
        });
      },
    }).catch((err) => {
      if (controller.signal.aborted) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === assistantMsg.id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          isStreaming: false,
          error: err instanceof Error ? err.message : String(err),
        };
        return next;
      });
    });

    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === assistantMsg.id);
      if (idx === -1) return prev;
      const next = [...prev];
      if (next[idx].isStreaming) next[idx] = { ...next[idx], isStreaming: false };
      return next;
    });
    setSending(false);
    abortRef.current = null;
  }

  function cancel() {
    abortRef.current?.abort();
    setSending(false);
  }

  function newSession() {
    cancel();
    setMessages([]);
    setInput("");
    onNewSession();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">
      <DefaultsBar
        session={session}
        sessionId={sessionId}
        defaults={defaults}
        onDefaultsChange={onDefaultsChange}
        onNewSession={newSession}
        sending={sending}
      />

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            <div className="mb-2 font-semibold text-slate-700">Ready when you are</div>
            <div>
              Pick a sample question above, or type something like
              <span className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                what connections do we have?
              </span>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <StreamMessage key={m.id} msg={m} />
        ))}
      </div>

      <div className="border-t border-slate-200 bg-white px-5 py-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about your tenant — Enter sends, Shift+Enter adds a newline"
            rows={2}
            className="flex-1 resize-none rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={sending}
          />
          {sending ? (
            <button
              type="button"
              onClick={cancel}
              className="self-end rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!input.trim()}
              className="self-end rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DefaultsBar({
  session,
  sessionId,
  defaults,
  onDefaultsChange,
  onNewSession,
  sending,
}: {
  session: AuthSession;
  sessionId: string;
  defaults: ChatPayloadDefaults;
  onDefaultsChange: (d: ChatPayloadDefaults) => void;
  onNewSession: () => void;
  sending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-5 py-2 text-xs text-slate-600">
      <Field label="tenant_id">
        <span className="font-mono">{session.tenantId}</span>
      </Field>
      <Field label="session_id">
        <span className="font-mono" title={sessionId}>
          {sessionId.slice(0, 8)}…
        </span>
      </Field>
      <Field label="max_loops">
        <input
          type="number"
          min={1}
          max={20}
          value={defaults.maxLoops}
          onChange={(e) =>
            onDefaultsChange({ ...defaults, maxLoops: clamp(+e.target.value, 1, 20) })
          }
          className="w-14 rounded border border-slate-300 px-1.5 py-0.5 font-mono"
        />
      </Field>
      <Field label="max_tokens">
        <input
          type="number"
          min={100}
          max={8000}
          step={100}
          value={defaults.maxTokens}
          onChange={(e) =>
            onDefaultsChange({ ...defaults, maxTokens: clamp(+e.target.value, 100, 8000) })
          }
          className="w-20 rounded border border-slate-300 px-1.5 py-0.5 font-mono"
        />
      </Field>
      <button
        type="button"
        onClick={onNewSession}
        disabled={sending}
        className="ml-auto rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50"
      >
        + New chat
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function lastOpenIndex(turns: { args?: unknown }[]): number {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].args === undefined) return i;
  return turns.length - 1;
}

function lastUnresolvedIndex(turns: { result?: unknown }[]): number {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].result === undefined) return i;
  return turns.length - 1;
}
