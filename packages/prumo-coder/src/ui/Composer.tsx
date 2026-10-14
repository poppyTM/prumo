// packages/prumo-coder/src/ui/Composer.tsx
// Rich composer with @file mentions, /slash commands, !shell bypass, prompt history, and Tab auto-complete
import { createSignal, createMemo, createEffect, Show, For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes, type MouseEvent } from "@opentui/core";
import { Glyph } from "../theme/glyphs";
import type { ThemePalette } from "../theme/palette";

export interface ComposerProps {
  palette: ThemePalette;
  isBusy: boolean;
  isModalOpen: boolean;
  vimMode: "INSERT" | "NORMAL";
  availableFiles?: string[];
  promptHistory?: string[];
  initialValue?: string;
  onSend: (text: string, images?: string[]) => void;
  onSetVimMode: (mode: "INSERT" | "NORMAL") => void;
  onExecuteCommand?: (cmd: string) => void;
}

export const SLASH_COMMANDS = [
  { name: "/commands", desc: "Open Universal Command Palette (Ctrl+Shift+P)" },
  { name: "/palette", desc: "Open Universal Command Palette (Ctrl+Shift+P)" },
  { name: "/files", desc: "Quick Open & Mark workspace files (Ctrl+P)" },
  { name: "/provider", desc: "Configure AI providers, API keys & custom base URLs (Alt+P)" },
  { name: "/providers", desc: "Configure AI providers, API keys & custom base URLs (Alt+P)" },
  { name: "/model", desc: "Select AI provider, model & reasoning effort (Ctrl+M)" },
  { name: "/effort", desc: "Change reasoning effort level (none..max)" },
  { name: "/diff", desc: "Open visual Git Diff Inspector" },
  { name: "/view", desc: "Open File Viewer modal (/view <file>)" },
  { name: "/status", desc: "Show agent session telemetry & active model info" },
  { name: "/context", desc: "Inspect working context token breakdown" },
  { name: "/compact", desc: "Compact conversation history context capsule" },
  { name: "/undo", desc: "Revert latest agent turn" },
  { name: "/review", desc: "Instruct agent to review git working changes" },
  { name: "/test", desc: "Instruct agent to run test suite and fix failures" },
  { name: "/init", desc: "Initialize Prumo in current repository" },
  { name: "/clear", desc: "Clear active tab transcript" },
  { name: "/theme", desc: "Switch terminal color palette" },
  { name: "/export", desc: "Export transcript to markdown file" },
  { name: "/help", desc: "Show keyboard cheatsheet & documentation" },
  { name: "/quit", desc: "Exit prumo-coder" },
];

export const AUTOCOMPLETE_PAGE_SIZE = 7;

