// packages/prumo-coder/src/ui/TabBar.tsx
// Top multi-tab navigation bar with status indicators and per-tab info
import { For, Show } from "solid-js";
import { TextAttributes, type MouseEvent } from "@opentui/core";
import { Glyph } from "../theme/glyphs";
import type { ThemePalette } from "../theme/palette";
import type { TabState, TabsStore } from "../state/tabs";

export interface TabBarProps {
  palette: ThemePalette;
  tabsStore: TabsStore;
  onNewTab: () => void;
  onOpenThemePicker?: () => void;
  onToggleRightSidebar?: () => void;
}

export function TabBar(props: TabBarProps) {
  function getTabStatusGlyph(tab: TabState): { glyph: string; color: typeof props.palette.accent } {
    if (tab.session.pendingApproval()) {
      return { glyph: Glyph.statusPermission, color: props.palette.warning };
    }
    if (tab.session.isBusy()) {
      return { glyph: Glyph.statusStreaming, color: props.palette.accent };
    }
    return { glyph: Glyph.statusIdle, color: props.palette.success };
  }

  return (
    <box
      id="tab-bar"
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={props.palette.panel}
      justifyContent="space-between"
      flexShrink={0}
    >
      {/* Left: Tab list */}
      <box flexDirection="row" flexGrow={1} overflow="hidden">
        <For each={props.tabsStore.tabs()}>
          {(tab, index) => {
            const isActive = () => props.tabsStore.activeTabId() === tab.id;
            const status = () => getTabStatusGlyph(tab);

            return (
              <box
                flexDirection="row"
                alignItems="center"
                backgroundColor={isActive() ? props.palette.surface : props.palette.panel}
                borderStyle={isActive() ? "single" : undefined}
                borderColor={isActive() ? props.palette.borderFocus : undefined}
                marginRight={1}
                paddingLeft={1}
                paddingRight={1}
                onMouseDown={(e: MouseEvent) => {
                  e.stopPropagation?.();
                  props.tabsStore.switchTab(tab.id);
                }}
              >
                {/* Tab Number & Worktree */}
                <text
                  fg={isActive() ? props.palette.accent : props.palette.muted}
                  attributes={isActive() ? TextAttributes.BOLD : undefined}
                >
                  {`${index() + 1} ${Glyph.worktree} `}
                </text>

                {/* Tab Name / Model */}
                <text
                  fg={isActive() ? props.palette.text : props.palette.muted}
                  attributes={isActive() ? TextAttributes.BOLD : undefined}
                >
                  {`${tab.cwd.split("/").pop()} [${tab.model.slice(0, 14)}] `}
                </text>

                {/* Status indicator */}
                <text fg={status().color}>
                  {`${status().glyph} `}
                </text>

                {/* Close Button */}
                <Show when={props.tabsStore.tabs().length > 1}>
                  <text
                    fg={props.palette.muted}
                    onMouseDown={(e: MouseEvent) => {
                      e.stopPropagation?.();
                      props.tabsStore.closeTab(tab.id);
                    }}
                  >
                    {`${Glyph.tabClose} `}
                  </text>
                </Show>
              </box>
            );
          }}
        </For>

        {/* Plus / New Tab button */}
        <box
          alignItems="center"
          paddingLeft={1}
          paddingRight={1}
          onMouseDown={(e: MouseEvent) => {
            e.stopPropagation?.();
            props.onNewTab();
          }}
        >
          <text fg={props.palette.accent}>
            {`+ [Ctrl+T]`}
          </text>
        </box>
      </box>

      {/* Right: Metrics & Active Theme */}
      <box flexDirection="row" alignItems="center" paddingRight={1} gap={1}>
        <box
          onMouseDown={(e: MouseEvent) => {
            e.stopPropagation?.();
            props.onToggleRightSidebar?.();
          }}
        >
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`[󰍛 Metrics] `}
          </text>
        </box>

        <box
          onMouseDown={(e: MouseEvent) => {
            e.stopPropagation?.();
            props.onOpenThemePicker?.();
          }}
        >
          <text fg={props.palette.secondary} attributes={TextAttributes.ITALIC}>
            {`󰳘 ${props.palette.name} `}
          </text>
        </box>
      </box>
    </box>
  );
}
