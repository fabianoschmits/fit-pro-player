import { useLayoutEffect, useRef } from 'react'
import { useStore } from '../../../store/useStore.js'
import { DAYS, normalizeWeeklyPlan } from '../../../lib/professional-program.js'
import { isCardio } from '../../../lib/exercises.js'

export const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
export const DAY_LABELS = { monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo' }
export const prescriptionDefaults = entry => ({ ...entry, rest: entry.rest ?? 90, ...(entry.mode === 'time' ? { sec: entry.sec ?? 45 } : {}), ...(entry.mode === 'cardio' ? { min: entry.min ?? 20, speed: entry.speed ?? 8 } : {}) })
const clone = value => structuredClone(value)
export function migrateWeekDraft(value = {}) {
  const metadata = value.metadata || value
  return { title: metadata.title || '', description: metadata.description || '', objective: metadata.objective || '',
    weeklyPlan: Object.fromEntries(Object.entries(normalizeWeeklyPlan(value.weeklyPlan || value.plan || {})).map(([day, entries]) => [day, entries.map(prescriptionDefaults)])),
    workoutTitles: Object.fromEntries(Object.entries(value.workoutTitles || {}).filter(([day]) => DAYS.includes(day))),
  }
}

/** Local WeekDraft shared by summary/day. Targets include scope, context and revision. */
export function useProgramDraft({ accountId, programId, initialDraft = {} }) {
  const records = useStore(state => state.S.professionalProgramDrafts)
  const persistence = useStore(state => state.persistence)
  const identity = useRef(null), alive = useRef(false)
  const scope = useStore.getState().getScopeToken()
  if (!identity.current || identity.current.accountId !== accountId || identity.current.programId !== programId || !useStore.getState().isScopeCurrent(identity.current.scope)) {
    identity.current = { accountId, programId, scope, initial: migrateWeekDraft(initialDraft) }
  }
  const context = identity.current, key = `${accountId}:${programId}`
  const current = () => alive.current && identity.current === context && !!accountId && !!programId && scope.scope.kind === 'account' && scope.scope.userId === accountId && useStore.getState().isScopeCurrent(context.scope)
  const read = () => useStore.getState().S.professionalProgramDrafts?.[key]
  const revision = () => read()?._revision || 0
  const value = () => read() ? migrateWeekDraft(read()) : clone(context.initial)
  useLayoutEffect(() => {
    alive.current = true
    if (current() && read()?.plan) useStore.getState().writeProgramDraft({ accountId, programId, scopeToken: context.scope, value: { ...value(), _revision: revision(), dirty: true } })
    return () => { alive.current = false }
  }, [context])
  const mutate = fn => {
    if (!current()) return false
    const next = value(); const result = fn(next)
    if (result === false || result === 'confirmation-required') return result
    return useStore.getState().writeProgramDraft({ accountId, programId, scopeToken: context.scope, value: { ...next, _revision: revision() + 1, dirty: true } })
  }
  const validDay = day => DAYS.includes(day)
  const target = (day, index) => ({ context, revision: revision(), day, index })
  const resolve = (day, token) => validDay(day) && token?.context === context && token.day === day && token.revision === revision() && Number.isInteger(token.index) ? token.index : -1
  const edit = (day, token, fn) => mutate(draft => { const index = resolve(day, token), entries = draft.weeklyPlan[day] || []; if (index < 0 || !entries[index]) return false; return fn(entries, index) })
  const saved = records?.[key]
  return {
    draft: saved ? migrateWeekDraft(saved) : context.initial, dirty: Boolean(saved?.dirty || saved?.plan), persistenceError: persistence?.state === 'error',
    isCurrent: current, target, publicationToken: () => ({ context, revision: revision() }),
    isTargetCurrent: (day, token) => current() && resolve(day, token) >= 0,
    updateMetadata: patch => mutate(draft => { for (const name of ['title', 'description', 'objective']) if (patch[name] != null) draft[name] = String(patch[name]) }),
    setWorkoutTitle: (day, title) => mutate(draft => { if (!validDay(day) || String(title).length > 80) return false; draft.workoutTitles[day] = String(title) }),
    addExercise: (day, exercise) => mutate(draft => { if (!validDay(day)) return false; const entries = draft.weeklyPlan[day] ||= []; if (entries.length >= 50) return false; entries.push(prescriptionDefaults({ exerciseId: String(exercise.exerciseId || exercise.id), sets: 3, reps: 8, load: 0, ...(isCardio(exercise) ? { mode: 'cardio', min: 20, speed: 8 } : {}) })) }),
    updateExercise: (day, token, patch) => edit(day, token, (entries, index) => { entries[index] = prescriptionDefaults({ ...entries[index], ...patch }) }),
    removeExercise: (day, token) => edit(day, token, (entries, index) => { entries.splice(index, 1) }),
    duplicateExercise: (day, token) => edit(day, token, (entries, index) => { if (entries.length >= 50) return false; entries.splice(index + 1, 0, clone(entries[index])) }),
    moveExercise: (day, token, delta) => edit(day, token, (entries, index) => { const other = index + delta; if (![1, -1].includes(delta) || other < 0 || other >= entries.length) return false; [entries[index], entries[other]] = [entries[other], entries[index]] }),
    copyDay: (source, destination, { overwrite = false } = {}) => mutate(draft => { if (!validDay(source) || !validDay(destination) || source === destination) return false; if (draft.weeklyPlan[destination]?.length && !overwrite) return 'confirmation-required'; draft.weeklyPlan[destination] = clone(draft.weeklyPlan[source] || []); draft.workoutTitles[destination] = draft.workoutTitles[source] || '' }),
    swapDays: (source, destination) => mutate(draft => { if (!validDay(source) || !validDay(destination) || source === destination) return false; [draft.weeklyPlan[source], draft.weeklyPlan[destination]] = [draft.weeklyPlan[destination] || [], draft.weeklyPlan[source] || []]; [draft.workoutTitles[source], draft.workoutTitles[destination]] = [draft.workoutTitles[destination] || '', draft.workoutTitles[source] || ''] }),
    clearAfterPublication: token => { if (!current() || token?.context !== context || token.revision !== revision()) return false; return useStore.getState().writeProgramDraft({ accountId, programId, scopeToken: context.scope, value: null }) },
  }
}
