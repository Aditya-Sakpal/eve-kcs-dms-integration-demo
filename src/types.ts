export interface AuthSession {
  token: string;
  tenantId: string;
}

export interface ChatPayloadDefaults {
  maxLoops: number;
  maxTokens: number;
}

export type StreamEvent =
  | { kind: "text"; delta: string }
  | { kind: "tool_call_start"; toolName: string }
  | { kind: "tool_call_args"; args: unknown }
  | { kind: "tool_call_result"; result: unknown }
  | { kind: "done"; finishReason: string | null }
  | { kind: "error"; error: string };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolTurn[];
  isStreaming: boolean;
  error?: string;
  finishReason?: string | null;
}

export interface ToolTurn {
  toolName: string;
  args?: unknown;
  result?: unknown;
}

export interface DmsConnection {
  id: string;
  name: string;
  source_id?: string;
  destination_id?: string;
  status?: string;
  schedule?: string;
  update_method?: string;
  streams?: string[] | unknown;
}

export interface DmsSource {
  id: string;
  name: string;
  connector_type?: string;
  status?: string;
}

export interface DmsRun {
  id?: string;
  connection_id?: string;
  connection_name?: string;
  status?: string;
  started_at?: string;
  duration_ms?: number;
}

export interface DmsObjectStore {
  id?: string;
  name?: string;
  bucket?: string;
}

export interface TenantInventory {
  sources: DmsSource[];
  connections: DmsConnection[];
  runs: DmsRun[];
  objectStores: DmsObjectStore[];
  loadError?: string;
}
