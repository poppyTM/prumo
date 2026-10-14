// packages/prumo-coder/src/ui/Modals.tsx
// Centered, responsive modal dialogs with focus trapping for Models, Providers, Themes, File Viewer, Diff Viewer, and Dialogs
import { For, Show, createSignal, createMemo } from "solid-js";
import { TextAttributes, type MouseEvent, type SyntaxStyle, type ScrollBoxRenderable } from "@opentui/core";
import { Glyph } from "../theme/glyphs";
import { AVAILABLE_THEMES, type ThemePalette, type ThemeName } from "../theme/palette";
import type { ReasoningEffort } from "../state/tabs";
import {
  MODEL_CATALOG,
  PROVIDERS,
  PROVIDER_METAS,
  checkProviderStatus,
  type ModelCapabilities,
  type ProviderId,
  type ProviderMeta,
} from "../models/catalog";
import type { CoderConfig } from "@prumo/client-core";

// --- Centered Modal Container Wrapper ---
interface ModalBackdropProps {
  palette: ThemePalette;
  onClose: () => void;
  children: any;
}

function ModalBackdrop(props: ModalBackdropProps) {
  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
    >
      {/* Semi-transparent Backdrop click catcher */}
      <box
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        onMouseDown={props.onClose}
      />
      {props.children}
    </box>
  );
}

// --- File Viewer Modal ---
export interface FileViewerModalProps {
  palette: ThemePalette;
  syntaxStyle: SyntaxStyle;
  filePath: string;
  content: string;
  lines: number;
  size: number;
  extension: string;
  truncated?: boolean;
  onClose: () => void;
}

export function FileViewerModal(props: FileViewerModalProps) {
  let scrollRef: ScrollBoxRenderable | null = null;
  const isMarkdown = () => props.extension === "md" || props.extension === "markdown";

  return (
    <ModalBackdrop palette={props.palette} onClose={props.onClose}>
      <box
        width="90%"
        height="88%"
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.borderFocus}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        {/* Header */}
        <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row">
          <box flexDirection="row">
            <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
              {`${Glyph.file} ${props.filePath} `}
            </text>
            <text fg={props.palette.muted}>
              {`(${props.lines} lines · ${(props.size / 1024).toFixed(1)} KB${props.truncated ? " · truncated" : ""})`}
            </text>
          </box>
          <text fg={props.palette.muted} onMouseDown={props.onClose}>
            {`[Esc / q] Close`}
          </text>
        </box>

        {/* Content Viewport */}
        <scrollbox
          ref={(el: ScrollBoxRenderable) => { scrollRef = el; }}
          flexGrow={1}
          width="100%"
          flexDirection="column"
          backgroundColor={props.palette.surface}
          paddingLeft={1}
          paddingRight={1}
        >
          <Show
            when={isMarkdown()}
            fallback={
              <code
                content={props.content}
                filetype={props.extension}
                syntaxStyle={props.syntaxStyle}
              />
            }
          >
            <markdown
              content={props.content}
              syntaxStyle={props.syntaxStyle}
              fg={props.palette.text}
            />
          </Show>
        </scrollbox>

        {/* Footer shortcuts hint */}
        <box height={1} marginTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={props.palette.muted}>
            {`[j/k] Scroll · [d/u] Page Down/Up · [g/G] Top/Bottom`}
          </text>
          <text fg={props.palette.accent}>
            {isMarkdown() ? `Rich Markdown Preview` : `Syntax Highlighted Code`}
          </text>
        </box>
      </box>
    </ModalBackdrop>
  );
}

// --- Diff Viewer Modal ---
export interface DiffViewerModalProps {
  palette: ThemePalette;
  diffText: string;
  onClose: () => void;
}

export function DiffViewerModal(props: DiffViewerModalProps) {
  let scrollRef: ScrollBoxRenderable | null = null;
  const lines = createMemo(() => props.diffText.split("\n"));

  return (
    <ModalBackdrop palette={props.palette} onClose={props.onClose}>
      <box
        width="90%"
        height="88%"
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.borderFocus}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row">
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`${Glyph.gitDiff} GIT WORKING TREE DIFF`}
          </text>
          <text fg={props.palette.muted} onMouseDown={props.onClose}>
            {`[Esc / q] Close`}
          </text>
        </box>

        <scrollbox
          ref={(el: ScrollBoxRenderable) => { scrollRef = el; }}
          flexGrow={1}
          width="100%"
          flexDirection="column"
          backgroundColor={props.palette.surface}
          paddingLeft={1}
          paddingRight={1}
        >
          <For each={lines()}>
            {(line) => {
              const isAdd = () => line.startsWith("+") && !line.startsWith("+++");
              const isDel = () => line.startsWith("-") && !line.startsWith("---");
              const isHunk = () => line.startsWith("@@");

              const color = () =>
                isAdd()
                  ? props.palette.success
                  : isDel()
                    ? props.palette.error
                    : isHunk()
                      ? props.palette.accent
                      : props.palette.muted;

              return (
                <box height={1}>
                  <text fg={color()} attributes={isHunk() ? TextAttributes.BOLD : undefined}>
                    {line}
                  </text>
                </box>
              );
            }}
          </For>
        </scrollbox>

        <box height={1} marginTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={props.palette.muted}>
            {`[j/k] Scroll · [d/u] Page · [Esc / q] Close`}
          </text>
          <text fg={props.palette.success}>
            {`Unified Diff`}
          </text>
        </box>
      </box>
    </ModalBackdrop>
  );
}

