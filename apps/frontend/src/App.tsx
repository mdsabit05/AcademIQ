import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { useAuth } from './lib/auth.ts'
import AppLayout from './components/layout/AppLayout.tsx'
import { useCurrentUser } from './lib/useCurrentUser.ts'
import { canTeach, isAdmin } from './lib/rbac.ts'
import { useMode } from './lib/modeContext.tsx'

// ── Lazy-loaded pages (code-split per route) ─────────────────────────────────
const Landing         = lazy(() => import('./pages/Landing.tsx'))
const Dashboard       = lazy(() => import('./pages/Dashboard.tsx'))
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard.tsx'))
const TeacherMaterials = lazy(() => import('./pages/TeacherMaterials.tsx'))
const Books           = lazy(() => import('./pages/Books.tsx'))
const LearnSession    = lazy(() => import('./pages/LearnSession.tsx'))
const AskAI           = lazy(() => import('./pages/AskAI.tsx'))
const AITutor         = lazy(() => import('./pages/AITutor.tsx'))
const Tests           = lazy(() => import('./pages/Tests.tsx'))
const TestNew         = lazy(() => import('./pages/TestNew.tsx'))
const TestTake        = lazy(() => import('./pages/TestTake.tsx'))
const TestResults     = lazy(() => import('./pages/TestResults.tsx'))
const Progress        = lazy(() => import('./pages/Progress.tsx'))
const StudyPlan       = lazy(() => import('./pages/StudyPlan.tsx'))
const GeneralAI       = lazy(() => import('./pages/GeneralAI.tsx'))
const Settings        = lazy(() => import('./pages/Settings.tsx'))
const SyllabusPage    = lazy(() => import('./pages/Syllabus.tsx'))
const Papers          = lazy(() => import('./pages/Papers.tsx'))
const AdminDashboard  = lazy(() => import('./pages/AdminDashboard.tsx'))

// ── Shared spinner — shown while a lazy chunk loads ──────────────────────────
function PageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <PageSpinner />
  if (!isSignedIn) return <Navigate to="/" replace />
  return <>{children}</>
}

function LandingOrDashboard() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <PageSpinner />
  if (isSignedIn) return <Navigate to="/dashboard" replace />
  return <Landing />
}

/** Renders student or teacher dashboard based on current mode */
function DashboardRoute() {
  const { mode } = useMode()
  if (mode === 'teacher') return <TeacherDashboard />
  return <Dashboard />
}

/** Route guard — redirects to /dashboard if user lacks required role.
 *  Teacher mode override: if the app is in teacher mode, teacher routes are accessible. */
function RoleRoute({
  children,
  require,
}: {
  children: React.ReactNode
  require: 'teacher' | 'admin'
}) {
  const { user, loading } = useCurrentUser()
  const { mode } = useMode()
  const role = user?.role

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (require === 'teacher' && !canTeach(role) && mode !== 'teacher') {
    return <Navigate to="/dashboard" replace />
  }
  if (require === 'admin' && !isAdmin(role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
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
          <Route path="/dashboard" element={<DashboardRoute />} />
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

          {/* Settings */}
          <Route path="/settings" element={<Settings />} />

          {/* Syllabus workspace */}
          <Route path="/syllabus" element={<SyllabusPage />} />

          {/* Teacher: Materials */}
          <Route
            path="/teacher/materials"
            element={
              <RoleRoute require="teacher">
                <TeacherMaterials />
              </RoleRoute>
            }
          />

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
          <Route path="/ask" element={<Navigate to="/tutor" replace />} />
          <Route path="/ask/:sessionId" element={<AskAI />} />
          <Route path="/subjects" element={<Navigate to="/syllabus" replace />} />
          <Route path="/papers" element={<Navigate to="/question-papers" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
