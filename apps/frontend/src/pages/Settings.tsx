/**
 * Settings — Student settings page for AcademIQ.
 * Sections: Profile · Learning · Appearance · Notifications · Privacy & Data · Security
 * Teacher section: Teaching Preferences
 * Admin sections: System Config · Documents · Security Logs
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuth, useClerk, useUser } from '../lib/auth.ts'
import {
  Bell,
  Check,
  ChevronRight,
  Database,
  FileText,
  GraduationCap,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Server,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { makeApi } from '../lib/api.ts'
import { useCurrentUser } from '../lib/useCurrentUser.ts'
import { useTheme, type Theme } from '../lib/theme.tsx'
import { canTeach, isAdmin } from '../lib/rbac.ts'

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveSection =
  | 'profile'
  | 'learning'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'teaching'
  | 'system'
  | 'documents'
  | 'security-logs'

interface NotificationPrefs {
  studyReminders: boolean
  revisionReminders: boolean
  testReminders: boolean
  testResults: boolean
  documentProcessed: boolean
  accountUpdates: boolean
}

interface LearningPrefsForm {
  explanationStyle: 'simple' | 'balanced' | 'detailed'
  preferredDifficulty: 'easy' | 'medium' | 'hard'
  studyGoalMinutesPerDay: number
  rememberProgress: boolean
  allowBookContext: boolean
  allowLearningHistory: boolean
  allowTestPerformance: boolean
  allowPersonalizedMemory: boolean
  academicYear: string
  enrollmentNo: string
  notifications: NotificationPrefs
  teachingPrefs: {
    defaultSubject: string
    defaultDuration: string
    defaultDifficulty: 'easy' | 'medium' | 'hard'
    defaultQuestionTypes: string[]
    defaultTotalMarks: number
  }
}

interface ProfileForm {
  name: string
  institution: string
  course: string
  semester: string
}

// ── Utility helpers ────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function capitalize(s: string): string {
  if (!s) return ''
  return s[0].toUpperCase() + s.slice(1)
}

function defaultLearningPrefs(): LearningPrefsForm {
  return {
    explanationStyle: 'balanced',
    preferredDifficulty: 'medium',
    studyGoalMinutesPerDay: 45,
    rememberProgress: true,
    allowBookContext: true,
    allowLearningHistory: true,
    allowTestPerformance: true,
    allowPersonalizedMemory: true,
    academicYear: '',
    enrollmentNo: '',
    notifications: {
      studyReminders: false,
      revisionReminders: false,
      testReminders: false,
      testResults: true,
      documentProcessed: true,
      accountUpdates: true,
    },
    teachingPrefs: {
      defaultSubject: '',
      defaultDuration: '60',
      defaultDifficulty: 'medium',
      defaultQuestionTypes: ['MCQ'],
      defaultTotalMarks: 100,
    },
  }
}

function prefsFromRecord(record: Record<string, unknown>): LearningPrefsForm {
  const base = defaultLearningPrefs()
  const tp = (record.teachingPrefs as Record<string, unknown> | undefined) ?? {}
  const notif = (record.notifications as Partial<NotificationPrefs> | undefined) ?? {}
  return {
    explanationStyle:
      (record.explanationStyle as LearningPrefsForm['explanationStyle']) ??
      base.explanationStyle,
    preferredDifficulty:
      (record.preferredDifficulty as LearningPrefsForm['preferredDifficulty']) ??
      base.preferredDifficulty,
    studyGoalMinutesPerDay:
      typeof record.studyGoalMinutesPerDay === 'number'
        ? record.studyGoalMinutesPerDay
        : base.studyGoalMinutesPerDay,
    rememberProgress:
      typeof record.rememberProgress === 'boolean'
        ? record.rememberProgress
        : base.rememberProgress,
    allowBookContext:
      typeof record.allowBookContext === 'boolean'
        ? record.allowBookContext
        : base.allowBookContext,
    allowLearningHistory:
      typeof record.allowLearningHistory === 'boolean'
        ? record.allowLearningHistory
        : base.allowLearningHistory,
    allowTestPerformance:
      typeof record.allowTestPerformance === 'boolean'
        ? record.allowTestPerformance
        : base.allowTestPerformance,
    allowPersonalizedMemory:
      typeof record.allowPersonalizedMemory === 'boolean'
        ? record.allowPersonalizedMemory
        : base.allowPersonalizedMemory,
    academicYear: (record.academicYear as string) ?? base.academicYear,
    enrollmentNo: (record.enrollmentNo as string) ?? base.enrollmentNo,
    notifications: {
      studyReminders:
        typeof notif.studyReminders === 'boolean'
          ? notif.studyReminders
          : base.notifications.studyReminders,
      revisionReminders:
        typeof notif.revisionReminders === 'boolean'
          ? notif.revisionReminders
          : base.notifications.revisionReminders,
      testReminders:
        typeof notif.testReminders === 'boolean'
          ? notif.testReminders
          : base.notifications.testReminders,
      testResults:
        typeof notif.testResults === 'boolean'
          ? notif.testResults
          : base.notifications.testResults,
      documentProcessed:
        typeof notif.documentProcessed === 'boolean'
          ? notif.documentProcessed
          : base.notifications.documentProcessed,
      accountUpdates:
        typeof notif.accountUpdates === 'boolean'
          ? notif.accountUpdates
          : base.notifications.accountUpdates,
    },
    teachingPrefs: {
      defaultSubject:
        (tp.defaultSubject as string) ?? base.teachingPrefs.defaultSubject,
      defaultDuration:
        (tp.defaultDuration as string) ?? base.teachingPrefs.defaultDuration,
      defaultDifficulty:
        (tp.defaultDifficulty as LearningPrefsForm['teachingPrefs']['defaultDifficulty']) ??
        base.teachingPrefs.defaultDifficulty,
      defaultQuestionTypes: Array.isArray(tp.defaultQuestionTypes)
        ? (tp.defaultQuestionTypes as string[])
        : base.teachingPrefs.defaultQuestionTypes,
      defaultTotalMarks:
        typeof tp.defaultTotalMarks === 'number'
          ? tp.defaultTotalMarks
          : base.teachingPrefs.defaultTotalMarks,
    },
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={clsx(
        'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg',
        value ? 'bg-primary' : 'bg-[rgba(0,0,0,0.2)] dark:bg-[rgb(var(--color-border))]',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
          value ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-4 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        )}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden flex-shrink-0">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium transition-colors',
            i !== 0 && 'border-l border-border',
            value === opt.value
              ? 'bg-primary text-bg font-semibold'
              : 'bg-surface text-muted hover:text-white',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  helper,
  type = 'text',
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  helper?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white outline-none transition-colors',
          readOnly
            ? 'opacity-60 cursor-default'
            : 'focus:border-primary',
        )}
      />
      {helper && <p className="mt-1 text-xs text-muted">{helper}</p>}
    </div>
  )
}

function SubSectionLabel({ label }: { label: string }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
      {label}
    </p>
  )
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-border overflow-hidden', className)}>
      {children}
    </div>
  )
}

function ControlRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5 border-b border-border last:border-0 bg-surface">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function SaveButton({
  onClick,
  saving,
  saved,
  isDirty,
  label = 'Save Changes',
}: {
  onClick: () => void
  saving: boolean
  saved: boolean
  isDirty: boolean
  label?: string
}) {
  return (
    <div className="flex items-center gap-3 mt-8">
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className="relative flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saved ? (
          <>
            <Check size={15} />
            Saved!
          </>
        ) : saving ? (
          'Saving…'
        ) : (
          label
        )}
        {isDirty && !saved && !saving && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-yellow-400 border-2 border-bg" />
        )}
      </button>
      {saved && (
        <span className="text-sm text-green-400 flex items-center gap-1">
          <Check size={13} /> Changes saved
        </span>
      )}
    </div>
  )
}

function SkeletonLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={clsx('rounded bg-surface animate-pulse', w, h)} />
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusBadge({
  label,
  variant = 'green',
}: {
  label: string
  variant?: 'green' | 'yellow' | 'blue' | 'muted'
}) {
  const cls = {
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    muted: 'bg-surface text-muted border-border',
  }[variant]
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        cls,
      )}
    >
      {label}
    </span>
  )
}

// ── Section components ─────────────────────────────────────────────────────────

function ProfileSection({
  profileForm,
  setProfileForm,
  prefsForm,
  setPrefsForm,
  userRole,
  emailAddress,
  imageUrl,
  loaded,
  onSave,
  saving,
  saved,
  saveError,
  isDirty,
}: {
  profileForm: ProfileForm
  setProfileForm: (f: ProfileForm) => void
  prefsForm: LearningPrefsForm
  setPrefsForm: (f: LearningPrefsForm) => void
  userRole: string
  emailAddress: string
  imageUrl: string | undefined
  loaded: boolean
  onSave: () => void
  saving: boolean
  saved: boolean
  saveError: string | null
  isDirty: boolean
}) {
  const { user: clerkUser } = useUser()
  const hasData = !!(profileForm.name || profileForm.institution)
  const [isEditing, setIsEditing] = useState(!hasData)

  useEffect(() => {
    if (saved) setIsEditing(false)
  }, [saved])

  if (!loaded) {
    return (
      <div className="space-y-4">
        <SkeletonLine w="w-48" h="h-6" />
        <SkeletonLine w="w-full" h="h-32" />
        <SkeletonLine w="w-full" h="h-10" />
      </div>
    )
  }

  const displayName = profileForm.name || clerkUser?.firstName || 'User'

  const AvatarEl = () =>
    imageUrl ? (
      <img
        src={imageUrl}
        alt="Profile"
        className="rounded-full object-cover w-full h-full"
      />
    ) : (
      <div className="w-full h-full rounded-full bg-primary flex items-center justify-center">
        <span className="font-bold text-bg text-lg">{initials(displayName)}</span>
      </div>
    )

  // VIEW MODE
  if (!isEditing) {
    return (
      <div>
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-white hover:border-primary hover:text-primary transition-colors"
          >
            <User size={13} />
            Edit
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface overflow-hidden max-w-2xl">
          <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
          <div className="px-5 pb-5">
            <div className="flex items-end gap-4 -mt-8 mb-5">
              <div className="h-16 w-16 rounded-full border-4 border-surface shrink-0 overflow-hidden">
                <AvatarEl />
              </div>
              <div className="pb-0.5 min-w-0">
                <h2 className="text-base font-bold text-white leading-tight truncate">
                  {displayName}
                </h2>
                <p className="text-xs text-muted truncate">{emailAddress}</p>
              </div>
              <span className="ml-auto mb-1 shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                {userRole}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 border-t border-border pt-4">
              {[
                { label: 'Institution', value: profileForm.institution },
                { label: 'Course / Program', value: profileForm.course },
                { label: 'Semester', value: profileForm.semester },
                { label: 'Academic Year', value: prefsForm.academicYear },
                { label: 'Enrollment No.', value: prefsForm.enrollmentNo },
                { label: 'Email', value: emailAddress },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/60 mb-0.5">
                    {label}
                  </p>
                  <p className="text-sm text-white">
                    {value || <span className="text-muted italic">Not set</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // EDIT MODE
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted">Update your personal and academic information.</p>
        <button
          onClick={() => setIsEditing(false)}
          className="flex-shrink-0 text-sm text-muted hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full">
          <AvatarEl />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{displayName}</p>
          <p className="text-xs text-muted mt-0.5">{emailAddress}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Full Name"
            value={profileForm.name}
            onChange={(v) => setProfileForm({ ...profileForm, name: v })}
            placeholder="Your full name"
          />
          <FormInput
            label="Email"
            value={emailAddress}
            readOnly
            helper="Managed by your auth provider"
          />
        </div>
        <FormInput
          label="Institution / College"
          value={profileForm.institution}
          onChange={(v) => setProfileForm({ ...profileForm, institution: v })}
          placeholder="e.g. IIT Delhi"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Course / Program"
            value={profileForm.course}
            onChange={(v) => setProfileForm({ ...profileForm, course: v })}
            placeholder="e.g. B.Tech Computer Science"
          />
          <FormInput
            label="Semester"
            value={profileForm.semester}
            onChange={(v) => setProfileForm({ ...profileForm, semester: v })}
            placeholder="e.g. Semester 4"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Academic Year"
            value={prefsForm.academicYear}
            onChange={(v) => setPrefsForm({ ...prefsForm, academicYear: v })}
            placeholder="e.g. 2024-25"
          />
          <FormInput
            label="Enrollment No."
            value={prefsForm.enrollmentNo}
            onChange={(v) => setPrefsForm({ ...prefsForm, enrollmentNo: v })}
            placeholder="e.g. 2021CS0042"
          />
        </div>
        <FormInput
          label="Role"
          value={capitalize(userRole)}
          readOnly
          helper="Contact an administrator to change your role"
        />
      </div>

      {saveError && <p className="mt-4 text-sm text-red-400">{saveError}</p>}
      <SaveButton onClick={onSave} saving={saving} saved={saved} isDirty={isDirty} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function LearningSection({
  form,
  setForm,
  loaded,
  onSave,
  saving,
  saved,
  saveError,
  isDirty,
}: {
  form: LearningPrefsForm
  setForm: (f: LearningPrefsForm) => void
  loaded: boolean
  onSave: () => void
  saving: boolean
  saved: boolean
  saveError: string | null
  isDirty: boolean
}) {
  if (!loaded) {
    return (
      <div className="space-y-6 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine w="w-32" h="h-3" />
            <SkeletonLine w="w-full" h="h-28" />
          </div>
        ))}
      </div>
    )
  }

  const sessionOptions = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '60 min' },
  ]

  return (
    <div>
      <div className="max-w-2xl space-y-7">

        {/* AI Teaching Style */}
        <div>
          <SubSectionLabel label="AI Teaching Style" />
          <SettingsCard>
            <ControlRow
              label="Explanation Style"
              description="How detailed AI explanations should be."
            >
              <SegmentedControl
                options={[
                  { value: 'simple', label: 'Simple' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'detailed', label: 'Detailed' },
                ]}
                value={form.explanationStyle}
                onChange={(v) => setForm({ ...form, explanationStyle: v })}
              />
            </ControlRow>
          </SettingsCard>
        </div>

        {/* Test Preferences */}
        <div>
          <SubSectionLabel label="Test Preferences" />
          <SettingsCard>
            <ControlRow
              label="Default Difficulty"
              description="Starting difficulty for new tests."
            >
              <SegmentedControl
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
                value={form.preferredDifficulty}
                onChange={(v) => setForm({ ...form, preferredDifficulty: v })}
              />
            </ControlRow>
            <ControlRow
              label="Preferred Session Length"
              description="How long your study sessions typically run."
            >
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                {sessionOptions.map((opt, i) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, studyGoalMinutesPerDay: opt.value })
                    }
                    className={clsx(
                      'px-3 py-1.5 text-sm font-medium transition-colors',
                      i !== 0 && 'border-l border-border',
                      form.studyGoalMinutesPerDay === opt.value
                        ? 'bg-primary text-bg font-semibold'
                        : 'bg-surface text-muted hover:text-white',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </ControlRow>
          </SettingsCard>
        </div>

        {/* Study Behaviour */}
        <div>
          <SubSectionLabel label="Study Behaviour" />
          <SettingsCard>
            <ToggleRow
              label="Track my topic mastery"
              description="AcademIQ remembers which topics you've covered and how well."
              value={form.rememberProgress}
              onChange={(v) => setForm({ ...form, rememberProgress: v })}
            />
            <ToggleRow
              label="Adapt study plan from test results"
              description="Quiz scores update your personalised study recommendations."
              value={form.allowTestPerformance}
              onChange={(v) => setForm({ ...form, allowTestPerformance: v })}
            />
            <ToggleRow
              label="Use study history for recommendations"
              description="Past sessions influence which topics are suggested next."
              value={form.allowLearningHistory}
              onChange={(v) => setForm({ ...form, allowLearningHistory: v })}
            />
          </SettingsCard>
        </div>

      </div>

      {saveError && <p className="mt-4 text-sm text-red-400">{saveError}</p>}
      <SaveButton
        label="Save Preferences"
        onClick={onSave}
        saving={saving}
        saved={saved}
        isDirty={isDirty}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  const options: { value: Theme; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'dark',
      label: 'Dark',
      desc: 'Dark background, easy on the eyes.',
      icon: <Moon size={18} />,
    },
    {
      value: 'light',
      label: 'Light',
      desc: 'Light background for bright environments.',
      icon: <Sun size={18} />,
    },
    {
      value: 'system',
      label: 'System',
      desc: 'Follows your device preference.',
      icon: <Monitor size={18} />,
    },
  ]

  return (
    <div>
      <div className="max-w-xl space-y-7">
        <div>
          <SubSectionLabel label="Theme" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {options.map((opt) => {
              const isActive = theme === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={clsx(
                    'flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                    isActive
                      ? 'border-primary bg-primary/8'
                      : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  {/* Mini preview */}
                  <div
                    className={clsx(
                      'w-full h-10 rounded-md border overflow-hidden flex items-end gap-1 px-2 pb-1.5',
                      opt.value === 'dark'
                        ? 'bg-[#0D1220] border-[#1E2A44]'
                        : opt.value === 'light'
                        ? 'bg-[#F1F3F7] border-[#C4CEDA]'
                        : 'border-border',
                      opt.value === 'system' && 'bg-gradient-to-r from-[#0D1220] to-[#F1F3F7]',
                    )}
                  >
                    {[3, 5, 4].map((w, j) => (
                      <div
                        key={j}
                        className={clsx(
                          'rounded-sm',
                          opt.value === 'dark'
                            ? 'bg-[#1E2A44]'
                            : opt.value === 'light'
                            ? 'bg-[#C4CEDA]'
                            : j === 0
                            ? 'bg-[#1E2A44]'
                            : 'bg-[#C4CEDA]',
                        )}
                        style={{ width: `${w * 6}px`, height: '4px' }}
                      />
                    ))}
                  </div>

                  <div className="w-full">
                    <div className="flex items-center justify-between">
                      <span
                        className={clsx(
                          'text-sm font-semibold',
                          isActive ? 'text-primary' : 'text-white',
                        )}
                      >
                        {opt.label}
                      </span>
                      <div
                        className={clsx(
                          'h-3.5 w-3.5 rounded-full border-2 transition-colors',
                          isActive
                            ? 'border-primary bg-primary'
                            : 'border-border bg-transparent',
                        )}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-muted leading-snug">{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function NotificationsSection({
  form,
  setForm,
  loaded,
  onSave,
  saving,
  saved,
  saveError,
  isDirty,
}: {
  form: LearningPrefsForm
  setForm: (f: LearningPrefsForm) => void
  loaded: boolean
  onSave: () => void
  saving: boolean
  saved: boolean
  saveError: string | null
  isDirty: boolean
}) {
  if (!loaded) {
    return (
      <div className="space-y-6 max-w-xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine w="w-24" h="h-3" />
            <SkeletonLine w="w-full" h="h-24" />
          </div>
        ))}
      </div>
    )
  }

  const notif = form.notifications
  const setNotif = (partial: Partial<NotificationPrefs>) =>
    setForm({ ...form, notifications: { ...notif, ...partial } })

  return (
    <div>
      <div className="max-w-xl space-y-7">
        <div>
          <SubSectionLabel label="Study" />
          <SettingsCard>
            <ToggleRow
              label="Study plan reminders"
              description="Get reminded to follow your daily study plan."
              value={notif.studyReminders}
              onChange={(v) => setNotif({ studyReminders: v })}
            />
            <ToggleRow
              label="Revision reminders"
              description="Alerts when topics are due for revision."
              value={notif.revisionReminders}
              onChange={(v) => setNotif({ revisionReminders: v })}
            />
          </SettingsCard>
        </div>

        <div>
          <SubSectionLabel label="Tests" />
          <SettingsCard>
            <ToggleRow
              label="Upcoming test reminders"
              description="Reminders before scheduled tests."
              value={notif.testReminders}
              onChange={(v) => setNotif({ testReminders: v })}
            />
            <ToggleRow
              label="Test result notifications"
              description="Notified when test results are ready."
              value={notif.testResults}
              onChange={(v) => setNotif({ testResults: v })}
            />
          </SettingsCard>
        </div>

        <div>
          <SubSectionLabel label="System" />
          <SettingsCard>
            <ToggleRow
              label="Document processing completed"
              description="Get notified when your uploaded PDFs finish processing."
              value={notif.documentProcessed}
              onChange={(v) => setNotif({ documentProcessed: v })}
            />
            <ToggleRow
              label="Important account updates"
              description="Account changes, role updates and security notices."
              value={notif.accountUpdates}
              onChange={(v) => setNotif({ accountUpdates: v })}
            />
          </SettingsCard>
        </div>
      </div>

      {saveError && <p className="mt-4 text-sm text-red-400">{saveError}</p>}
      <SaveButton
        label="Save Notifications"
        onClick={onSave}
        saving={saving}
        saved={saved}
        isDirty={isDirty}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function PrivacyDataSection({
  form,
  setForm,
  loaded,
  onSave,
  saving,
  saved,
  saveError,
  isDirty,
  getToken,
}: {
  form: LearningPrefsForm
  setForm: (f: LearningPrefsForm) => void
  loaded: boolean
  onSave: () => void
  saving: boolean
  saved: boolean
  saveError: string | null
  isDirty: boolean
  getToken: () => Promise<string | null>
}) {
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearDone, setClearDone] = useState(false)

  const handleClearLearningData = useCallback(async () => {
    setClearing(true)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).memory.clear()
      setClearDone(true)
      setShowClearModal(false)
      setTimeout(() => setClearDone(false), 3000)
    } finally {
      setClearing(false)
    }
  }, [getToken])

  if (!loaded) {
    return (
      <div className="space-y-6 max-w-xl">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine w="w-28" h="h-3" />
            <SkeletonLine w="w-full" h="h-28" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-xl space-y-7">

        {/* AI Data Usage */}
        <div>
          <SubSectionLabel label="AI Data Usage" />
          <SettingsCard>
            <ToggleRow
              label="Use my uploaded documents when answering"
              description="The AI will reference your uploaded PDFs and books as context."
              value={form.allowBookContext}
              onChange={(v) => setForm({ ...form, allowBookContext: v })}
            />
            <ToggleRow
              label="Personalise AI responses from memory"
              description="The AI recalls topics you've studied and where you tend to struggle."
              value={form.allowPersonalizedMemory}
              onChange={(v) => setForm({ ...form, allowPersonalizedMemory: v })}
            />
          </SettingsCard>
        </div>

        {saveError && <p className="text-sm text-red-400">{saveError}</p>}
        <SaveButton
          label="Save Privacy Settings"
          onClick={onSave}
          saving={saving}
          saved={saved}
          isDirty={isDirty}
        />

        {/* Your Data */}
        <div>
          <SubSectionLabel label="Your Data" />
          <SettingsCard>
            <div className="px-4 py-4 border-b border-border bg-surface">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Export my data</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Download a copy of your profile, books and test history.
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted">
                  Coming soon
                </span>
              </div>
            </div>
            <div className="px-4 py-4 bg-surface">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Delete learning data</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Permanently erase your AI learning memory. Books and test history are not affected.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClearModal(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
              {clearDone && (
                <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <Check size={12} /> Learning memory cleared.
                </p>
              )}
            </div>
          </SettingsCard>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-surface px-4 py-3.5">
            <Shield size={13} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted leading-relaxed">
              Your uploaded books and learning data are stored securely and are never shared with third parties.
            </p>
          </div>
        </div>

      </div>

      <Modal
        open={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Delete Learning Memory?"
      >
        <p className="text-sm text-muted mb-6">
          This permanently erases your AI learning memory — topic tracking, weak areas, and study history. Your books, tests, and test history will not be affected.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowClearModal(false)}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-white hover:border-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleClearLearningData}
            disabled={clearing}
            className="flex-1 rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {clearing ? 'Deleting…' : 'Yes, Delete Memory'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SecuritySection({
  emailAddress,
  userRole,
}: {
  emailAddress: string
  userRole: string
}) {
  const { signOut } = useClerk()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div>
      <div className="max-w-xl space-y-5">

        {/* Account info */}
        <div>
          <SubSectionLabel label="Account" />
          <SettingsCard>
            <div className="px-4 py-3.5 border-b border-border bg-surface flex items-center justify-between">
              <p className="text-xs text-muted uppercase tracking-wide font-medium">Email</p>
              <p className="text-sm text-white">{emailAddress || '—'}</p>
            </div>
            <div className="px-4 py-3.5 border-b border-border bg-surface flex items-center justify-between">
              <p className="text-xs text-muted uppercase tracking-wide font-medium">Role</p>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                {userRole}
              </span>
            </div>
            <div className="px-4 py-3.5 bg-surface flex items-center justify-between">
              <p className="text-xs text-muted uppercase tracking-wide font-medium">Authentication</p>
              <StatusBadge label="Clerk (managed)" variant="blue" />
            </div>
          </SettingsCard>
        </div>

        {/* Session */}
        <div>
          <SubSectionLabel label="Session" />
          <SettingsCard>
            <div className="px-4 py-4 bg-surface">
              <p className="text-sm font-medium text-white mb-0.5">Sign out</p>
              <p className="text-xs text-muted mb-3">
                End your current session. You will need to sign in again to access AcademIQ.
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2 text-sm font-medium text-white hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <LogOut size={14} />
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </SettingsCard>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function TeachingSection({
  form,
  setForm,
  loaded,
  onSave,
  saving,
  saved,
  saveError,
  isDirty,
}: {
  form: LearningPrefsForm
  setForm: (f: LearningPrefsForm) => void
  loaded: boolean
  onSave: () => void
  saving: boolean
  saved: boolean
  saveError: string | null
  isDirty: boolean
}) {
  const tp = form.teachingPrefs
  const setTp = (partial: Partial<typeof tp>) =>
    setForm({ ...form, teachingPrefs: { ...tp, ...partial } })

  const durationOptions = ['30', '60', '90', '120', '180']
  const questionTypes = ['MCQ', 'Short Answer', 'Long Answer', 'Five Mark']

  function toggleQType(qt: string) {
    const current = tp.defaultQuestionTypes
    const next = current.includes(qt)
      ? current.filter((q) => q !== qt)
      : [...current, qt]
    setTp({ defaultQuestionTypes: next })
  }

  if (!loaded) {
    return (
      <div className="space-y-6 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine w="w-36" h="h-3" />
            <SkeletonLine w="w-full" h="h-10" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-xl space-y-7">

        <div>
          <SubSectionLabel label="Defaults" />
          <SettingsCard>
            <div className="px-4 py-4 border-b border-border bg-surface">
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Default Subject</p>
              <input
                type="text"
                value={tp.defaultSubject}
                onChange={(e) => setTp({ defaultSubject: e.target.value })}
                placeholder="e.g. Physics"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
            <ControlRow label="Default Difficulty">
              <SegmentedControl
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
                value={tp.defaultDifficulty}
                onChange={(v) => setTp({ defaultDifficulty: v })}
              />
            </ControlRow>
            <ControlRow label="Default Duration">
              <select
                value={tp.defaultDuration}
                onChange={(e) => setTp({ defaultDuration: e.target.value })}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white outline-none focus:border-primary"
              >
                {durationOptions.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </ControlRow>
            <div className="px-4 py-4 border-b border-border bg-surface">
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Question Types</p>
              <div className="flex flex-wrap gap-2">
                {questionTypes.map((qt) => (
                  <button
                    key={qt}
                    type="button"
                    onClick={() => toggleQType(qt)}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                      tp.defaultQuestionTypes.includes(qt)
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-bg text-muted hover:text-white',
                    )}
                  >
                    {qt}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4 bg-surface">
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Default Total Marks</p>
              <input
                type="number"
                value={tp.defaultTotalMarks}
                onChange={(e) => setTp({ defaultTotalMarks: parseInt(e.target.value) || 0 })}
                min={0}
                className="w-28 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </div>
          </SettingsCard>
        </div>

      </div>

      {saveError && <p className="mt-4 text-sm text-red-400">{saveError}</p>}
      <SaveButton
        label="Save Preferences"
        onClick={onSave}
        saving={saving}
        saved={saved}
        isDirty={isDirty}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SystemConfigSection() {
  const rows = [
    { label: 'File Upload Limit', value: '200 MB maximum PDF size', badge: null },
    { label: 'OCR', value: 'Enabled', badge: 'green' as const },
    { label: 'Background Processing', value: 'Active', badge: 'green' as const },
    { label: 'Storage', value: 'Configured', badge: 'green' as const },
    { label: 'AI Provider', value: 'Operational', badge: 'green' as const },
  ]

  return (
    <div>
      <div className="max-w-xl">
        <SettingsCard>
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={clsx(
                'flex items-center justify-between px-4 py-3.5',
                i !== 0 && 'border-t border-border',
                i % 2 === 0 ? 'bg-surface' : 'bg-bg',
              )}
            >
              <span className="text-sm text-muted">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">{row.value}</span>
                {row.badge && <StatusBadge label={row.value} variant={row.badge} />}
              </div>
            </div>
          ))}
        </SettingsCard>
      </div>
    </div>
  )
}

function DocumentProcessingSection() {
  const rows = [
    { label: 'Processing Queue', value: 'Active' },
    { label: 'Supported Formats', value: 'PDF, JPEG, PNG, WebP, BMP, TIFF' },
    { label: 'Max File Size', value: '200 MB' },
    { label: 'OCR', value: 'Enabled for images and scanned PDFs' },
  ]

  return (
    <div>
      <div className="max-w-xl">
        <SettingsCard>
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={clsx(
                'flex items-start justify-between gap-6 px-4 py-3.5',
                i !== 0 && 'border-t border-border',
                i % 2 === 0 ? 'bg-surface' : 'bg-bg',
              )}
            >
              <span className="text-sm text-muted flex-shrink-0 w-40">{row.label}</span>
              <span className="text-sm text-white text-right">{row.value}</span>
            </div>
          ))}
        </SettingsCard>
      </div>
    </div>
  )
}

function SecurityLogsSection() {
  const rows = [
    { label: 'Authentication', value: 'Clerk (managed)' },
    { label: 'Audit Logging', value: 'Enabled' },
    { label: 'Data Encryption', value: 'At rest and in transit' },
    { label: 'Admin Note', value: 'Full audit logs available in server admin panel.' },
  ]

  return (
    <div>
      <div className="max-w-xl">
        <SettingsCard>
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={clsx(
                'flex items-start justify-between gap-6 px-4 py-3.5',
                i !== 0 && 'border-t border-border',
                i % 2 === 0 ? 'bg-surface' : 'bg-bg',
              )}
            >
              <span className="text-sm text-muted flex-shrink-0 w-40">{row.label}</span>
              <span className="text-sm text-white text-right">{row.value}</span>
            </div>
          ))}
        </SettingsCard>
      </div>
    </div>
  )
}