// --- Model Picker Modal ---
export interface ModelPickerModalProps {
  palette: ThemePalette;
  currentProvider: string;
  currentModel: string;
  currentEffort: ReasoningEffort;
  favoriteModels?: string[];
  roleModels?: Record<string, string>;
  highlightedIndex?: number;
  activeProviderFilter?: ProviderId;
  onSelect: (provider: string, model: string, effort: ReasoningEffort) => void;
  onToggleFavorite?: (modelId: string) => void;
  onSetDefaultModel?: (modelId: string) => void;
  onSetRoleModel?: (role: string, modelId: string) => void;
  onProviderChange?: (prov: ProviderId) => void;
  onEffortChange?: (eff: ReasoningEffort) => void;
  onHighlightedIndexChange?: (idx: number) => void;
  onClose: () => void;
}

export function ModelPickerModal(props: ModelPickerModalProps) {
  const [internalEffort, setInternalEffort] = createSignal<ReasoningEffort>(props.currentEffort);
  const [internalProvider, setInternalProvider] = createSignal<ProviderId>("all");
  const [internalHighlight, setInternalHighlight] = createSignal(0);

  const effectiveProvider = () => props.activeProviderFilter ?? internalProvider();
  const effectiveEffort = () => props.currentEffort ?? internalEffort();
  const effectiveHighlight = () => props.highlightedIndex ?? internalHighlight();

  const filteredModels = createMemo(() => {
    const prov = effectiveProvider();
    const favs = new Set(props.favoriteModels || []);
    if (prov === "favorites") {
      return MODEL_CATALOG.filter((m) => favs.has(m.id));
    }
    if (prov === "all") {
      return MODEL_CATALOG;
    }
    return MODEL_CATALOG.filter((m) => m.provider === prov);
  });

  const selectedModelInfo = createMemo(() => {
    const list = filteredModels();
    const idx = Math.min(Math.max(0, effectiveHighlight()), Math.max(0, list.length - 1));
    return list[idx] || list[0] || MODEL_CATALOG[0];
  });

  const activeEfforts = createMemo(() => {
    const sm = selectedModelInfo();
    if (!sm || !sm.supportsReasoning) return [];
    return sm.supportedEfforts;
  });

  function setProvider(p: ProviderId) {
    if (props.onProviderChange) props.onProviderChange(p);
    else setInternalProvider(p);
    if (props.onHighlightedIndexChange) props.onHighlightedIndexChange(0);
    else setInternalHighlight(0);
  }

  function setEffort(e: ReasoningEffort) {
    if (props.onEffortChange) props.onEffortChange(e);
    else setInternalEffort(e);
  }

  function setHighlight(idx: number) {
    if (props.onHighlightedIndexChange) props.onHighlightedIndexChange(idx);
    else setInternalHighlight(idx);
  }

  return (
    <ModalBackdrop palette={props.palette} onClose={props.onClose}>
      <box
        width={92}
        height={26}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.accent}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        {/* Top Header */}
        <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row">
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`${Glyph.providerAnthropic} AI MODELS & PROVIDERS REGISTRY`}
          </text>
          <text fg={props.palette.muted} onMouseDown={props.onClose}>{`[Esc / q] Close`}</text>
        </box>

        {/* Provider Tabs Filter Row (Clean badges, zero height distortion) */}
        <box height={1} marginBottom={1} flexDirection="row" overflow="hidden">
          <For each={PROVIDERS}>
            {(prov) => {
              const isActive = () => effectiveProvider() === prov.id;
              return (
                <box
                  marginRight={1}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={isActive() ? props.palette.accent : props.palette.crust}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    setProvider(prov.id);
                  }}
                >
                  <text
                    fg={isActive() ? props.palette.surface : props.palette.muted}
                    attributes={isActive() ? TextAttributes.BOLD : undefined}
                  >
                    {isActive() ? `[ ${prov.name} ]` : ` ${prov.name} `}
                  </text>
                </box>
              );
            }}
          </For>
        </box>

        {/* Dynamic Reasoning Effort Row */}
        <box height={1} marginBottom={1} flexDirection="row" alignItems="center" justifyContent="space-between">
          <Show
            when={selectedModelInfo()?.supportsReasoning}
            fallback={
              <box flexDirection="row" alignItems="center">
                <text fg={props.palette.muted} attributes={TextAttributes.BOLD}>
                  {`REASONING: `}
                </text>
                <text fg={props.palette.muted}>
                  {`[Disabled] ${selectedModelInfo()?.displayName || "Model"} does not support extended thinking`}
                </text>
              </box>
            }
          >
            <box flexDirection="row" alignItems="center">
              <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
                {`REASONING: `}
              </text>
              <For each={activeEfforts()}>
                {(eff) => {
                  const isActive = () => effectiveEffort() === eff;
                  return (
                    <box
                      marginRight={1}
                      paddingLeft={1}
                      paddingRight={1}
                      backgroundColor={isActive() ? props.palette.warning : props.palette.crust}
                      onMouseDown={(e: MouseEvent) => {
                        e.stopPropagation?.();
                        setEffort(eff);
                      }}
                    >
                      <text
                        fg={isActive() ? props.palette.surface : props.palette.muted}
                        attributes={isActive() ? TextAttributes.BOLD : undefined}
                      >
                        {isActive() ? `[${eff.toUpperCase()}]` : ` ${eff.toUpperCase()} `}
                      </text>
                    </box>
                  );
                }}
              </For>
            </box>
          </Show>
          <text fg={props.palette.muted}>
            {selectedModelInfo()?.supportsReasoning ? `[Tab] Provider · [e] Effort` : `[Tab] Provider`}
          </text>
        </box>

        {/* Models List Scrollbox */}
        <scrollbox flexGrow={1} flexDirection="column" marginBottom={1}>
          <For each={filteredModels()}>
            {(m, idx) => {
              const isSelected = () => props.currentModel === m.id;
              const isHighlighted = () => effectiveHighlight() === idx();
              const isFav = () => (props.favoriteModels || []).includes(m.id);

              return (
                <box
                  height={1}
                  flexDirection="row"
                  alignItems="center"
                  backgroundColor={isHighlighted() ? props.palette.surface : props.palette.panel}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    setHighlight(idx());
                    props.onSelect(m.provider, m.id, effectiveEffort());
                  }}
                >
                  {/* Selection Pointer */}
                  <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                    {isHighlighted() ? `❯ ` : `  `}
                  </text>

                  {/* Favorite Toggle Star */}
                  <text
                    fg={isFav() ? props.palette.warning : props.palette.muted}
                    onMouseDown={(e: MouseEvent) => {
                      e.stopPropagation?.();
                      props.onToggleFavorite?.(m.id);
                    }}
                  >
                    {isFav() ? `★ ` : `☆ `}
                  </text>

                  {/* Index */}
                  <text fg={props.palette.muted}>
                    {`[${idx() + 1}] `}
                  </text>

                  {/* Model Name */}
                  <text
                    fg={isSelected() ? props.palette.accent : isHighlighted() ? props.palette.text : props.palette.muted}
                    attributes={TextAttributes.BOLD}
                  >
                    {`${m.displayName.padEnd(23, " ")} `}
                  </text>

                  {/* Capabilities badges */}
                  <text fg={props.palette.muted}>
                    {`${(m.contextWindow / 1000).toFixed(0)}k `}
                  </text>
                  {m.supportsVision && <text fg={props.palette.accent}>{`[🖼️] `}</text>}
                  {m.supportsReasoning && <text fg={props.palette.warning}>{`[🧠] `}</text>}
                  {m.supportsTools && <text fg={props.palette.success}>{`[⚡] `}</text>}

                  <text fg={props.palette.muted}>
                    {m.description.slice(0, 32)}
                  </text>
                </box>
              );
            }}
          </For>
        </scrollbox>

        {/* Selected Model Capabilities Inspector Box */}
        <Show when={selectedModelInfo()}>
          {(() => {
            const sm = selectedModelInfo()!;
            return (
              <box
                height={5}
                flexShrink={0}
                flexDirection="column"
                backgroundColor={props.palette.crust}
                paddingLeft={1}
                paddingRight={1}
                borderStyle="single"
                borderColor={props.palette.border}
              >
                <box height={1} flexDirection="row" justifyContent="space-between">
                  <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                    {`CAPABILITIES: ${sm.displayName}`}
                  </text>
                  <text fg={props.palette.muted}>
                    {`$${sm.pricingInputUSDPerM}/M in · $${sm.pricingOutputUSDPerM}/M out`}
                  </text>
                </box>
                <box height={1} flexDirection="row" justifyContent="space-between">
                  <text fg={props.palette.text}>
                    {`Ctx: ${(sm.contextWindow / 1000).toFixed(0)}k · Out: ${(sm.maxOutputTokens / 1000).toFixed(0)}k · Spd: ${sm.speed.toUpperCase()}`}
                  </text>
                  <box flexDirection="row" gap={1}>
                    <text fg={props.palette.warning} onMouseDown={() => props.onSetRoleModel?.("architect", sm.id)}>
                      {`[Arch]`}
                    </text>
                    <text fg={props.palette.success} onMouseDown={() => props.onSetRoleModel?.("coder", sm.id)}>
                      {`[Coder]`}
                    </text>
                    <text fg={props.palette.accent} onMouseDown={() => props.onSetRoleModel?.("planner", sm.id)}>
                      {`[Plan]`}
                    </text>
                    <text fg={props.palette.secondary} onMouseDown={() => props.onSetRoleModel?.("fast", sm.id)}>
                      {`[Fast]`}
                    </text>
                  </box>
                </box>
                <box height={1} flexDirection="row" justifyContent="space-between">
                  <text fg={props.palette.muted}>
                    {`[Enter] Select · [d] Default · [f] Fav · [1..8] Direct`}
                  </text>
                  <text fg={props.palette.secondary}>
                    {`[↑/↓/j/k] Move`}
                  </text>
                </box>
              </box>
            );
          })()}
        </Show>
      </box>
    </ModalBackdrop>
  );
}

