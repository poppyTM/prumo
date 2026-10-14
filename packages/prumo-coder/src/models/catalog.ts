// packages/prumo-coder/src/models/catalog.ts
// Comprehensive catalog of AI providers, models, capabilities, and pricing
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "max";

export interface ModelCapabilities {
  id: string;
  provider: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportedEfforts: ReasoningEffort[];
  defaultEffort: ReasoningEffort;
  reasoningBudgetRange?: { min: number; max: number };
  supportsTools: boolean;
  pricingInputUSDPerM: number;
  pricingOutputUSDPerM: number;
  pricingCacheUSDPerM: number;
  speed: "fast" | "moderate" | "heavy";
  recommendedRoles: ("architect" | "coder" | "planner" | "fast")[];
}

export const PROVIDERS = [
  { id: "all", name: "All" },
  { id: "favorites", name: "★ Favorites" },
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "gemini", name: "Gemini" },
  { id: "local", name: "Local" },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export interface ProviderMeta {
  id: string;
  name: string;
  defaultBaseUrl: string;
  envKey: string;
  description: string;
}

export const PROVIDER_METAS: ProviderMeta[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
    description: "Claude 3.7 Sonnet, 3.5 Sonnet, 3.5 Haiku",
  },
  {
    id: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    description: "o3-mini, GPT-4o, GPT-4o-mini",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    envKey: "GEMINI_API_KEY",
    description: "Gemini 2.5 Pro & Flash with 1M context",
  },
  {
    id: "local",
    name: "Local (Ollama / vLLM)",
    defaultBaseUrl: "http://localhost:11434/v1",
    envKey: "OLLAMA_HOST",
    description: "DeepSeek-R1, Qwen 2.5 Coder, local open weights",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    description: "Aggregated multi-provider gateway",
  },
  {
    id: "deepseek",
    name: "DeepSeek API",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
    description: "DeepSeek V3 & R1 direct cloud API",
  },
];

export function checkProviderStatus(
  meta: ProviderMeta,
  customApiKey?: string,
): { isConfigured: boolean; displayStatus: string } {
  if (meta.id === "local") {
    return { isConfigured: true, displayStatus: "● Local Ready" };
  }
  const hasKey = !!customApiKey || !!process.env[meta.envKey];
  if (hasKey) {
    return { isConfigured: true, displayStatus: "✓ Ready" };
  }
  return { isConfigured: false, displayStatus: "○ Missing Key" };
}

