/**
 * Centralized model configuration.
 * All model IDs are defined here. No model strings appear elsewhere in the codebase.
 * Override any model via environment variable without code changes.
 *
 * ── HYBRID MODE (current) ────────────────────────────────────────────────────
 *   Chat  → NVIDIA free API  (env: NVIDIA_API_KEY)
 *   Embed → OpenRouter       (env: OPENROUTER_API_KEY)  ← unchanged
 *
 * ── To revert to full OpenRouter ─────────────────────────────────────────────
 *   Swap the commented / uncommented lines below, then update ai.service.ts.
 */
export const MODELS = {
  /** Embeddings — OpenRouter /api/v1/embeddings — 1536 dimensions (unchanged) */
  embed: process.env.MODEL_EMBED ?? 'openai/text-embedding-3-small',

  // ── NVIDIA free chat models (active) ───────────────────────────────────────
  /** Default generation — learn, ask, general chat */
  default: process.env.MODEL_DEFAULT ?? 'meta/llama-3.3-70b-instruct',

  /** Strong reasoning — test generation, paper generation, reranking */
  strong: process.env.MODEL_STRONG ?? 'meta/llama-3.3-70b-instruct',

  /** Lightweight — memory extraction, syllabus parsing, summarization */
  light: process.env.MODEL_LIGHT ?? 'meta/llama-3.1-8b-instruct',

  /** Reranker */
  reranker: process.env.MODEL_RERANKER ?? 'meta/llama-3.3-70b-instruct',

  // ── DeepSeek v4.1 Flash (unstable on NVIDIA free tier — try later) ──────────
  // default:  process.env.MODEL_DEFAULT  ?? 'deepseek-ai/deepseek-v4.1-flash',
  // strong:   process.env.MODEL_STRONG   ?? 'deepseek-ai/deepseek-v4.1-flash',
  // light:    process.env.MODEL_LIGHT    ?? 'deepseek-ai/deepseek-v4.1-flash',
  // reranker: process.env.MODEL_RERANKER ?? 'deepseek-ai/deepseek-v4.1-flash',

  // ── Nemotron (commented out) ────────────────────────────────────────────────
  // default:   process.env.MODEL_DEFAULT   ?? 'nvidia/nemotron-3-super-120b-a12b',
  // strong:    process.env.MODEL_STRONG    ?? 'nvidia/nemotron-3-super-120b-a12b',
  // light:     process.env.MODEL_LIGHT     ?? 'meta/llama-3.1-8b-instruct',
  // reranker:  process.env.MODEL_RERANKER  ?? 'nvidia/nemotron-3-super-120b-a12b',

  // ── OpenRouter chat models (commented out — uncomment to revert) ────────────
  // default:   process.env.MODEL_DEFAULT   ?? 'openai/gpt-5.6-terra',
  // strong:    process.env.MODEL_STRONG    ?? 'openai/gpt-5.6-sol',
  // light:     process.env.MODEL_LIGHT     ?? 'openai/gpt-5.6-luna',
  // reranker:  process.env.MODEL_RERANKER  ?? 'openai/gpt-5.6-sol',

  /** Web search — Perplexity online model via OpenRouter (unchanged) */
  webSearch: process.env.MODEL_WEB_SEARCH ?? 'perplexity/sonar',
} as const

export type ModelKey = keyof typeof MODELS