// --- Provider Settings Modal ---
export interface ProviderSettingsModalProps {
  palette: ThemePalette;
  activeProvider: string;
  config?: CoderConfig | null;
  highlightedIndex?: number;
  onSelectProvider: (providerId: string) => void;
  onClose: () => void;
}

export function ProviderSettingsModal(props: ProviderSettingsModalProps) {
  const [internalHighlight, setInternalHighlight] = createSignal(0);
  const effectiveHighlight = () => props.highlightedIndex ?? internalHighlight();

  const selectedMeta = createMemo(() => {
    const list = PROVIDER_METAS;
    const idx = Math.min(Math.max(0, effectiveHighlight()), list.length - 1);
    return list[idx] || list[0];
  });

  return (
    <ModalBackdrop palette={props.palette} onClose={props.onClose}>
      <box
        width={92}
        height={24}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.accent}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        {/* Header */}
        <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row">
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`󰒋 AI PROVIDER CONFIGURATION`}
          </text>
          <text fg={props.palette.muted} onMouseDown={props.onClose}>{`[Esc / q] Close`}</text>
        </box>

        {/* Subtitle */}
        <box height={1} marginBottom={1}>
          <text fg={props.palette.muted}>
            {`Manage model endpoints, local hosts (Ollama / vLLM), and API key environments`}
          </text>
        </box>

        {/* Providers List */}
        <scrollbox flexGrow={1} flexDirection="column" marginBottom={1}>
          <For each={PROVIDER_METAS}>
            {(meta, idx) => {
              const isSelected = () => props.activeProvider === meta.id;
              const isHighlighted = () => effectiveHighlight() === idx();
              const customKey = () => props.config?.providers?.[meta.id]?.apiKey;
              const status = () => checkProviderStatus(meta, customKey());

              return (
                <box
                  height={1}
                  flexDirection="row"
                  alignItems="center"
                  backgroundColor={isHighlighted() ? props.palette.surface : props.palette.panel}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    setInternalHighlight(idx());
                    props.onSelectProvider(meta.id);
                  }}
                >
                  <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                    {isHighlighted() ? `❯ ` : `  `}
                  </text>

                  <text fg={props.palette.muted}>
                    {`[${idx() + 1}] `}
                  </text>

                  <text
                    fg={isSelected() ? props.palette.accent : isHighlighted() ? props.palette.text : props.palette.muted}
                    attributes={TextAttributes.BOLD}
                  >
                    {`${meta.name.padEnd(24, " ")} `}
                  </text>

                  <text fg={status().isConfigured ? props.palette.success : props.palette.error} attributes={TextAttributes.BOLD}>
                    {`${status().displayStatus.padEnd(16, " ")} `}
                  </text>

                  <text fg={props.palette.muted}>
                    {meta.defaultBaseUrl}
                  </text>
                </box>
              );
            }}
          </For>
        </scrollbox>

        {/* Selected Provider Card */}
        <Show when={selectedMeta()}>
          {(() => {
            const sm = selectedMeta()!;
            const customKey = () => props.config?.providers?.[sm.id]?.apiKey;
            const status = () => checkProviderStatus(sm, customKey());

            return (
              <box
                flexShrink={0}
                flexDirection="column"
                backgroundColor={props.palette.crust}
                paddingLeft={1}
                paddingRight={1}
                borderStyle="single"
                borderColor={props.palette.border}
              >
                <box height={1} flexDirection="row" justifyContent="space-between">
                  <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                    {`PROVIDER: ${sm.name} (${sm.id})`}
                  </text>
                  <text fg={status().isConfigured ? props.palette.success : props.palette.warning}>
                    {status().displayStatus}
                  </text>
                </box>
                <box height={1} flexDirection="row" justifyContent="space-between">
                  <text fg={props.palette.text}>
                    {`Endpoint: ${sm.defaultBaseUrl}`}
                  </text>
                  <text fg={props.palette.muted}>
                    {`Env Var: export ${sm.envKey}=...`}
                  </text>
                </box>
                <box height={1} flexDirection="row" justifyContent="space-between">
                  <text fg={props.palette.muted}>
                    {`[Enter] Set as Default Provider · [↑/↓/j/k] Navigate · [1..6] Select`}
                  </text>
                  <text fg={props.palette.secondary} onMouseDown={() => props.onSelectProvider(sm.id)}>
                    {`[Activate Provider]`}
                  </text>
                </box>
              </box>
            );
          })()}
        </Show>
      </box>
    </ModalBackdrop>
  );
}

