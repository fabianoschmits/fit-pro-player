import { create } from 'zustand'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED, STANDALONE } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave, nativeClear, clearLegacyReminders } from '../lib/mobile.js'
import { annotateStarterRoutines, ensureStarterRoutines, isStarterRoutine } from '../lib/starter.js'
import { DEFAULT_PROFILE, normalizeProfile, syncProfileWeightFromBodyweight } from '../lib/profile.js'
import { normalizeBodyMeasurementCheckins, normalizeBodyMeasurementGoals } from '../lib/body-measurements.js'
import { nextStateTimestamp } from '../lib/sync-state.js'
import { ANONYMOUS_SCOPE, resolveLocalScope } from '../lib/local-state-scope.js'
import { readScopedState, writeScopedState } from '../lib/account-cache.js'
import { recordDiagnostic } from '../lib/diagnostics.js'
import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences } from '../lib/notification-preferences.js'
import { MASS_UNIT, STATE_SCHEMA_VERSION } from '../lib/mass.js'
import { createSessionRecovery, hasPendingSessionFinalization } from '../lib/session-recovery.js'

export const DEF = {
  displayUnit: 'kg', massUnit: MASS_UNIT, stateSchemaVersion: STATE_SCHEMA_VERSION,
  restSec: 90, sound: true, keepAwake: true, lang: 'pt',
  theme: 'dark', accent: 'lime', body: 'male', targetW: null,
  profile: DEFAULT_PROFILE, planMode: 'weekly',
  bodyweight: [], bodyMeasurements: [], bodyMeasurementGoals: {}, routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], mediaSize: 'mini',
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', tz: null }, effort: null, assignedProgram: null,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  // UX prefs — weighBeforeWorkout defaults true; skipped automatically when already weighed today.
  weighBeforeWorkout: true, onboardingDone: false, simpleMode: true, seenTips: {}, pendingProfessionalEvents: [], professionalProgramDrafts: {}
}
const clone = o => JSON.parse(JSON.stringify(o))
const uuidOrNull = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')) ? value : null

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}

// Older installations did not have the full personal-profile object. Established data should
// enter the new wizard prefilled, while untouched starter plans remain first-run installs.
function legacyHasPersonalData(state) {
  if (state.onboardingDone || state.active) return true
  if ((state.workouts || []).length || (state.bodyweight || []).length || (state.bodyMeasurements || []).length || (state.customEx || []).length) return true
  return (state.routines || []).some(routine => !isStarterRoutine(routine))
}

function hasCompleteProfile(profile) {
  return !!(profile?.name && profile?.birthDate && profile?.heightCm && profile?.startWeight && profile?.goal && profile?.experience)
}

export function normalizeState(source) {
  const raw = object(source)
  if (raw.stateSchemaVersion !== STATE_SCHEMA_VERSION || raw.massUnit !== MASS_UNIT) {
    const displayUnit = raw.displayUnit === 'lb' || raw.unit === 'lb' ? 'lb' : 'kg'
    return normalizeState({ ...clone(DEF), displayUnit })
  }
  const state = Object.assign(clone(DEF), raw)
  state.displayUnit = state.displayUnit === 'lb' ? 'lb' : 'kg'
  state.massUnit = MASS_UNIT
  state.stateSchemaVersion = STATE_SCHEMA_VERSION
  delete state.unit
  state.bodyweight = Array.isArray(state.bodyweight) ? state.bodyweight : []
  state.bodyMeasurements = normalizeBodyMeasurementCheckins(state.bodyMeasurements)
  state.bodyMeasurementGoals = normalizeBodyMeasurementGoals(state.bodyMeasurementGoals)
  state.routines = Array.isArray(state.routines) ? state.routines : []
  state.workouts = Array.isArray(state.workouts) ? state.workouts : []
  state.customEx = Array.isArray(state.customEx) ? state.customEx : []
  state.pendingProfessionalEvents = Array.isArray(state.pendingProfessionalEvents) ? state.pendingProfessionalEvents : []
  state.professionalProgramDrafts = object(state.professionalProgramDrafts)
  state.week = object(state.week)
  state.dayPlan = object(state.dayPlan)
  state.exWeights = object(state.exWeights)
  state.planMode = state.planMode === 'daily' ? 'daily' : 'weekly'
  state.notifications = normalizeNotificationPreferences(raw.notifications, raw.reminder)
  state.profile = normalizeProfile(raw.profile, state.body)
  syncProfileWeightFromBodyweight(state)

  if (!hasCompleteProfile(state.profile) && legacyHasPersonalData(raw)) {
    state.onboardingDone = false
    state.profile.startWeight = state.profile.startWeight || state.bodyweight[0]?.w || null
    state.profile.completedAt = null
  }

  annotateStarterRoutines(state)
  if (!state.onboardingDone && !state.routines.length) ensureStarterRoutines(state)
  return state
}

