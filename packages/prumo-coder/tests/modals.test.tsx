import { test, expect } from "bun:test";
import { testRender, useRenderer } from "@opentui/solid";
import { getThemePalette } from "../src/theme/palette";
import { FileViewerModal, DiffViewerModal } from "../src/ui/Modals";
import { createPrumoSyntaxStyle } from "../src/theme/syntax";

test("FileViewerModal renders with title, line count, and content", async () => {
  const palette = getThemePalette("catppuccin-mocha");

  const setup = await testRender(() => {
    const renderer = useRenderer();
    const syntaxStyle = createPrumoSyntaxStyle(renderer, palette);
    return (
      <box width={80} height={20}>
        <FileViewerModal
          palette={palette}
          syntaxStyle={syntaxStyle}
          filePath="src/main.ts"
          content={"console.log('hello prumo');\nexport const x = 42;"}
          lines={2}
          size={54}
          extension="ts"
          onClose={() => {}}
        />
      </box>
    );
  }, { width: 80, height: 20 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("src/main.ts");
    expect(frame).toContain("2 lines");
    expect(frame).toContain("Esc / q");
  } finally {
    setup.renderer.destroy();
  }
});

test("DiffViewerModal renders additions and deletions", async () => {
  const palette = getThemePalette("catppuccin-mocha");
  const diffSample = `--- a/file.ts\n+++ b/file.ts\n@@ -1,2 +1,3 @@\n+added line\n-removed line`;

  const setup = await testRender(() => {
    return (
      <box width={80} height={20}>
        <DiffViewerModal
          palette={palette}
          diffText={diffSample}
          onClose={() => {}}
        />
      </box>
    );
  }, { width: 80, height: 20 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("GIT WORKING TREE DIFF");
    expect(frame).toContain("+added line");
    expect(frame).toContain("-removed line");
  } finally {
    setup.renderer.destroy();
  }
});

import { ModelPickerModal, ProviderSettingsModal } from "../src/ui/Modals";

test("ModelPickerModal renders centered with provider badges and capabilities", async () => {
  const palette = getThemePalette("catppuccin-mocha");

  const setup = await testRender(() => {
    return (
      <box width={110} height={30}>
        <ModelPickerModal
          palette={palette}
          currentProvider="anthropic"
          currentModel="claude-3-7-sonnet"
          currentEffort="high"
          onSelect={() => {}}
          onClose={() => {}}
        />
      </box>
    );
  }, { width: 110, height: 30 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("AI MODELS & PROVIDERS REGISTRY");
    expect(frame).toContain("All");
    expect(frame).toContain("Anthropic");
    expect(frame).toContain("REASONING");
    expect(frame).toContain("Claude 3.7 Sonnet");
    expect(frame).toContain("CAPABILITIES");
  } finally {
    setup.renderer.destroy();
  }
});

test("ProviderSettingsModal renders provider list and endpoints", async () => {
  const palette = getThemePalette("catppuccin-mocha");

  const setup = await testRender(() => {
    return (
      <box width={110} height={30}>
        <ProviderSettingsModal
          palette={palette}
          activeProvider="anthropic"
          onSelectProvider={() => {}}
          onClose={() => {}}
        />
      </box>
    );
  }, { width: 110, height: 30 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("AI PROVIDER CONFIGURATION");
    expect(frame).toContain("Anthropic Claude");
    expect(frame).toContain("Local (Ollama / vLLM)");
    expect(frame).toContain("api.anthropic.com");
  } finally {
    setup.renderer.destroy();
  }
});

import { QuickFileModal, CommandPaletteModal } from "../src/ui/Modals";
import { getModelSupportedEfforts, clampModelEffort } from "../src/models/catalog";

test("Model dynamic reasoning effort ranges clamp correctly", () => {
  expect(getModelSupportedEfforts("claude-3-7-sonnet")).toEqual(["none", "low", "medium", "high", "max"]);
  expect(getModelSupportedEfforts("o3-mini")).toEqual(["low", "medium", "high"]);
  expect(getModelSupportedEfforts("gpt-4o")).toEqual(["none"]);

  expect(clampModelEffort("o3-mini", "low")).toBe("low");
  expect(clampModelEffort("o3-mini", "max")).toBe("medium");
  expect(clampModelEffort("gpt-4o", "high")).toBe("none");
});

test("QuickFileModal renders search bar, files, and mark status", async () => {
  const palette = getThemePalette("catppuccin-mocha");
  const files = ["src/index.ts", "src/app.tsx", "README.md"];

  const setup = await testRender(() => {
    return (
      <box width={100} height={25}>
        <QuickFileModal
          palette={palette}
          availableFiles={files}
          markedFiles={["src/index.ts"]}
          filterQuery="app"
          onClose={() => {}}
        />
      </box>
    );
  }, { width: 100, height: 25 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("QUICK OPEN & MARK FILES (Ctrl+P)");
    expect(frame).toContain("Search: app");
    expect(frame).toContain("src/app.tsx");
    expect(frame).toContain("[Marked: 1]");
  } finally {
    setup.renderer.destroy();
  }
});

test("CommandPaletteModal renders commands list, search prompt, and shortcuts", async () => {
  const palette = getThemePalette("catppuccin-mocha");
  const commands = [
    { id: "model", title: "AI Models: Select Provider", shortcut: "Ctrl+M", action: () => {} },
    { id: "files", title: "Quick Open: Search Files", shortcut: "Ctrl+P", action: () => {} },
    { id: "provider", title: "AI Providers: Configure Keys", shortcut: "Alt+P", action: () => {} },
  ];

  const setup = await testRender(() => {
    return (
      <box width={100} height={25}>
        <CommandPaletteModal
          palette={palette}
          commands={commands}
          onExecuteCommand={() => {}}
          onClose={() => {}}
        />
      </box>
    );
  }, { width: 100, height: 25 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("COMMAND PALETTE (Ctrl+Shift+P)");
    expect(frame).toContain("AI Models: Select Provider");
    expect(frame).toContain("Ctrl+M");
    expect(frame).toContain("Ctrl+P");
    expect(frame).toContain("Alt+P");
  } finally {
    setup.renderer.destroy();
  }
});

