/**
 * Centralized model configuration.
 * All model IDs are defined here — no model strings appear elsewhere in the codebase.
 * Override any model via environment variable without code changes.
 *
 *   Chat  → OpenRouter  (OPENROUTER_API_KEY)
 *   Embed → OpenRouter  (OPENROUTER_API_KEY) — text-embedding-3-small, 1536 dims
 */
export const MODELS = {
  /** Embeddings — OpenRouter — text-embedding-3-small — 1536 dimensions */
  embed: process.env.MODEL_EMBED ?? 'openai/text-embedding-3-small',

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
