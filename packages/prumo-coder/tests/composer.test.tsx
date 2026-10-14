// packages/prumo-coder/tests/composer.test.tsx
import { test, expect } from "bun:test";
import { testRender } from "@opentui/solid";
import { getThemePalette } from "../src/theme/palette";
import { Composer, SLASH_COMMANDS } from "../src/ui/Composer";

test("Composer exports required coding agent slash commands including provider configuration", () => {
  const names = SLASH_COMMANDS.map((c) => c.name);
  expect(names).toContain("/provider");
  expect(names).toContain("/providers");
  expect(names).toContain("/model");
  expect(names).toContain("/effort");
  expect(names).toContain("/commands");
  expect(names).toContain("/palette");
  expect(names).toContain("/files");
  expect(names).toContain("/status");
  expect(names).toContain("/context");
  expect(names).toContain("/diff");
  expect(names).toContain("/view");
  expect(names).toContain("/compact");
  expect(names).toContain("/undo");
  expect(names).toContain("/review");
  expect(names).toContain("/test");
  expect(names).toContain("/init");
  expect(names).toContain("/clear");
  expect(names).toContain("/theme");
  expect(names).toContain("/export");
  expect(names).toContain("/help");
  expect(names).toContain("/quit");
});

test("Composer renders slash command suggestions when input starts with /", async () => {
  const palette = getThemePalette("catppuccin-mocha");

  const setup = await testRender(() => {
    return (
      <box width={80} height={15}>
        <Composer
          palette={palette}
          isBusy={false}
          isModalOpen={false}
          vimMode="INSERT"
          initialValue="/mod"
          onSend={() => {}}
          onSetVimMode={() => {}}
        />
      </box>
    );
  }, { width: 80, height: 15 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("SLASH COMMAND");
    expect(frame).toContain("/model");
    expect(frame).toContain("Tab to complete");
  } finally {
    setup.renderer.destroy();
  }
});

test("Composer renders file mention suggestions when input contains @", async () => {
  const palette = getThemePalette("catppuccin-mocha");
  const files = [
    "packages/client-core/src/index.ts",
    "packages/prumo-coder/src/main.ts",
    "README.md",
  ];

  const setup = await testRender(() => {
    return (
      <box width={80} height={15}>
        <Composer
          palette={palette}
          isBusy={false}
          isModalOpen={false}
          vimMode="INSERT"
          initialValue="Inspect @main"
          availableFiles={files}
          onSend={() => {}}
          onSetVimMode={() => {}}
        />
      </box>
    );
  }, { width: 80, height: 15 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("WORKSPACE FILES");
    expect(frame).toContain("packages/prumo-coder/src/main.ts");
    expect(frame).toContain("Tab to complete");
  } finally {
    setup.renderer.destroy();
  }
});