// --- Theme Picker Modal ---
export interface ThemePickerModalProps {
  palette: ThemePalette;
  highlightedIndex?: number;
  onSelectTheme: (name: ThemeName) => void;
  onClose: () => void;
}

export function ThemePickerModal(props: ThemePickerModalProps) {
  const [internalHighlight, setInternalHighlight] = createSignal(0);
  const effectiveHighlight = () => props.highlightedIndex ?? internalHighlight();

  return (
    <ModalBackdrop palette={props.palette} onClose={props.onClose}>
      <box
        width={56}
        height={18}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.secondary}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row">
          <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
            {`󰳘 SELECT COLOR PALETTE`}
          </text>
          <text fg={props.palette.muted} onMouseDown={props.onClose}>{`[Esc / q] Close`}</text>
        </box>

        <For each={AVAILABLE_THEMES}>
          {(tName, idx) => {
            const isCurrent = () => props.palette.name === tName;
            const isHighlighted = () => effectiveHighlight() === idx();
            return (
              <box
                height={1}
                flexDirection="row"
                alignItems="center"
                backgroundColor={isHighlighted() ? props.palette.surface : props.palette.panel}
                onMouseDown={(e: MouseEvent) => {
                  e.stopPropagation?.();
                  props.onSelectTheme(tName);
                }}
              >
                <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
                  {isHighlighted() ? `❯ ` : `  `}
                </text>
                <text fg={props.palette.muted}>
                  {`[${idx() + 1}] `}
                </text>
                <text fg={isCurrent() ? props.palette.secondary : props.palette.text} attributes={TextAttributes.BOLD}>
                  {`${tName}`}
                </text>
                {isCurrent() && (
                  <text fg={props.palette.success}>{` (active)`}</text>
                )}
              </box>
            );
          }}
        </For>

        <box height={1} marginTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={props.palette.muted}>
            {`[↑/↓] Navigate · [Enter] Apply`}
          </text>
          <text fg={props.palette.secondary}>
            {`[1..7] Quick Select`}
          </text>
        </box>
      </box>
    </ModalBackdrop>
  );
}

