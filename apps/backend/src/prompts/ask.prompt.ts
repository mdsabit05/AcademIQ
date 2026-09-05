import type { LLMMessage } from '../services/openrouter.service.js'
import type { MessageRole } from 'shared'

export function askPrompt(
  question: string,
  context: string,
  history: Array<{ role: MessageRole; content: string }>,
): LLMMessage[] {
  const systemMessage: LLMMessage = {
    role: 'system',
    content: `You are a helpful AI tutor answering questions about a student's study material.
Answer questions using ONLY the provided context. Be conversational but accurate.
If the answer isn't in the context, say "I don't see that in your material" and offer what you do know from the context.
Keep answers concise — aim for 2-4 sentences unless a longer explanation is clearly needed.`,
  }

  const contextMessage: LLMMessage = {
    role: 'user',
    content: `Relevant context from my notes:\n\n${context}`,
  }

  const contextAck: LLMMessage = {
    role: 'assistant',
    content: 'Got it, I have the relevant context. Ask me anything about your material.',
  }

  const historyMessages: LLMMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const userMessage: LLMMessage = {
    role: 'user',
    content: question,
  }

  return [systemMessage, contextMessage, contextAck, ...historyMessages, userMessage]
}
