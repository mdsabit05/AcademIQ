import { useState, useEffect, useCallback } from 'react'
import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
  useClerk as useClerkOrig,
} from '@clerk/clerk-react'

export const GUEST_TOKEN_KEY = 'aq_guest_token'

export function getGuestToken(): string | null {
  return localStorage.getItem(GUEST_TOKEN_KEY)
}

export function isGuestMode(): boolean {
  return Boolean(localStorage.getItem(GUEST_TOKEN_KEY))
}

export function enterGuestMode(): string {
  let token = localStorage.getItem(GUEST_TOKEN_KEY)
  if (!token) {
    token = 'guest_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
    localStorage.setItem(GUEST_TOKEN_KEY, token)
  }
  window.dispatchEvent(new Event('aq_auth_change'))
  return token
}

export function exitGuestMode(): void {
  localStorage.removeItem(GUEST_TOKEN_KEY)
  sessionStorage.removeItem('aq_current_user')
  window.dispatchEvent(new Event('aq_auth_change'))
}

export function useAuth(): ReturnType<typeof useClerkAuth> & {
  isGuest: boolean
  guestToken: string | null
} {
  const clerkAuth = useClerkAuth()
  const [guestToken, setGuestToken] = useState<string | null>(() => getGuestToken())

  useEffect(() => {
    const handleAuthChange = () => setGuestToken(getGuestToken())
    window.addEventListener('aq_auth_change', handleAuthChange)
    window.addEventListener('storage', handleAuthChange)
    return () => {
      window.removeEventListener('aq_auth_change', handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [])

  // If user signed in with real Clerk account, clear guest session
  useEffect(() => {
    if (clerkAuth.isSignedIn && guestToken) {
      exitGuestMode()
    }
  }, [clerkAuth.isSignedIn, guestToken])

  const isGuest = Boolean(!clerkAuth.isSignedIn && guestToken)
  const clerkGetToken = clerkAuth.getToken
  const clerkSignOut = clerkAuth.signOut
  const isSignedIn = Boolean(clerkAuth.isSignedIn || isGuest)

  const getToken = useCallback(async () => {
    if (clerkAuth.isSignedIn) {
      return clerkGetToken()
    }
    return getGuestToken()
  }, [clerkAuth.isSignedIn, clerkGetToken])

  const signOut = useCallback(async (cb?: () => void) => {
    if (isGuest) {
      exitGuestMode()
      if (cb) cb()
      return
    }
    return (clerkSignOut as any)(cb)
  }, [isGuest, clerkSignOut])

  return {
    ...clerkAuth,
    isLoaded: clerkAuth.isLoaded,
    isSignedIn,
    isGuest,
    guestToken,
    userId: clerkAuth.userId || guestToken,
    getToken,
    signOut,
  } as unknown as ReturnType<typeof useClerkAuth> & {
    isGuest: boolean
    guestToken: string | null
  }
}

export function useUser(): ReturnType<typeof useClerkUser> {
  const clerkUser = useClerkUser()
  const [guestToken, setGuestToken] = useState<string | null>(() => getGuestToken())

  useEffect(() => {
    const handleAuthChange = () => setGuestToken(getGuestToken())
    window.addEventListener('aq_auth_change', handleAuthChange)
    window.addEventListener('storage', handleAuthChange)
    return () => {
      window.removeEventListener('aq_auth_change', handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [])

  const isGuest = Boolean(!clerkUser.isSignedIn && guestToken)

  if (isGuest && guestToken) {
    return {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: guestToken,
        firstName: 'Guest',
        lastName: 'Student',
        fullName: 'Guest Student',
        imageUrl: undefined,
        primaryEmailAddress: { emailAddress: `${guestToken}@guest.academiq.local` },
      } as unknown as ReturnType<typeof useClerkUser>['user'],
    } as unknown as ReturnType<typeof useClerkUser>
  }

  return clerkUser
}

export function useClerk(): ReturnType<typeof useClerkOrig> {
  const clerk = useClerkOrig()
  const [guestToken, setGuestToken] = useState<string | null>(() => getGuestToken())

  useEffect(() => {
    const handleAuthChange = () => setGuestToken(getGuestToken())
    window.addEventListener('aq_auth_change', handleAuthChange)
    window.addEventListener('storage', handleAuthChange)
    return () => {
      window.removeEventListener('aq_auth_change', handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [])

  const isGuest = Boolean(!clerk.user && guestToken)

  return {
    ...clerk,
    signOut: async (cb?: () => void) => {
      if (isGuest) {
        exitGuestMode()
        if (cb) cb()
        return
      }
      return (clerk.signOut as any)(cb)
    },
  } as unknown as ReturnType<typeof useClerkOrig>
}