// --- Permission Dialog Modal ---
export interface PermissionDialogProps {
  palette: ThemePalette;
  tool: string;
  arguments: Record<string, unknown>;
  fingerprint: string;
  onApprove: (always?: boolean) => void;
  onDeny: (reason?: string) => void;
}

export function PermissionDialog(props: PermissionDialogProps) {
  return (
    <ModalBackdrop palette={props.palette} onClose={() => props.onDeny("Dismissed")}>
      <box
        width={68}
        height={16}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.warning}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        <box height={1} marginBottom={1}>
          <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
            {`▲ TOOL EXECUTION APPROVAL REQUIRED`}
          </text>
        </box>

        <text fg={props.palette.text} attributes={TextAttributes.BOLD}>
          {`Tool: ${props.tool}`}
        </text>

        <box
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={props.palette.crust}
          marginTop={1}
          marginBottom={1}
        >
          <text fg={props.palette.muted}>
            {JSON.stringify(props.arguments, null, 2).slice(0, 300)}
          </text>
        </box>

        <text fg={props.palette.muted}>
          {`Fingerprint: ${props.fingerprint.slice(0, 16)}...`}
        </text>

        <box height={1} marginTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={props.palette.success} attributes={TextAttributes.BOLD} onMouseDown={() => props.onApprove(false)}>
            {`[y] Approve Once`}
          </text>
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD} onMouseDown={() => props.onApprove(true)}>
            {`[a] Always Approve`}
          </text>
          <text fg={props.palette.error} attributes={TextAttributes.BOLD} onMouseDown={() => props.onDeny("Denied by user")}>
            {`[n] Deny`}
          </text>
        </box>
      </box>
    </ModalBackdrop>
  );
}

