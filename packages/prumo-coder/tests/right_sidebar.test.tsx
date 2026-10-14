// packages/prumo-coder/tests/right_sidebar.test.tsx
// Verification test for RightSidebar, Model catalog pricing, and living plan rendering
import { test, expect } from "bun:test";
import { testRender } from "@opentui/solid";
import { getThemePalette } from "../src/theme/palette";
import { createTabsStore } from "../src/state/tabs";
import { RightSidebar } from "../src/ui/RightSidebar";
import { calculateEstimatedCost, findModel } from "../src/models/catalog";

test("Model catalog pricing calculation calculates totals and cache savings", () => {
  const model = findModel("claude-3-7-sonnet");
  expect(model).toBeDefined();
  expect(model?.contextWindow).toBe(200_000);
  expect(model?.supportsVision).toBe(true);
  expect(model?.supportsReasoning).toBe(true);

  const cost = calculateEstimatedCost("claude-3-7-sonnet", 100_000, 10_000, 50_000);
  expect(cost.totalUSD).toBeGreaterThan(0);
  expect(cost.savingsUSD).toBeGreaterThan(0);
});

test("RightSidebar renders living plan, telemetry, and cost metrics", async () => {
  const palette = getThemePalette("catppuccin-mocha");
  const tabs = createTabsStore();
  const tab = tabs.activeTab();

  const setup = await testRender(() => {
    return (
      <box width={80} height={36}>
        <RightSidebar
          palette={palette}
          tab={tab}
          visible={true}
          onClose={() => {}}
        />
      </box>
    );
  }, { width: 80, height: 36 });

  try {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("METRICS & GOALS");
    expect(frame).toContain("LIVING PLAN");
    expect(frame).toContain("COST ESTIMATION");
    expect(frame).toContain("TOKEN TELEMETRY");
    expect(frame).toContain("CONTEXT WINDOW");
  } finally {
    setup.renderer.destroy();
  }
});
