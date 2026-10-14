// packages/prumo-coder-ide/src/components/EditorSurface.tsx
import { For, Show } from "solid-js";
import { X, Circle } from "phosphor-solid";

export interface TabItem {
  id: string;
  title: string;
  isDirty?: boolean;
  content: string;
}

export interface EditorSurfaceProps {
  tabs: TabItem[];
  activeTabId?: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export function EditorSurface(props: EditorSurfaceProps) {
  const currentTab = () => props.tabs.find((t) => t.id === props.activeTabId);

  return (
    <div style="flex: 1; display: flex; flex-direction: column; background: var(--zed-bg-editor); overflow: hidden;">
      {/* Zed-like compact tabs bar (30px) */}
      <div style="height: var(--zed-tab-height); background: var(--zed-bg-surface); border-bottom: 1px solid var(--zed-border-subtle); display: flex; align-items: center; overflow-x: auto;">
        <For each={props.tabs}>
          {(tab) => {
            const isActive = () => props.activeTabId === tab.id;
            return (
              <div
                onClick={() => props.onSelectTab(tab.id)}
                style={`height: 100%; display: flex; align-items: center; gap: 8px; padding: 0 12px; cursor: pointer; border-right: 1px solid var(--zed-border-subtle); background: ${isActive() ? "var(--zed-bg-editor)" : "transparent"}; color: ${isActive() ? "var(--zed-text-primary)" : "var(--zed-text-muted)"}; font-size: 12px; font-weight: ${isActive() ? "500" : "400"};`}
              >
                <span>{tab.title}</span>

                {/* Dirty indicator or close button */}
                <Show
                  when={tab.isDirty}
                  fallback={
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onCloseTab(tab.id);
                      }}
                      style="background: transparent; border: none; color: inherit; cursor: pointer; display: flex; align-items: center;"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  <Circle size={8} weight="fill" color="var(--zed-git-modified)" />
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Editor Body */}
      <div style="flex: 1; overflow: auto; padding: 12px 16px; font-family: var(--zed-font-mono); font-size: 13px; line-height: 1.5; color: var(--zed-text-primary); white-space: pre-wrap;">
        <Show when={currentTab()} fallback={<div style="color: var(--zed-text-muted);">No open file</div>}>
          {(tab) => tab().content}
        </Show>
      </div>
    </div>
  );
}
