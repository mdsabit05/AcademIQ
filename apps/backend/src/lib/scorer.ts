/**
 * Test Scorer — calculates scores for test attempts.
 * Handles MCQ (exact match), short-answer, and essay grading via AI.
 */

import { complete } from '../services/ai.service.js'
import { MODELS } from '../config/models.js'

export interface QuestionResult {
  questionId: string
  answer: string
  isCorrect: boolean
  marksAwarded: number
  maxMarks: number
}

export interface ScoreResult {
  totalScore: number
  totalMarks: number
  results: QuestionResult[]
}

interface Question {
  id: string
  question_type: string
  correct_answer: string
  marks: number
  options?: unknown
}

/**
 * Score MCQ/one-mark questions (exact string match after normalization).
 */
function scoreMcq(answer: string, correctAnswer: string, marks: number): boolean {
  return answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
}

/**
 * Score a long-answer question using the light AI model.
 * Returns marks awarded (0 to maxMarks).
 */
async function scoreLongAnswer(
  question: string,
  correctAnswer: string,
  studentAnswer: string,
  maxMarks: number,
): Promise<number> {
  const prompt = `You are a fair academic examiner. Score this student answer.

Question: ${question}
Model answer: ${correctAnswer}
Student answer: ${studentAnswer}
Maximum marks: ${maxMarks}

Award marks based on: accuracy, completeness, and relevance.
Reply with JSON only: {"marks": <number 0-${maxMarks}>, "reason": "<brief reason>"}`

  try {
    const raw = await complete([{ role: 'user', content: prompt }], MODELS.light)
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
    const { marks } = JSON.parse(cleaned) as { marks: number }
    return Math.max(0, Math.min(maxMarks, Math.round(marks)))
  } catch {
    // Fallback: 0 if AI scoring fails
    return 0
  }
}

/**
 * Score all answers in a test attempt.
 */
export async function scoreAttempt(
  questions: Question[],
  answers: Record<string, string>, // questionId → student answer
): Promise<ScoreResult> {
  const results: QuestionResult[] = []

  for (const q of questions) {
    const studentAnswer = answers[q.id] ?? ''
    let isCorrect = false
    let marksAwarded = 0

    if (q.question_type === 'mcq' || q.question_type === 'one_mark') {
      isCorrect = scoreMcq(studentAnswer, q.correct_answer, q.marks)
      marksAwarded = isCorrect ? q.marks : 0
    } else {
      // two_mark or five_mark — AI scoring
      marksAwarded = await scoreLongAnswer(
        '',               // question text not passed here — caller can enrich if needed
        q.correct_answer,
        studentAnswer,
        q.marks,
      )
      isCorrect = marksAwarded >= Math.ceil(q.marks / 2)
    }

    results.push({
      questionId: q.id,
      answer: studentAnswer,
      isCorrect,
      marksAwarded,
      maxMarks: q.marks,
    })
  }

  const totalScore = results.reduce((sum, r) => sum + r.marksAwarded, 0)
  const totalMarks = results.reduce((sum, r) => sum + r.maxMarks, 0)

  return { totalScore, totalMarks, results }
}
