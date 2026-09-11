import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react'
import AppLayout from './components/layout/AppLayout.tsx'
import Landing from './pages/Landing.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Books from './pages/Books.tsx'
import LearnSession from './pages/LearnSession.tsx'
import AskAI from './pages/AskAI.tsx'
import TestNew from './pages/TestNew.tsx'
import TestTake from './pages/TestTake.tsx'
import TestResults from './pages/TestResults.tsx'
import Progress from './pages/Progress.tsx'
import Settings from './pages/Settings.tsx'
import Subjects from './pages/Subjects.tsx'
import Papers from './pages/Papers.tsx'
import AdminDashboard from './pages/AdminDashboard.tsx'
import MemoryView from './pages/MemoryView.tsx'

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

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route
        path="/sign-in/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-bg">
            <SignIn routing="path" path={`${import.meta.env.BASE_URL}sign-in`} />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-bg">
            <SignUp routing="path" path={`${import.meta.env.BASE_URL}sign-up`} />
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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/books" element={<Books />} />
        <Route path="/learn/:sessionId" element={<LearnSession />} />
        <Route path="/ask/:sessionId?" element={<AskAI />} />
        <Route path="/test/new" element={<TestNew />} />
        <Route path="/test/:testId" element={<TestTake />} />
        <Route path="/test/:testId/results/:attemptId" element={<TestResults />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/memory" element={<MemoryView />} />
        <Route path="/settings" element={<Settings />} />
        {/* Teacher routes */}
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/papers" element={<Papers />} />
        {/* Admin routes */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
    </Routes>
  )
}
