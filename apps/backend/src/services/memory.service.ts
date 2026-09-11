/**
 * Memory Service (MAG — Memory-Augmented Generation)
 * Reads and writes student_memory entries.
 *
 * - readMemory: fetches entries relevant to a topic for context injection
 * - updateMemory: LLM-extracted memory upsert after session ends
 * - extractAndSave: calls the light model to extract memory facts from a conversation
 */

import sql from '../db/client.js'
import { completeJson } from './ai.service.js'
import { MODELS } from '../config/models.js'
import type { MemoryEntry } from './context-builder.service.js'

type MemoryType =
  | 'topic_mastery'
  | 'weak_topic'
  | 'strong_topic'
  | 'common_mistake'
  | 'study_history'
  | 'revision_priority'
  | 'syllabus_coverage'

type MemorySource = 'test' | 'learn' | 'ask' | 'manual'

export interface MemoryFact {
  memoryType: MemoryType
  contextKey: string
  value: unknown
  confidence: number
}

/**
 * Fetch memory entries for a user, optionally filtered by topic.
 * Returns entries sorted by confidence descending.
 */
export async function readMemory(
  userId: string,
  topic?: string,
  limit = 10,
): Promise<MemoryEntry[]> {
  const rows = topic
    ? await sql<
        Array<{
          memory_type: string
          context_key: string
          value: unknown
          confidence: number
        }>
      >`
        SELECT memory_type, context_key, value, confidence
        FROM student_memory
        WHERE user_id = ${userId}
          AND context_key ILIKE ${'%' + topic + '%'}
        ORDER BY confidence DESC
        LIMIT ${limit}
      `
    : await sql<
        Array<{
          memory_type: string
          context_key: string
          value: unknown
          confidence: number
        }>
      >`
        SELECT memory_type, context_key, value, confidence
        FROM student_memory
        WHERE user_id = ${userId}
        ORDER BY confidence DESC
        LIMIT ${limit}
      `

  return rows.map((r) => ({
    memoryType: r.memory_type,
    contextKey: r.context_key,
    value: r.value,
    confidence: r.confidence,
  }))
}

/**
 * Upsert a memory fact for a user.
 * Uses ON CONFLICT to merge with existing entries — confidence is blended.
 */
export async function upsertMemory(
  userId: string,
  fact: MemoryFact,
  source: MemorySource = 'learn',
): Promise<void> {
  await sql`
    INSERT INTO student_memory (user_id, memory_type, context_key, value, confidence, source)
    VALUES (${userId}, ${fact.memoryType}, ${fact.contextKey},
            ${JSON.stringify(fact.value)}::jsonb, ${fact.confidence}, ${source})
    ON CONFLICT (user_id, memory_type, context_key) DO UPDATE
      SET value      = EXCLUDED.value,
          -- Blend confidence toward new value (weighted update)
          confidence = (student_memory.confidence * 0.6 + EXCLUDED.confidence * 0.4),
          source     = EXCLUDED.source,
          updated_at = now()
  `
}

/**
 * Extract memory facts from a completed conversation using the light model.
 * Saves each extracted fact via upsertMemory.
 *
 * @param userId     The learning user
 * @param messages   Full conversation as [{role, content}] pairs
 * @param source     Origin of this extraction ('learn' | 'ask' | 'test')
 */
export async function extractAndSave(
  userId: string,
  messages: Array<{ role: string; content: string }>,
  source: MemorySource = 'learn',
): Promise<void> {
  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 500)}`)
    .join('\n')

  const prompt = `You are a student memory extractor. Analyze this learning conversation and extract factual memory entries about what the student knows, struggles with, or has mastered.

Conversation:
${transcript.slice(0, 4000)}

Return a JSON array (may be empty []). Each item must have:
{
  "memoryType": one of ["topic_mastery","weak_topic","strong_topic","common_mistake","study_history","revision_priority","syllabus_coverage"],
  "contextKey": short topic/concept identifier (e.g. "Newton's Second Law"),
  "value": any JSON object with relevant data,
  "confidence": number between 0 and 1
}

Only extract clear, specific facts. Return [] if nothing significant is observable.`

  let facts: MemoryFact[]
  try {
    facts = await completeJson<MemoryFact[]>(
      [{ role: 'user', content: prompt }],
      MODELS.light,
    )
  } catch (err) {
    console.warn('[memory] extraction failed:', err)
    return
  }

  if (!Array.isArray(facts)) return

  for (const fact of facts) {
    if (!fact.memoryType || !fact.contextKey) continue
    await upsertMemory(userId, fact, source).catch((err) =>
      console.warn('[memory] upsert failed:', err),
    )
  }
}
