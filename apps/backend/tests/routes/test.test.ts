import { describe, it, expect } from 'vitest'
import { scoreAttempt } from '../../src/routes/test.js'

describe('scoreAttempt', () => {
  const questions = [
    { id: 'q1', correct_answer: 'B', marks: 1 },
    { id: 'q2', correct_answer: 'Paris', marks: 1 },
    { id: 'q3', correct_answer: 'Normalization reduces redundancy', marks: 5 },
  ]

  it('gives full score when all answers are correct', () => {
    const answers = {
      q1: 'B',
      q2: 'Paris',
      q3: 'Normalization reduces redundancy',
    }
    const { score, totalMarks } = scoreAttempt(questions, answers)
    expect(score).toBe(7)
    expect(totalMarks).toBe(7)
  })

  it('gives zero for all wrong answers', () => {
    const answers = { q1: 'A', q2: 'London', q3: 'Wrong answer' }
    const { score } = scoreAttempt(questions, answers)
    expect(score).toBe(0)
  })

  it('is case-insensitive', () => {
    const answers = { q1: 'b', q2: 'paris', q3: 'normalization reduces redundancy' }
    const { score } = scoreAttempt(questions, answers)
    expect(score).toBe(7)
  })

  it('handles missing answers as wrong', () => {
    const { score, totalMarks } = scoreAttempt(questions, {})
    expect(score).toBe(0)
    expect(totalMarks).toBe(7)
  })

  it('scores partial attempts correctly', () => {
    const answers = { q1: 'B', q2: 'Wrong' }
    const { score } = scoreAttempt(questions, answers)
    expect(score).toBe(1)
  })
})
