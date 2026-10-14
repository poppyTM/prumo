// packages/prumo-coder/src/theme/glyphs.ts
// Nerd Fonts glyph definitions for prumo-coder

export const Glyph = {
  // Git & Worktree
  gitBranch: "",
  gitClean: "",
  gitDirty: "",
  gitDiff: "",
  gitCommit: "",
  worktree: "󰙅",
  repo: "󰳘",

  // Lifecycle & Agent Status
  statusIdle: "●",
  statusStreaming: "◉",
  statusWorking: "󱐋",
  statusPermission: "▲",
  statusCompleted: "󰄬",
  statusFailed: "󰅚",
  statusPaused: "󰏤",

  // Providers & Intelligence
  providerAnthropic: "󰚩",
  providerOpenAI: "󰊤",
  providerGemini: "󰛄",
  providerLocal: "󱤅",

  // Modes & Controls
  vimNormal: " NORMAL",
  vimInsert: " INSERT",
  leaderChord: "󰌌 ^X",
  thinking: "💭",
  gaugeFilled: "▰",
  gaugeEmpty: "▱",
  gaugeIcon: "󰥉",
  dollar: "󰡱",
  token: "󰆏",
  clock: "󱑎",
  fire: "󰈸",
  lock: "󰌾",

  // Tools & Execution
  toolBash: "󰞷",
  toolRead: "󰈔",
  toolEdit: "󰏫",
  toolWrite: "󰎝",
  toolSearch: "󰍉",
  toolWeb: "󰖟",
  toolDefault: "󰅩",

  // Tabs & Windows
  tabClose: "󰅖",
  tabAdd: "󰐕",
  tabPin: "󰤱",
  sidebarOpen: "󰍜",
  sidebarClosed: "󰍛",
  chevronRight: "󰅂",
  chevronDown: "󰅀",

  // Files & Filetree
  file: "󰈔",
  folder: "󰉋",
  folderOpen: "󰝰",
  dirtyModified: "M",
  dirtyAdded: "A",
  dirtyDeleted: "D",
  dirtyUntracked: "?",
} as const;
