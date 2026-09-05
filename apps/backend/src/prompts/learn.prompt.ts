import type { LLMMessage } from '../services/openrouter.service.js'

export function learnPrompt(topic: string, context: string): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert tutor explaining study material to a student.
Your job is to teach "${topic}" clearly and thoroughly using ONLY the provided context.

Structure your explanation with:
1. A brief definition or overview
2. Why it matters / real-world relevance
3. Key concepts broken down simply
4. A concrete example
5. A quick summary

Use simple language. Avoid jargon unless you explain it immediately.
If the context doesn't cover the topic, say so clearly.`,
    },
    {
      role: 'user',
      content: `Context from my study material:\n\n${context}\n\nPlease teach me about: ${topic}`,
    },
  ]
}