// --- Dirty Check Dialog Modal ---
export interface DirtyDialogProps {
  palette: ThemePalette;
  summary: string;
  onAction: (action: "stash" | "commit" | "proceed" | "abort") => void;
}

export function DirtyDialog(props: DirtyDialogProps) {
  return (
    <ModalBackdrop palette={props.palette} onClose={() => props.onAction("abort")}>
      <box
        width={64}
        height={12}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.warning}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        <box height={1} marginBottom={1}>
          <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
            {` UNCOMMITTED CHANGES DETECTED`}
          </text>
        </box>

        <text fg={props.palette.text}>
          {props.summary || "Your working tree has modified or untracked files."}
        </text>

        <box height={1} marginTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={props.palette.accent} onMouseDown={() => props.onAction("stash")}>{`[s] Stash`}</text>
          <text fg={props.palette.secondary} onMouseDown={() => props.onAction("commit")}>{`[c] Commit WIP`}</text>
          <text fg={props.palette.warning} onMouseDown={() => props.onAction("proceed")}>{`[p] Proceed`}</text>
          <text fg={props.palette.error} onMouseDown={() => props.onAction("abort")}>{`[a] Abort`}</text>
        </box>
      </box>
    </ModalBackdrop>
  );
}

// --- Help Modal ---
export interface HelpModalProps {
  palette: ThemePalette;
  onClose: () => void;
}

export function HelpModal(props: HelpModalProps) {
  const shortcuts = [
    { key: "Ctrl+Shift+P", desc: "Open Universal Command Palette" },
    { key: "Ctrl+P", desc: "Quick Open & Mark workspace files" },
    { key: "Alt+P", desc: "Open AI Provider configuration modal" },
    { key: "Ctrl+M", desc: "Open AI Model & Reasoning Effort picker" },
    { key: "Ctrl+B", desc: "Toggle Git / Worktree drawer" },
    { key: "Ctrl+L", desc: "Toggle Goals & Token Metrics drawer" },
    { key: "Ctrl+T", desc: "Open a new independent tab" },
    { key: "Ctrl+W", desc: "Close the current active tab" },
    { key: "Ctrl+1..9", desc: "Switch directly to tab 1..9" },
    { key: "Ctrl+X", desc: "Activate Leader chord for quick actions" },
    { key: "Esc", desc: "Enter Vim NORMAL navigation mode" },
    { key: "i / Enter", desc: "Enter Vim INSERT editing mode" },
    { key: "Tab", desc: "Auto-complete slash command or @file mention" },
    { key: "@file", desc: "Fuzzy search and attach files / images" },
    { key: "/provider", desc: "Configure AI providers & custom endpoints" },
    { key: "/diff", desc: "Open visual Git Diff Inspector" },
    { key: "/view <f>", desc: "Open File Viewer inside modal" },
    { key: "/status", desc: "Show agent session status & tokens" },
    { key: "/context", desc: "Inspect working context token breakdown" },
    { key: "/compact", desc: "Prune context & summarize history" },
    { key: "/undo", desc: "Revert latest agent turn" },
    { key: "/review", desc: "Ask agent to review git changes" },
    { key: "/test", desc: "Instruct agent to run test suite" },
    { key: "/init", desc: "Initialize Prumo in current repository" },
    { key: "!cmd", desc: "Execute direct bash shell bypass" },
  ];

  return (
    <ModalBackdrop palette={props.palette} onClose={props.onClose}>
      <box
        width={78}
        height={26}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.borderFocus}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row">
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`⌨ PRUMO-CODER SHORTCUTS & SLASH COMMANDS`}
          </text>
          <text fg={props.palette.muted} onMouseDown={props.onClose}>{`[Esc / q] Close`}</text>
        </box>

        <scrollbox flexGrow={1} flexDirection="column">
          <For each={shortcuts}>
            {(s) => (
              <box height={1} flexDirection="row">
                <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                  {`${s.key.padEnd(14, " ")} `}
                </text>
                <text fg={props.palette.text}>
                  {s.desc}
                </text>
              </box>
            )}
          </For>
        </scrollbox>

        <box height={1} marginTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={props.palette.muted}>
            {`[Esc / q / Enter] Close Help Dialog`}
          </text>
          <text fg={props.palette.secondary}>
            {`prumo-coder v0.1.0`}
          </text>
        </box>
      </box>
    </ModalBackdrop>
  );
}

