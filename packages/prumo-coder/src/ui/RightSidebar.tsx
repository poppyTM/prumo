// packages/prumo-coder/src/ui/RightSidebar.tsx
// Right-hand telemetry and Living Plan drawer: goals, deep token breakdowns, and pricing rates
import { Show, createMemo } from "solid-js";
import { TextAttributes, type MouseEvent } from "@opentui/core";
import { Glyph } from "../theme/glyphs";
import type { ThemePalette } from "../theme/palette";
import type { TabState } from "../state/tabs";
import { findModel, calculateEstimatedCost } from "../models/catalog";
import { formatTokens, renderVuMeter } from "./StatusLine";

export interface RightSidebarProps {
  palette: ThemePalette;
  tab: TabState;
  visible: boolean;
  onClose: () => void;
}

export function RightSidebar(props: RightSidebarProps) {
  const modelInfo = createMemo(() => findModel(props.tab.model));
  const metrics = () => props.tab.session.metrics();

  // Cache hit percentage calculation
  const cacheHitRatio = createMemo(() => {
    const m = metrics();
    const totalInput = m.promptTokens + m.cacheTokens;
    if (totalInput <= 0) return 0;
    return Math.round((m.cacheTokens / totalInput) * 100);
  });

  // Context usage percentage calculation
  const contextLimit = createMemo(() => modelInfo()?.contextWindow || 200_000);
  const contextUsed = createMemo(() => metrics().promptTokens + metrics().completionTokens);
  const contextPercent = createMemo(() => {
    return Math.min(100, Math.round((contextUsed() / contextLimit()) * 100));
  });

  // Cost estimates based on rates
  const costCalculation = createMemo(() => {
    const m = metrics();
    return calculateEstimatedCost(props.tab.model, m.promptTokens, m.completionTokens, m.cacheTokens);
  });

  return (
    <Show when={props.visible}>
      <box
        id="right-sidebar"
        width={34}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="single"
        borderColor={props.palette.border}
        flexShrink={0}
        overflow="hidden"
      >
        {/* Header */}
        <box
          height={1}
          flexDirection="row"
          alignItems="center"
          backgroundColor={props.palette.surface}
          paddingLeft={1}
          paddingRight={1}
          justifyContent="space-between"
        >
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`󰍛 METRICS & GOALS`}
          </text>
          <text
            fg={props.palette.muted}
            onMouseDown={(e: MouseEvent) => {
              e.stopPropagation?.();
              props.onClose();
            }}
          >
            {`[Ctrl+L] [x]`}
          </text>
        </box>

        {/* Section 1: Active Goal & Steps Checklist */}
        <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
          <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
            {`🎯 LIVING PLAN`}
          </text>
          <text fg={props.palette.text} attributes={TextAttributes.BOLD}>
            {`Goal: ${props.tab.session.activeRunID() ? `Run ${props.tab.session.activeRunID()}` : "Idle Workspace"}`}
          </text>

          <box flexDirection="column" marginTop={1}>
            <text fg={props.palette.success}>
              {`[✓] Phase 0: Monorepo & Governance`}
            </text>
            <text fg={props.palette.success}>
              {`[✓] Phase 1: Client Core Protocol`}
            </text>
            <text fg={props.palette.success}>
              {`[✓] Phase 2: prumo-coder OpenTUI`}
            </text>
            <text fg={props.tab.session.isBusy() ? props.palette.accent : props.palette.success}>
              {props.tab.session.isBusy() ? `[◉] Phase 3: Autonomous Run` : `[✓] Phase 3: Ready for Input`}
            </text>
          </box>
        </box>

        {/* Section 2: Detailed Cost Calculation Breakdown */}
        <box height={1} paddingLeft={1} backgroundColor={props.palette.crust}>
          <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
            {`󰡱 COST ESTIMATION (USD)`}
          </text>
        </box>

        <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={props.palette.text}>{`Accumulated Cost:`}</text>
            <text fg={props.palette.success} attributes={TextAttributes.BOLD}>
              {`$${(metrics().costUSD > 0 ? metrics().costUSD : costCalculation().totalUSD).toFixed(4)}`}
            </text>
          </box>

          <box flexDirection="row" justifyContent="space-between">
            <text fg={props.palette.muted}>{`Input Rate (1M):`}</text>
            <text fg={props.palette.muted}>
              {`$${(modelInfo()?.pricingInputUSDPerM || 0).toFixed(2)}`}
            </text>
          </box>

          <box flexDirection="row" justifyContent="space-between">
            <text fg={props.palette.muted}>{`Output Rate (1M):`}</text>
            <text fg={props.palette.muted}>
              {`$${(modelInfo()?.pricingOutputUSDPerM || 0).toFixed(2)}`}
            </text>
          </box>

          <box flexDirection="row" justifyContent="space-between">
            <text fg={props.palette.accent}>{`Cache Savings:`}</text>
            <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
              {`-$${costCalculation().savingsUSD.toFixed(4)}`}
            </text>
          </box>
        </box>

        {/* Section 3: Deep Token Telemetry */}
        <box height={1} paddingLeft={1} backgroundColor={props.palette.crust}>
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`󰆏 TOKEN TELEMETRY`}
          </text>
        </box>

        <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={props.palette.text}>{`Prompt (in):`}</text>
            <text fg={props.palette.text}>{`${formatTokens(metrics().promptTokens)}`}</text>
          </box>

          <box flexDirection="row" justifyContent="space-between">
            <text fg={props.palette.accent}>{`Cache hit:`}</text>
            <text fg={props.palette.accent}>{`${formatTokens(metrics().cacheTokens)}`}</text>
          </box>

          {/* Cache Hit Gauge */}
          <box flexDirection="row" justifyContent="space-between" marginTop={0}>
            <text fg={props.palette.muted}>{`Cache ratio:`}</text>
            <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
              {`${renderVuMeter(cacheHitRatio(), 6)} ${cacheHitRatio()}%`}
            </text>
          </box>

          <box flexDirection="row" justifyContent="space-between">
            <text fg={props.palette.text}>{`Completion (out):`}</text>
            <text fg={props.palette.text}>{`${formatTokens(metrics().completionTokens)}`}</text>
          </box>

          <Show when={metrics().reasoningTokens > 0}>
            <box flexDirection="row" justifyContent="space-between">
              <text fg={props.palette.secondary}>{`Reasoning (think):`}</text>
              <text fg={props.palette.secondary}>{`${formatTokens(metrics().reasoningTokens)}`}</text>
            </box>
          </Show>
        </box>

        {/* Section 4: Context Window Gauge */}
        <box height={1} paddingLeft={1} backgroundColor={props.palette.crust}>
          <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
            {`󰥉 CONTEXT WINDOW`}
          </text>
        </box>

        <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
          <text fg={contextPercent() > 80 ? props.palette.error : props.palette.accent}>
            {`${renderVuMeter(contextPercent(), 10)} ${contextPercent()}%`}
          </text>
          <text fg={props.palette.muted}>
            {`${formatTokens(contextUsed())} / ${formatTokens(contextLimit())} tokens`}
          </text>

          {/* Capabilities Badges */}
          <box flexDirection="row" gap={1} marginTop={1} flexWrap="wrap">
            <Show when={modelInfo()?.supportsVision}>
              <text fg={props.palette.accent}>{`[🖼️ Vision]`}</text>
            </Show>
            <Show when={modelInfo()?.supportsReasoning}>
              <text fg={props.palette.warning}>{`[🧠 Reasoning]`}</text>
            </Show>
            <Show when={modelInfo()?.supportsTools}>
              <text fg={props.palette.success}>{`[⚡ Tools]`}</text>
            </Show>
          </box>
        </box>
      </box>
    </Show>
  );
}
