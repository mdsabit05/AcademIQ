import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { makeApi } from '../lib/api.ts'
import UploadZone from '../components/UploadZone.tsx'
import DocumentCard from '../components/DocumentCard.tsx'
import type { Document } from 'shared'

export default function Materials() {
  const { getToken } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const loadDocuments = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const api = makeApi(token)
    const res = await api.documents.list()
    setDocuments(res.documents)
    setLoading(false)
  }, [getToken])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  // Poll processing documents every 3 seconds
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing')
    if (!hasProcessing) return
    const id = setInterval(loadDocuments, 3000)
    return () => clearInterval(id)
  }, [documents, loadDocuments])

  async function handleUpload(file: File, title: string) {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const api = makeApi(token)
    const res = await api.documents.upload(file, title)
    setDocuments((prev) => [res.document, ...prev])
    return { documentId: res.document.id }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its data?')) return
    const token = await getToken()
    if (!token) return
    const api = makeApi(token)
    await api.documents.delete(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Materials</h1>
        <p className="mt-1 text-muted">Upload PDFs to use them across Learn, Ask AI, and Test modes.</p>
      </div>

      <div className="mb-8 max-w-lg">
        <h2 className="mb-4 font-semibold text-white">Upload PDF</h2>
        <UploadZone onUpload={handleUpload} onComplete={loadDocuments} />
      </div>

      <div>
        <h2 className="mb-4 font-semibold text-white">
          Your Documents
          <span className="ml-2 text-sm font-normal text-muted">({documents.length})</span>
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted">No documents uploaded yet. Upload a PDF above to get started.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
