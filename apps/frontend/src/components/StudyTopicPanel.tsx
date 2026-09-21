import { useState } from 'react'
import { X, CheckCircle2, Circle, BookOpen } from 'lucide-react'
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

  // Group topics by unit
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
    <div className="relative flex flex-col w-64 shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{syllabusTitle}</span>
        <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={16} />
        </button>
      </div>

      {/* Topic list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Object.entries(groups).map(([unit, unitTopics]) => (
          <div key={unit}>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1">{unit}</div>
            <div className="space-y-1">
              {unitTopics.map(topic => {
                const isActive = topic.id === activeTopicId
                return (
                  <button
                    key={topic.id}
                    onClick={() => setExpandedId(expandedId === topic.id ? null : topic.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                      isActive
                        ? 'border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    } ${topic.completed ? 'opacity-60' : ''}`}
                  >
                    {topic.completed ? (
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <Circle size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                    )}
                    <span className={`truncate ${topic.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {topic.topic}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Progress footer */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Progress</span>
          <span>{completed}/{total}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Expanded popup */}
      {expandedTopic && (
        <div className="absolute inset-0 bg-white dark:bg-gray-900 flex flex-col p-4 overflow-y-auto">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">{expandedTopic.topic}</div>
              {expandedTopic.unit && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{expandedTopic.unit}</div>
              )}
            </div>
            <button onClick={() => setExpandedId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-2 shrink-0">
              <X size={16} />
            </button>
          </div>

          {expandedTopic.subtopic && (
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Subtopics</div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{expandedTopic.subtopic}</p>
            </div>
          )}

          <div className="mt-auto space-y-2">
            <button
              onClick={() => {
                onSetActive(expandedTopic.id)
                setExpandedId(null)
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              <BookOpen size={14} />
              Study This Topic
            </button>
            {!expandedTopic.completed && (
              <button
                onClick={() => {
                  onMarkComplete(expandedTopic.id)
                  setExpandedId(null)
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 text-sm font-medium"
              >
                <CheckCircle2 size={14} />
                Mark Complete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
