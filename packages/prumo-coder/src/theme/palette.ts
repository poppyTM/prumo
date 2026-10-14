// packages/prumo-coder/src/theme/palette.ts
// High-fidelity terminal palettes for prumo-coder
import { RGBA } from "@opentui/core";

export interface ThemePalette {
  name: string;
  surface: RGBA;
  panel: RGBA;
  crust: RGBA;
  text: RGBA;
  muted: RGBA;
  accent: RGBA;
  secondary: RGBA;
  success: RGBA;
  warning: RGBA;
  error: RGBA;
  border: RGBA;
  borderFocus: RGBA;
  selection: RGBA;
}

export type ThemeName =
  | "catppuccin-mocha"
  | "tokyo-night"
  | "zed-dark"
  | "daisy-lain"
  | "dracula"
  | "nord"
  | "github-dark";

const paletteDefinitions: Record<ThemeName, {
  surface: string;
  panel: string;
  crust: string;
  text: string;
  muted: string;
  accent: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  borderFocus: string;
  selection: string;
}> = {
  "catppuccin-mocha": {
    surface: "#1e1e2e",
    panel: "#181825",
    crust: "#11111b",
    text: "#cdd6f4",
    muted: "#6c7086",
    accent: "#89b4fa",
    secondary: "#cba6f7",
    success: "#a6e3a1",
    warning: "#f9e2af",
    error: "#f38ba8",
    border: "#313244",
    borderFocus: "#89b4fa",
    selection: "#45475a",
  },
  "tokyo-night": {
    surface: "#1a1b26",
    panel: "#16161e",
    crust: "#0f0f14",
    text: "#a9b1d6",
    muted: "#565f89",
    accent: "#7aa2f7",
    secondary: "#bb9af7",
    success: "#9ece6a",
    warning: "#e0af68",
    error: "#f7768e",
    border: "#292e42",
    borderFocus: "#7aa2f7",
    selection: "#283457",
  },
  "zed-dark": {
    surface: "#18181b",
    panel: "#121215",
    crust: "#0c0c0e",
    text: "#e4e4e7",
    muted: "#71717a",
    accent: "#59c2ff",
    secondary: "#b794f4",
    success: "#4ade80",
    warning: "#eab308",
    error: "#f43f5e",
    border: "#27272a",
    borderFocus: "#59c2ff",
    selection: "#3f3f46",
  },
  "daisy-lain": {
    surface: "#070913",
    panel: "#00106a",
    crust: "#000838",
    text: "#f1f1ea",
    muted: "#525f70",
    accent: "#ffe500",
    secondary: "#0025c5",
    success: "#50fa7b",
    warning: "#ffe500",
    error: "#e73748",
    border: "#0025c5",
    borderFocus: "#ffe500",
    selection: "#0435e9",
  },
  dracula: {
    surface: "#282a36",
    panel: "#21222c",
    crust: "#191a21",
    text: "#f8f8f2",
    muted: "#6272a4",
    accent: "#bd93f9",
    secondary: "#ff79c6",
    success: "#50fa7b",
    warning: "#f1fa8c",
    error: "#ff5555",
    border: "#44475a",
    borderFocus: "#bd93f9",
    selection: "#44475a",
  },
  nord: {
    surface: "#2e3440",
    panel: "#3b4252",
    crust: "#242933",
    text: "#eceff4",
    muted: "#81a1c1",
    accent: "#88c0d0",
    secondary: "#b48ead",
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
    border: "#434c5e",
    borderFocus: "#88c0d0",
    selection: "#4c566a",
  },
  "github-dark": {
    surface: "#0d1117",
    panel: "#161b22",
    crust: "#010409",
    text: "#c9d1d9",
    muted: "#8b949e",
    accent: "#58a6ff",
    secondary: "#bc8cff",
    success: "#3fb950",
    warning: "#d29922",
    error: "#ff7b72",
    border: "#30363d",
    borderFocus: "#58a6ff",
    selection: "#264f78",
  },
};

export const AVAILABLE_THEMES: ThemeName[] = Object.keys(
  paletteDefinitions,
) as ThemeName[];

export function getThemePalette(name: ThemeName | string): ThemePalette {
  const norm = (name || "").toLowerCase().replace(" ", "-") as ThemeName;
  const def = paletteDefinitions[norm] || paletteDefinitions["catppuccin-mocha"];

  return {
    name: norm in paletteDefinitions ? norm : "catppuccin-mocha",
    surface: RGBA.fromHex(def.surface),
    panel: RGBA.fromHex(def.panel),
    crust: RGBA.fromHex(def.crust),
    text: RGBA.fromHex(def.text),
    muted: RGBA.fromHex(def.muted),
    accent: RGBA.fromHex(def.accent),
    secondary: RGBA.fromHex(def.secondary),
    success: RGBA.fromHex(def.success),
    warning: RGBA.fromHex(def.warning),
    error: RGBA.fromHex(def.error),
    border: RGBA.fromHex(def.border),
    borderFocus: RGBA.fromHex(def.borderFocus),
    selection: RGBA.fromHex(def.selection),
  };
}