export const MODEL_CATALOG: ModelCapabilities[] = [
  // --- Anthropic ---
  {
    id: "claude-3-7-sonnet",
    provider: "anthropic",
    displayName: "Claude 3.7 Sonnet",
    description: "Flagship hybrid thinking model with surgical code generation",
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    supportsVision: true,
    supportsReasoning: true,
    supportedEfforts: ["none", "low", "medium", "high", "max"],
    defaultEffort: "high",
    reasoningBudgetRange: { min: 1024, max: 64000 },
    supportsTools: true,
    pricingInputUSDPerM: 3.0,
    pricingOutputUSDPerM: 15.0,
    pricingCacheUSDPerM: 0.3,
    speed: "moderate",
    recommendedRoles: ["architect", "coder"],
  },
  {
    id: "claude-3-5-sonnet",
    provider: "anthropic",
    displayName: "Claude 3.5 Sonnet",
    description: "High-intelligence workhorse with exceptional coding proficiency",
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsReasoning: false,
    supportedEfforts: ["none"],
    defaultEffort: "none",
    supportsTools: true,
    pricingInputUSDPerM: 3.0,
    pricingOutputUSDPerM: 15.0,
    pricingCacheUSDPerM: 0.3,
    speed: "fast",
    recommendedRoles: ["coder"],
  },
  {
    id: "claude-3-5-haiku",
    provider: "anthropic",
    displayName: "Claude 3.5 Haiku",
    description: "Ultra-fast lightweight model for linters, searches, and summaries",
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsVision: false,
    supportsReasoning: false,
    supportedEfforts: ["none"],
    defaultEffort: "none",
    supportsTools: true,
    pricingInputUSDPerM: 0.8,
    pricingOutputUSDPerM: 4.0,
    pricingCacheUSDPerM: 0.08,
    speed: "fast",
    recommendedRoles: ["fast"],
  },

  // --- OpenAI ---
  {
    id: "o3-mini",
    provider: "openai",
    displayName: "o3-mini",
    description: "High-speed reasoning model tailored for math, code, and logic",
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    supportsVision: false,
    supportsReasoning: true,
    supportedEfforts: ["low", "medium", "high"],
    defaultEffort: "medium",
    supportsTools: true,
    pricingInputUSDPerM: 1.1,
    pricingOutputUSDPerM: 4.4,
    pricingCacheUSDPerM: 0.55,
    speed: "moderate",
    recommendedRoles: ["planner", "coder"],
  },
  {
    id: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    description: "Versatile multimodal flagship with high speed and vision abilities",
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsVision: true,
    supportsReasoning: false,
    supportedEfforts: ["none"],
    defaultEffort: "none",
    supportsTools: true,
    pricingInputUSDPerM: 2.5,
    pricingOutputUSDPerM: 10.0,
    pricingCacheUSDPerM: 1.25,
    speed: "fast",
    recommendedRoles: ["coder"],
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    displayName: "GPT-4o Mini",
    description: "Cost-efficient lightweight assistant for fast automated tasks",
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsVision: true,
    supportsReasoning: false,
    supportedEfforts: ["none"],
    defaultEffort: "none",
    supportsTools: true,
    pricingInputUSDPerM: 0.15,
    pricingOutputUSDPerM: 0.6,
    pricingCacheUSDPerM: 0.075,
    speed: "fast",
    recommendedRoles: ["fast"],
  },

  // --- Google Gemini ---
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    displayName: "Gemini 2.5 Pro",
    description: "Massive 1M context reasoning model with native audio & vision",
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    supportsVision: true,
    supportsReasoning: true,
    supportedEfforts: ["none", "low", "medium", "high"],
    defaultEffort: "medium",
    reasoningBudgetRange: { min: 0, max: 32768 },
    supportsTools: true,
    pricingInputUSDPerM: 1.25,
    pricingOutputUSDPerM: 5.0,
    pricingCacheUSDPerM: 0.31,
    speed: "moderate",
    recommendedRoles: ["architect", "planner"],
  },
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    displayName: "Gemini 2.5 Flash",
    description: "Sub-second multimodal responses with high throughput",
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    supportsVision: true,
    supportsReasoning: true,
    supportedEfforts: ["none", "low", "medium", "high"],
    defaultEffort: "low",
    reasoningBudgetRange: { min: 0, max: 24576 },
    supportsTools: true,
    pricingInputUSDPerM: 0.075,
    pricingOutputUSDPerM: 0.3,
    pricingCacheUSDPerM: 0.018,
    speed: "fast",
    recommendedRoles: ["fast", "coder"],
  },

  // --- Local / Open-Weights ---
  {
    id: "deepseek-r1",
    provider: "local",
    displayName: "DeepSeek-R1 (Local)",
    description: "Open-weights deep reasoning engine running via Ollama / vLLM",
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    supportsVision: false,
    supportsReasoning: true,
    supportedEfforts: ["high", "max"],
    defaultEffort: "high",
    supportsTools: true,
    pricingInputUSDPerM: 0.0,
    pricingOutputUSDPerM: 0.0,
    pricingCacheUSDPerM: 0.0,
    speed: "moderate",
    recommendedRoles: ["planner"],
  },
  {
    id: "qwen2.5-coder-32b",
    provider: "local",
    displayName: "Qwen 2.5 Coder 32B (Local)",
    description: "Specialized open-weights code model with strong multi-file syntax",
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    supportsVision: false,
    supportsReasoning: false,
    supportedEfforts: ["none"],
    defaultEffort: "none",
    supportsTools: true,
    pricingInputUSDPerM: 0.0,
    pricingOutputUSDPerM: 0.0,
    pricingCacheUSDPerM: 0.0,
    speed: "fast",
    recommendedRoles: ["coder"],
  },
];

export function findModel(id: string): ModelCapabilities | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

export function getModelSupportedEfforts(modelId: string): ReasoningEffort[] {
  const model = findModel(modelId);
  if (!model || !model.supportsReasoning) return ["none"];
  return model.supportedEfforts;
}

export function clampModelEffort(modelId: string, requested: ReasoningEffort): ReasoningEffort {
  const model = findModel(modelId);
  if (!model || !model.supportsReasoning) return "none";
  if (model.supportedEfforts.includes(requested)) return requested;
  return model.defaultEffort;
}

export function calculateEstimatedCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  cacheTokens: number,
): { totalUSD: number; savingsUSD: number } {
  const model = findModel(modelId);
  if (!model) return { totalUSD: 0, savingsUSD: 0 };

  const regularPromptUSD = (promptTokens / 1_000_000) * model.pricingInputUSDPerM;
  const cachedPromptUSD = (cacheTokens / 1_000_000) * model.pricingCacheUSDPerM;
  const outputUSD = (completionTokens / 1_000_000) * model.pricingOutputUSDPerM;

  const totalUSD = regularPromptUSD + cachedPromptUSD + outputUSD;
  const potentialWithoutCache = ((promptTokens + cacheTokens) / 1_000_000) * model.pricingInputUSDPerM + outputUSD;
  const savingsUSD = Math.max(0, potentialWithoutCache - totalUSD);

  return { totalUSD, savingsUSD };
}
