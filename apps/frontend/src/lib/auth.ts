import { useCallback } from 'react'
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
  return token
}

export function exitGuestMode(): void {
  localStorage.removeItem(GUEST_TOKEN_KEY)
  sessionStorage.removeItem('aq_current_user')
}

export function useAuth(): ReturnType<typeof useClerkAuth> & {
  isGuest: boolean
  guestToken: string | null
} {
  const clerkAuth = useClerkAuth()
  let guestToken = getGuestToken()

  if (clerkAuth.isSignedIn && guestToken) {
    exitGuestMode()
    guestToken = null
  } else if (!clerkAuth.isSignedIn && !guestToken) {
    guestToken = enterGuestMode()
  }

  const isGuest = Boolean(!clerkAuth.isSignedIn && guestToken)

  const getToken = useCallback(async () => {
    if (clerkAuth.isSignedIn) {
      return clerkAuth.getToken()
    }
    return guestToken ?? enterGuestMode()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkAuth.isSignedIn, clerkAuth.getToken, guestToken])

  const signOut = useCallback(async (cb?: () => void) => {
    if (isGuest) {
      exitGuestMode()
      if (cb) cb()
      return
    }
    return (clerkAuth.signOut as any)(cb)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, clerkAuth.signOut])

  return {
    ...clerkAuth,
    isLoaded: clerkAuth.isLoaded,
    isSignedIn: clerkAuth.isSignedIn || isGuest,
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
  let guestToken = getGuestToken()
  if (!clerkUser.isSignedIn && !guestToken) {
    guestToken = enterGuestMode()
  }
  const isGuest = Boolean(!clerkUser.isSignedIn && guestToken)

  if (isGuest) {
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
  const guestToken = getGuestToken()
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