// ── Nav sidebar ────────────────────────────────────────────────────────────────

type NavItem = { id: ActiveSection; label: string; icon: React.ReactNode }
type NavGroup = { groupLabel: string; items: NavItem[]; show?: boolean }

function NavSidebar({
  active,
  setActive,
  role,
}: {
  active: ActiveSection
  setActive: (s: ActiveSection) => void
  role: string | undefined
}) {
  const groups: NavGroup[] = [
    {
      groupLabel: 'Account',
      items: [
        { id: 'profile', label: 'Profile', icon: <User size={14} /> },
        { id: 'security', label: 'Security', icon: <Lock size={14} /> },
      ],
    },
    {
      groupLabel: 'Learning',
      items: [
        {
          id: 'learning',
          label: 'Learning Preferences',
          icon: <SlidersHorizontal size={14} />,
        },
      ],
    },
    {
      groupLabel: 'Experience',
      items: [
        { id: 'appearance', label: 'Appearance', icon: <Sun size={14} /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
      ],
    },
    {
      groupLabel: 'Data',
      items: [
        { id: 'privacy', label: 'Privacy & Data', icon: <Database size={14} /> },
      ],
    },
    {
      groupLabel: 'Teaching',
      show: canTeach(role as 'student' | 'teacher' | 'admin' | undefined),
      items: [
        {
          id: 'teaching',
          label: 'Teaching Preferences',
          icon: <GraduationCap size={14} />,
        },
      ],
    },
    {
      groupLabel: 'Admin',
      show: isAdmin(role as 'student' | 'teacher' | 'admin' | undefined),
      items: [
        { id: 'system', label: 'System Config', icon: <Server size={14} /> },
        { id: 'documents', label: 'Document Processing', icon: <FileText size={14} /> },
        { id: 'security-logs', label: 'Security & Logs', icon: <ShieldAlert size={14} /> },
      ],
    },
  ]

  return (
    <nav className="w-48 flex-shrink-0">
      {groups.map((group) => {
        if (group.show === false) return null
        return (
          <div key={group.groupLabel} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted opacity-60">
              {group.groupLabel}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = active === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActive(item.id)}
                      className={clsx(
                        'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                        isActive
                          ? 'border-l-2 border-primary text-primary bg-primary/8 pl-[10px]'
                          : 'border-l-2 border-transparent text-muted hover:text-white hover:bg-white/5',
                      )}
                    >
                      <span className={clsx('flex-shrink-0', isActive ? 'text-primary' : 'text-muted')}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Settings() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const { invalidate } = useCurrentUser()

  const [activeSection, setActiveSection] = useState<ActiveSection>('profile')
  const [loaded, setLoaded] = useState(false)

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: '',
    institution: '',
    course: '',
    semester: '',
  })
  const [origProfileForm, setOrigProfileForm] = useState<ProfileForm>({
    name: '',
    institution: '',
    course: '',
    semester: '',
  })

  const [prefsForm, setPrefsForm] = useState<LearningPrefsForm>(defaultLearningPrefs())
  const [origPrefsForm, setOrigPrefsForm] = useState<LearningPrefsForm>(defaultLearningPrefs())

  const [userRole, setUserRole] = useState<string>('student')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const profileDirty =
    JSON.stringify(profileForm) !== JSON.stringify(origProfileForm) ||
    prefsForm.academicYear !== origPrefsForm.academicYear ||
    prefsForm.enrollmentNo !== origPrefsForm.enrollmentNo

  const prefsDirty = JSON.stringify(prefsForm) !== JSON.stringify(origPrefsForm)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      try {
        const { user } = await makeApi(token).settings.get()
        const pf: ProfileForm = {
          name: user.name ?? '',
          institution: user.institution ?? '',
          course: user.course ?? '',
          semester: user.semester ?? '',
        }
        setProfileForm(pf)
        setOrigProfileForm(pf)
        setUserRole(user.role ?? 'student')

        const lp = prefsFromRecord(
          (user.learning_prefs as Record<string, unknown>) ?? {},
        )
        setPrefsForm(lp)
        setOrigPrefsForm(lp)
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [getToken])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const token = await getToken()
      if (!token) return

      await makeApi(token).settings.update({
        name: profileForm.name || undefined,
        institution: profileForm.institution || undefined,
        course: profileForm.course || undefined,
        semester: profileForm.semester || undefined,
        learning_prefs: {
          explanationStyle: prefsForm.explanationStyle,
          preferredDifficulty: prefsForm.preferredDifficulty,
          studyGoalMinutesPerDay: prefsForm.studyGoalMinutesPerDay,
          rememberProgress: prefsForm.rememberProgress,
          allowBookContext: prefsForm.allowBookContext,
          allowLearningHistory: prefsForm.allowLearningHistory,
          allowTestPerformance: prefsForm.allowTestPerformance,
          allowPersonalizedMemory: prefsForm.allowPersonalizedMemory,
          academicYear: prefsForm.academicYear,
          enrollmentNo: prefsForm.enrollmentNo,
          notifications: prefsForm.notifications,
          teachingPrefs: prefsForm.teachingPrefs,
        } as Parameters<ReturnType<typeof makeApi>['settings']['update']>[0]['learning_prefs'],
      })

      setOrigProfileForm({ ...profileForm })
      setOrigPrefsForm({ ...prefsForm })
      invalidate()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const emailAddress = clerkUser?.primaryEmailAddress?.emailAddress ?? ''
  const imageUrl = clerkUser?.imageUrl

  function switchSection(s: ActiveSection) {
    setActiveSection(s)
    setSaved(false)
    setSaveError(null)
  }

  // Mobile: null = show menu list, otherwise show that section
  const [mobileOpen, setMobileOpen] = useState<ActiveSection | null>(null)

  function mobileSwitchSection(s: ActiveSection) {
    setMobileOpen(s)
    switchSection(s)
  }

  const sectionTitle: Record<ActiveSection, string> = {
    profile: 'Profile', learning: 'Learning Preferences', appearance: 'Appearance',
    notifications: 'Notifications', privacy: 'Privacy & Data', security: 'Security',
    teaching: 'Teaching Preferences', system: 'System Configuration',
    documents: 'Document Processing', 'security-logs': 'Security & Logs',
  }

  const mobileMenuGroups = [
    {
      label: 'Account',
      items: [
        { id: 'profile' as ActiveSection, label: 'Profile', icon: <User size={16} /> },
        { id: 'security' as ActiveSection, label: 'Security', icon: <Lock size={16} /> },
      ],
    },
    {
      label: 'Learning',
      items: [
        { id: 'learning' as ActiveSection, label: 'Learning Preferences', icon: <SlidersHorizontal size={16} /> },
      ],
    },
    {
      label: 'Experience',
      items: [
        { id: 'appearance' as ActiveSection, label: 'Appearance', icon: <Sun size={16} /> },
        { id: 'notifications' as ActiveSection, label: 'Notifications', icon: <Bell size={16} /> },
      ],
    },
    {
      label: 'Data',
      items: [
        { id: 'privacy' as ActiveSection, label: 'Privacy & Data', icon: <Database size={16} /> },
      ],
    },
    ...(canTeach(userRole as 'student' | 'teacher' | 'admin') ? [{
      label: 'Teaching',
      items: [{ id: 'teaching' as ActiveSection, label: 'Teaching Preferences', icon: <GraduationCap size={16} /> }],
    }] : []),
    ...(isAdmin(userRole as 'student' | 'teacher' | 'admin') ? [{
      label: 'Admin',
      items: [
        { id: 'system' as ActiveSection, label: 'System Configuration', icon: <Server size={16} /> },
        { id: 'documents' as ActiveSection, label: 'Document Processing', icon: <FileText size={16} /> },
        { id: 'security-logs' as ActiveSection, label: 'Security & Logs', icon: <ShieldAlert size={16} /> },
      ],
    }] : []),
  ]

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Settings nav sidebar — desktop only */}
      <div className="hidden md:flex flex-col border-r border-border bg-surface/40 px-3 py-6 overflow-y-auto min-w-[200px]">
        <div className="mb-6 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted opacity-60 mb-1">
            Settings
          </p>
          <h1 className="text-base font-bold text-white">Account</h1>
        </div>
        <NavSidebar active={activeSection} setActive={switchSection} role={userRole} />
      </div>

      {/* Mobile: section list menu */}
      {mobileOpen === null && (
        <div className="md:hidden flex-1 overflow-y-auto px-4 py-5">
          <h1 className="text-xl font-bold text-white mb-5">Settings</h1>
          <div className="space-y-5">
            {mobileMenuGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2 px-1">
                  {group.label}
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  {group.items.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => mobileSwitchSection(item.id)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3.5 text-left bg-surface hover:bg-white/5 transition-colors',
                        i !== 0 && 'border-t border-border',
                      )}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                        {item.icon}
                      </span>
                      <span className="flex-1 text-sm font-medium text-white">{item.label}</span>
                      <ChevronRight size={15} className="text-muted flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content — desktop always, mobile only when a section is open */}
      <div className={clsx('flex-1 overflow-y-auto px-5 py-7 md:px-10 md:py-8', mobileOpen === null && 'hidden md:block')}>
        {/* Mobile back button */}
        {mobileOpen !== null && (
          <button
            type="button"
            onClick={() => setMobileOpen(null)}
            className="md:hidden flex items-center gap-1.5 text-sm text-primary mb-5 -ml-1"
          >
            <ChevronRight size={14} className="rotate-180" />
            Settings
          </button>
        )}

        {/* Breadcrumb — desktop only */}
        <p className="hidden md:block mb-1 text-xs text-muted uppercase tracking-widest font-medium">
          Settings
        </p>
        <h1 className="text-2xl font-bold text-white mb-1">
          {sectionTitle[activeSection]}
        </h1>
        <p className="text-sm text-muted mb-8">
          {activeSection === 'profile' && 'Your personal and academic information.'}
          {activeSection === 'learning' && 'Tell AcademIQ how you learn best.'}
          {activeSection === 'appearance' && 'Choose how AcademIQ looks.'}
          {activeSection === 'notifications' && 'Control when AcademIQ notifies you.'}
          {activeSection === 'privacy' && 'Control how AcademIQ uses your data.'}
          {activeSection === 'security' && 'Your account authentication and session.'}
          {activeSection === 'teaching' && 'Set defaults for question paper generation.'}
          {activeSection === 'system' && 'Read-only overview of system settings.'}
          {activeSection === 'documents' && 'Status of the document ingestion pipeline.'}
          {activeSection === 'security-logs' && 'Security posture and audit trail status.'}
        </p>

        {/* Sections */}
        {activeSection === 'profile' && (
          <ProfileSection
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            prefsForm={prefsForm}
            setPrefsForm={setPrefsForm}
            userRole={userRole}
            emailAddress={emailAddress}
            imageUrl={imageUrl}
            loaded={loaded}
            onSave={handleSave}
            saving={saving}
            saved={saved}
            saveError={saveError}
            isDirty={profileDirty}
          />
        )}

        {activeSection === 'learning' && (
          <LearningSection
            form={prefsForm}
            setForm={setPrefsForm}
            loaded={loaded}
            onSave={handleSave}
            saving={saving}
            saved={saved}
            saveError={saveError}
            isDirty={prefsDirty}
          />
        )}

        {activeSection === 'appearance' && <AppearanceSection />}

        {activeSection === 'notifications' && (
          <NotificationsSection
            form={prefsForm}
            setForm={setPrefsForm}
            loaded={loaded}
            onSave={handleSave}
            saving={saving}
            saved={saved}
            saveError={saveError}
            isDirty={prefsDirty}
          />
        )}

        {activeSection === 'privacy' && (
          <PrivacyDataSection
            form={prefsForm}
            setForm={setPrefsForm}
            loaded={loaded}
            onSave={handleSave}
            saving={saving}
            saved={saved}
            saveError={saveError}
            isDirty={prefsDirty}
            getToken={getToken}
          />
        )}

        {activeSection === 'security' && (
          <SecuritySection emailAddress={emailAddress} userRole={userRole} />
        )}

        {activeSection === 'teaching' &&
          canTeach(userRole as 'student' | 'teacher' | 'admin') && (
            <TeachingSection
              form={prefsForm}
              setForm={setPrefsForm}
              loaded={loaded}
              onSave={handleSave}
              saving={saving}
              saved={saved}
              saveError={saveError}
              isDirty={prefsDirty}
            />
          )}

        {activeSection === 'system' &&
          isAdmin(userRole as 'student' | 'teacher' | 'admin') && (
            <SystemConfigSection />
          )}

        {activeSection === 'documents' &&
          isAdmin(userRole as 'student' | 'teacher' | 'admin') && (
            <DocumentProcessingSection />
          )}

        {activeSection === 'security-logs' &&
          isAdmin(userRole as 'student' | 'teacher' | 'admin') && (
            <SecurityLogsSection />
          )}
      </div>
    </div>
  )
}
