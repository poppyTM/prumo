// packages/prumo-coder/src/app.tsx
// Main Workbench for prumo-coder with Focus-trapped Modals, Rich Markdown, Auto-Copy, and Right Sidebar
import { createSignal, createMemo, onMount, onCleanup, Show, createEffect } from "solid-js";
import { useKeyboard, useRenderer } from "@opentui/solid";
import {
  Client,
  loadCoderConfig,
  saveCoderConfig,
  type CoderConfig,
} from "@prumo/client-core";
import { Glyph } from "./theme/glyphs";
import { getThemePalette, AVAILABLE_THEMES, type ThemeName } from "./theme/palette";
import { createPrumoSyntaxStyle } from "./theme/syntax";
import { createTabsStore, type ReasoningEffort } from "./state/tabs";
import { getGitStatus, getGitDiff, gitStash, gitCommit, type GitFileEntry } from "./services/git";
import { listWorkspaceFiles, readWorkspaceFile } from "./services/files";
import { TabBar } from "./ui/TabBar";
import { StatusLine } from "./ui/StatusLine";
import { Sidebar } from "./ui/Sidebar";
import { RightSidebar } from "./ui/RightSidebar";
import { Transcript } from "./ui/Transcript";
import { Composer } from "./ui/Composer";
import {
  ModelPickerModal,
  ProviderSettingsModal,
  ThemePickerModal,
  PermissionDialog,
  DirtyDialog,
  HelpModal,
  FileViewerModal,
  DiffViewerModal,
  QuickFileModal,
  CommandPaletteModal,
  type PaletteCommand,
} from "./ui/Modals";
import {
  MODEL_CATALOG,
  PROVIDERS,
  PROVIDER_METAS,
  findModel,
  getModelSupportedEfforts,
  clampModelEffort,
  type ProviderId,
} from "./models/catalog";

