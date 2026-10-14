// packages/client-core/src/store/session.ts
// SolidJS reactive stores for Prumo session, timeline & metrics
import { createSignal, createMemo } from "solid-js";
import type { AgentEvent, RunStatus } from "../protocol/client";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  thinking?: string;
  isStreaming?: boolean;
  images?: string[];
  createdAt: number;
}

export interface SessionMetrics {
  promptTokens: number;
  completionTokens: number;
  cacheTokens: number;
  reasoningTokens: number;
  costUSD: number;
  contextWindow?: number;
}

export function createPrumoSessionStore() {
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [activeRunID, setActiveRunID] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<RunStatus | null>(null);
  const [metrics, setMetrics] = createSignal<SessionMetrics>({
    promptTokens: 0,
    completionTokens: 0,
    cacheTokens: 0,
    reasoningTokens: 0,
    costUSD: 0,
  });
  const [isBusy, setIsBusy] = createSignal(false);
  const [pendingApproval, setPendingApproval] = createSignal<{
    requestID: string;
    tool: string;
    arguments: Record<string, unknown>;
    fingerprint: string;
  } | null>(null);

  // Context gauge calculation (ctx: XX%)
  const contextPressure = createMemo(() => {
    const m = metrics();
    if (!m.contextWindow || m.contextWindow <= 0) return null;
    const total = m.promptTokens + m.completionTokens;
    const pct = Math.min(100, Math.round((total / m.contextWindow) * 100));
    return `${pct}%`;
  });

  function appendMessage(msg: Message) {
    setMessages((prev) => [...prev, msg]);
  }

  function appendThinking(delta: string) {
    setMessages((prev) => {
      if (prev.length === 0 || prev[prev.length - 1].role !== "assistant") {
        return [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: "",
            thinking: delta,
            isStreaming: true,
            createdAt: Date.now(),
          },
        ];
      }
      const last = { ...prev[prev.length - 1] };
      last.thinking = (last.thinking ?? "") + delta;
      return [...prev.slice(0, -1), last];
    });
  }

  function appendTextDelta(delta: string) {
    setMessages((prev) => {
      if (prev.length === 0 || prev[prev.length - 1].role !== "assistant") {
        return [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: delta,
            isStreaming: true,
            createdAt: Date.now(),
          },
        ];
      }
      const last = { ...prev[prev.length - 1] };
      last.content += delta;
      return [...prev.slice(0, -1), last];
    });
  }

  function handleEvent(ev: AgentEvent) {
    switch (ev.kind) {
      case "text_delta": {
        const text = String(ev.payload?.text ?? "");
        appendTextDelta(text);
        break;
      }
      case "reasoning_delta": {
        const text = String(ev.payload?.text ?? "");
        appendThinking(text);
        break;
      }
      case "tool_call": {
        const toolName = String(ev.payload?.tool ?? "tool");
        const toolArgs = JSON.stringify(ev.payload?.arguments ?? {});
        appendMessage({
          id: `tool-${Date.now()}`,
          role: "tool",
          content: `⚡ ${toolName}: ${toolArgs}`,
          createdAt: Date.now(),
        });
        break;
      }
      case "tool_result": {
        const output = String(ev.payload?.output ?? "");
        appendMessage({
          id: `tool-res-${Date.now()}`,
          role: "tool",
          content: output,
          createdAt: Date.now(),
        });
        break;
      }
      case "usage": {
        const p = ev.payload ?? {};
        setMetrics((prev) => ({
          promptTokens: prev.promptTokens + Number(p.prompt_tokens ?? 0),
          completionTokens: prev.completionTokens + Number(p.completion_tokens ?? 0),
          cacheTokens: prev.cacheTokens + Number(p.cache_tokens ?? 0),
          reasoningTokens: prev.reasoningTokens + Number(p.reasoning_tokens ?? 0),
          costUSD: prev.costUSD + Number(p.cost_usd ?? 0),
          contextWindow: prev.contextWindow,
        }));
        break;
      }
      case "permission_wait": {
        const p = ev.payload ?? {};
        setPendingApproval({
          requestID: String(p.request_id ?? ""),
          tool: String(p.tool ?? ""),
          arguments: (p.arguments as Record<string, unknown>) ?? {},
          fingerprint: String(p.fingerprint ?? ""),
        });
        break;
      }
      case "run.finished":
      case "run.completed":
      case "run.failed": {
        setIsBusy(false);
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
          }
          return prev;
        });
        break;
      }
    }
  }

  return {
    messages,
    activeRunID,
    setActiveRunID,
    status,
    setStatus,
    metrics,
    setMetrics,
    isBusy,
    setIsBusy,
    pendingApproval,
    setPendingApproval,
    contextPressure,
    appendMessage,
    handleEvent,
  };
}

export type PrumoSessionStore = ReturnType<typeof createPrumoSessionStore>;
