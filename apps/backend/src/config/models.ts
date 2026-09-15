/**
 * Centralized model configuration.
 * All model IDs are defined here. No model strings appear elsewhere in the codebase.
 * Override any model via environment variable without code changes.
 */
export const MODELS = {
  /** Embeddings — OpenRouter /api/v1/embeddings — 1536 dimensions */
  embed: process.env.MODEL_EMBED ?? 'openai/text-embedding-3-small',

  /** Default generation — learn, ask, general chat, discussion */
  default: process.env.MODEL_DEFAULT ?? 'openai/gpt-5.6-terra',

  /** Strong reasoning — test generation, paper generation, reranking */
  strong: process.env.MODEL_STRONG ?? 'openai/gpt-5.6-sol',

  /** Lightweight — memory extraction, lightweight summarization */
  light: process.env.MODEL_LIGHT ?? 'openai/gpt-5.6-luna',

  /** Reranker — configurable independently; defaults to strong model */
  reranker: process.env.MODEL_RERANKER ?? 'openai/gpt-5.6-sol',

  /** Web search — Perplexity online model with built-in real-time search */
  webSearch: process.env.MODEL_WEB_SEARCH ?? 'perplexity/sonar',
} as const

export type ModelKey = keyof typeof MODELS
