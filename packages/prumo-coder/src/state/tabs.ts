// packages/prumo-coder/src/state/tabs.ts
// Multi-tab workspace manager with independent sessions, models, and worktrees
import { createSignal, createMemo } from "solid-js";
import {
  createPrumoSessionStore,
  type PrumoSessionStore,
} from "@prumo/client-core";

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "max";

export interface TabState {
  id: string;
  index: number;
  title: string;
  session: PrumoSessionStore;
  provider: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  cwd: string;
  gitBranch: string;
  isDirty: boolean;
  promptDraft: string;
}

export function createTabsStore(defaultProvider = "anthropic", defaultModel = "claude-3-7-sonnet", defaultCwd = process.cwd()) {
  let nextTabId = 1;

  function createNewTab(partial?: Partial<TabState>): TabState {
    const id = `tab-${nextTabId++}`;
    const session = createPrumoSessionStore();
    return {
      id,
      index: nextTabId - 1,
      title: partial?.title ?? `${defaultModel}`,
      session,
      provider: partial?.provider ?? defaultProvider,
      model: partial?.model ?? defaultModel,
      reasoningEffort: partial?.reasoningEffort ?? "high",
      cwd: partial?.cwd ?? defaultCwd,
      gitBranch: partial?.gitBranch ?? "main",
      isDirty: partial?.isDirty ?? false,
      promptDraft: "",
    };
  }

  const initial = createNewTab();
  const [tabs, setTabs] = createSignal<TabState[]>([initial]);
  const [activeTabId, setActiveTabId] = createSignal<string>(initial.id);

  const activeTab = createMemo(() => {
    const current = tabs().find((t) => t.id === activeTabId());
    return current || tabs()[0];
  });

  function addTab(partial?: Partial<TabState>): TabState {
    const tab = createNewTab(partial);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    return tab;
  }

  function closeTab(id: string) {
    const currentTabs = tabs();
    if (currentTabs.length <= 1) return; // Keep at least one tab open

    const targetIndex = currentTabs.findIndex((t) => t.id === id);
    if (targetIndex === -1) return;

    const remaining = currentTabs.filter((t) => t.id !== id);
    setTabs(remaining);

    if (activeTabId() === id) {
      const nextActive = remaining[Math.min(targetIndex, remaining.length - 1)];
      if (nextActive) {
        setActiveTabId(nextActive.id);
      }
    }
  }

  function switchTab(id: string) {
    if (tabs().some((t) => t.id === id)) {
      setActiveTabId(id);
    }
  }

  function switchTabByIndex(index: number) {
    const list = tabs();
    if (index >= 0 && index < list.length) {
      setActiveTabId(list[index].id);
    }
  }

  function updateTab(id: string, patch: Partial<TabState>) {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return { ...t, ...patch };
        }
        return t;
      }),
    );
  }

  function updateActiveTab(patch: Partial<TabState>) {
    updateTab(activeTabId(), patch);
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    addTab,
    closeTab,
    switchTab,
    switchTabByIndex,
    updateTab,
    updateActiveTab,
  };
}

export type TabsStore = ReturnType<typeof createTabsStore>;
