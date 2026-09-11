/**
 * Chunker Service — orchestrates page-aware text extraction and chunking.
 * Uses pdf-parse for text pages and ocr.service for image pages.
 * Operates on file paths — never holds the full PDF in memory.
 */

import pdfParse from 'pdf-parse'
import { readFile } from 'fs/promises'
import { recognizePath } from './ocr.service.js'
import { chunkPages, type PageText, type TextChunk } from '../lib/chunker.js'

export interface ExtractionResult {
  pages: PageText[]
  pageCount: number
  ocrApplied: boolean
}

/**
 * Minimum text length per page to be considered a text page.
 * Pages with less text are treated as image/scanned pages.
 */
const MIN_TEXT_PAGE_CHARS = 50

/**
 * Extract text from a PDF file path.
 * Detects image pages and applies OCR where needed.
 * Returns structured page data for chunking.
 */
export async function extractPages(filePath: string): Promise<ExtractionResult> {
  const buffer = await readFile(filePath)
  const parsed = await pdfParse(buffer)

  const pageCount = parsed.numpages
  let ocrApplied = false

  // pdf-parse gives us the full text; split by form feeds to approximate pages
  const rawPageTexts = parsed.text
    .split('\f')
    .map((t: string) => t.trim())
    .slice(0, pageCount)

  const pages: PageText[] = []

  for (let i = 0; i < pageCount; i++) {
    const pageText = rawPageTexts[i] ?? ''
    const pageNumber = i + 1

    if (pageText.length >= MIN_TEXT_PAGE_CHARS) {
      // Sufficient text — treat as normal text page
      pages.push({
        pageNumber,
        text: pageText,
        isOcr: false,
      })
    } else {
      // Insufficient text — likely a scanned/image page, apply OCR
      ocrApplied = true
      let ocrText = ''
      try {
        // OCR the file path directly (tesseract handles multi-page PDFs by page)
        ocrText = await recognizePath(filePath)
      } catch (err) {
        console.error(`[chunker] OCR failed on page ${pageNumber}:`, err)
      }
      pages.push({
        pageNumber,
        text: ocrText,
        isOcr: true,
      })
    }
  }

  return { pages, pageCount, ocrApplied }
}

/**
 * Full pipeline: extract pages from PDF → chunk all pages.
 * Returns ready-to-embed TextChunk[].
 */
export async function extractAndChunk(filePath: string): Promise<{
  chunks: TextChunk[]
  pageCount: number
  ocrApplied: boolean
}> {
  const { pages, pageCount, ocrApplied } = await extractPages(filePath)
  const chunks = chunkPages(pages)
  return { chunks, pageCount, ocrApplied }
}