// --- Quick File Search & Mark Modal (Ctrl+P) ---
export interface QuickFileModalProps {
  palette: ThemePalette;
  availableFiles: string[];
  markedFiles?: string[];
  filterQuery?: string;
  highlightedIndex?: number;
  onFilterQueryChange?: (q: string) => void;
  onToggleMark?: (filePath: string) => void;
  onConfirmMarks?: (marked: string[]) => void;
  onOpenFile?: (filePath: string) => void;
  onClose: () => void;
}

export function QuickFileModal(props: QuickFileModalProps) {
  const [internalQuery, setInternalQuery] = createSignal("");
  const [internalHighlight, setInternalHighlight] = createSignal(0);
  const [internalMarked, setInternalMarked] = createSignal<string[]>([]);

  const effectiveQuery = () => props.filterQuery ?? internalQuery();
  const effectiveHighlight = () => props.highlightedIndex ?? internalHighlight();
  const effectiveMarked = () => props.markedFiles ?? internalMarked();

  const filteredFiles = createMemo(() => {
    const q = effectiveQuery().toLowerCase().trim();
    const list = props.availableFiles || [];
    if (!q) return list;
    return list.filter((f) => f.toLowerCase().includes(q));
  });

  const PAGE_SIZE = 10;
  const windowStart = createMemo(() => {
    const cur = effectiveHighlight();
    const total = filteredFiles().length;
    if (total <= PAGE_SIZE) return 0;
    return Math.max(0, Math.min(cur - Math.floor(PAGE_SIZE / 2), total - PAGE_SIZE));
  });

  const visibleFiles = createMemo(() => {
    const start = windowStart();
    return filteredFiles()
      .slice(start, start + PAGE_SIZE)
      .map((file, idx) => ({ file, globalIndex: start + idx }));
  });

  function toggleMark(f: string) {
    if (props.onToggleMark) {
      props.onToggleMark(f);
    } else {
      setInternalMarked((prev) =>
        prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
      );
    }
  }

  return (
    <ModalBackdrop palette={props.palette} onClose={props.onClose}>
      <box
        width={92}
        height={22}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.accent}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        {/* Header */}
        <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row">
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`󰈞 QUICK OPEN & MARK FILES (Ctrl+P)`}
          </text>
          <box flexDirection="row" gap={1}>
            <text fg={effectiveMarked().length > 0 ? props.palette.success : props.palette.muted} attributes={TextAttributes.BOLD}>
              {`[Marked: ${effectiveMarked().length}]`}
            </text>
            <text fg={props.palette.muted} onMouseDown={props.onClose}>{`[Esc / q] Close`}</text>
          </box>
        </box>

        {/* Filter Input Display */}
        <box
          height={1}
          marginBottom={1}
          flexDirection="row"
          backgroundColor={props.palette.crust}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={props.palette.muted}>{`Search: `}</text>
          <text fg={props.palette.text} attributes={TextAttributes.BOLD}>
            {effectiveQuery()}
          </text>
          <text fg={props.palette.accent}>{`█`}</text>
          <box flexGrow={1} />
          <text fg={props.palette.muted}>{`${filteredFiles().length} files`}</text>
        </box>

        {/* Files List */}
        <scrollbox flexGrow={1} flexDirection="column" marginBottom={1}>
          <For each={visibleFiles()}>
            {({ file, globalIndex }) => {
              const isHighlighted = () => effectiveHighlight() === globalIndex;
              const isMarked = () => effectiveMarked().includes(file);

              return (
                <box
                  height={1}
                  flexDirection="row"
                  alignItems="center"
                  backgroundColor={isHighlighted() ? props.palette.surface : props.palette.panel}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    toggleMark(file);
                  }}
                >
                  <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                    {isHighlighted() ? `❯ ` : `  `}
                  </text>
                  <text fg={isMarked() ? props.palette.success : props.palette.muted} attributes={TextAttributes.BOLD}>
                    {isMarked() ? `[✔] ` : `[ ] `}
                  </text>
                  <text fg={props.palette.secondary}>{`󰈔 `}</text>
                  <text
                    fg={isHighlighted() ? props.palette.text : props.palette.muted}
                    attributes={isHighlighted() ? TextAttributes.BOLD : undefined}
                  >
                    {file}
                  </text>
                </box>
              );
            }}
          </For>
        </scrollbox>

        {/* Footer shortcuts */}
        <box height={1} flexDirection="row" justifyContent="space-between">
          <text fg={props.palette.muted}>
            {`[Space] Toggle Mark · [Enter] Attach/Open · [↑/↓/j/k] Navigate`}
          </text>
          <text
            fg={props.palette.secondary}
            attributes={TextAttributes.BOLD}
            onMouseDown={() => props.onConfirmMarks?.(effectiveMarked())}
          >
            {`[Attach Marked]`}
          </text>
        </box>
      </box>
    </ModalBackdrop>
  );
}

