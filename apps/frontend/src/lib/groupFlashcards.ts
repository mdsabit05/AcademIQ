import type { Flashcard } from 'shared'

export interface FlashcardSet {
  documentId: string
  topic: string
  cards: Flashcard[]
  weakCount: number
}

export function groupIntoSets(flashcards: Flashcard[]): FlashcardSet[] {
  const map = new Map<string, { documentId: string; topic: string; cards: Flashcard[] }>()
  for (const card of flashcards) {
    const key = `${card.document_id}\x00${card.topic}`
    if (!map.has(key)) {
      map.set(key, { documentId: card.document_id, topic: card.topic, cards: [] })
    }
    map.get(key)!.cards.push(card)
  }
  return Array.from(map.values()).map(({ documentId, topic, cards }) => ({
    documentId,
    topic,
    cards,
    weakCount: cards.filter((c) => c.fail_count > c.pass_count).length,
  }))
}

export function sendCardToEnd(deck: Flashcard[], index: number): Flashcard[] {
  const newDeck = [...deck]
  const [card] = newDeck.splice(index, 1)
  newDeck.push(card)
  return newDeck
}
