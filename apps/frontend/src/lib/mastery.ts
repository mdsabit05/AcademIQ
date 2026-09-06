import type { Document, TestAttempt } from 'shared'

type AttemptRow = TestAttempt & { document_id: string; document_title: string; topic: string }

export interface MasteryInfo {
  pct: number          // -1 if no attempts yet
  lastActivity: string // ISO date string
}

export function computeMastery(
  documents: Document[],
  attempts: AttemptRow[],
): Record<string, MasteryInfo> {
  const byDoc = new Map<string, { scores: number[]; lastDate: string }>()

  for (const a of attempts) {
    const pct = Math.round((a.score / a.total_marks) * 100)
    const existing = byDoc.get(a.document_id)
    if (existing) {
      existing.scores.push(pct)
      if (a.submitted_at > existing.lastDate) existing.lastDate = a.submitted_at
    } else {
      byDoc.set(a.document_id, { scores: [pct], lastDate: a.submitted_at })
    }
  }

  const result: Record<string, MasteryInfo> = {}
  for (const doc of documents) {
    const entry = byDoc.get(doc.id)
    if (entry) {
      const avg = Math.round(entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length)
      result[doc.id] = { pct: avg, lastActivity: entry.lastDate }
    } else {
      result[doc.id] = { pct: -1, lastActivity: doc.created_at }
    }
  }
  return result
}
