/**
 * Centralized model configuration.
 * All model IDs are defined here — no model strings appear elsewhere in the codebase.
 * Override any model via environment variable without code changes.
 *
 *   Chat  → OpenRouter  (OPENROUTER_API_KEY)
 *   Embed → NVIDIA      (NVIDIA_API_KEY) — nemotron-3-embed-1b, 2048 dims
 */
export const MODELS = {
  /** Embeddings — NVIDIA paid API — nemotron-3-embed-1b — 2048 dimensions */
  embed: process.env.MODEL_EMBED ?? 'nvidia/nemotron-3-embed-1b',

  /** Default generation — learn, ask, general chat */
  default: process.env.MODEL_DEFAULT ?? 'openai/gpt-4o-mini',

  /** Strong reasoning — test generation, paper generation */
  strong: process.env.MODEL_STRONG ?? 'openai/gpt-4o',

  /** Lightweight — memory extraction, syllabus parsing, summarization */
  light: process.env.MODEL_LIGHT ?? 'openai/gpt-4o-mini',

  /** Reranker */
  reranker: process.env.MODEL_RERANKER ?? 'openai/gpt-4o-mini',

  /** Web search — Perplexity online model via OpenRouter */
  webSearch: process.env.MODEL_WEB_SEARCH ?? 'perplexity/sonar',
} as const

export type ModelKey = keyof typeof MODELS
