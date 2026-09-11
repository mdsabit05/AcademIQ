/**
 * Duplicate Detector — identifies near-duplicate questions in a generated paper.
 * Uses simple text similarity (Jaccard on word sets) to flag duplicates.
 * A future version could use embedding cosine similarity.
 */

export interface DuplicateFlag {
  indexA: number
  indexB: number
  similarity: number
}

const DUPLICATE_THRESHOLD = 0.7  // Jaccard similarity ≥ 0.7 = likely duplicate

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  const intersection = new Set([...a].filter((x) => b.has(x)))
  const union = new Set([...a, ...b])
  return intersection.size / union.size
}

/**
 * Find near-duplicate question pairs in a list of question strings.
 * Returns all pairs with similarity ≥ DUPLICATE_THRESHOLD.
 */
export function detectDuplicates(questions: string[]): DuplicateFlag[] {
  const tokenized = questions.map(tokenize)
  const flags: DuplicateFlag[] = []

  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const sim = jaccard(tokenized[i], tokenized[j])
      if (sim >= DUPLICATE_THRESHOLD) {
        flags.push({ indexA: i, indexB: j, similarity: sim })
      }
    }
  }

  return flags
}
