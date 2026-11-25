import { useMemo } from 'react'
import { useOptionalAuth } from '../auth/auth-context.js'
import { useStore } from '../store/useStore.js'
import { withTrainingCheckin } from './training-checkin.js'
import { normalizeTrainingCheckin } from './training-checkin-data.js'
import { queueCheckin } from './training-checkin-repository.js'
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
 const records=useMemo(()=>authorized?{...state.trainingCheckIns,...state.trainingCheckinRecords}:EMPTY,[authorized,state.trainingCheckIns,state.trainingCheckinRecords])
 const syncError=state.checkinSyncError||(Object.keys(state.checkinMigrationConflicts||{}).length?'conflict':state.pendingCheckinOperations?.length?'pending':null)
 return { records, workouts: authorized ? state.workouts : [], scopeKey: authorized ? scopeKey : null, syncError:authorized?syncError:null }
}
export function saveTrainingCheckin(workoutId, input, ownerScope, shares=null) {
 const store = useStore.getState()
 if (!ownerScope || !store.ready || checkinScopeKey(store) !== ownerScope) throw new Error('training-checkin-scope-changed')
 const next=withTrainingCheckin({...store.S,trainingCheckIns:{...store.S.trainingCheckIns,...store.S.trainingCheckinRecords}},workoutId,input,new Date().toISOString(),crypto.randomUUID())
 const value=next.trainingCheckIns[workoutId]
 const result=ownerScope==='visitor'?next:queueCheckin(store.S,ownerScope,workoutId,value,shares)
 if (!store.replaceState(result)) throw new Error('training-checkin-local-write-failed')
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
