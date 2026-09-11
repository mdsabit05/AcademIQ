/**
 * Prompt builder for test question generation.
 */

export interface TestConfig {
  questionCount: number
  type: 'mcq' | 'one_mark' | 'two_mark' | 'five_mark' | 'mixed'
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  marksPerQuestion?: number
}

export function testGenerationPrompt(context: string, config: TestConfig): string {
  const typeInstructions: Record<string, string> = {
    mcq: 'Multiple choice questions with exactly 4 options (A, B, C, D). Include correct_answer as the letter (A/B/C/D).',
    one_mark: 'Short one-word or one-sentence answers. correct_answer is the expected answer.',
    two_mark: 'Brief explanatory answers (2–4 sentences). correct_answer is the model answer.',
    five_mark: 'Detailed analytical answers (1–2 paragraphs). correct_answer is the model answer.',
    mixed: 'Mix of MCQ, one_mark, two_mark, and five_mark questions as appropriate for the topic.',
  }

  return `You are an expert examiner generating test questions.

${context}

Generate exactly ${config.questionCount} question(s) of type: ${config.type}
Difficulty: ${config.difficulty}
${config.topic ? `Topic: ${config.topic}` : ''}

${typeInstructions[config.type] ?? typeInstructions.one_mark}

Return a JSON array only — no other text:
[
  {
    "question": "question text",
    "question_type": "mcq|one_mark|two_mark|five_mark",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."} (MCQ only, else null),
    "correct_answer": "...",
    "marks": ${config.marksPerQuestion ?? (config.type === 'five_mark' ? 5 : config.type === 'two_mark' ? 2 : 1)},
    "topic": "brief topic label",
    "difficulty": "${config.difficulty}"
  }
]`
}
