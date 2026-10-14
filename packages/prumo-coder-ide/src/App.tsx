// packages/prumo-coder-ide/src/App.tsx
import { createSignal, onMount } from "solid-js";
import { HeaderBar } from "./components/HeaderBar";
import { ActivityRail, type ActiveView } from "./components/ActivityRail";
import { WorkspaceExplorer, type FileItem } from "./components/WorkspaceExplorer";
import { EditorSurface, type TabItem } from "./components/EditorSurface";
import { AgentInspector } from "./components/AgentInspector";
import { Statusbar } from "./components/Statusbar";
import { Client, createPrumoSessionStore } from "@prumo/client-core";
import "./styles/zed-theme.css";

export function App() {
  const [activeView, setActiveView] = createSignal<ActiveView>("explorer");
  const [activeTabId, setActiveTabId] = createSignal<string>("main.ts");
  const [activeFile, setActiveFile] = createSignal<string>("main.ts");

  const [files, setFiles] = createSignal<FileItem[]>([
    { path: "src/main.ts", name: "main.ts", isDir: false, agentStatus: "modified" },
    { path: "src/agent.ts", name: "agent.ts", isDir: false, agentStatus: "added" },
    { path: "src/utils.ts", name: "utils.ts", isDir: false },
    { path: "package.json", name: "package.json", isDir: false },
  ]);

  const [tabs, setTabs] = createSignal<TabItem[]>([
    {
      id: "main.ts",
      title: "main.ts",
      isDirty: true,
      content: `// Prumo Coder IDE - Zed-like Developer Workspace
import { Client } from "@prumo/client-core";

console.log("Welcome to Prumo Coder IDE");
`,
    },
    {
      id: "agent.ts",
      title: "agent.ts",
      isDirty: false,
      content: `export function initializeAgent() {
  return "Agent connected and operational";
}
`,
    },
  ]);

  const session = createPrumoSessionStore();
  const client = new Client(process.env.PRUMO_DAEMON_SOCKET || "/tmp/prumo-daemon.sock");

  async function handleSendPrompt(text: string) {
    session.appendMessage({
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: Date.now(),
    });

    session.setIsBusy(true);

    try {
      const runID = await client.start({
        goal: text,
        model: "claude-3-7-sonnet",
      });
      session.setActiveRunID(runID);

      await client.subscribe(runID, 0, (ev) => {
        session.handleEvent(ev);
      });
    } catch (err) {
      session.setIsBusy(false);
      session.appendMessage({
        id: `err-${Date.now()}`,
        role: "system",
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: Date.now(),
      });
    }
  }

  return (
    <div style="display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--zed-bg-app); overflow: hidden;">
      {/* 32px Zed-like Header */}
      <HeaderBar
        workspaceName="prumo"
        activeRunID={session.activeRunID()}
        isBusy={session.isBusy()}
        onOpenCommandPalette={() => console.log("Open command palette")}
      />

      {/* Main Workbench Body */}
      <div style="flex: 1; display: flex; overflow: hidden;">
        {/* 38px Activity Rail */}
        <ActivityRail activeView={activeView()} setActiveView={setActiveView} />

        {/* 260px Workspace Explorer */}
        {activeView() === "explorer" && (
          <WorkspaceExplorer
            files={files()}
            activeFile={activeFile()}
            onSelectFile={(path) => {
              setActiveFile(path);
              setActiveTabId(path.split("/").pop() || path);
            }}
          />
        )}

        {/* Center Editor Surface */}
        <EditorSurface
          tabs={tabs()}
          activeTabId={activeTabId()}
          onSelectTab={setActiveTabId}
          onCloseTab={(id) => setTabs(tabs().filter((t) => t.id !== id))}
        />

        {/* 320px Right Inspector: Prumo Agent */}
        <AgentInspector
          messages={session.messages()}
          isBusy={session.isBusy()}
          pendingApproval={session.pendingApproval()}
          onSendPrompt={handleSendPrompt}
          onApprove={async (reqID, fp) => {
            if (session.activeRunID()) {
              await client.approve(session.activeRunID()!, reqID, fp);
              session.setPendingApproval(null);
            }
          }}
          onDeny={async (reqID, fp) => {
            if (session.activeRunID()) {
              await client.deny(session.activeRunID()!, reqID, fp);
              session.setPendingApproval(null);
            }
          }}
        />
      </div>

      {/* 24px Zed-like Statusbar */}
      <Statusbar
        branch="main"
        model="claude-3-7-sonnet"
        contextPressure={session.contextPressure()}
        metrics={session.metrics()}
      />
    </div>
  );
}

export default App;
