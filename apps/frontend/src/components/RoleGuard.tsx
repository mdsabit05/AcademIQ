/**
 * RoleGuard — renders children only if the current user has one of the required roles.
 * Falls back to null (hidden) or a custom fallback element.
 */

import type { Role } from 'shared'

interface Props {
  role: Role | undefined
  allowed: Role[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

export default function RoleGuard({ role, allowed, fallback = null, children }: Props) {
  if (!role || !allowed.includes(role)) return <>{fallback}</>
  return <>{children}</>
}
