/**
 * Storage Service — abstraction over file storage.
 * Local filesystem in development. S3/R2-compatible in production.
 * PDF binaries are never stored in PostgreSQL.
 *
 * Key format: {ownerId}/{bookId}/original.pdf
 *
 * Switch provider via STORAGE_PROVIDER env var:
 *   local (default) → STORAGE_LOCAL_PATH
 *   s3              → S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY
 */

import {
  createWriteStream,
  createReadStream as fsCreateReadStream,
  existsSync,
  mkdirSync,
} from 'fs'
import { unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { pipeline } from 'stream/promises'
import type { Readable } from 'stream'
import { S3Client, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

export interface StorageProvider {
  /**
   * Stream a file to storage without buffering the full content in memory.
   * Returns the number of bytes written.
   */
  saveStream(key: string, stream: Readable): Promise<{ sizeBytes: number }>

  /** Create a readable stream from storage. */
  createReadStream(key: string): Readable

  /**
   * Return the absolute local filesystem path for this key.
   * Returns null for non-local providers (e.g. S3).
   * Use this to pass file paths to pdf-parse, tesseract, etc.
   */
  getLocalPath(key: string): string | null

  delete(key: string): Promise<void>

  exists(key: string): Promise<boolean>
}

class LocalStorageProvider implements StorageProvider {
  constructor(private readonly basePath: string) {
    mkdirSync(basePath, { recursive: true })
  }

  private resolve(key: string): string {
    // Prevent path traversal
    const safe = key.replace(/\.\./g, '').replace(/^\/+/, '')
    return join(this.basePath, safe)
  }

  async saveStream(key: string, stream: Readable): Promise<{ sizeBytes: number }> {
    const fullPath = this.resolve(key)
    mkdirSync(dirname(fullPath), { recursive: true })

    let sizeBytes = 0
    const writeStream = createWriteStream(fullPath)

    // Count bytes as they flow — no Buffer accumulation
    stream.on('data', (chunk: Buffer) => {
      sizeBytes += chunk.length
    })

    await pipeline(stream as NodeJS.ReadableStream, writeStream)
    return { sizeBytes }
  }

  createReadStream(key: string): Readable {
    return fsCreateReadStream(this.resolve(key)) as Readable
  }

  getLocalPath(key: string): string {
    return this.resolve(key)
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolve(key)
    if (existsSync(fullPath)) {
      await unlink(fullPath)
    }
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.resolve(key))
  }
}

class S3StorageProvider implements StorageProvider {
  private client: S3Client
  private bucket: string

  constructor() {
    this.bucket = process.env.B2_BUCKET_NAME ?? process.env.S3_BUCKET ?? ''
    this.client = new S3Client({
      region: process.env.B2_REGION ?? process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.B2_ENDPOINT ?? process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID ?? process.env.S3_ACCESS_KEY ?? '',
        secretAccessKey: process.env.B2_APPLICATION_KEY ?? process.env.S3_SECRET_KEY ?? '',
      },
      forcePathStyle: true,
    })
  }

  async saveStream(key: string, stream: Readable): Promise<{ sizeBytes: number }> {
    let sizeBytes = 0
    stream.on('data', (chunk: Buffer) => { sizeBytes += chunk.length })

    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: stream, ContentType: 'application/pdf' },
    })
    await upload.done()
    return { sizeBytes }
  }

  createReadStream(key: string): Readable {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    // Return a lazy stream — the promise resolves on first read
    const { Readable: NodeReadable } = require('stream')
    const pass = new NodeReadable({ read() {} })
    this.client.send(cmd).then((res) => {
      const body = res.Body as Readable
      body.on('data', (chunk) => pass.push(chunk))
      body.on('end', () => pass.push(null))
      body.on('error', (err) => pass.destroy(err))
    }).catch((err) => pass.destroy(err))
    return pass
  }

  getLocalPath(_key: string): null { return null }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }
}

function createProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'

  if (provider === 'local') {
    const basePath = process.env.STORAGE_LOCAL_PATH
      ? join(process.cwd(), process.env.STORAGE_LOCAL_PATH)
      : join(process.cwd(), 'uploads')
    return new LocalStorageProvider(basePath)
  }

  if (provider === 's3') {
    return new S3StorageProvider()
  }

  throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`)
}

export const storage = createProvider()

/** Build a storage key for a book's original PDF */
export function bookStorageKey(ownerId: string, bookId: string): string {
  return `${ownerId}/${bookId}/original.pdf`
}
