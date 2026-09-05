import { FileText, Trash2, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { Document } from 'shared'

interface DocumentCardProps {
  document: Document
  onDelete: (id: string) => void
  onOpen?: (id: string) => void
}

const STATUS_CONFIG = {
  ready: { icon: CheckCircle, color: 'text-success', label: 'Ready' },
  processing: { icon: Loader2, color: 'text-primary animate-spin', label: 'Processing...' },
  failed: { icon: AlertCircle, color: 'text-danger', label: 'Failed' },
}

export default function DocumentCard({ document, onDelete, onOpen }: DocumentCardProps) {
  const status = STATUS_CONFIG[document.status]
  const StatusIcon = status.icon

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <FileText size={18} className="text-primary" />
        </div>
        <div>
          <p className="font-medium text-white">{document.title}</p>
          <div className="flex items-center gap-1.5">
            <StatusIcon size={12} className={clsx(status.color)} />
            <span className="text-xs text-muted">{status.label}</span>
            {document.page_count && (
              <span className="text-xs text-subtle">· {document.page_count} pages</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {document.status === 'ready' && onOpen && (
          <button
            onClick={() => onOpen(document.id)}
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Open
          </button>
        )}
        <button
          onClick={() => onDelete(document.id)}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