export function App() {
  const renderer = useRenderer();
  const [themeName, setThemeName] = createSignal<ThemeName>("catppuccin-mocha");
  const palette = createMemo(() => getThemePalette(themeName()));
  const syntaxStyle = createMemo(() => createPrumoSyntaxStyle(renderer, palette()));
  const [config, setConfig] = createSignal<CoderConfig | null>(null);

  const tabsStore = createTabsStore();
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [rightSidebarOpen, setRightSidebarOpen] = createSignal(false);
  const [vimMode, setVimMode] = createSignal<"INSERT" | "NORMAL">("INSERT");
  const [leaderActive, setLeaderActive] = createSignal(false);

  // Favorites & Role Models
  const [favoriteModels, setFavoriteModels] = createSignal<string[]>([
    "claude-3-7-sonnet",
    "o3-mini",
    "gemini-2.5-pro",
  ]);
  const [roleModels, setRoleModels] = createSignal<Record<string, string>>({
    architect: "claude-3-7-sonnet",
    coder: "claude-3-5-sonnet",
    planner: "o3-mini",
    fast: "gemini-2.5-flash",
  });

  // Auto-copy on text selection
  const [lastCopiedSelection, setLastCopiedSelection] = createSignal("");
  const [copyNotice, setCopyNotice] = createSignal("");

  // Modal Overlay States
  const [activeModal, setActiveModal] = createSignal<
    "none" | "model" | "provider" | "theme" | "help" | "dirty" | "file" | "diff" | "quick-files" | "palette"
  >("none");

  // Modal Interactive Keyboard Navigation State
  const [modalModelIndex, setModalModelIndex] = createSignal(0);
  const [modalProviderFilter, setModalProviderFilter] = createSignal<ProviderId>("all");
  const [modalReasoningEffort, setModalReasoningEffort] = createSignal<ReasoningEffort>("high");
  const [modalProviderIndex, setModalProviderIndex] = createSignal(0);
  const [modalThemeIndex, setModalThemeIndex] = createSignal(0);
  const [modalFileIndex, setModalFileIndex] = createSignal(0);
  const [modalPaletteIndex, setModalPaletteIndex] = createSignal(0);
  const [modalQuery, setModalQuery] = createSignal("");
  const [markedFiles, setMarkedFiles] = createSignal<string[]>([]);
  const [composerDraft, setComposerDraft] = createSignal("");

  // File Viewer state
  const [viewingFile, setViewingFile] = createSignal<{
    path: string;
    content: string;
    size: number;
    lines: number;
    extension: string;
    truncated?: boolean;
  } | null>(null);

  // Diff Viewer state
  const [diffContent, setDiffContent] = createSignal<string>("");

  const [dirtySummary, setDirtySummary] = createSignal("");
  const [pendingPrompt, setPendingPrompt] = createSignal<string | null>(null);

  // Real Git & File system state
  const [gitEntries, setGitEntries] = createSignal<GitFileEntry[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = createSignal<string[]>([]);
  const [promptHistory, setPromptHistory] = createSignal<string[]>([]);

  const client = new Client(process.env.PRUMO_DAEMON_SOCKET || "/tmp/prumo-daemon.sock");

  // Synchronous cleanup registrations to avoid SolidJS async-boundary leak
  let selectionInterval: NodeJS.Timeout | null = null;
  let refreshDebounceTimer: NodeJS.Timeout | null = null;

  onCleanup(() => {
    if (selectionInterval) clearInterval(selectionInterval);
    if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
  });

  async function refreshGitAndFiles() {
    const cwd = tabsStore.activeTab().cwd;
    try {
      const status = await getGitStatus(cwd);
      setGitEntries(status.entries);
      tabsStore.updateActiveTab({
        gitBranch: status.branch,
        isDirty: status.isDirty,
      });

      const files = await listWorkspaceFiles(cwd, 300);
      setWorkspaceFiles(files);
    } catch {
      // Fallback
    }
  }

  function triggerGitRefreshDebounced() {
    if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = setTimeout(() => {
      void refreshGitAndFiles();
    }, 300);
  }

  onMount(async () => {
    try {
      const loaded = await loadCoderConfig();
      setConfig(loaded);
      if (loaded.general?.theme) {
        setThemeName(loaded.general.theme as ThemeName);
      }
      if (loaded.general?.favorite_models) {
        setFavoriteModels(loaded.general.favorite_models);
      }
      if (loaded.agent.role_models) {
        setRoleModels(loaded.agent.role_models);
      }
      if (loaded.agent.default_model) {
        tabsStore.updateActiveTab({
          provider: loaded.agent.default_provider,
          model: loaded.agent.default_model,
          reasoningEffort: loaded.agent.reasoning_effort as ReasoningEffort,
        });
      }
    } catch {
      // Defaults already set
    }
    await refreshGitAndFiles();

    // Auto-copy on text selection listener (OpenCode parity)
    selectionInterval = setInterval(() => {
      try {
        const sel = renderer.getSelection?.()?.getSelectedText?.();
        if (sel && sel.trim().length > 0 && sel !== lastCopiedSelection()) {
          setLastCopiedSelection(sel);
          renderer.copyToClipboardOSC52?.(sel);
          setCopyNotice(`📋 Copied selection`);
          setTimeout(() => setCopyNotice(""), 2200);
        }
      } catch {
        // Selection not available
      }
    }, 350);
  });

  let isFirstTabMount = true;
  createEffect(() => {
    tabsStore.activeTabId();
    if (isFirstTabMount) {
      isFirstTabMount = false;
      return;
    }
    void refreshGitAndFiles();
  });

  async function openFileInViewer(relPath: string) {
    try {
      const data = await readWorkspaceFile(tabsStore.activeTab().cwd, relPath);
      setViewingFile({
        path: relPath,
        content: data.content,
        size: data.size,
        lines: data.lines,
        extension: data.extension,
        truncated: data.truncated,
      });
      setActiveModal("file");
    } catch (err) {
      tabsStore.activeTab().session.appendMessage({
        id: `err-${Date.now()}`,
        role: "system",
        content: `Could not open file: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: Date.now(),
      });
    }
  }

  async function openDiffViewer() {
    try {
      const diff = await getGitDiff(tabsStore.activeTab().cwd);
      setDiffContent(diff);
      setActiveModal("diff");
    } catch (err) {
      tabsStore.activeTab().session.appendMessage({
        id: `err-${Date.now()}`,
        role: "system",
        content: `Error loading git diff: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: Date.now(),
      });
    }
  }

  function handleToggleMarkFile(file: string) {
    setMarkedFiles((prev) =>
      prev.includes(file) ? prev.filter((x) => x !== file) : [...prev, file]
    );
  }

  function handleConfirmAttachMarkedFiles(files: string[]) {
    setActiveModal("none");
    if (files.length === 0) return;
    const mentions = files.map((f) => `@${f}`).join(" ") + " ";
    setComposerDraft((prev) => (prev ? `${prev} ${mentions}` : mentions));
  }

  const commandPaletteActions = createMemo<PaletteCommand[]>(() => [
    {
      id: "files",
      title: "Quick Open: Search & Mark Workspace Files",
      shortcut: "Ctrl+P",
      category: "Navigation",
      action: () => {
        setModalQuery("");
        setModalFileIndex(0);
        setActiveModal("quick-files");
      },
    },
    {
      id: "model",
      title: "AI Models: Select Provider & Reasoning Effort",
      shortcut: "Ctrl+M",
      category: "AI Configuration",
      action: () => setActiveModal("model"),
    },
    {
      id: "provider",
      title: "AI Providers: Configure Endpoints & Keys",
      shortcut: "Alt+P",
      category: "AI Configuration",
      action: () => setActiveModal("provider"),
    },
    {
      id: "diff",
      title: "Git Diff: Open Working Tree Diff Inspector",
      shortcut: "/diff",
      category: "Git",
      action: () => void openDiffViewer(),
    },
    {
      id: "tree",
      title: "Explorer: Toggle Workspace File Tree Sidebar",
      shortcut: "Ctrl+B",
      category: "View",
      action: () => setSidebarOpen(!sidebarOpen()),
    },
    {
      id: "metrics",
      title: "Metrics: Toggle Goals & Telemetry Drawer",
      shortcut: "Ctrl+L",
      category: "View",
      action: () => setRightSidebarOpen(!rightSidebarOpen()),
    },
    {
      id: "theme",
      title: "Theme: Switch Color Palette",
      shortcut: "/theme",
      category: "Appearance",
      action: () => setActiveModal("theme"),
    },
    {
      id: "review",
      title: "Review: Instruct Agent to Review Working Tree Changes",
      shortcut: "/review",
      category: "Agent",
      action: () => handleExecuteSlashCommand("/review"),
    },
    {
      id: "test",
      title: "Test: Run Test Suite and Auto-Fix Failures",
      shortcut: "/test",
      category: "Agent",
      action: () => handleExecuteSlashCommand("/test"),
    },
    {
      id: "context",
      title: "Context: Inspect Token Breakdown Capsule",
      shortcut: "/context",
      category: "Agent",
      action: () => handleExecuteSlashCommand("/context"),
    },
    {
      id: "compact",
      title: "Compact: Compact Conversation History Capsule",
      shortcut: "/compact",
      category: "Session",
      action: () => handleExecuteSlashCommand("/compact"),
    },
    {
      id: "undo",
      title: "Undo: Revert Latest Turn Checkpoint",
      shortcut: "/undo",
      category: "Session",
      action: () => handleExecuteSlashCommand("/undo"),
    },
    {
      id: "init",
      title: "Init: Initialize Prumo in Current Workspace",
      shortcut: "/init",
      category: "Workspace",
      action: () => handleExecuteSlashCommand("/init"),
    },
    {
      id: "tab-new",
      title: "Tab: Create New Session Tab",
      shortcut: "Ctrl+T",
      category: "Tabs",
      action: () => tabsStore.addTab(),
    },
    {
      id: "tab-close",
      title: "Tab: Close Current Session Tab",
      shortcut: "Ctrl+W",
      category: "Tabs",
      action: () => tabsStore.closeTab(tabsStore.activeTabId()),
    },
    {
      id: "clear",
      title: "Clear: Clear Active Tab Transcript",
      shortcut: "/clear",
      category: "Session",
      action: () => handleExecuteSlashCommand("/clear"),
    },
    {
      id: "export",
      title: "Export: Save Transcript to Markdown File",
      shortcut: "/export",
      category: "Session",
      action: () => handleExecuteSlashCommand("/export"),
    },
    {
      id: "help",
      title: "Help: Show Keyboard Cheatsheet & Documentation",
      shortcut: "/help",
      category: "Help",
      action: () => setActiveModal("help"),
    },
    {
      id: "quit",
      title: "Quit: Exit Prumo Coder",
      shortcut: "Ctrl+Q",
      category: "System",
      action: () => process.exit(0),
    },
  ]);

  // --- Strict Focus Trapping Keyboard Handler ---
  useKeyboard((key) => {
    // 0. GLOBAL QUIT SHORTCUT (Ctrl+Q) - exits immediately from any screen, modal or state
    const isQ = key.name === "q" || key.name === "Q";
    if ((key.ctrl && isQ) || key.sequence === "\x11") {
      key.preventDefault();
      key.stopPropagation();
      process.exit(0);
    }

    const modal = activeModal();
    const hasApproval = !!tabsStore.activeTab().session.pendingApproval();

    // 1. MODAL FOCUS TRAP & INTERACTIVE KEYBOARD NAVIGATION
    if (modal !== "none" || hasApproval) {
      key.preventDefault();
      key.stopPropagation();

      // Universal close on Escape
      if (key.name === "escape") {
        setActiveModal("none");
        return;
      }

      // --- Model Picker Modal Navigation ---
      if (modal === "model") {
        const prov = modalProviderFilter();
        const favs = new Set(favoriteModels());
        const list = prov === "favorites"
          ? MODEL_CATALOG.filter((m) => favs.has(m.id))
          : prov === "all"
            ? MODEL_CATALOG
            : MODEL_CATALOG.filter((m) => m.provider === prov);

        if (key.name === "down" || key.name === "j") {
          const nextIdx = Math.min(Math.max(0, list.length - 1), modalModelIndex() + 1);
          setModalModelIndex(nextIdx);
          const m = list[nextIdx];
          if (m) setModalReasoningEffort(clampModelEffort(m.id, modalReasoningEffort()));
          return;
        }
        if (key.name === "up" || key.name === "k") {
          const nextIdx = Math.max(0, modalModelIndex() - 1);
          setModalModelIndex(nextIdx);
          const m = list[nextIdx];
          if (m) setModalReasoningEffort(clampModelEffort(m.id, modalReasoningEffort()));
          return;
        }
        if (key.name === "tab" || key.name === "right" || key.name === "l") {
          const provIds: ProviderId[] = PROVIDERS.map((p) => p.id);
          const currentIdx = provIds.indexOf(modalProviderFilter());
          const nextIdx = (currentIdx + 1) % provIds.length;
          setModalProviderFilter(provIds[nextIdx]);
          setModalModelIndex(0);
          return;
        }
        if (key.name === "left" || key.name === "h") {
          const provIds: ProviderId[] = PROVIDERS.map((p) => p.id);
          const currentIdx = provIds.indexOf(modalProviderFilter());
          const nextIdx = (currentIdx - 1 + provIds.length) % provIds.length;
          setModalProviderFilter(provIds[nextIdx]);
          setModalModelIndex(0);
          return;
        }
        if (key.name === "e") {
          const m = list[modalModelIndex()];
          if (m && m.supportsReasoning && m.supportedEfforts.length > 0) {
            const efforts = m.supportedEfforts;
            const curEff = efforts.includes(modalReasoningEffort()) ? modalReasoningEffort() : m.defaultEffort;
            const eIdx = efforts.indexOf(curEff);
            setModalReasoningEffort(efforts[(eIdx + 1) % efforts.length]);
          }
          return;
        }
        if (key.name === "f") {
          const m = list[modalModelIndex()];
          if (m) handleToggleFavorite(m.id);
          return;
        }
        if (key.name === "d") {
          const m = list[modalModelIndex()];
          if (m) handleSetDefaultModel(m.id);
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          const m = list[modalModelIndex()];
          if (m) {
            const eff = clampModelEffort(m.id, modalReasoningEffort());
            tabsStore.updateActiveTab({
              provider: m.provider,
              model: m.id,
              reasoningEffort: eff,
            });
            setActiveModal("none");
          }
          return;
        }
        if (/^[1-8]$/.test(key.name)) {
          const directIdx = parseInt(key.name, 10) - 1;
          if (directIdx >= 0 && directIdx < list.length) {
            const m = list[directIdx];
            const eff = clampModelEffort(m.id, modalReasoningEffort());
            tabsStore.updateActiveTab({
              provider: m.provider,
              model: m.id,
              reasoningEffort: eff,
            });
            setActiveModal("none");
          }
          return;
        }
        if (key.name === "q") {
          setActiveModal("none");
          return;
        }
        return;
      }

      // --- Provider Settings Modal Navigation ---
      if (modal === "provider") {
        if (key.name === "down" || key.name === "j") {
          setModalProviderIndex((prev) => Math.min(PROVIDER_METAS.length - 1, prev + 1));
          return;
        }
        if (key.name === "up" || key.name === "k") {
          setModalProviderIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          const p = PROVIDER_METAS[modalProviderIndex()];
          if (p) {
            tabsStore.updateActiveTab({ provider: p.id });
            setActiveModal("none");
          }
          return;
        }
        if (/^[1-6]$/.test(key.name)) {
          const directIdx = parseInt(key.name, 10) - 1;
          if (directIdx >= 0 && directIdx < PROVIDER_METAS.length) {
            tabsStore.updateActiveTab({ provider: PROVIDER_METAS[directIdx].id });
            setActiveModal("none");
          }
          return;
        }
        if (key.name === "q") {
          setActiveModal("none");
          return;
        }
        return;
      }

      // --- Theme Picker Modal Navigation ---
      if (modal === "theme") {
        if (key.name === "down" || key.name === "j") {
          setModalThemeIndex((prev) => Math.min(AVAILABLE_THEMES.length - 1, prev + 1));
          return;
        }
        if (key.name === "up" || key.name === "k") {
          setModalThemeIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          const tName = AVAILABLE_THEMES[modalThemeIndex()];
          if (tName) {
            setThemeName(tName);
            setActiveModal("none");
          }
          return;
        }
        if (/^[1-7]$/.test(key.name)) {
          const directIdx = parseInt(key.name, 10) - 1;
          if (directIdx >= 0 && directIdx < AVAILABLE_THEMES.length) {
            setThemeName(AVAILABLE_THEMES[directIdx]);
            setActiveModal("none");
          }
          return;
        }
        if (key.name === "q") {
          setActiveModal("none");
          return;
        }
        return;
      }

      // --- Quick Open & Mark Files Modal Navigation (Ctrl+P) ---
      if (modal === "quick-files") {
        const q = modalQuery().toLowerCase().trim();
        const allFiles = workspaceFiles();
        const filtered = q ? allFiles.filter((f) => f.toLowerCase().includes(q)) : allFiles;

        if (key.name === "escape") {
          setActiveModal("none");
          return;
        }
        if (key.name === "down") {
          setModalFileIndex((prev) => Math.min(Math.max(0, filtered.length - 1), prev + 1));
          return;
        }
        if (key.name === "up") {
          setModalFileIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.name === "space") {
          const target = filtered[modalFileIndex()];
          if (target) {
            handleToggleMarkFile(target);
          }
          return;
        }
        if (key.name === "backspace") {
          setModalQuery((prev) => prev.slice(0, -1));
          setModalFileIndex(0);
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          const marked = markedFiles();
          if (marked.length > 0) {
            handleConfirmAttachMarkedFiles(marked);
          } else {
            const single = filtered[modalFileIndex()];
            if (single) {
              handleConfirmAttachMarkedFiles([single]);
            }
          }
          return;
        }
        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && !key.option) {
          setModalQuery((prev) => prev + key.sequence);
          setModalFileIndex(0);
          return;
        }
        return;
      }

      // --- Universal Command Palette Navigation (Ctrl+Shift+P) ---
      if (modal === "palette") {
        const q = modalQuery().toLowerCase().trim();
        const allCmds = commandPaletteActions();
        const filtered = q
          ? allCmds.filter(
              (c) =>
                c.title.toLowerCase().includes(q) ||
                c.id.toLowerCase().includes(q) ||
                (c.category && c.category.toLowerCase().includes(q))
            )
          : allCmds;

        if (key.name === "escape") {
          setActiveModal("none");
          return;
        }
        if (key.name === "down") {
          setModalPaletteIndex((prev) => Math.min(Math.max(0, filtered.length - 1), prev + 1));
          return;
        }
        if (key.name === "up") {
          setModalPaletteIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.name === "backspace") {
          setModalQuery((prev) => prev.slice(0, -1));
          setModalPaletteIndex(0);
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          const selected = filtered[modalPaletteIndex()];
          if (selected) {
            setActiveModal("none");
            selected.action();
          }
          return;
        }
        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && !key.option) {
          setModalQuery((prev) => prev + key.sequence);
          setModalPaletteIndex(0);
          return;
        }
        return;
      }

      // File Viewer, Diff Viewer & Help navigation
      if (modal === "file" || modal === "diff" || modal === "help") {
        if (key.name === "q" || key.name === "return") {
          setActiveModal("none");
          return;
        }
        return;
      }

      // Dirty Dialog choices (s, c, p, a)
      if (modal === "dirty") {
        if (key.name === "s") {
          void gitStash(tabsStore.activeTab().cwd).then(() => refreshGitAndFiles());
          setActiveModal("none");
          if (pendingPrompt()) handleSend(pendingPrompt()!);
          return;
        }
        if (key.name === "c") {
          void gitCommit(tabsStore.activeTab().cwd, "WIP: checkpoint before agent run").then(() => refreshGitAndFiles());
          setActiveModal("none");
          if (pendingPrompt()) handleSend(pendingPrompt()!);
          return;
        }
        if (key.name === "p") {
          setActiveModal("none");
          if (pendingPrompt()) handleSend(pendingPrompt()!);
          return;
        }
        if (key.name === "a") {
          setActiveModal("none");
          setPendingPrompt(null);
          return;
        }
        return;
      }

      // Permission Dialog approval keys (y, a, n)
      if (hasApproval) {
        const approval = tabsStore.activeTab().session.pendingApproval();
        if (approval) {
          if (key.name === "y") {
            const tab = tabsStore.activeTab();
            if (tab.session.activeRunID()) {
              void client.approve(tab.session.activeRunID()!, approval.requestID, approval.fingerprint);
              tab.session.setPendingApproval(null);
            }
            return;
          }
          if (key.name === "n") {
            const tab = tabsStore.activeTab();
            if (tab.session.activeRunID()) {
              void client.deny(tab.session.activeRunID()!, approval.requestID, approval.fingerprint, "Denied by user");
              tab.session.setPendingApproval(null);
            }
            return;
          }
        }
      }

      return; // Trap all other unhandled keys while dialog is active
    }

    // 2. LEADER CHORD (Ctrl+X)
    if (key.ctrl && key.name === "x") {
      key.preventDefault();
      key.stopPropagation();
      setLeaderActive(!leaderActive());
      return;
    }

    if (leaderActive()) {
      setLeaderActive(false);
      key.preventDefault();
      key.stopPropagation();

      if (key.name === "b") {
        setSidebarOpen(!sidebarOpen());
      } else if (key.name === "r" || key.name === "l") {
        setRightSidebarOpen(!rightSidebarOpen());
      } else if (key.name === "m") {
        setActiveModal("model");
      } else if (key.name === "p") {
        setActiveModal("provider");
      } else if (key.name === "f") {
        setModalQuery("");
        setModalFileIndex(0);
        setActiveModal("quick-files");
      } else if (key.name === "P" || key.name === ":") {
        setModalQuery("");
        setModalPaletteIndex(0);
        setActiveModal("palette");
      } else if (key.name === "t") {
        setActiveModal("theme");
      } else if (key.name === "d") {
        void openDiffViewer();
      } else if (key.name === "c") {
        handleExecuteSlashCommand("/compact");
      } else if (key.name === "u") {
        handleExecuteSlashCommand("/undo");
      } else if (key.name === "h" || key.name === "?") {
        setActiveModal("help");
      } else if (key.name === "w") {
        tabsStore.closeTab(tabsStore.activeTabId());
      }
      return;
    }

    // 3. GLOBAL TAB SHORTCUTS (Ctrl+T, Ctrl+W, Ctrl+1..9)
    if (key.ctrl && key.name === "t") {
      key.preventDefault();
      tabsStore.addTab();
      return;
    }

    if (key.ctrl && key.name === "w") {
      key.preventDefault();
      tabsStore.closeTab(tabsStore.activeTabId());
      return;
    }

    if (key.ctrl && /^[1-9]$/.test(key.name)) {
      key.preventDefault();
      const tabNum = parseInt(key.name, 10);
      tabsStore.switchTabByIndex(tabNum - 1);
      return;
    }

    // 4. WORKBENCH DRAWER SHORTCUTS (Ctrl+B Left Drawer, Ctrl+L Right Drawer)
    if (key.ctrl && key.name === "b") {
      key.preventDefault();
      setSidebarOpen(!sidebarOpen());
      return;
    }

    if (key.ctrl && key.name === "l") {
      key.preventDefault();
      setRightSidebarOpen(!rightSidebarOpen());
      return;
    }

    if (key.ctrl && key.name === "m") {
      key.preventDefault();
      setActiveModal("model");
      return;
    }

    const isP = key.name === "p" || key.name === "P";

    // Universal Command Palette (Ctrl+Shift+P)
    if (key.ctrl && key.shift && isP) {
      key.preventDefault();
      setModalQuery("");
      setModalPaletteIndex(0);
      setActiveModal("palette");
      return;
    }

    // Quick Open & Mark Files (Ctrl+P)
    if (key.ctrl && !key.shift && isP) {
      key.preventDefault();
      setModalQuery("");
      setModalFileIndex(0);
      setActiveModal("quick-files");
      return;
    }

    // AI Provider Configuration (Alt+P or Meta+P)
    if ((key.option || key.meta) && isP) {
      key.preventDefault();
      setActiveModal("provider");
      return;
    }

    // 5. VIM MODES
    if (vimMode() === "INSERT") {
      if (key.name === "escape") {
        key.preventDefault();
        setVimMode("NORMAL");
      }
    } else if (vimMode() === "NORMAL") {
      if (key.name === "i" || key.name === "return" || key.name === "enter") {
        key.preventDefault();
        setVimMode("INSERT");
      } else if (key.name === "t") {
        key.preventDefault();
        tabsStore.addTab();
      } else if (key.name === "x") {
        key.preventDefault();
        tabsStore.closeTab(tabsStore.activeTabId());
      } else if (key.name === "d") {
        key.preventDefault();
        void openDiffViewer();
      } else if (key.name === "l") {
        key.preventDefault();
        setRightSidebarOpen(!rightSidebarOpen());
      } else if (key.name === "b") {
        key.preventDefault();
        setSidebarOpen(!sidebarOpen());
      } else if (key.name === "?") {
        key.preventDefault();
        setActiveModal("help");
      }
    }
  });

  async function handleSend(text: string, images?: string[]) {
    const tab = tabsStore.activeTab();
    const session = tab.session;

    setPromptHistory((prev) => [...prev, text]);

    session.appendMessage({
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      images,
      createdAt: Date.now(),
    });

    session.setIsBusy(true);

    try {
      const runID = await client.start({
        goal: text,
        provider: tab.provider,
        model: tab.model,
        reasoning_effort: tab.reasoningEffort,
        max_turns: config()?.agent.max_turns || 30,
      });

      session.setActiveRunID(runID);

      await client.subscribe(runID, 0, (ev) => {
        session.handleEvent(ev);
        if (ev.kind.startsWith("run.") || ev.kind === "tool_call") {
          triggerGitRefreshDebounced();
        }
        if (ev.kind === "run.finished" || ev.kind === "run.completed") {
          // Terminal bell alert on completion
          try {
            process.stdout.write("\x07");
          } catch {}
        }
      });
    } catch (err) {
      session.setIsBusy(false);
      session.appendMessage({
        id: `err-${Date.now()}`,
        role: "system",
        content: `Daemon communication error: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: Date.now(),
      });
    }
  }

  function handleExecuteSlashCommand(cmd: string) {
    const parts = cmd.trim().split(" ");
    const name = parts[0];
    const session = tabsStore.activeTab().session;

    switch (name) {
      case "/files":
        setModalQuery("");
        setModalFileIndex(0);
        setActiveModal("quick-files");
        break;
      case "/commands":
      case "/palette":
        setModalQuery("");
        setModalPaletteIndex(0);
        setActiveModal("palette");
        break;
      case "/provider":
      case "/providers":
        setActiveModal("provider");
        break;
      case "/model":
        setActiveModal("model");
        break;
      case "/theme":
        setActiveModal("theme");
        break;
      case "/help":
        setActiveModal("help");
        break;
      case "/diff":
        void openDiffViewer();
        break;
      case "/metrics":
        setRightSidebarOpen(!rightSidebarOpen());
        break;
      case "/status": {
        const t = tabsStore.activeTab();
        const m = t.session.metrics();
        session.appendMessage({
          id: `status-${Date.now()}`,
          role: "system",
          content: `📊 SESSION STATUS & TELEMETRY:\n• Provider: ${t.provider} | Model: ${t.model} (effort: ${t.reasoningEffort})\n• Tokens: ▲${m.promptTokens} in · ⚡${m.cacheTokens} cache · ▼${m.completionTokens} out\n• Est. Cost: $${m.costUSD.toFixed(4)}\n• Git Worktree: branch ${t.gitBranch} (${t.isDirty ? "dirty" : "clean"})\n• Active Run: ${t.session.activeRunID() || "idle"}`,
          createdAt: Date.now(),
        });
        break;
      }
      case "/context": {
        const t = tabsStore.activeTab();
        const m = t.session.metrics();
        session.appendMessage({
          id: `ctx-${Date.now()}`,
          role: "system",
          content: `󰥉 WORKING CONTEXT BREAKDOWN:\n• Prompt Tokens: ${m.promptTokens.toLocaleString()}\n• Cached Tokens: ${m.cacheTokens.toLocaleString()}\n• Output Tokens: ${m.completionTokens.toLocaleString()}\n• Reasoning Tokens: ${m.reasoningTokens.toLocaleString()}\n• Total in Context: ${(m.promptTokens + m.completionTokens).toLocaleString()}`,
          createdAt: Date.now(),
        });
        break;
      }
      case "/review": {
        handleSend("Please review our working tree git changes and identify potential bugs, regressions, or architectural improvements.");
        break;
      }
      case "/test": {
        handleSend("Please run our test suite, inspect failures if any, and suggest precise fixes.");
        break;
      }
      case "/init": {
        session.appendMessage({
          id: `init-${Date.now()}`,
          role: "system",
          content: "🏗️ Prumo initialized. Guidelines, authority maps, and provider configurations loaded.",
          createdAt: Date.now(),
        });
        break;
      }
      case "/view":
        if (parts[1]) {
          void openFileInViewer(parts[1]);
        }
        break;
      case "/compact": {
        const msgs = session.messages();
        if (msgs.length > 4) {
          const recent = msgs.slice(-4);
          session.appendMessage({
            id: `compact-${Date.now()}`,
            role: "system",
            content: `🗜️ Context compacted. Retained last ${recent.length} turns. Earlier history stored in session capsule.`,
            createdAt: Date.now(),
          });
        }
        break;
      }
      case "/undo": {
        session.appendMessage({
          id: `undo-${Date.now()}`,
          role: "system",
          content: `⏪ Reverted previous turn.`,
          createdAt: Date.now(),
        });
        break;
      }
      case "/clear":
        session.appendMessage({
          id: `clear-${Date.now()}`,
          role: "system",
          content: "Transcript cleared.",
          createdAt: Date.now(),
        });
        break;
      case "/effort":
        if (parts[1]) {
          tabsStore.updateActiveTab({ reasoningEffort: parts[1] as ReasoningEffort });
        }
        break;
      case "/export": {
        const msgs = session.messages();
        const doc = msgs.map((m) => `### ${m.role.toUpperCase()}\n${m.content}\n`).join("\n---\n\n");
        session.appendMessage({
          id: `export-${Date.now()}`,
          role: "system",
          content: `Exported transcript:\n\n${doc.slice(0, 500)}...`,
          createdAt: Date.now(),
        });
        break;
      }
      case "/quit":
        process.exit(0);
        break;
    }
  }

  async function handleToggleFavorite(modelId: string) {
    setFavoriteModels((prev) => {
      const next = prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId];
      if (config()) {
        const updated: CoderConfig = {
          ...config()!,
          general: { ...config()!.general, favorite_models: next },
        };
        setConfig(updated);
        void saveCoderConfig(updated);
      }
      return next;
    });
  }

  async function handleSetDefaultModel(modelId: string) {
    if (config()) {
      const updated: CoderConfig = {
        ...config()!,
        agent: { ...config()!.agent, default_model: modelId },
      };
      setConfig(updated);
      void saveCoderConfig(updated);
    }
    tabsStore.updateActiveTab({ model: modelId });
  }

  async function handleSetRoleModel(role: string, modelId: string) {
    setRoleModels((prev) => {
      const next = { ...prev, [role]: modelId };
      if (config()) {
        const updated: CoderConfig = {
          ...config()!,
          agent: {
            ...config()!.agent,
            role_models: next,
          },
        };
        setConfig(updated);
        void saveCoderConfig(updated);
      }
      return next;
    });
  }

  const isAnyModalOpen = () => activeModal() !== "none" || !!tabsStore.activeTab().session.pendingApproval();

  return (
    <box
      id="root"
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={palette().surface}
      overflow="hidden"
    >
      {/* Top Multi-Tab Bar */}
      <TabBar
        palette={palette()}
        tabsStore={tabsStore}
        onNewTab={() => tabsStore.addTab()}
        onOpenThemePicker={() => setActiveModal("theme")}
        onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen())}
      />

      {/* Main Workspace Body: Left Sidebar + Transcript + Right Sidebar */}
      <box flexGrow={1} flexDirection="row" width="100%" overflow="hidden">
        {/* Collapsible Left Drawer (Worktree & Git changes) */}
        <Sidebar
          palette={palette()}
          tab={tabsStore.activeTab()}
          visible={sidebarOpen()}
          gitEntries={gitEntries()}
          workspaceFiles={workspaceFiles()}
          onOpenFile={(file) => void openFileInViewer(file)}
          onMentionFile={(file) => {}}
        />

        {/* Center Transcript Surface with Rich Text Markdown */}
        <Transcript
          palette={palette()}
          tab={tabsStore.activeTab()}
          syntaxStyle={syntaxStyle()}
          onOpenFile={(file) => void openFileInViewer(file)}
        />

        {/* Collapsible Right Drawer: Goals, Cost & Deep Telemetry */}
        <RightSidebar
          palette={palette()}
          tab={tabsStore.activeTab()}
          visible={rightSidebarOpen()}
          onClose={() => setRightSidebarOpen(false)}
        />
      </box>

      {/* Floating Dialogs and Modals with Absolute Backdrops */}
      <Show when={activeModal() === "file" && viewingFile()}>
        {(() => {
          const vf = viewingFile();
          if (!vf) return null;
          return (
            <FileViewerModal
              palette={palette()}
              syntaxStyle={syntaxStyle()}
              filePath={vf.path}
              content={vf.content}
              lines={vf.lines}
              size={vf.size}
              extension={vf.extension}
              truncated={vf.truncated}
              onClose={() => setActiveModal("none")}
            />
          );
        })()}
      </Show>

      <Show when={activeModal() === "diff"}>
        <DiffViewerModal
          palette={palette()}
          diffText={diffContent()}
          onClose={() => setActiveModal("none")}
        />
      </Show>

      <Show when={activeModal() === "model"}>
        <ModelPickerModal
          palette={palette()}
          currentProvider={tabsStore.activeTab().provider}
          currentModel={tabsStore.activeTab().model}
          currentEffort={modalReasoningEffort()}
          favoriteModels={favoriteModels()}
          roleModels={roleModels()}
          highlightedIndex={modalModelIndex()}
          activeProviderFilter={modalProviderFilter()}
          onSelect={(prov, mod, eff) => {
            tabsStore.updateActiveTab({
              provider: prov,
              model: mod,
              reasoningEffort: eff,
            });
            setActiveModal("none");
          }}
          onProviderChange={(prov) => {
            setModalProviderFilter(prov);
            setModalModelIndex(0);
          }}
          onEffortChange={(eff) => setModalReasoningEffort(eff)}
          onHighlightedIndexChange={(idx) => setModalModelIndex(idx)}
          onToggleFavorite={handleToggleFavorite}
          onSetDefaultModel={handleSetDefaultModel}
          onSetRoleModel={handleSetRoleModel}
          onClose={() => setActiveModal("none")}
        />
      </Show>

      <Show when={activeModal() === "provider"}>
        <ProviderSettingsModal
          palette={palette()}
          activeProvider={tabsStore.activeTab().provider}
          config={config()}
          highlightedIndex={modalProviderIndex()}
          onSelectProvider={(provId) => {
            tabsStore.updateActiveTab({ provider: provId });
            setActiveModal("none");
          }}
          onClose={() => setActiveModal("none")}
        />
      </Show>

      <Show when={activeModal() === "theme"}>
        <ThemePickerModal
          palette={palette()}
          highlightedIndex={modalThemeIndex()}
          onSelectTheme={(tName) => {
            setThemeName(tName);
            setActiveModal("none");
          }}
          onClose={() => setActiveModal("none")}
        />
      </Show>

      <Show when={activeModal() === "help"}>
        <HelpModal palette={palette()} onClose={() => setActiveModal("none")} />
      </Show>

      <Show when={activeModal() === "dirty"}>
        <DirtyDialog
          palette={palette()}
          summary={dirtySummary()}
          onAction={async (act) => {
            setActiveModal("none");
            if (act === "stash") {
              await gitStash(tabsStore.activeTab().cwd);
              await refreshGitAndFiles();
            } else if (act === "commit") {
              await gitCommit(tabsStore.activeTab().cwd, "WIP: checkpoint before agent run");
              await refreshGitAndFiles();
            }
            if ((act === "proceed" || act === "stash" || act === "commit") && pendingPrompt()) {
              handleSend(pendingPrompt()!);
            }
          }}
        />
      </Show>

      <Show when={tabsStore.activeTab().session.pendingApproval()}>
        {(() => {
          const approval = tabsStore.activeTab().session.pendingApproval();
          if (!approval) return null;
          return (
            <PermissionDialog
              palette={palette()}
              tool={approval.tool}
              arguments={approval.arguments}
              fingerprint={approval.fingerprint}
              onApprove={async () => {
                const tab = tabsStore.activeTab();
                if (tab.session.activeRunID()) {
                  await client.approve(
                    tab.session.activeRunID()!,
                    approval.requestID,
                    approval.fingerprint,
                  );
                  tab.session.setPendingApproval(null);
                }
              }}
              onDeny={async (reason) => {
                const tab = tabsStore.activeTab();
                if (tab.session.activeRunID()) {
                  await client.deny(
                    tab.session.activeRunID()!,
                    approval.requestID,
                    approval.fingerprint,
                    reason,
                  );
                  tab.session.setPendingApproval(null);
                }
              }}
            />
          );
        })()}
      </Show>

      <Show when={activeModal() === "quick-files"}>
        <QuickFileModal
          palette={palette()}
          availableFiles={workspaceFiles()}
          markedFiles={markedFiles()}
          filterQuery={modalQuery()}
          highlightedIndex={modalFileIndex()}
          onFilterQueryChange={setModalQuery}
          onToggleMark={handleToggleMarkFile}
          onConfirmMarks={handleConfirmAttachMarkedFiles}
          onOpenFile={(f) => {
            setActiveModal("none");
            void openFileInViewer(f);
          }}
          onClose={() => setActiveModal("none")}
        />
      </Show>

      <Show when={activeModal() === "palette"}>
        <CommandPaletteModal
          palette={palette()}
          commands={commandPaletteActions()}
          filterQuery={modalQuery()}
          highlightedIndex={modalPaletteIndex()}
          onFilterQueryChange={setModalQuery}
          onExecuteCommand={(cmd) => {
            setActiveModal("none");
            cmd.action();
          }}
          onClose={() => setActiveModal("none")}
        />
      </Show>

      {/* Composer Input Area (Modal-Aware Focus) */}
      <Composer
        palette={palette()}
        isBusy={tabsStore.activeTab().session.isBusy()}
        isModalOpen={isAnyModalOpen()}
        vimMode={vimMode()}
        availableFiles={workspaceFiles()}
        promptHistory={promptHistory()}
        initialValue={composerDraft()}
        onSend={(text, imgs) => {
          setComposerDraft("");
          handleSend(text, imgs);
        }}
        onSetVimMode={setVimMode}
        onExecuteCommand={handleExecuteSlashCommand}
      />

      {/* Bottom Statusline */}
      <StatusLine
        palette={palette()}
        tab={tabsStore.activeTab()}
        vimMode={vimMode()}
        leaderActive={leaderActive()}
        copyNotice={copyNotice()}
      />
    </box>
  );
}

export default App;
