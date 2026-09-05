import { useState, useRef } from 'react'
import { Upload, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

type UploadStep = 'idle' | 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'ready' | 'failed'

const STEPS: UploadStep[] = ['uploading', 'extracting', 'chunking', 'embedding', 'ready']
const STEP_LABELS: Record<UploadStep, string> = {
  idle: '',
  uploading: 'Uploading...',
  extracting: 'Extracting text...',
  chunking: 'Chunking text...',
  embedding: 'Generating embeddings...',
  ready: 'Ready!',
  failed: 'Processing failed',
}

interface UploadZoneProps {
  onUpload: (file: File, title: string) => Promise<{ documentId: string }>
  onComplete: (documentId: string) => void
}

export default function UploadZone({ onUpload, onComplete }: UploadZoneProps) {
  const [step, setStep] = useState<UploadStep>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.pdf')) {
      alert('Please upload a PDF file.')
      return
    }

    const fileTitle = title || file.name.replace('.pdf', '')
    setStep('uploading')

    try {
      const { documentId } = await onUpload(file, fileTitle)

      // Simulate steps while backend processes (poll is handled by parent)
      setStep('extracting')
      await delay(1200)
      setStep('chunking')
      await delay(800)
      setStep('embedding')

      // Poll document status
      onComplete(documentId)
    } catch {
      setStep('failed')
    }
  }

  const isProcessing = step !== 'idle' && step !== 'ready' && step !== 'failed'

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Document title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => !isProcessing && inputRef.current?.click()}
        className={clsx(
          'flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed p-10 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-white/[0.02]',
          isProcessing && 'cursor-default',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {step === 'idle' && (
          <>
            <Upload size={32} className="text-muted" />
            <div className="text-center">
              <p className="font-medium text-white">Drop your PDF here</p>
              <p className="mt-1 text-sm text-muted">or click to browse</p>
            </div>
          </>
        )}

        {isProcessing && (
          <div className="w-full space-y-3">
            <Loader2 size={28} className="mx-auto animate-spin text-primary" />
            <div className="space-y-2">
              {STEPS.filter((s) => s !== 'ready').map((s) => {
                const stepIdx = STEPS.indexOf(s)
                const currentIdx = STEPS.indexOf(step)
                const done = stepIdx < currentIdx
                const active = s === step
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={clsx(
                      'h-2 w-2 rounded-full',
                      done ? 'bg-success' : active ? 'animate-pulse bg-primary' : 'bg-border',
                    )} />
                    <span className={clsx(
                      'text-sm',
                      done ? 'text-success' : active ? 'text-white' : 'text-subtle',
                    )}>
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {step === 'ready' && (
          <>
            <CheckCircle size={32} className="text-success" />
            <p className="font-medium text-success">Document ready!</p>
          </>
        )}

        {step === 'failed' && (
          <>
            <AlertCircle size={32} className="text-danger" />
            <p className="font-medium text-danger">Processing failed. Try again.</p>
          </>
        )}
      </div>
    </div>
  )
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
