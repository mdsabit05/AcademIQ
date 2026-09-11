/**
 * Hook to fetch the current user's profile (role, prefs) from our backend.
 * Cached in sessionStorage to avoid repeated calls on every navigation.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { makeApi } from './api.ts'
import type { User } from 'shared'

const CACHE_KEY = 'aq_current_user'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface Cached {
  user: User
  fetchedAt: number
}

let inFlightPromise: Promise<User | null> | null = null

export function useCurrentUser() {
  const { getToken, isSignedIn } = useAuth()
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (!raw) return null
      const cached = JSON.parse(raw) as Cached
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null
      return cached.user
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(!user)

  useEffect(() => {
    if (!isSignedIn) return
    if (user) { setLoading(false); return }

    if (!inFlightPromise) {
      inFlightPromise = (async () => {
        try {
          const token = await getToken()
          if (!token) return null
          const { user: fetched } = await makeApi(token).settings.get()
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ user: fetched, fetchedAt: Date.now() }))
          return fetched
        } catch {
          return null
        } finally {
          inFlightPromise = null
        }
      })()
    }

    inFlightPromise.then((u) => {
      if (u) setUser(u)
      setLoading(false)
    })
  }, [isSignedIn, getToken, user])

  function invalidate() {
    sessionStorage.removeItem(CACHE_KEY)
    setUser(null)
    setLoading(true)
  }

  return { user, loading, invalidate }
}
