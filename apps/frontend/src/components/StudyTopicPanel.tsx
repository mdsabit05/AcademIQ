import { useState } from 'react'
import { X, CheckCircle2, Circle, BookOpen, ChevronRight } from 'lucide-react'
import type { SyllabusTopic } from 'shared'

export interface StudyTopicPanelProps {
  syllabusTitle: string
  topics: SyllabusTopic[]
  activeTopicId: string | null
  onSetActive: (id: string) => void
  onMarkComplete: (topicId: string) => void
  onClose: () => void
}

export default function StudyTopicPanel({
  syllabusTitle,
  topics,
  activeTopicId,
  onSetActive,
  onMarkComplete,
  onClose,
}: StudyTopicPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const groups = topics.reduce<Record<string, SyllabusTopic[]>>((acc, t) => {
    const key = t.unit ?? 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const completed = topics.filter(t => t.completed).length
  const total = topics.length
  const expandedTopic = expandedId ? topics.find(t => t.id === expandedId) : null

  return (
    <div className="relative flex flex-col w-72 md:w-52 shrink-0 border-l border-border bg-bg h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border">
        <span className="text-[11px] font-bold text-white uppercase tracking-wide truncate">{syllabusTitle}</span>
        <button onClick={onClose} className="ml-1 text-muted hover:text-white transition-colors shrink-0">
          <X size={13} />
        </button>
      </div>

      {/* Topic list */}
      <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'none' }}>
        {Object.entries(groups).map(([unit, unitTopics]) => (
          <div key={unit}>
            <div className="text-[9px] font-black uppercase tracking-[0.15em] text-muted px-2.5 pt-2 pb-1">{unit}</div>
            {unitTopics.map(topic => {
              const isActive = topic.id === activeTopicId
              return (
                <button
                  key={topic.id}
                  onClick={() => setExpandedId(expandedId === topic.id ? null : topic.id)}
                  className={`w-full flex items-center gap-1.5 px-2.5 py-1 text-left transition-colors group ${
                    isActive ? 'bg-primary/10' : 'hover:bg-surface'
                  }`}
                >
                  {topic.completed
                    ? <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                    : <Circle size={11} className={`shrink-0 ${isActive ? 'text-primary' : 'text-muted/40'}`} />
                  }
                  <span className={`flex-1 text-[11px] leading-snug truncate ${
                    topic.completed
                      ? 'line-through text-muted/40'
                      : isActive
                        ? 'text-primary font-semibold'
                        : 'text-muted group-hover:text-white'
                  }`}>
                    {topic.topic}
                  </span>
                  <ChevronRight size={9} className="text-muted/30 shrink-0 group-hover:text-muted transition-colors" />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Progress footer */}
      <div className="px-2.5 py-2 border-t border-border">
        <div className="flex justify-between text-[10px] text-muted mb-1">
          <span>Progress</span>
          <span className="font-semibold text-white">{completed}/{total}</span>
        </div>
        <div className="w-full bg-surface rounded-full h-1">
          <div
            className="bg-emerald-500 h-1 rounded-full transition-all"
            style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Expanded detail popup */}
      {expandedTopic && (
        <div className="absolute inset-0 bg-bg flex flex-col border-l border-border overflow-y-auto">
          <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-border">
            <div className="min-w-0 mr-2">
              <p className="text-xs font-semibold text-white leading-snug">{expandedTopic.topic}</p>
              {expandedTopic.unit && <p className="text-[10px] text-muted mt-0.5">{expandedTopic.unit}</p>}
            </div>
            <button onClick={() => setExpandedId(null)} className="text-muted hover:text-white shrink-0 transition-colors">
              <X size={13} />
            </button>
          </div>

          {expandedTopic.subtopic && (
            <div className="px-3 py-2 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1">Subtopics</p>
              <p className="text-[11px] text-muted leading-relaxed whitespace-pre-line">{expandedTopic.subtopic}</p>
            </div>
          )}

          <div className="px-3 py-3 space-y-1.5 border-t border-border mt-auto">
            <button
              onClick={() => { onSetActive(expandedTopic.id); setExpandedId(null) }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-bg transition-colors"
              style={{ background: '#22D3EE' }}
            >
              <BookOpen size={11} /> Study This Topic
            </button>
            {!expandedTopic.completed && (
              <button
                onClick={() => { onMarkComplete(expandedTopic.id); setExpandedId(null) }}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <CheckCircle2 size={11} /> Mark Complete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
