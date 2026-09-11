/**
 * Job handler: process-book
 * Called by pg-boss when book processing jobs are dequeued.
 * pg-boss v10 passes an array of jobs to each handler invocation.
 */

import type PgBoss from 'pg-boss'
import { processBook } from '../../services/pipeline.service.js'

export const PROCESS_BOOK_JOB = 'process-book'

export async function handleProcessBook(
  jobs: PgBoss.Job<{ bookId: string }>[],
): Promise<void> {
  await Promise.all(
    jobs.map(async (job) => {
      const { bookId } = job.data
      console.log(`[process-book] starting job for book ${bookId}`)
      await processBook(bookId)
      console.log(`[process-book] completed job for book ${bookId}`)
    }),
  )
}
