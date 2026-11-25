import { useMemo } from 'react'
import { useOptionalAuth } from '../auth/auth-context.js'
import { useStore } from '../store/useStore.js'
import { weeklyExerciseCatalog } from './exercises.js'
import { weeklyHistoryAvailability } from './weekly-history-availability.js'
import { ANONYMOUS_SCOPE } from './local-state-scope.js'

export function useWeeklyHistory(online) {
  const auth = useOptionalAuth()
  const state = useStore(s => s.S), ready = useStore(s => s.ready)
  const history = useStore(s => s.accountHistory)
  const scope = useStore(s => s.getActiveLocalScope?.()) || ANONYMOUS_SCOPE
  const accountId = auth ? (auth.status === 'authenticated' ? auth.user?.id : null) : scope.userId
  const availability = weeklyHistoryAvailability({ ready, scope, accountId, authLoading: auth?.status === 'initializing', online, workouts: state.workouts, history })
  const visible = availability.scopeMatches && ready
  // EXIDX has a global compatibility overlay. Never copy its private custom
  // entries: only this account's S.customEx may extend the public catalogue.
  const custom = visible ? state.customEx : null
  const exerciseCatalog = useMemo(() => weeklyExerciseCatalog(custom), [custom])
  return { availability, workouts: visible ? state.workouts : [], exerciseCatalog, scopeKey: accountId || 'visitor' }
}
