#!/usr/bin/env bun
// packages/prumo-coder/src/cli.tsx
// CLI launcher for prumo-coder using OpenTUI CLI renderer
import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { App } from "./app";

export async function run(args: string[] = process.argv.slice(2)): Promise<void> {
  if (args.includes("--version") || args.includes("-v") || args.includes("-V")) {
    console.log("prumo-coder 0.1.0 (Autonomous Coding Agent · OpenTUI Solid)");
    return;
  }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`prumo-coder — Autonomous Terminal Coding Agent

Usage:
  prumo-coder [options]

Options:
  -v, --version    Show version
  -h, --help       Show help
  --theme <name>   Launch with specific theme (catppuccin-mocha, tokyo-night, zed-dark, daisy-lain, dracula, nord, github-dark)

Keybindings:
  Ctrl+T           New independent tab
  Ctrl+W           Close active tab
  Ctrl+1..9        Switch directly to tab 1..9
  Ctrl+B           Toggle Git / Worktree drawer
  Ctrl+M           Open AI Model & Reasoning Effort picker
  Ctrl+P           Open Theme Palette picker
  Ctrl+X           Leader key chord (^X)
  Esc              Enter Vim NORMAL navigation mode
  i / Enter        Enter Vim INSERT editing mode
  @<file>          Fuzzy search and attach files
  /<cmd>           Execute slash commands (/model, /theme, /clear, /quit)
  !<cmd>           Direct shell execution bypass
`);
    return;
  }

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
    targetFps: 30,
  });

  const destroy = () => {
    try {
      renderer.destroy();
    } catch {}
    process.exit(0);
  };

  process.on("SIGTERM", destroy);
  process.on("SIGINT", destroy);

  await render(() => <App />, renderer);
}

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
