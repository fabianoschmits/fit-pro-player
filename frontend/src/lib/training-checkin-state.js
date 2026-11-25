import { useOptionalAuth } from '../auth/auth-context.js'
import { useStore } from '../store/useStore.js'
import { withTrainingCheckin } from './training-checkin.js'
import { normalizeTrainingCheckin } from './training-checkin-data.js'
const EMPTY = Object.freeze({})
export const checkinScopeKey = store => {
 const scope = store.getActiveLocalScope?.()
 return scope?.kind === 'account' ? scope.userId : 'visitor'
}
export function useTrainingCheckins() {
 const auth = useOptionalAuth()
 const state = useStore(store => store.S), ready = useStore(store => store.ready)
 const scopeKey = useStore(checkinScopeKey)
 const expected = auth ? auth.status === 'authenticated' ? auth.user?.id : auth.status === 'initializing' ? null : 'visitor' : scopeKey
 const authorized = ready && expected === scopeKey
 return { records: authorized ? state.trainingCheckIns || EMPTY : EMPTY, workouts: authorized ? state.workouts : [], scopeKey: authorized ? scopeKey : null }
}
export function saveTrainingCheckin(workoutId, input, ownerScope) {
 const store = useStore.getState()
 if (!ownerScope || !store.ready || checkinScopeKey(store) !== ownerScope) throw new Error('training-checkin-scope-changed')
 if (!store.replaceState(withTrainingCheckin(store.S, workoutId, input, new Date().toISOString(), crypto.randomUUID()))) throw new Error('training-checkin-local-write-failed')
}
export const checkinFor = (records, id) => normalizeTrainingCheckin(records?.[id])
export async function openTrainingCheckin(workoutId, closeCurrent = undefined, onReturn = undefined) {
 const ownerScope = checkinScopeKey(useStore.getState())
 const [{ default: TrainingCheckinSheet }, { useUI }, React] = await Promise.all([import('../components/training/checkin/TrainingCheckinSheet.jsx'), import('../store/useUI.js'), import('react')])
 const store = useStore.getState()
 if (checkinScopeKey(store) !== ownerScope || !store.S.workouts.some(workout => workout.id === workoutId)) return
 closeCurrent?.()
 useUI.getState().openSheet(close => React.createElement(TrainingCheckinSheet, { key: ownerScope + workoutId, workoutId, ownerScope, close, onReturn }))
}
