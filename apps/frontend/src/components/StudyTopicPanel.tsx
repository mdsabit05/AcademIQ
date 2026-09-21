import type { SyllabusTopic } from 'shared'

export interface StudyTopicPanelProps {
  syllabusTitle: string
  topics: SyllabusTopic[]
  activeTopicId: string | null
  onSetActive: (id: string) => void
  onMarkComplete: (topicId: string) => void
  onClose: () => void
}

export default function StudyTopicPanel(_props: StudyTopicPanelProps) {
  return <div>panel</div>
}
