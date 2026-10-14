// packages/prumo-coder/src/ui/StatusLine.tsx
// High-density statusline with VU meters, telemetry, Git status, and Vim modes
import { createMemo } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { Glyph } from "../theme/glyphs";
import type { ThemePalette } from "../theme/palette";
import type { TabState } from "../state/tabs";

import { findModel } from "../models/catalog";

export interface StatusLineProps {
  palette: ThemePalette;
  tab: TabState;
  vimMode: "INSERT" | "NORMAL";
  leaderActive: boolean;
  copyNotice?: string;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function renderVuMeter(pct: number, length = 8): string {
  const filledCount = Math.round((Math.max(0, Math.min(100, pct)) / 100) * length);
  const emptyCount = length - filledCount;
  return Glyph.gaugeFilled.repeat(filledCount) + Glyph.gaugeEmpty.repeat(emptyCount);
}

export function StatusLine(props: StatusLineProps) {
  const providerIcon = createMemo(() => {
    switch (props.tab.provider.toLowerCase()) {
      case "anthropic":
        return Glyph.providerAnthropic;
      case "openai":
        return Glyph.providerOpenAI;
      case "gemini":
        return Glyph.providerGemini;
      default:
        return Glyph.providerLocal;
    }
  });

  const metrics = () => props.tab.session.metrics();

  const contextPercent = createMemo(() => {
    const m = metrics();
    if (!m.contextWindow || m.contextWindow <= 0) return 0;
    const total = m.promptTokens + m.completionTokens;
    return Math.min(100, Math.round((total / m.contextWindow) * 100));
  });

  const costDisplay = createMemo(() => {
    const cost = metrics().costUSD;
    if (cost <= 0) return "$0.000";
    return `$${cost.toFixed(3)}`;
  });

  return (
    <box
      id="statusline"
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={props.palette.panel}
      justifyContent="space-between"
      paddingLeft={1}
      paddingRight={1}
      flexShrink={0}
      borderStyle="single"
      borderColor={props.palette.border}
    >
      {/* Left: Vim mode, Leader chord, Provider, Model, Effort */}
      <box flexDirection="row" alignItems="center">
        {/* Vim Mode */}
        <text
          fg={props.vimMode === "NORMAL" ? props.palette.warning : props.palette.success}
          attributes={TextAttributes.BOLD}
        >
          {props.vimMode === "NORMAL" ? `${Glyph.vimNormal} ` : `${Glyph.vimInsert} `}
        </text>

        {/* Leader key chord */}
        {props.leaderActive && (
          <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
            {`${Glyph.leaderChord} `}
          </text>
        )}

        {/* Provider & Model */}
        <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
          {`${providerIcon()} ${props.tab.model} `}
        </text>

        {/* Reasoning Effort (Dynamic by model) */}
        {findModel(props.tab.model)?.supportsReasoning ? (
          <text fg={props.palette.warning}>
            {`[${Glyph.fire} ${props.tab.reasoningEffort.toUpperCase()}] `}
          </text>
        ) : (
          <text fg={props.palette.muted}>
            {`[${Glyph.fire} N/A] `}
          </text>
        )}
      </box>

      {/* Center: VU meter gauge & Telemetry */}
      <box flexDirection="row" alignItems="center">
        {/* Context VU Gauge */}
        <text fg={contextPercent() > 80 ? props.palette.error : props.palette.accent}>
          {`${Glyph.gaugeIcon} ${renderVuMeter(contextPercent(), 8)} ${contextPercent()}% `}
        </text>

        {/* Tokens telemetry */}
        <text fg={props.palette.muted}>
          {`▲${formatTokens(metrics().promptTokens)} ⚡${formatTokens(metrics().cacheTokens)} ▼${formatTokens(metrics().completionTokens)} `}
        </text>

        {metrics().reasoningTokens > 0 && (
          <text fg={props.palette.secondary}>
            {`🧠${formatTokens(metrics().reasoningTokens)} `}
          </text>
        )}

        {/* Cost */}
        <text fg={props.palette.success} attributes={TextAttributes.BOLD}>
          {`${Glyph.dollar} ${costDisplay()} `}
        </text>
      </box>

      {/* Right: Git Branch, Dirty state, and Status LED */}
      <box flexDirection="row" alignItems="center">
        <text fg={props.palette.accent}>
          {`${Glyph.gitBranch} ${props.tab.gitBranch} `}
        </text>

        <text fg={props.tab.isDirty ? props.palette.error : props.palette.success}>
          {props.tab.isDirty ? `${Glyph.gitDirty} dirty ` : `${Glyph.gitClean} clean `}
        </text>

        {props.copyNotice ? (
          <text fg={props.palette.success} attributes={TextAttributes.BOLD}>
            {` ${props.copyNotice}`}
          </text>
        ) : (
          <text
            fg={
              props.tab.session.pendingApproval()
                ? props.palette.warning
                : props.tab.session.isBusy()
                  ? props.palette.accent
                  : props.palette.muted
            }
            attributes={TextAttributes.BOLD}
          >
            {props.tab.session.pendingApproval()
              ? ` ▲ PERMISSION`
              : props.tab.session.isBusy()
                ? ` ◉ WORKING`
                : ` ● IDLE`}
          </text>
        )}
      </box>
    </box>
  );
}
