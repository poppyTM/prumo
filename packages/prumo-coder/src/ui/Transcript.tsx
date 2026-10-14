// packages/prumo-coder/src/ui/Transcript.tsx
// Virtual scrollable transcript with Rich Text Markdown, Thinking accordions, and Tool cards
import { For, Show, createSignal } from "solid-js";
import { TextAttributes, type MouseEvent, type SyntaxStyle } from "@opentui/core";
import { Glyph } from "../theme/glyphs";
import type { ThemePalette } from "../theme/palette";
import type { Message } from "@prumo/client-core";
import type { TabState } from "../state/tabs";

export interface TranscriptProps {
  palette: ThemePalette;
  tab: TabState;
  syntaxStyle: SyntaxStyle;
  onOpenFile?: (path: string) => void;
}

export function Transcript(props: TranscriptProps) {
  const [expandedThinking, setExpandedThinking] = createSignal<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = createSignal<Record<string, boolean>>({});

  function toggleThinking(id: string) {
    setExpandedThinking((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function toggleTool(id: string) {
    setExpandedTools((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  const welcomeBanner = `
 ██████╗ ██████╗ ██╗   ██╗███╗   ███╗ ██████╗ 
 ██╔══██╗██╔══██╗██║   ██║████╗ ████║██╔═══██╗
 ██████╔╝██████╔╝██║   ██║██╔████╔██║██║   ██║
 ██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██║   ██║
 ██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║╚██████╔╝
 ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝ ╚═════╝ 
`;

  return (
    <scrollbox
      id="transcript"
      flexGrow={1}
      flexDirection="column"
      backgroundColor={props.palette.surface}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      stickyScroll
      stickyStart="bottom"
    >
      {/* Empty State / Welcome Screen */}
      <Show when={props.tab.session.messages().length === 0}>
        <box flexDirection="column" alignItems="center" paddingTop={1} paddingBottom={1}>
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {welcomeBanner}
          </text>
          <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
            {`Autonomous Terminal Engineering Agent · OpenTUI Solid`}
          </text>
          <text fg={props.palette.muted} attributes={TextAttributes.ITALIC}>
            {`Type a prompt, @file to attach, /help for commands, !shell to bypass`}
          </text>
          <box height={1} />
          <box flexDirection="row" gap={2}>
            <text fg={props.palette.accent}>{`[Ctrl+T] New Tab `}</text>
            <text fg={props.palette.accent}>{`[Ctrl+B] Toggle Tree `}</text>
            <text fg={props.palette.accent}>{`[Ctrl+M] Change Model `}</text>
            <text fg={props.palette.accent}>{`[Esc] Vim Mode `}</text>
          </box>
        </box>
      </Show>

      {/* Messages Timeline */}
      <For each={props.tab.session.messages()}>
        {(msg: Message) => {
          const isUser = () => msg.role === "user";
          const isTool = () => msg.role === "tool";
          const isSystem = () => msg.role === "system";
          const hasThinking = () => !!msg.thinking && msg.thinking.length > 0;
          const isThinkingOpen = () => !!expandedThinking()[msg.id];
          const isToolOpen = () => expandedTools()[msg.id] !== false; // default open

          return (
            <box flexDirection="column" marginBottom={1}>
              {/* Role Header */}
              <box flexDirection="row" alignItems="center" marginBottom={0}>
                {isUser() && (
                  <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
                    {`❯ USER `}
                  </text>
                )}
                {!isUser() && !isTool() && !isSystem() && (
                  <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
                    {`󰚩 PRUMO (${props.tab.model}) `}
                  </text>
                )}
                {isTool() && (
                  <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
                    {`⚡ TOOL EXECUTION `}
                  </text>
                )}
                {isSystem() && (
                  <text fg={props.palette.muted} attributes={TextAttributes.BOLD}>
                    {`⚙ SYSTEM `}
                  </text>
                )}
                <text fg={props.palette.muted}>
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </text>
              </box>

              {/* Thinking Accordion for Assistant */}
              <Show when={hasThinking()}>
                <box
                  flexDirection="column"
                  marginBottom={1}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation?.();
                    toggleThinking(msg.id);
                  }}
                >
                  <box
                    height={1}
                    flexDirection="row"
                    alignItems="center"
                    backgroundColor={props.palette.crust}
                    paddingLeft={1}
                    paddingRight={1}
                  >
                    <text fg={props.palette.muted} attributes={TextAttributes.ITALIC}>
                      {`${Glyph.thinking} Thinking (${isThinkingOpen() ? "collapse" : "expand"}) `}
                    </text>
                    <text fg={props.palette.accent}>
                      {isThinkingOpen() ? `[${Glyph.chevronDown}]` : `[${Glyph.chevronRight}]`}
                    </text>
                  </box>

                  <Show when={isThinkingOpen()}>
                    <box
                      paddingLeft={2}
                      paddingRight={1}
                      paddingTop={1}
                      paddingBottom={1}
                      backgroundColor={props.palette.panel}
                      borderStyle="single"
                      borderColor={props.palette.border}
                    >
                      <text fg={props.palette.muted} attributes={TextAttributes.ITALIC}>
                        {msg.thinking}
                      </text>
                    </box>
                  </Show>
                </box>
              </Show>

              {/* Message Content: Rich Markdown for Assistant, formatted Box for User & Tool */}
              <Show
                when={!isUser() && !isTool()}
                fallback={
                  <Show
                    when={isTool()}
                    fallback={
                      /* User Message Box */
                      <box
                        paddingLeft={1}
                        paddingRight={1}
                        paddingTop={1}
                        paddingBottom={1}
                        backgroundColor={props.palette.panel}
                        borderStyle="single"
                        borderColor={props.palette.borderFocus}
                        flexDirection="column"
                      >
                        <Show when={msg.images && msg.images.length > 0}>
                          <box flexDirection="row" gap={1} marginBottom={1}>
                            <For each={msg.images}>
                              {(img) => (
                                <box backgroundColor={props.palette.crust} paddingLeft={1} paddingRight={1}>
                                  <text fg={props.palette.secondary} attributes={TextAttributes.BOLD}>
                                    {`🖼️ ${img}`}
                                  </text>
                                </box>
                              )}
                            </For>
                          </box>
                        </Show>
                        <text fg={props.palette.text}>
                          {msg.content}
                        </text>
                      </box>
                    }
                  >
                    {/* Tool Execution Card */}
                    <box
                      flexDirection="column"
                      backgroundColor={props.palette.crust}
                      borderStyle="rounded"
                      borderColor={props.palette.warning}
                      paddingLeft={1}
                      paddingRight={1}
                      paddingTop={1}
                      paddingBottom={1}
                    >
                      <box
                        height={1}
                        flexDirection="row"
                        justifyContent="space-between"
                        onMouseDown={(e: MouseEvent) => {
                          e.stopPropagation?.();
                          toggleTool(msg.id);
                        }}
                      >
                        <text fg={props.palette.warning} attributes={TextAttributes.BOLD}>
                          {`⚡ Output (${isToolOpen() ? "collapse" : "expand"})`}
                        </text>
                        <text fg={props.palette.accent}>
                          {isToolOpen() ? `[${Glyph.chevronDown}]` : `[${Glyph.chevronRight}]`}
                        </text>
                      </box>

                      <Show when={isToolOpen()}>
                        {(() => {
                          const lines = msg.content.split("\n");
                          const MAX_TOOL_LINES = 60;
                          const textToDisplay =
                            lines.length > MAX_TOOL_LINES
                              ? lines.slice(0, MAX_TOOL_LINES).join("\n") +
                                `\n\n[... Truncated: ${lines.length - MAX_TOOL_LINES} more lines in output ...]`
                              : msg.content;

                          return (
                            <box marginTop={1}>
                              <text fg={props.palette.text}>
                                {textToDisplay}
                              </text>
                            </box>
                          );
                        })()}
                      </Show>
                    </box>
                  </Show>
                }
              >
                {/* Assistant Rich Text Markdown Viewport */}
                <box
                  paddingLeft={1}
                  paddingRight={1}
                  paddingTop={1}
                  paddingBottom={1}
                  backgroundColor={props.palette.surface}
                  borderStyle="single"
                  borderColor={props.palette.border}
                  flexDirection="column"
                >
                  <markdown
                    content={msg.content}
                    syntaxStyle={props.syntaxStyle}
                    fg={props.palette.text}
                  />
                </box>
              </Show>
            </box>
          );
        }}
      </For>

      {/* Live Stream / Busy indicator */}
      <Show when={props.tab.session.isBusy()}>
        <box flexDirection="row" alignItems="center" marginTop={1}>
          <text fg={props.palette.accent} attributes={TextAttributes.BOLD}>
            {`◉ Agent is streaming thinking & executing tools... `}
          </text>
        </box>
      </Show>
    </scrollbox>
  );
}
