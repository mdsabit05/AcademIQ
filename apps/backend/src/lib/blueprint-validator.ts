/**
 * Blueprint Validator — validates a paper blueprint config JSON schema.
 * Called before generating a question paper from a blueprint.
 */

export interface BlueprintSection {
  name: string
  type: 'mcq' | 'one_mark' | 'two_mark' | 'five_mark'
  count: number
  marksEach: number
  topics?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  bookIds: string[]
}

export interface BlueprintConfig {
  duration: number         // minutes
  totalMarks: number
  sections: BlueprintSection[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateBlueprint(config: unknown): ValidationResult {
  const errors: string[] = []

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['config must be an object'] }
  }

  const c = config as Record<string, unknown>

  if (typeof c.duration !== 'number' || c.duration <= 0) {
    errors.push('config.duration must be a positive number (minutes)')
  }

  if (typeof c.totalMarks !== 'number' || c.totalMarks <= 0) {
    errors.push('config.totalMarks must be a positive number')
  }

  if (!Array.isArray(c.sections) || c.sections.length === 0) {
    errors.push('config.sections must be a non-empty array')
    return { valid: false, errors }
  }

  const VALID_TYPES = new Set(['mcq', 'one_mark', 'two_mark', 'five_mark'])
  const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard'])

  let computedMarks = 0

  for (let i = 0; i < c.sections.length; i++) {
    const s = c.sections[i] as Record<string, unknown>
    const prefix = `sections[${i}]`

    if (!s.name || typeof s.name !== 'string') errors.push(`${prefix}.name is required`)
    if (!VALID_TYPES.has(s.type as string)) errors.push(`${prefix}.type must be one of mcq|one_mark|two_mark|five_mark`)
    if (typeof s.count !== 'number' || s.count <= 0) errors.push(`${prefix}.count must be a positive integer`)
    if (typeof s.marksEach !== 'number' || s.marksEach <= 0) errors.push(`${prefix}.marksEach must be positive`)
    if (s.difficulty && !VALID_DIFFICULTIES.has(s.difficulty as string)) {
      errors.push(`${prefix}.difficulty must be easy|medium|hard`)
    }
    if (!Array.isArray(s.bookIds)) {
      errors.push(`${prefix}.bookIds must be an array`)
    }

    if (typeof s.count === 'number' && typeof s.marksEach === 'number') {
      computedMarks += s.count * s.marksEach
    }
  }

  // Allow up to 5 marks tolerance to handle rounding from percentage-based configs
  if (errors.length === 0 && Math.abs(computedMarks - (c.totalMarks as number)) > 5) {
    errors.push(
      `Sections add up to ${computedMarks} marks but totalMarks is ${c.totalMarks}`,
    )
  }

  return { valid: errors.length === 0, errors }
}
