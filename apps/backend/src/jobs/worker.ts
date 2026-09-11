/**
 * pg-boss worker — registers all job handlers and starts polling.
 * Call startWorker() once during application startup.
 * Call stopWorker() on graceful shutdown.
 */

import PgBoss from 'pg-boss'
import { handleProcessBook, PROCESS_BOOK_JOB } from './handlers/process-book.js'

let boss: PgBoss | null = null

export async function startWorker(): Promise<PgBoss> {
  if (boss) return boss

  boss = new PgBoss(process.env.DATABASE_URL!)

  boss.on('error', (err) => console.error('[pg-boss] error:', err))

  await boss.start()

  // Register job handlers
  await boss.work(PROCESS_BOOK_JOB, { batchSize: 2 }, handleProcessBook)

  console.log('[pg-boss] worker started')
  return boss
}

export async function stopWorker(): Promise<void> {
  if (boss) {
    await boss.stop()
    boss = null
    console.log('[pg-boss] worker stopped')
  }
}

/**
 * Enqueue a book processing job.
 * Idempotent — pg-boss deduplicates by key within the retention window.
 */
export async function enqueueProcessBook(bookId: string): Promise<void> {
  if (!boss) throw new Error('Worker not started — call startWorker() first')
  await boss.send(PROCESS_BOOK_JOB, { bookId }, { singletonKey: `process-book:${bookId}` })
}
