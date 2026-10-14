// packages/client-core/tests/store.test.ts
import { test, expect } from "bun:test";
import { createPrumoSessionStore } from "../src/store/session";
import { parseCoderConfig, serializeCoderConfig, DEFAULT_CODER_CONFIG } from "../src/config/toml";

test("PrumoSessionStore appends messages and tracks metrics", () => {
  const store = createPrumoSessionStore();
  expect(store.messages().length).toBe(0);

  store.appendMessage({
    id: "msg-1",
    role: "user",
    content: "hello prumo",
    createdAt: Date.now(),
  });

  expect(store.messages().length).toBe(1);
  expect(store.messages()[0].content).toBe("hello prumo");

  // Telemetry event handling
  store.handleEvent({
    run_id: "run-1",
    seq: 1,
    timestamp: Date.now(),
    kind: "usage",
    payload: {
      prompt_tokens: 1500,
      completion_tokens: 250,
      cache_tokens: 800,
      cost_usd: 0.005,
    },
  });

  expect(store.metrics().promptTokens).toBe(1500);
  expect(store.metrics().completionTokens).toBe(250);
  expect(store.metrics().cacheTokens).toBe(800);
  expect(store.metrics().costUSD).toBe(0.005);
});

test("PrumoSessionStore handles streaming deltas and finalizes on run.finished", () => {
  const store = createPrumoSessionStore();
  store.setIsBusy(true);

  store.handleEvent({
    id: "ev-1",
    run_id: "run-1",
    kind: "text_delta",
    created_at: new Date().toISOString(),
    payload: { text: "Hello " },
  });

  store.handleEvent({
    id: "ev-2",
    run_id: "run-1",
    kind: "text_delta",
    created_at: new Date().toISOString(),
    payload: { text: "world!" },
  });

  expect(store.messages().length).toBe(1);
  expect(store.messages()[0].content).toBe("Hello world!");
  expect(store.messages()[0].isStreaming).toBe(true);
  expect(store.isBusy()).toBe(true);

  store.handleEvent({
    id: "ev-3",
    run_id: "run-1",
    kind: "run.finished",
    created_at: new Date().toISOString(),
  });

  expect(store.isBusy()).toBe(false);
  expect(store.messages()[0].isStreaming).toBe(false);
});

test("CoderConfig TOML serialization and parsing", () => {
  const tomlStr = serializeCoderConfig(DEFAULT_CODER_CONFIG);
  expect(tomlStr).toContain("catppuccin-mocha");

  const parsed = parseCoderConfig(tomlStr);
  expect(parsed.general.theme).toBe("catppuccin-mocha");
  expect(parsed.agent.default_model).toBe("claude-3-7-sonnet");
});

