import { X, CheckCircle2, Circle } from 'lucide-react'
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
  const groups = topics.reduce<Record<string, SyllabusTopic[]>>((acc, t) => {
    const key = t.unit ?? 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const completed = topics.filter(t => t.completed).length
  const total = topics.length

  return (
    <div className="flex flex-col w-72 md:w-52 shrink-0 border-l border-border bg-bg h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border shrink-0">
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
                <div
                  key={topic.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors group ${
                    isActive ? 'bg-primary/10' : 'hover:bg-surface'
                  }`}
                >
                  {/* Circle — click to toggle complete */}
                  <button
                    onClick={() => onMarkComplete(topic.id)}
                    className="shrink-0 transition-colors"
                    title={topic.completed ? 'Mark as incomplete' : 'Mark as read'}
                  >
                    {topic.completed
                      ? <CheckCircle2 size={13} className="text-emerald-500 hover:text-emerald-400" />
                      : <Circle size={13} className={`${isActive ? 'text-primary' : 'text-muted/40 hover:text-emerald-400'}`} />
                    }
                  </button>
                  {/* Topic name — click to set active */}
                  <button
                    onClick={() => onSetActive(topic.id)}
                    className={`flex-1 text-left text-[11px] leading-snug truncate ${
                      topic.completed
                        ? 'line-through text-muted/40'
                        : isActive
                          ? 'text-primary font-semibold'
                          : 'text-muted group-hover:text-white'
                    }`}
                  >
                    {topic.topic}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Progress footer */}
      <div className="px-2.5 py-2 border-t border-border shrink-0">
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
    </div>
  )
}
