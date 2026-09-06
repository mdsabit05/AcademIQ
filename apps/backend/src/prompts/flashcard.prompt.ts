import type { LLMMessage } from '../services/openrouter.service.js'

export function flashcardPrompt(topic: string, context: string, count: number): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are a flashcard generator. Create exactly ${count} question-answer pairs about "${topic}".

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "cards": [
    { "question": "...", "answer": "..." }
  ]
}

Each question should test a single concept. Each answer should be 1-3 sentences.
Base everything strictly on the provided study material. Do not invent information.`,
    },
    {
      role: 'user',
      content: `Study material:\n\n${context}\n\nGenerate ${count} flashcards about: ${topic}`,
    },
  ]
}
