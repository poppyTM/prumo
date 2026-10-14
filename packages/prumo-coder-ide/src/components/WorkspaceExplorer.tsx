import { For } from "solid-js";
import { Folder, Code, FileText } from "phosphor-solid";

export interface FileItem {
  path: string;
  name: string;
  isDir: boolean;
  agentStatus?: "added" | "modified" | "deleted";
}

export interface WorkspaceExplorerProps {
  files: FileItem[];
  activeFile?: string;
  onSelectFile: (path: string) => void;
}

export function WorkspaceExplorer(props: WorkspaceExplorerProps) {
  return (
    <div style="width: var(--zed-sidebar-width); background: var(--zed-bg-surface); border-right: 1px solid var(--zed-border-subtle); display: flex; flex-direction: column; overflow-y: auto;">
      {/* Title */}
      <div style="padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--zed-text-muted); letter-spacing: 0.5px;">
        Project Explorer
      </div>

      {/* File Tree List */}
      <div style="display: flex; flex-direction: column;">
        <For each={props.files}>
          {(file) => {
            const isSelected = () => props.activeFile === file.path;
            const statusColor = () => {
              switch (file.agentStatus) {
                case "added":
                  return "var(--zed-git-added)";
                case "modified":
                  return "var(--zed-git-modified)";
                case "deleted":
                  return "var(--zed-git-deleted)";
                default:
                  return "transparent";
              }
            };

            return (
              <div
                onClick={() => props.onSelectFile(file.path)}
                style={`display: flex; align-items: center; justify-content: space-between; padding: 4px 12px; cursor: pointer; background: ${isSelected() ? "var(--zed-bg-active)" : "transparent"}; color: ${isSelected() ? "var(--zed-text-primary)" : "var(--zed-text-secondary)"}; font-size: 12.5px; transition: background 0.1s;`}
              >
                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  {file.isDir ? (
                    <Folder size={14} weight="fill" color="var(--zed-text-muted)" />
                  ) : file.name.endsWith(".ts") || file.name.endsWith(".go") ? (
                    <Code size={14} color="var(--zed-text-accent)" />
                  ) : (
                    <FileText size={14} color="var(--zed-text-muted)" />
                  )}
                  <span>{file.name}</span>
                </div>

                {/* Agent mutation indicator badge */}
                {file.agentStatus && (
                  <span
                    style={`font-family: var(--zed-font-mono); font-size: 10px; font-weight: bold; color: ${statusColor()};`}
                  >
                    {file.agentStatus === "added" ? "+" : file.agentStatus === "modified" ? "M" : "D"}
                  </span>
                )}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
