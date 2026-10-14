// packages/prumo-coder/src/ui/Sidebar.tsx
// Collapsible sidebar showing worktree files, git changes, and file preview triggers
import { For, Show, createSignal } from "solid-js";
import { TextAttributes, type MouseEvent } from "@opentui/core";
import { Glyph } from "../theme/glyphs";
import type { ThemePalette } from "../theme/palette";
import type { TabState } from "../state/tabs";
import type { GitFileEntry } from "../services/git";

export interface SidebarProps {
  palette: ThemePalette;
  tab: TabState;
  visible: boolean;
  gitEntries: GitFileEntry[];
  workspaceFiles: string[];
  onOpenFile: (filePath: string) => void;
  onMentionFile?: (filePath: string) => void;
}

export function Sidebar(props: SidebarProps) {
  const [activeView, setActiveView] = createSignal<"changes" | "files">("changes");

  function getStatusColor(status: GitFileEntry["status"]) {
    switch (status) {
      case "M":
        return props.palette.warning;
      case "A":
        return props.palette.success;
      case "D":
        return props.palette.error;
      case "U":
        return props.palette.error;
      default:
        return props.palette.muted;
    }
  }

  return (
    <Show when={props.visible}>
      <box
        id="sidebar"
        width={30}
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
            {`${Glyph.worktree} WORKTREE `}
          </text>
          <box flexDirection="row" gap={1}>
            <text
              fg={activeView() === "changes" ? props.palette.accent : props.palette.muted}
              attributes={activeView() === "changes" ? TextAttributes.BOLD : undefined}
              onMouseDown={() => setActiveView("changes")}
            >
              {`[Changes]`}
            </text>
            <text
              fg={activeView() === "files" ? props.palette.accent : props.palette.muted}
              attributes={activeView() === "files" ? TextAttributes.BOLD : undefined}
              onMouseDown={() => setActiveView("files")}
            >
              {`[Files]`}
            </text>
          </box>
        </box>

        {/* Directory & Branch Info */}
        <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
          <text fg={props.palette.text} attributes={TextAttributes.BOLD}>
            {`${Glyph.folderOpen} ${props.tab.cwd.split("/").pop() || "project"}`}
          </text>
          <text fg={props.palette.muted}>
            {`${Glyph.gitBranch} ${props.tab.gitBranch}`}
          </text>
        </box>

        {/* Changes Header */}
        <box height={1} paddingLeft={1} backgroundColor={props.palette.crust}>
          <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
            {activeView() === "changes"
              ? `CHANGED FILES (${props.gitEntries.length})`
              : `ALL FILES (${props.workspaceFiles.length})`}
          </text>
        </box>

        {/* Files / Changes Scrollbox */}
        <scrollbox flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
          <Show
            when={activeView() === "changes"}
            fallback={
              /* All Workspace Files View */
              <For each={props.workspaceFiles}>
                {(file) => (
                  <box
                    height={1}
                    flexDirection="row"
                    alignItems="center"
                    onMouseDown={(e: MouseEvent) => {
                      e.stopPropagation?.();
                      props.onOpenFile(file);
                    }}
                  >
                    <text fg={props.palette.muted}>
                      {`${Glyph.file} `}
                    </text>
                    <text fg={props.palette.text}>
                      {file.length > 24 ? "..." + file.slice(-21) : file}
                    </text>
                  </box>
                )}
              </For>
            }
          >
            {/* Git Changed Files View */}
            <Show
              when={props.gitEntries.length > 0}
              fallback={
                <box paddingTop={1}>
                  <text fg={props.palette.muted} attributes={TextAttributes.ITALIC}>
                    {`No local uncommitted changes`}
                  </text>
                </box>
              }
            >
              <For each={props.gitEntries}>
                {(entry) => (
                  <box
                    height={1}
                    flexDirection="row"
                    alignItems="center"
                    onMouseDown={(e: MouseEvent) => {
                      e.stopPropagation?.();
                      props.onOpenFile(entry.path);
                    }}
                  >
                    <text fg={getStatusColor(entry.status)} attributes={TextAttributes.BOLD}>
                      {`[${entry.status}] `}
                    </text>
                    <text fg={props.palette.text}>
                      {entry.path.length > 22 ? "..." + entry.path.slice(-19) : entry.path}
                    </text>
                  </box>
                )}
              </For>
            </Show>
          </Show>
        </scrollbox>

        {/* Footer shortcuts */}
        <box height={2} flexDirection="column" paddingLeft={1} backgroundColor={props.palette.surface}>
          <text fg={props.palette.muted}>
            {`Click: View file in modal`}
          </text>
          <text fg={props.palette.muted}>
            {`[Ctrl+B] Toggle drawer`}
          </text>
        </box>
      </box>
    </Show>
  );
}
