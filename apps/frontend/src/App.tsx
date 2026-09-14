import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react'
import AppLayout from './components/layout/AppLayout.tsx'
import Landing from './pages/Landing.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Books from './pages/Books.tsx'
import LearnSession from './pages/LearnSession.tsx'
import AskAI from './pages/AskAI.tsx'
import AITutor from './pages/AITutor.tsx'
import Tests from './pages/Tests.tsx'
import TestNew from './pages/TestNew.tsx'
import TestTake from './pages/TestTake.tsx'
import TestResults from './pages/TestResults.tsx'
import Progress from './pages/Progress.tsx'
import StudyPlan from './pages/StudyPlan.tsx'
import GeneralAI from './pages/GeneralAI.tsx'
import Settings from './pages/Settings.tsx'
import Subjects from './pages/Subjects.tsx'
import Papers from './pages/Papers.tsx'
import AdminDashboard from './pages/AdminDashboard.tsx'
import MemoryView from './pages/MemoryView.tsx'
import { useCurrentUser } from './lib/useCurrentUser.ts'
import { canTeach, isAdmin } from './lib/rbac.ts'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  if (!isSignedIn) return <Navigate to="/" replace />
  return <>{children}</>
}

function LandingOrDashboard() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  if (isSignedIn) return <Navigate to="/dashboard" replace />
  return <Landing />
}

/** Route guard — redirects to /dashboard if user lacks required role */
function RoleRoute({
  children,
  require,
}: {
  children: React.ReactNode
  require: 'teacher' | 'admin'
}) {
  const { user, loading } = useCurrentUser()
  const role = user?.role

  // Show spinner while the user profile is loading
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (require === 'teacher' && !canTeach(role)) {
    return <Navigate to="/dashboard" replace />
  }
  if (require === 'admin' && !isAdmin(role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingOrDashboard />} />
      <Route
        path="/sign-in/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-bg">
            <SignIn />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-bg">
            <SignUp />
          </div>
        }
      />

      {/* Protected — wrapped in AppLayout (sidebar + main) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* ── Core routes ─────────────────────────────────────────── */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/books" element={<Books />} />
        <Route path="/learn/:sessionId" element={<LearnSession />} />

        {/* AI Tutor (RAG-based, grounded in books) */}
        <Route path="/tutor" element={<AITutor />} />
        <Route path="/tutor/:sessionId?" element={<AITutor />} />

        {/* General AI (not book-grounded) */}
        <Route path="/general-ai" element={<GeneralAI />} />

        {/* Tests */}
        <Route path="/tests" element={<Tests />} />
        <Route path="/test/new" element={<TestNew />} />
        <Route path="/test/:testId" element={<TestTake />} />
        <Route path="/test/:testId/results/:attemptId" element={<TestResults />} />

        {/* Progress & Study Plan */}
        <Route path="/progress" element={<Progress />} />
        <Route path="/study-plan" element={<StudyPlan />} />

        {/* Memory */}
        <Route path="/memory" element={<MemoryView />} />

        {/* Settings */}
        <Route path="/settings" element={<Settings />} />

        {/* Syllabus (was /subjects) */}
        <Route path="/syllabus" element={<Subjects />} />

        {/* Teacher: Question Papers */}
        <Route
          path="/question-papers"
          element={
            <RoleRoute require="teacher">
              <Papers />
            </RoleRoute>
          }
        />

        {/* Admin: User Management */}
        <Route
          path="/admin/users"
          element={
            <RoleRoute require="admin">
              <AdminDashboard />
            </RoleRoute>
          }
        />

        {/* ── Backward-compatibility redirects ─────────────────────── */}
        {/* Old /ask → /tutor */}
        <Route path="/ask" element={<Navigate to="/tutor" replace />} />
        <Route path="/ask/:sessionId" element={<AskAI />} />

        {/* Old /subjects → /syllabus */}
        <Route path="/subjects" element={<Navigate to="/syllabus" replace />} />

        {/* Old /papers → /question-papers */}
        <Route path="/papers" element={<Navigate to="/question-papers" replace />} />

        {/* Old /admin → /admin/users */}
        <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
      </Route>
    </Routes>
  )
}