// --- Universal Command Palette (Ctrl+Shift+P) ---
export interface PaletteCommand {
  id: string;
  title: string;
  shortcut?: string;
  category?: string;
  action: () => void;
}

export interface CommandPaletteModalProps {
  palette: ThemePalette;
  commands: PaletteCommand[];
  filterQuery?: string;
  highlightedIndex?: number;
  onFilterQueryChange?: (q: string) => void;
  onExecuteCommand: (cmd: PaletteCommand) => void;
  onClose: () => void;
}

export function CommandPaletteModal(props: CommandPaletteModalProps) {
  const [internalQuery, setInternalQuery] = createSignal("");
  const [internalHighlight, setInternalHighlight] = createSignal(0);

  const effectiveQuery = () => props.filterQuery ?? internalQuery();
  const effectiveHighlight = () => props.highlightedIndex ?? internalHighlight();

  const filteredCommands = createMemo(() => {
    const q = effectiveQuery().toLowerCase().trim();
    if (!q) return props.commands;
    return props.commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q))
    );
  });

  const PAGE_SIZE = 10;
  const windowStart = createMemo(() => {
    const cur = effectiveHighlight();
    const total = filteredCommands().length;
    if (total <= PAGE_SIZE) return 0;
    return Math.max(0, Math.min(cur - Math.floor(PAGE_SIZE / 2), total - PAGE_SIZE));
  });

  const visibleCommands = createMemo(() => {
    const start = windowStart();
    return filteredCommands()
      .slice(start, start + PAGE_SIZE)
      .map((cmd, idx) => ({ cmd, globalIndex: start + idx }));
  });

  return (
    <ModalBackdrop palette={props.palette} onClose={props.onClose}>
      <box
        width={92}
        height={22}
        flexDirection="column"
        backgroundColor={props.palette.panel}
        borderStyle="rounded"
        borderColor={props.palette.secondary}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation?.()}
      >
        {/* Header */}
        <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row">
          <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
            {`󰘳 COMMAND PALETTE (Ctrl+Shift+P)`}
          </text>
          <text fg={props.palette.muted} onMouseDown={props.onClose}>{`[Esc / q] Close`}</text>
        </box>

        {/* Filter Input Display */}
        <box
          height={1}
          marginBottom={1}
          flexDirection="row"
          backgroundColor={props.palette.crust}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={props.palette.muted}>{`> `}</text>
          <text fg={props.palette.text} attributes={TextAttributes.BOLD}>
            {effectiveQuery()}
          </text>
          <text fg={props.palette.secondary}>{`█`}</text>
          <box flexGrow={1} />
          <text fg={props.palette.muted}>{`${filteredCommands().length} commands`}</text>
        </box>

        {/* Commands List */}
        <scrollbox flexGrow={1} flexDirection="column" marginBottom={1}>
          <For each={visibleCommands()}>
            {({ cmd, globalIndex }) => {
              const isHighlighted = () => effectiveHighlight() === globalIndex;

              return (
                <box
                  height={1}
                  flexDirection="row"
                  justifyContent="space-between"
                  alignItems="center"
                  backgroundColor={isHighlighted() ? props.palette.surface : props.palette.panel}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    props.onExecuteCommand(cmd);
                  }}
                >
                  <box flexDirection="row" alignItems="center">
                    <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
                      {isHighlighted() ? `❯ ` : `  `}
                    </text>
                    <text
                      fg={isHighlighted() ? props.palette.text : props.palette.muted}
                      attributes={isHighlighted() ? TextAttributes.BOLD : undefined}
                    >
                      {cmd.title}
                    </text>
                  </box>
                  {cmd.shortcut && (
                    <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
                      {cmd.shortcut}
                    </text>
                  )}
                </box>
              );
            }}
          </For>
        </scrollbox>

        {/* Footer shortcuts */}
        <box height={1} flexDirection="row" justifyContent="space-between">
          <text fg={props.palette.muted}>
            {`[Enter] Execute Command · [↑/↓/j/k] Navigate`}
          </text>
          <text fg={props.palette.secondary}>
            {`Type to search`}
          </text>
        </box>
      </box>
    </ModalBackdrop>
  );
}
