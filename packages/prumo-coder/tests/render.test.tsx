// packages/prumo-coder/tests/render.test.ts
// Headless frame rendering verification test for prumo-coder using OpenTUI testRender
import { test, expect } from "bun:test";
import { testRender } from "@opentui/solid";
import { App } from "../src/app";
import { getThemePalette } from "../src/theme/palette";
import { Glyph } from "../src/theme/glyphs";

test("ThemePalette loads valid RGBA colors", () => {
  const p = getThemePalette("catppuccin-mocha");
  expect(p.name).toBe("catppuccin-mocha");
  expect(p.surface).toBeDefined();
  expect(p.panel).toBeDefined();
  expect(p.accent).toBeDefined();
});

test("Glyph constants are populated", () => {
  expect(Glyph.gitBranch).toBe("");
  expect(Glyph.statusStreaming).toBe("◉");
  expect(Glyph.vimNormal).toContain("NORMAL");
});

test("prumo-coder headless frame renders", async () => {
  const setup = await testRender(() => <App />, { width: 100, height: 28 });
  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);
    // Should render tab bar, status bar, and banner or prompt
    expect(frame).toContain("Ctrl+T");
    expect(frame).toContain("INSERT");
  } finally {
    setup.renderer.destroy();
  }
});
