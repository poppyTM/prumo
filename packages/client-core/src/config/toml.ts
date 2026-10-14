// packages/client-core/src/config/toml.ts
// TOML config parser & serializer for Prumo clients
import { parse, stringify } from "smol-toml";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  enabled?: boolean;
}

export interface CoderConfig {
  general: {
    theme: string;
    reduced_motion: boolean;
    vim_navigation: boolean;
    nerd_fonts: boolean;
    favorite_models?: string[];
    favorite_providers?: string[];
  };
  workspace: {
    auto_stash_dirty: boolean;
    preflight_check: boolean;
  };
  agent: {
    default_provider?: string;
    default_model?: string;
    reasoning_effort?: "low" | "medium" | "high" | "max";
    max_turns: number;
    role_models?: Record<string, string>;
  };
  providers?: Record<string, ProviderConfig>;
  keymap: {
    leader: string;
    editor: string;
    files: string;
    models: string;
    providers?: string;
    right_sidebar?: string;
  };
}

export const DEFAULT_CODER_CONFIG: CoderConfig = {
  general: {
    theme: "catppuccin-mocha",
    reduced_motion: false,
    vim_navigation: true,
    nerd_fonts: true,
    favorite_models: ["claude-3-7-sonnet", "o3-mini", "gemini-2.5-pro"],
    favorite_providers: ["anthropic", "openai", "gemini"],
  },
  workspace: {
    auto_stash_dirty: false,
    preflight_check: true,
  },
  agent: {
    default_provider: "anthropic",
    default_model: "claude-3-7-sonnet",
    reasoning_effort: "high",
    max_turns: 30,
    role_models: {
      architect: "claude-3-7-sonnet",
      coder: "claude-3-5-sonnet",
      planner: "o3-mini",
      fast: "gemini-2.5-flash",
    },
  },
  providers: {
    anthropic: { enabled: true },
    openai: { enabled: true },
    gemini: { enabled: true },
    local: { baseUrl: "http://localhost:11434/v1", enabled: true },
  },
  keymap: {
    leader: "ctrl+x",
    editor: "ctrl+e",
    files: "ctrl+g",
    models: "ctrl+o",
    providers: "ctrl+p",
    right_sidebar: "ctrl+l",
  },
};

export async function loadCoderConfig(customPath?: string): Promise<CoderConfig> {
  const configPath =
    customPath ||
    process.env.PRUMO_CODER_CONFIG ||
    path.join(os.homedir(), ".config", "prumo", "coder.toml");

  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed = parse(raw) as Partial<CoderConfig>;
    return {
      general: { ...DEFAULT_CODER_CONFIG.general, ...parsed.general },
      workspace: { ...DEFAULT_CODER_CONFIG.workspace, ...parsed.workspace },
      agent: { ...DEFAULT_CODER_CONFIG.agent, ...parsed.agent },
      providers: { ...DEFAULT_CODER_CONFIG.providers, ...parsed.providers },
      keymap: { ...DEFAULT_CODER_CONFIG.keymap, ...parsed.keymap },
    };
  } catch (err) {
    return DEFAULT_CODER_CONFIG;
  }
}

export function serializeCoderConfig(config: CoderConfig): string {
  return stringify(config as unknown as Record<string, unknown>);
}

export function parseCoderConfig(raw: string): CoderConfig {
  const parsed = parse(raw) as Partial<CoderConfig>;
  return {
    general: { ...DEFAULT_CODER_CONFIG.general, ...parsed.general },
    workspace: { ...DEFAULT_CODER_CONFIG.workspace, ...parsed.workspace },
    agent: { ...DEFAULT_CODER_CONFIG.agent, ...parsed.agent },
    providers: { ...DEFAULT_CODER_CONFIG.providers, ...parsed.providers },
    keymap: { ...DEFAULT_CODER_CONFIG.keymap, ...parsed.keymap },
  };
}

export async function saveCoderConfig(config: CoderConfig, customPath?: string): Promise<void> {
  const configPath =
    customPath ||
    process.env.PRUMO_CODER_CONFIG ||
    path.join(os.homedir(), ".config", "prumo", "coder.toml");

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const content = serializeCoderConfig(config);
  await fs.writeFile(configPath, content, "utf-8");
}