export function Composer(props: ComposerProps) {
  const [input, setInput] = createSignal(props.initialValue ?? "");
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  const [selectedAutoIndex, setSelectedAutoIndex] = createSignal(0);

  createEffect(() => {
    if (props.initialValue !== undefined) {
      setInput(props.initialValue);
    }
  });

  const prefixType = createMemo(() => {
    const val = input().trim();
    if (val.startsWith("!")) return "shell";
    if (val.startsWith("/")) return "slash";
    if (val.includes("@")) return "file";
    return "text";
  });

  const matchingSlashCommands = createMemo(() => {
    const val = input().trim();
    if (!val.startsWith("/")) return [];
    const query = val.toLowerCase();
    const matches = SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(query));
    return matches;
  });

  const slashWindowStart = createMemo(() => {
    const cur = selectedAutoIndex();
    const total = matchingSlashCommands().length;
    if (total <= AUTOCOMPLETE_PAGE_SIZE) return 0;
    return Math.max(0, Math.min(cur - Math.floor(AUTOCOMPLETE_PAGE_SIZE / 2), total - AUTOCOMPLETE_PAGE_SIZE));
  });

  const visibleSlashCommands = createMemo(() => {
    const start = slashWindowStart();
    return matchingSlashCommands()
      .slice(start, start + AUTOCOMPLETE_PAGE_SIZE)
      .map((cmd, idx) => ({ cmd, globalIndex: start + idx }));
  });

  const matchingFiles = createMemo(() => {
    const val = input();
    const atIndex = val.lastIndexOf("@");
    if (atIndex === -1) return [];
    const query = val.slice(atIndex + 1).toLowerCase();
    const list = props.availableFiles || [];
    return list.filter((f) => f.toLowerCase().includes(query));
  });

  const fileWindowStart = createMemo(() => {
    const cur = selectedAutoIndex();
    const total = matchingFiles().length;
    if (total <= AUTOCOMPLETE_PAGE_SIZE) return 0;
    return Math.max(0, Math.min(cur - Math.floor(AUTOCOMPLETE_PAGE_SIZE / 2), total - AUTOCOMPLETE_PAGE_SIZE));
  });

  const visibleFiles = createMemo(() => {
    const start = fileWindowStart();
    return matchingFiles()
      .slice(start, start + AUTOCOMPLETE_PAGE_SIZE)
      .map((file, idx) => ({ file, globalIndex: start + idx }));
  });

  const hasAutocomplete = createMemo(() => {
    return matchingSlashCommands().length > 0 || matchingFiles().length > 0;
  });

  const [attachedImages, setAttachedImages] = createSignal<string[]>([]);

  function isImagePath(p: string) {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p);
  }

  function handleSelectFile(filePath: string) {
    if (isImagePath(filePath)) {
      if (!attachedImages().includes(filePath)) {
        setAttachedImages((prev) => [...prev, filePath]);
      }
    }
    const val = input();
    const atIndex = val.lastIndexOf("@");
    if (atIndex !== -1) {
      const updated = val.slice(0, atIndex) + "@" + filePath + " ";
      setInput(updated);
    }
  }

  function removeAttachedImage(img: string) {
    setAttachedImages((prev) => prev.filter((i) => i !== img));
  }

  function handleSubmit() {
    const text = input().trim();
    if (!text || props.isBusy || props.isModalOpen) return;

    if (text.startsWith("/") && props.onExecuteCommand) {
      props.onExecuteCommand(text);
      setInput("");
      setHistoryIndex(-1);
      return;
    }

    props.onSend(text, attachedImages());
    setInput("");
    setAttachedImages([]);
    setHistoryIndex(-1);
  }

  function handleSelectSlashCommand(cmdName: string) {
    setInput(cmdName + " ");
  }

  // --- Keyboard Handler for Tab-completion and arrow navigation ---
  useKeyboard((key) => {
    if (props.isModalOpen || props.isBusy) return;

    const slashMatches = matchingSlashCommands();
    const fileMatches = matchingFiles();
    const isSlashActive = slashMatches.length > 0 && input().startsWith("/");
    const isFileActive = fileMatches.length > 0 && input().includes("@");
    const activeListLength = isSlashActive ? slashMatches.length : isFileActive ? fileMatches.length : 0;

    if (activeListLength > 0) {
      // 1. TAB COMPLETION: Complete current suggestion
      if (key.name === "tab") {
        key.preventDefault();
        key.stopPropagation();
        if (isSlashActive) {
          const item = slashMatches[selectedAutoIndex() % slashMatches.length];
          if (item) {
            handleSelectSlashCommand(item.name);
          }
        } else if (isFileActive) {
          const file = fileMatches[selectedAutoIndex() % fileMatches.length];
          if (file) {
            handleSelectFile(file);
          }
        }
        return;
      }

      // 2. ARROW DOWN: Next suggestion
      if (key.name === "down") {
        key.preventDefault();
        key.stopPropagation();
        setSelectedAutoIndex((prev) => (prev + 1) % activeListLength);
        return;
      }

      // 3. ARROW UP: Previous suggestion
      if (key.name === "up") {
        key.preventDefault();
        key.stopPropagation();
        setSelectedAutoIndex((prev) => (prev - 1 + activeListLength) % activeListLength);
        return;
      }
    }

    // Prompt History navigation when input is empty
    if (key.name === "up" && input().trim().length === 0 && (props.promptHistory || []).length > 0) {
      key.preventDefault();
      const history = props.promptHistory || [];
      const nextIndex = historyIndex() === -1 ? history.length - 1 : Math.max(0, historyIndex() - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
      return;
    }

    if (key.name === "down" && historyIndex() !== -1) {
      key.preventDefault();
      const history = props.promptHistory || [];
      const nextIndex = historyIndex() + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
      return;
    }
  });

  return (
    <box
      id="composer"
      flexDirection="column"
      backgroundColor={props.palette.panel}
      borderStyle="single"
      borderColor={props.palette.border}
      paddingLeft={1}
      paddingRight={1}
      flexShrink={0}
    >
      {/* Autocomplete Popup for Slash Commands */}
      <Show when={matchingSlashCommands().length > 0 && input().startsWith("/") && input().trim().length >= 1}>
        <box
          flexDirection="column"
          backgroundColor={props.palette.crust}
          borderStyle="single"
          borderColor={props.palette.borderFocus}
          paddingLeft={1}
          paddingRight={1}
          marginBottom={1}
        >
          <box height={1} justifyContent="space-between" flexDirection="row">
            <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
              {`COMMANDS [Tab to complete · ↑/↓ navigate]:`}
            </text>
            <text fg={props.palette.muted}>
              {`${selectedAutoIndex() + 1}/${matchingSlashCommands().length} matches`}
            </text>
          </box>
          <Show when={slashWindowStart() > 0}>
            <box height={1}>
              <text fg={props.palette.muted}>
                {`  ▲ ${slashWindowStart()} more above...`}
              </text>
            </box>
          </Show>
          <For each={visibleSlashCommands()}>
            {({ cmd, globalIndex }) => {
              const isHighlighted = () => selectedAutoIndex() === globalIndex;
              return (
                <box
                  height={1}
                  flexDirection="row"
                  backgroundColor={isHighlighted() ? props.palette.surface : props.palette.crust}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    handleSelectSlashCommand(cmd.name);
                  }}
                >
                  <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                    {`${isHighlighted() ? "❯ " : "  "}${cmd.name.padEnd(14, " ")} `}
                  </text>
                  <text fg={isHighlighted() ? props.palette.text : props.palette.muted}>
                    {cmd.desc}
                  </text>
                </box>
              );
            }}
          </For>
          <Show when={slashWindowStart() + AUTOCOMPLETE_PAGE_SIZE < matchingSlashCommands().length}>
            <box height={1}>
              <text fg={props.palette.muted}>
                {`  ▼ ${matchingSlashCommands().length - (slashWindowStart() + AUTOCOMPLETE_PAGE_SIZE)} more below...`}
              </text>
            </box>
          </Show>
        </box>
      </Show>

      {/* Autocomplete Popup for File Mentions */}
      <Show when={matchingFiles().length > 0 && input().includes("@")}>
        <box
          flexDirection="column"
          backgroundColor={props.palette.crust}
          borderStyle="single"
          borderColor={props.palette.borderFocus}
          paddingLeft={1}
          paddingRight={1}
          marginBottom={1}
        >
          <box height={1} justifyContent="space-between" flexDirection="row">
            <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
              {`WORKSPACE FILES (${Glyph.file}) [Tab to complete · ↑/↓ navigate]:`}
            </text>
            <text fg={props.palette.muted}>
              {`${selectedAutoIndex() + 1}/${matchingFiles().length} files`}
            </text>
          </box>
          <Show when={fileWindowStart() > 0}>
            <box height={1}>
              <text fg={props.palette.muted}>
                {`  ▲ ${fileWindowStart()} more above...`}
              </text>
            </box>
          </Show>
          <For each={visibleFiles()}>
            {({ file, globalIndex }) => {
              const isHighlighted = () => selectedAutoIndex() === globalIndex;
              return (
                <box
                  height={1}
                  flexDirection="row"
                  backgroundColor={isHighlighted() ? props.palette.surface : props.palette.crust}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    handleSelectFile(file);
                  }}
                >
                  <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                    {`${isHighlighted() ? "❯ " : "  "}`}
                  </text>
                  <text fg={isHighlighted() ? props.palette.text : props.palette.muted}>
                    {file}
                  </text>
                </box>
              );
            }}
          </For>
          <Show when={fileWindowStart() + AUTOCOMPLETE_PAGE_SIZE < matchingFiles().length}>
            <box height={1}>
              <text fg={props.palette.muted}>
                {`  ▼ ${matchingFiles().length - (fileWindowStart() + AUTOCOMPLETE_PAGE_SIZE)} more below...`}
              </text>
            </box>
          </Show>
        </box>
      </Show>

      {/* Prefix Badges */}
      <Show when={prefixType() === "shell"}>
        <box height={1}>
          <text fg={props.palette.error} attributes={TextAttributes.BOLD}>
            {`[ ! SHELL BYPASS ]`}
          </text>
        </box>
      </Show>
      <Show when={prefixType() === "slash"}>
        <box height={1}>
          <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
            {`[ / SLASH COMMAND ]`}
          </text>
        </box>
      </Show>

      {/* Attached Image References */}
      <Show when={attachedImages().length > 0}>
        <box height={1} flexDirection="row" gap={1} marginBottom={0}>
          <For each={attachedImages()}>
            {(img) => (
              <box flexDirection="row" backgroundColor={props.palette.crust} paddingLeft={1} paddingRight={1}>
                <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
                  {`🖼️ ${img.split("/").pop()} `}
                </text>
                <text
                  fg={props.palette.muted}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    removeAttachedImage(img);
                  }}
                >
                  {`[×]`}
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>

      {/* Input Prompt Box */}
      <box flexDirection="row" alignItems="center">
        <text
          fg={props.vimMode === "NORMAL" ? props.palette.warning : props.palette.success}
          attributes={TextAttributes.BOLD}
        >
          {props.vimMode === "NORMAL" ? "NORMAL ❯ " : "INSERT ❯ "}
        </text>

        <input
          focused={!props.isModalOpen && props.vimMode === "INSERT" && !props.isBusy}
          width="100%"
          value={input()}
          backgroundColor={props.palette.panel}
          textColor={props.palette.text}
          cursorColor={props.palette.accent}
          placeholder={
            props.isBusy
              ? "Agent working... [Esc] Explore transcript"
              : props.isModalOpen
                ? "Dialog active... [Esc] Close dialog"
                : props.vimMode === "NORMAL"
                  ? "Press 'i' or Enter to enter insert mode"
                  : "Type message, @file, /command, !shell..."
          }
          onInput={(val: string) => {
            setInput(val);
            setSelectedAutoIndex(0);
          }}
          onSubmit={() => handleSubmit()}
        />
      </box>
    </box>
  );
}

export default Composer;
