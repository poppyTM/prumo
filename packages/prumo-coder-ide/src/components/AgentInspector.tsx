// packages/prumo-coder-ide/src/components/AgentInspector.tsx
import { For, Show, createSignal } from "solid-js";
import { PaperPlaneTilt, Check, X, CaretDown, CaretRight } from "phosphor-solid";
import type { Message } from "@prumo/client-core";

export interface AgentInspectorProps {
  messages: Message[];
  isBusy: boolean;
  pendingApproval: {
    requestID: string;
    tool: string;
    arguments: Record<string, unknown>;
    fingerprint: string;
  } | null;
  onSendPrompt: (prompt: string) => void;
  onApprove: (requestID: string, fingerprint: string) => void;
  onDeny: (requestID: string, fingerprint: string) => void;
}

export function AgentInspector(props: AgentInspectorProps) {
  const [prompt, setPrompt] = createSignal("");
  const [showThinking, setShowThinking] = createSignal(false);

  function handleSubmit() {
    const text = prompt().trim();
    if (!text || props.isBusy) return;
    props.onSendPrompt(text);
    setPrompt("");
  }

  return (
    <div style="width: 320px; background: var(--zed-bg-surface); border-left: 1px solid var(--zed-border-subtle); display: flex; flex-direction: column; height: 100%;">
      {/* Header */}
      <div style="padding: 8px 12px; border-bottom: 1px solid var(--zed-border-subtle); font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--zed-text-muted); letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
        <span>Prumo Agent</span>
        <Show when={props.isBusy}>
          <span style="color: var(--zed-git-added); font-size: 10px;">Thinking...</span>
        </Show>
      </div>

      {/* Messages Timeline */}
      <div style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px;">
        <For each={props.messages}>
          {(msg) => (
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style={`font-size: 11px; font-weight: 600; color: ${msg.role === "user" ? "var(--zed-text-accent)" : "var(--zed-git-added)"};`}>
                {msg.role === "user" ? "You" : "Prumo Assistant"}
              </span>

              {/* Thinking accordion */}
              <Show when={msg.thinking}>
                <div style="border-left: 2px solid var(--zed-border-subtle); padding-left: 8px; margin: 4px 0;">
                  <button
                    onClick={() => setShowThinking(!showThinking())}
                    style="background: transparent; border: none; color: var(--zed-text-muted); font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer;"
                  >
                    {showThinking() ? <CaretDown size={12} /> : <CaretRight size={12} />}
                    <span>Reasoning Process</span>
                  </button>
                  <Show when={showThinking()}>
                    <div style="font-family: var(--zed-font-mono); font-size: 11px; color: var(--zed-text-muted); margin-top: 4px; white-space: pre-wrap;">
                      {msg.thinking}
                    </div>
                  </Show>
                </div>
              </Show>

              <div style="font-size: 12.5px; line-height: 1.4; color: var(--zed-text-primary); white-space: pre-wrap;">
                {msg.content}
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Pending Approval Gate */}
      <Show when={props.pendingApproval}>
        {(approval) => (
          <div style="margin: 8px; padding: 8px; border: 1px solid var(--zed-git-modified); border-radius: 4px; background: var(--zed-bg-app); display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 11px; font-weight: bold; color: var(--zed-git-modified);">
              Approval Required: {approval().tool}
            </div>
            <div style="font-family: var(--zed-font-mono); font-size: 10px; color: var(--zed-text-muted); max-height: 60px; overflow: hidden;">
              {JSON.stringify(approval().arguments)}
            </div>
            <div style="display: flex; gap: 6px; margin-top: 4px;">
              <button
                onClick={() => props.onApprove(approval().requestID, approval().fingerprint)}
                style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; background: var(--zed-git-added); color: #000; border: none; border-radius: 3px; padding: 4px; font-size: 11px; font-weight: bold; cursor: pointer;"
              >
                <Check size={12} weight="bold" /> Allow
              </button>
              <button
                onClick={() => props.onDeny(approval().requestID, approval().fingerprint)}
                style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; background: var(--zed-git-deleted); color: #fff; border: none; border-radius: 3px; padding: 4px; font-size: 11px; font-weight: bold; cursor: pointer;"
              >
                <X size={12} weight="bold" /> Deny
              </button>
            </div>
          </div>
        )}
      </Show>

      {/* Composer Input */}
      <div style="padding: 8px; border-top: 1px solid var(--zed-border-subtle); display: flex; gap: 6px;">
        <input
          type="text"
          value={prompt()}
          disabled={props.isBusy}
          placeholder="Ask or instruct agent..."
          style="flex: 1; background: var(--zed-bg-app); border: 1px solid var(--zed-border-subtle); border-radius: 4px; padding: 6px 8px; color: var(--zed-text-primary); font-size: 12px; outline: none;"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          onInput={(e) => setPrompt(e.currentTarget.value)}
        />
        <button
          onClick={handleSubmit}
          disabled={props.isBusy}
          style="background: var(--zed-bg-active); border: 1px solid var(--zed-border-subtle); border-radius: 4px; padding: 0 10px; color: var(--zed-text-accent); cursor: pointer;"
        >
          <PaperPlaneTilt size={14} />
        </button>
      </div>
    </div>
  );
}
