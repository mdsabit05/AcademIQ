import type { LLMMessage } from '../services/openrouter.service.js'
import type { TestType, Difficulty } from 'shared'

const TYPE_INSTRUCTIONS: Record<TestType, string> = {
  mcq: 'Multiple choice questions with exactly 4 options labelled "A", "B", "C", "D". Set correct_answer to the letter only (e.g. "B"). Set marks to 1.',
  one_mark: 'Short one-sentence answer questions. Set options to null. Set marks to 1.',
  two_mark: 'Short paragraph answer questions (2-4 sentences expected). Set options to null. Set marks to 2.',
  five_mark: 'Detailed essay-style questions requiring thorough explanations. Set options to null. Set marks to 5.',
  mixed: 'A mix: roughly half MCQ (marks: 1, options: [...]), a quarter short answer (marks: 1, options: null), and a quarter detailed (marks: 5, options: null).',
}

export function testPrompt(
  topic: string,
  context: string,
  count: number,
  type: TestType,
  difficulty: Difficulty,
): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert exam question generator.
Generate exactly ${count} ${difficulty}-difficulty questions about "${topic}".

Question type instructions: ${TYPE_INSTRUCTIONS[type]}

Difficulty guidelines:
- easy: recall and definitions, straightforward facts from the material
- medium: application and comparison, requires understanding relationships
- hard: analysis and edge cases, requires synthesis of multiple concepts

Return ONLY a valid JSON object in this exact structure — no markdown, no explanation:
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."] or null,
      "correct_answer": "...",
      "marks": 1
    }
  ]
}

Base every question strictly on the provided context. Do not invent information not present in the material.`,
    },
    {
      role: 'user',
      content: `Study material context:\n\n${context}\n\nGenerate ${count} ${difficulty} ${type} questions about: ${topic}`,
    },
  ]
}
