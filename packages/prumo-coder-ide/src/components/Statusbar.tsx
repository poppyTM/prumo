// packages/prumo-coder-ide/src/components/Statusbar.tsx
import { GitBranch, Gauge, CurrencyDollar } from "phosphor-solid";
import type { SessionMetrics } from "@prumo/client-core";

export interface StatusbarProps {
  branch: string;
  model: string;
  contextPressure: string | null;
  metrics: SessionMetrics;
}

export function Statusbar(props: StatusbarProps) {
  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  return (
    <div style="height: var(--zed-statusbar-height); background: var(--zed-bg-surface); border-top: 1px solid var(--zed-border-subtle); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 11.5px; color: var(--zed-text-muted);">
      {/* Left: Git Branch */}
      <div style="display: flex; align-items: center; gap: 6px;">
        <GitBranch size={13} color="var(--zed-text-secondary)" />
        <span style="color: var(--zed-text-secondary);">{props.branch}</span>
      </div>

      {/* Right: Telemetry & Model */}
      <div style="display: flex; align-items: center; gap: 12px;">
        {props.contextPressure && (
          <span style="display: flex; align-items: center; gap: 4px; color: var(--zed-git-modified); font-weight: 500;">
            <Gauge size={13} />
            <span>ctx: {props.contextPressure}</span>
          </span>
        )}

        <span>
          in: {formatTokens(props.metrics.promptTokens)} · out: {formatTokens(props.metrics.completionTokens)}
        </span>

        <span style="display: flex; align-items: center; gap: 2px; color: var(--zed-git-added);">
          <CurrencyDollar size={13} />
          <span>${props.metrics.costUSD.toFixed(3)}</span>
        </span>

        <span style="color: var(--zed-text-accent); font-weight: 500;">
          {props.model}
        </span>
      </div>
    </div>
  );
}
