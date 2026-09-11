/**
 * Frontend RBAC helpers — role-based UI visibility.
 * Server-side enforcement is the source of truth.
 * These are UI conveniences only.
 */

import type { Role } from 'shared'

export function canTeach(role: Role | undefined): boolean {
  return role === 'teacher' || role === 'admin'
}

export function isAdmin(role: Role | undefined): boolean {
  return role === 'admin'
}

export function canManageSubjects(role: Role | undefined): boolean {
  return role === 'teacher' || role === 'admin'
}
