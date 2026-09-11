/**
 * OCR Service — converts scanned/image-based PDF pages to text.
 * Uses tesseract.js with page-by-page processing.
 * Never loads the full PDF into memory — operates on individual page images.
 */

import { createWorker } from 'tesseract.js'

let worker: Awaited<ReturnType<typeof createWorker>> | null = null

async function getWorker() {
  if (!worker) {
    worker = await createWorker('eng', 1, {
      // Suppress verbose tesseract logging in production
      logger: process.env.NODE_ENV === 'development'
        ? (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              process.stdout.write(`\r[OCR] ${Math.round(m.progress * 100)}%`)
            }
          }
        : undefined,
    })
  }
  return worker
}

/**
 * Recognize text from a raw image buffer (PNG, JPEG, or raw pixel data).
 * Returns the extracted text string.
 */
export async function recognizeImage(imageBuffer: Buffer): Promise<string> {
  const w = await getWorker()
  const { data } = await w.recognize(imageBuffer)
  return data.text ?? ''
}

/**
 * Recognize text from a local file path.
 */
export async function recognizePath(imagePath: string): Promise<string> {
  const w = await getWorker()
  const { data } = await w.recognize(imagePath)
  return data.text ?? ''
}

/**
 * Terminate the shared worker. Call on application shutdown.
 */
export async function terminateOcr(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
  }
}
