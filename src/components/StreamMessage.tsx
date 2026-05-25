import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../types";

interface Props {
  msg: Message;
}

export function StreamMessage({ msg }: Props) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white text-slate-900 border border-slate-200"
        }`}
      >
        {!isUser && msg.toolCalls.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {msg.toolCalls.map((t, i) => (
              <ToolCallBox key={i} turn={t} />
            ))}
          </div>
        )}

        {isUser ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
        ) : msg.content ? (
          <div className="prose prose-sm max-w-none text-sm leading-relaxed prose-table:my-2 prose-th:py-1 prose-td:py-1 prose-thead:border-slate-300 prose-tr:border-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ) : msg.isStreaming ? (
          <div className="text-xs italic text-slate-400">thinking…</div>
        ) : null}

        {msg.isStreaming && msg.content && (
          <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-slate-400 align-middle" />
        )}

        {msg.error && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {msg.error}
          </div>
        )}

        {!isUser && msg.finishReason && msg.finishReason !== "stop" && (
          <div className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">
            finish reason: {msg.finishReason}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallBox({ turn }: { turn: { toolName: string; args?: unknown; result?: unknown } }) {
  const [expanded, setExpanded] = useState(false);
  const hasArgs = turn.args !== undefined;
  const hasResult = turn.result !== undefined;

  return (
    <div className="rounded border border-slate-200 bg-slate-50 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 hover:bg-slate-100"
      >
        <span className="font-mono font-semibold text-amber-700">🔧 {turn.toolName}</span>
        {hasResult ? (
          <span className="text-[10px] uppercase tracking-wide text-emerald-600">done</span>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-slate-400">running…</span>
        )}
        <span className="ml-auto text-slate-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-slate-200 px-2 py-2">
          {hasArgs && (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-500">args</div>
              <pre className="overflow-x-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
                {safeStringify(turn.args)}
              </pre>
            </div>
          )}
          {hasResult && (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-500">result</div>
              <pre className="overflow-x-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
                {safeStringify(turn.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