function loadState(scope = ANONYMOUS_SCOPE) {
  return normalizeState(readScopedState(scope, localStorage, DEF).state)
}

const hasData = st => !!(
  st?.onboardingDone || st?.active || st?.profile?.name
  || (st?.workouts || []).length || (st?.bodyweight || []).length || (st?.bodyMeasurements || []).length || (st?.customEx || []).length
  || (st?.routines || []).some(routine => !isStarterRoutine(routine))
)

export const useStore = create((set, get) => {
  let activeScope = ANONYMOUS_SCOPE
  let scopeGeneration = 0
  let assignedProgramGeneration = 0
  let saveTm = null
  let sessionRecovery = null
  let sessionRecoveryAccountId = null
  let nativePending = Promise.resolve(true)
  const scopeToken = () => ({ scope: activeScope, generation: scopeGeneration })
  const isCurrent = token => token.generation === scopeGeneration && token.scope === activeScope
  const persistenceResult = (ok, error = 'local-write-failed') => {
    if (!ok) recordDiagnostic('storage-error')
    set({ persistence: { state: ok ? 'saved' : 'error', error: ok ? null : error } })
  }
  const saveNative = (scope, state, generation) => {
    const pending = nativeSave(scope, clone(state)).then(ok => {
      if (generation === scopeGeneration && scope === activeScope && (ok === false || get().persistence.state !== 'error' || get().persistence.error === 'native-write-failed')) persistenceResult(ok !== false, 'native-write-failed')
      return ok !== false
    })
    nativePending = pending
    return pending
  }

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction). Notification schedules are maintained by their dedicated client.
  const nativePersist = (scope = activeScope, generation = scopeGeneration) => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => {
      saveTm = null
      if (generation !== scopeGeneration || scope !== activeScope) return
      saveNative(scope, get().S, generation)
    }, 800)
  }

  const persist = (S, dirty = true) => {
    const scope = activeScope
    const generation = scopeGeneration
    const previousAssignment = get().S?.assignedProgram
    if (['assignmentId', 'versionId', 'programId'].some(key => previousAssignment?.[key] !== S.assignedProgram?.[key])) assignedProgramGeneration++
    if (dirty) S._ts = nextStateTimestamp(get().S?._ts)
    registerCustom(S.customEx)
    let ok = writeScopedState(scope, S, localStorage)
    set({ S })
    persistenceResult(ok)
    if (MOBILE) nativePersist(scope, generation)
    return ok
  }

  // Flush the native file mirror before a mobile WebView is suspended.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      saveNative(activeScope, get().S, scopeGeneration)
    }
  })

  const clearLocalSessionContext = () => {
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem('gym_sync_conflict')
  }

  const appEntryKey = scope => scope.kind === 'account'
    ? `fpp_app_entered:${scope.userId}`
    : 'fpp_app_entered:anonymous'

  const ensureSessionRecoveryDraft = () => {
    if (!sessionRecovery) return false
    if (sessionRecovery.getDraft()) return true
    const active = get().S.active
    if (!active) return false
    get().startSessionRecovery(active)
    return !!sessionRecovery.getDraft()
  }

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    ready: false,
    persistence: { state: 'saved', error: null },
    sessionRecovery: { state: 'idle', pending: 0, error: null },
    getActiveLocalScope: () => activeScope,
    getScopeToken: scopeToken,
    isScopeCurrent: isCurrent,
    // Reads share this generation across Shell and management. Every persisted assignment
    // replacement/clear invalidates older snapshots. Confirmed reads and successful
    // unlink also invalidate when the local assignment happens to remain unchanged.
    getAssignedProgramReadToken: () => ({ ...scopeToken(), assignmentGeneration: assignedProgramGeneration }),
    isAssignedProgramReadCurrent: (token, userId) => isCurrent(token) && token.scope.kind === 'account' && token.scope.userId === userId && token.assignmentGeneration === assignedProgramGeneration,
    invalidateAssignedProgramReads(token) {
      if (isCurrent(token)) assignedProgramGeneration++
    },
    configureSessionRecovery(repository, accountId) {
      if (activeScope.kind !== 'account' || activeScope.userId !== accountId) return null
      if (sessionRecovery && sessionRecoveryAccountId === accountId) return sessionRecovery
      sessionRecoveryAccountId = accountId
      sessionRecovery = createSessionRecovery({
        repository,
        accountId,
        onStatus: status => {
          if (activeScope.kind === 'account' && activeScope.userId === accountId && sessionRecoveryAccountId === accountId) {
            set({ sessionRecovery: { error: null, ...status } })
          }
        },
      })
      const draft = sessionRecovery.getDraft()
      set({ sessionRecovery: draft
        ? { state: hasPendingSessionFinalization(draft) ? 'waiting' : 'saved', pending: draft.pendingOperations.length, error: null }
        : { state: 'idle', pending: 0, error: null } })
      return sessionRecovery
    },
    releaseSessionRecovery(accountId) {
      if (sessionRecoveryAccountId !== accountId) return
      sessionRecovery = null
      sessionRecoveryAccountId = null
      set({ sessionRecovery: { state: 'idle', pending: 0, error: null } })
    },
    flushSessionRecovery() {
      return sessionRecovery?.flush() || Promise.resolve({ state: 'idle', pending: 0 })
    },
    hasPendingSessionCompletion() {
      return hasPendingSessionFinalization(sessionRecovery?.getDraft())
    },
    takeOverSessionRecovery() {
      return sessionRecovery?.takeOver() || Promise.resolve({ state: 'idle', pending: 0 })
    },
    replaceRemoteActiveSession() {
      return sessionRecovery?.replaceRemoteActive() || Promise.resolve({ state: 'idle', pending: 0 })
    },
    startSessionRecovery(active) {
      if (!sessionRecovery || !active) return Promise.resolve({ state: 'idle', pending: 0 })
      const prescriptionSnapshot = {
        name: active.name || '',
        bodyweightKg: active.bw ?? null,
        massUnit: MASS_UNIT,
        exercises: (active.entries || []).map(entry => ({
          id: entry.id,
          ...(entry.sg ? { sg: entry.sg } : {}),
          target: clone(entry.target || {}),
          plan: entry.plan ? clone(entry.plan) : null,
        })),
      }
      return sessionRecovery.start({
        sessionId: active.id,
        prescriptionSnapshot,
        routineId: uuidOrNull(active.routineId),
        assignmentId: uuidOrNull(active.assignmentId),
      })
    },
    queueSessionOperation({ kind = 'set_upserted', payload, operationId = crypto.randomUUID() }) {
      if (!ensureSessionRecoveryDraft()) return Promise.resolve({ state: 'idle', pending: 0 })
      return sessionRecovery.enqueue({ operationId, kind, payload: { ...clone(payload || {}), massUnit: MASS_UNIT } })
    },
    completeSessionRecovery(payload, operationId = crypto.randomUUID()) {
      if (!ensureSessionRecoveryDraft()) return Promise.resolve({ state: 'idle', pending: 0 })
      return sessionRecovery.complete({ operationId, kind: 'session_completed', payload: { ...clone(payload || {}), massUnit: MASS_UNIT } })
    },
    abandonSessionRecovery(payload, operationId = crypto.randomUUID()) {
      if (!ensureSessionRecoveryDraft()) return { state: 'idle', pending: 0 }
      return sessionRecovery.abandon({ operationId, kind: 'session_abandoned', payload: { ...clone(payload || {}), massUnit: MASS_UNIT } })
    },
    clearSessionRecovery() {
      return sessionRecovery?.clear() || { state: 'idle', pending: 0 }
    },
    async flushPersistence() {
      clearTimeout(saveTm); saveTm = null
      const token = scopeToken()
      let ok = writeScopedState(activeScope, get().S, localStorage)
      if (MOBILE) ok = await saveNative(activeScope, get().S, scopeGeneration) && ok
      if (isCurrent(token)) persistenceResult(ok)
      return ok
    },

    async activateLocalScope(userId) {
      const scope = resolveLocalScope(userId)
      if (MOBILE && saveTm) saveNative(activeScope, get().S, scopeGeneration)
      const generation = ++scopeGeneration
      activeScope = scope
      sessionRecovery = null
      sessionRecoveryAccountId = null
      clearTimeout(saveTm); saveTm = null
      const local = readScopedState(scope, localStorage, DEF)
      set({ S: normalizeState(local.state), ready: false, persistence: { state: local.status === 'invalid' || local.status === 'error' ? 'error' : 'saved', error: local.status === 'invalid' ? 'invalid-local-cache' : local.status === 'error' ? 'local-read-failed' : null }, sessionRecovery: { state: 'idle', pending: 0, error: null } })
      if (MOBILE) {
        const nativeState = await nativeLoad(scope)
        if (generation !== scopeGeneration || scope !== activeScope) return false
        if (nativeState && Number(nativeState._ts || 0) > Number(get().S._ts || 0)) {
          set({ S: normalizeState(nativeState) })
          let ok = writeScopedState(scope, get().S, localStorage)
          persistenceResult(ok)
        }
      }
      return true
    },

    // Mutate a draft of S via producer fn, then persist it in the active local scope.
    update(mut) {
      const S = clone(get().S)
      mut(S)
      persist(S)
    },
    replaceState(S, dirty = true) {
      const next = normalizeState(S)
      next.pendingProfessionalEvents = next.pendingProfessionalEvents.filter(event => activeScope.kind === 'account' && event.accountId === activeScope.userId)
      return persist(next, dirty)
    },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },
    isAppEntered: () => localStorage.getItem(appEntryKey(activeScope)) === '1'
      || (activeScope.kind === 'anonymous' && localStorage.getItem('gym_guest') === '1' && hasData(get().S)),
    enterApp() {
      localStorage.setItem(appEntryKey(activeScope), '1')
      if (activeScope.kind === 'anonymous') localStorage.setItem('gym_guest', '1')
      set({})
    },
    leaveApp() {
      localStorage.removeItem(appEntryKey(activeScope))
      if (activeScope.kind === 'anonymous') localStorage.removeItem('gym_guest')
      set({})
    },
    clearAnonymousState() {
      if (!get().clearLocalScope(null)) return false
      localStorage.removeItem('gym_guest')
      localStorage.removeItem('fpp_app_entered:anonymous')
      localStorage.removeItem('gym_dirty')
      localStorage.removeItem('gym_sync_conflict')
      set({})
      return true
    },
    clearLocalScope(userId = null) {
      const scope = resolveLocalScope(userId)
      const currentScope = scope.kind === activeScope.kind && scope.userId === activeScope.userId
      if (currentScope) { ++scopeGeneration; activeScope = scope; clearTimeout(saveTm); saveTm = null }
      const empty = normalizeState(DEF)
      empty._ts = nextStateTimestamp(currentScope ? get().S._ts : 0)
      const ok = writeScopedState(scope, empty, localStorage)
      if (!ok) { persistenceResult(false); return false }
      localStorage.removeItem(appEntryKey(scope))
      if (scope.kind === 'anonymous') localStorage.removeItem('gym_guest')
      if (scope === activeScope || (scope.kind === activeScope.kind && scope.userId === activeScope.userId)) {
        set({ S: empty })
        persistenceResult(ok)
      }
      if (MOBILE) nativePending = nativeClear(scope, empty).then(result => { if (currentScope) persistenceResult(result !== false, 'native-clear-failed'); return result })
      return ok
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(normalizeState(Object.assign(clone(DEF), buildDemoState())))
    },

    async boot({ supabaseUserId = null } = {}) {
      if (!(await get().activateLocalScope(supabaseUserId))) return
      if (supabaseUserId) get().setGuest(false)
      // Public static deployment: show the product landing page first. Entering the app
      // creates the local guest marker; returning visitors keep going straight to their data.
      if (STANDALONE) {
        set({ ready: true })
        return
      }
      // Mobile build: no backend either — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in.
      if (MOBILE) {
        saveNative(activeScope, get().S, scopeGeneration)
        get().setGuest(!supabaseUserId)
        void clearLegacyReminders()
          set({ ready: true })
        return
      }
      // Static demo build: seed once, then let the landing page introduce the product
      // before the visitor explicitly opens the browser-only example profile.
      if (DEMO) {
        if (!localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        set({ ready: true })
        return
      }
      clearLocalSessionContext()
      set({ ready: true })
    }
  }
})

export { hasData }
