/**
 * Centralized model configuration.
 * All model IDs are defined here. No model strings appear elsewhere in the codebase.
 * Override any model via environment variable without code changes.
 *
 * ── HYBRID MODE (current) ────────────────────────────────────────────────────
 *   Chat  → Groq free API    (env: GROQ_API_KEY)
 *   Embed → OpenRouter       (env: OPENROUTER_API_KEY)  ← unchanged
 *
 * ── To revert to full OpenRouter ─────────────────────────────────────────────
 *   Swap the commented / uncommented lines below, then update ai.service.ts.
 */
export const MODELS = {
  /** Embeddings — NVIDIA paid API — nemotron-3-embed-1b — 2048 dimensions */
  embed: process.env.MODEL_EMBED ?? 'nvidia/nemotron-3-embed-1b',

  // ── OpenRouter embeddings (commented out — uncomment to revert, also update ai.service.ts + schema.sql) ──
  // embed: process.env.MODEL_EMBED ?? 'openai/text-embedding-3-small',  // 1536 dims

  // ── Groq free chat models (active) ─────────────────────────────────────────
  /** Default generation — learn, ask, general chat */
  default: process.env.MODEL_DEFAULT ?? 'openai/gpt-oss-120b',

  /** Strong reasoning — test generation, paper generation, reranking */
  strong: process.env.MODEL_STRONG ?? 'openai/gpt-oss-120b',

  /** Lightweight — memory extraction, syllabus parsing, summarization */
  light: process.env.MODEL_LIGHT ?? 'openai/gpt-oss-20b',

  /** Reranker — separate model to avoid hitting same quota as chat */
  reranker: process.env.MODEL_RERANKER ?? 'qwen/qwen3.8-27b',

  // ── DeepSeek R1 distill (commented out — blank response on streaming) ────────
  // default:  process.env.MODEL_DEFAULT  ?? 'deepseek-r1-distill-llama-70b',
  // strong:   process.env.MODEL_STRONG   ?? 'deepseek-r1-distill-llama-70b',
  // light:    process.env.MODEL_LIGHT    ?? 'openai/gpt-oss-20b',
  // reranker: process.env.MODEL_RERANKER ?? 'deepseek-r1-distill-llama-70b',

  // ── NVIDIA free chat models (commented out — uncomment to revert) ───────────
  // default:  process.env.MODEL_DEFAULT  ?? 'meta/llama-3.3-70b-instruct',
  // strong:   process.env.MODEL_STRONG   ?? 'meta/llama-3.3-70b-instruct',
  // light:    process.env.MODEL_LIGHT    ?? 'meta/llama-3.1-8b-instruct',
  // reranker: process.env.MODEL_RERANKER ?? 'meta/llama-3.3-70b-instruct',

  // ── DeepSeek v4.1 Flash (unstable on NVIDIA free tier — try later) ──────────
  // default:  process.env.MODEL_DEFAULT  ?? 'deepseek-ai/deepseek-v4.1-flash',
  // strong:   process.env.MODEL_STRONG   ?? 'deepseek-ai/deepseek-v4.1-flash',
  // light:    process.env.MODEL_LIGHT    ?? 'deepseek-ai/deepseek-v4.1-flash',
  // reranker: process.env.MODEL_RERANKER ?? 'deepseek-ai/deepseek-v4.1-flash',

  // ── OpenRouter chat models (commented out — uncomment to revert) ────────────
  // default:   process.env.MODEL_DEFAULT   ?? 'openai/gpt-5.6-terra',
  // strong:    process.env.MODEL_STRONG    ?? 'openai/gpt-5.6-sol',
  // light:     process.env.MODEL_LIGHT     ?? 'openai/gpt-5.6-luna',
  // reranker:  process.env.MODEL_RERANKER  ?? 'openai/gpt-5.6-sol',

  /** Web search — Perplexity online model via OpenRouter (unchanged) */
  webSearch: process.env.MODEL_WEB_SEARCH ?? 'perplexity/sonar',
} as const

export type ModelKey = keyof typeof MODELS
