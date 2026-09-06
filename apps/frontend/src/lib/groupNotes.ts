import type { NoteWithTitle } from 'shared'

export function groupByDocument(
  notes: NoteWithTitle[],
): Record<string, Record<string, NoteWithTitle[]>> {
  const grouped: Record<string, Record<string, NoteWithTitle[]>> = {}
  for (const note of notes) {
    if (!grouped[note.document_title]) grouped[note.document_title] = {}
    if (!grouped[note.document_title][note.topic]) grouped[note.document_title][note.topic] = []
    grouped[note.document_title][note.topic].push(note)
  }
  return grouped
}
