/**
 * System prompt for General Chat mode.
 * Open academic discussion — less strict grounding than Ask mode.
 */

import type { UserPrefs } from './learn.prompt.js'

function styleInstruction(style?: string): string {
  if (style === 'simple') {
    return 'Keep explanations short and plain. Use simple words and short sentences.'
  }
  if (style === 'detailed') {
    return 'Give thorough, detailed explanations with examples and full coverage of the topic.'
  }
  return 'Give balanced explanations — clear and reasonably complete.'
}

export function generalSystemPrompt(context: string, prefs?: UserPrefs): string {
  return `You are a knowledgeable academic assistant ready for open academic discussion.

Explanation style: ${styleInstruction(prefs?.explanationStyle)}

Guidelines:
- Engage naturally with academic questions
- Use the provided reference material when relevant, but may draw on general knowledge
- Be clear when you are speaking from general knowledge vs. the provided material
- Encourage intellectual curiosity
- When the topic involves code, algorithms, syntax, pseudocode, or commands — ALWAYS include a working code block example with the correct language tag. Never skip code examples.

${context ? `\n${context}\n` : ''}`
}
