import { create } from 'zustand'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED, STANDALONE } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave, nativeClear, syncReminder } from '../lib/mobile.js'
import { annotateStarterRoutines, ensureStarterRoutines, isStarterRoutine } from '../lib/starter.js'
import { DEFAULT_PROFILE, normalizeProfile, syncProfileWeightFromBodyweight } from '../lib/profile.js'
import { normalizeBodyMeasurementCheckins, normalizeBodyMeasurementGoals } from '../lib/body-measurements.js'
import { nextStateTimestamp } from '../lib/sync-state.js'
import { ANONYMOUS_SCOPE, resolveLocalScope } from '../lib/local-state-scope.js'
import { readScopedState, writeScopedState } from '../lib/account-cache.js'
import { createAccountSyncService, readSyncConflict, writeSyncConflict, clearSyncConflict, readSyncMetadata, syncMetadataKey, writeSyncMetadata, REMOTE_SYNC_STATE } from '../lib/account-sync.js'
import { recordDiagnostic } from '../lib/diagnostics.js'

export const DEF = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'pt',
  theme: 'dark', accent: 'lime', body: 'male', targetW: null,
  profile: DEFAULT_PROFILE, planMode: 'weekly',
  bodyweight: [], bodyMeasurements: [], bodyMeasurementGoals: {}, routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], mediaSize: 'mini',
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', tz: null }, effort: null, assignedProgram: null,
  // UX prefs — weighBeforeWorkout defaults true; skipped automatically when already weighed today.
  weighBeforeWorkout: true, onboardingDone: false, simpleMode: true, seenTips: {}, pendingProfessionalEvents: [], professionalProgramDrafts: {}
}
const clone = o => JSON.parse(JSON.stringify(o))

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
  const state = Object.assign(clone(DEF), raw)
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
  let localDirty = false
  let saveTm = null
  let syncRunning = null
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
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = (scope = activeScope, generation = scopeGeneration) => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => {
      saveTm = null
      if (generation !== scopeGeneration || scope !== activeScope) return
      saveNative(scope, get().S, generation)
      syncReminder(get().S)
    }, 800)
  }

  const persist = (S, dirty = true) => {
    const scope = activeScope
    const generation = scopeGeneration
    if (dirty) localDirty = true
    if (dirty) S._ts = nextStateTimestamp(get().S?._ts)
    registerCustom(S.customEx)
    let ok = writeScopedState(scope, S, localStorage)
    if (scope.kind === 'account' && dirty) {
      const sync = readSyncMetadata(scope, localStorage)
      ok = writeSyncMetadata(scope, { ...sync, dirty: true }, localStorage) && ok
    }
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

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    ready: false,
    persistence: { state: 'saved', error: null },
    accountSync: { state: 'IDLE', error: null, conflict: null },
    getActiveLocalScope: () => activeScope,
    getScopeToken: scopeToken,
    isScopeCurrent: isCurrent,
    async flushPersistence() {
      clearTimeout(saveTm); saveTm = null
      const token = scopeToken()
      let ok = writeScopedState(activeScope, get().S, localStorage)
      if (activeScope.kind === 'account' && localDirty) ok = writeSyncMetadata(activeScope, { ...readSyncMetadata(activeScope), dirty: true }) && ok
      if (MOBILE) ok = await saveNative(activeScope, get().S, scopeGeneration) && ok
      if (isCurrent(token)) persistenceResult(ok)
      return ok
    },

    async activateLocalScope(userId) {
      const scope = resolveLocalScope(userId)
      if (MOBILE && saveTm) saveNative(activeScope, get().S, scopeGeneration)
      const generation = ++scopeGeneration
      activeScope = scope
      localDirty = readSyncMetadata(scope).dirty
      clearTimeout(saveTm); saveTm = null
      const local = readScopedState(scope, localStorage, DEF)
      const conflict = readSyncConflict(scope)
      set({ S: normalizeState(local.state), ready: false, persistence: { state: local.status === 'invalid' || local.status === 'error' ? 'error' : 'saved', error: local.status === 'invalid' ? 'invalid-local-cache' : local.status === 'error' ? 'local-read-failed' : null }, accountSync: { state: conflict && !conflict.resolved ? 'CONFLICT' : 'IDLE', error: null, conflict: conflict && !conflict.resolved ? conflict : null } })
      if (MOBILE) {
        const nativeState = await nativeLoad(scope)
        if (generation !== scopeGeneration || scope !== activeScope) return false
        if (nativeState && Number(nativeState._ts || 0) > Number(get().S._ts || 0)) {
          set({ S: normalizeState(nativeState) })
          let ok = writeScopedState(scope, get().S, localStorage)
          if (scope.kind === 'account') {
            // The native mirror may contain edits whose WebView sync metadata was
            // evicted. Treat recovery as a local change; never silently replace it.
            localDirty = true
            ok = writeSyncMetadata(scope, { revision: readSyncMetadata(scope).revision, dirty: true }) && ok
          }
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

    async syncAccount(client) {
      if (activeScope.kind !== 'account') return { state: 'IDLE' }
      if (syncRunning?.token && isCurrent(syncRunning.token)) return syncRunning.promise
      const token = scopeToken()
      const scope = token.scope
      const service = createAccountSyncService({ client, scope, generation: token.generation, isCurrent: generation => generation === scopeGeneration && scope === activeScope })
      const publish = result => { if (isCurrent(token)) { if (result.state === 'ERROR') recordDiagnostic('sync-error'); set({ accountSync: { ...get().accountSync, ...result } }) }; return result }
      const preserveConflict = remote => {
        const conflict = { local: clone(get().S), remote, baseRevision: readSyncMetadata(scope).revision, createdAt: Date.now(), resolved: false }
        const ok = remote && writeSyncConflict(scope, conflict)
        if (!ok) persistenceResult(false, 'conflict-copy-write-failed')
        return publish({ state: 'CONFLICT', error: ok ? null : 'conflict-copy-write-failed', conflict })
      }
      const run = async () => {
        if (get().accountSync.state === 'CONFLICT') return get().accountSync
        if (get().persistence.state === 'error' && !(await get().flushPersistence())) return publish({ state: 'ERROR', error: 'local-write-failed' })
        if (!isCurrent(token)) return { state: 'ERROR', error: 'stale-scope' }
        publish({ state: 'SYNCING', error: null })
        const result = await service.sync({ state: get().S })
        if (!isCurrent(token)) return { state: 'ERROR', error: 'stale-scope' }
        if (result.state === REMOTE_SYNC_STATE.CONFLICT) return preserveConflict(result.snapshot)
        if (result.state === REMOTE_SYNC_STATE.REMOTE_AHEAD) {
          if (readSyncMetadata(scope).dirty) return preserveConflict(result.snapshot)
          const next = normalizeState(result.snapshot.payload)
          next.professionalProgramDrafts = get().S.professionalProgramDrafts
          next.pendingProfessionalEvents = get().S.pendingProfessionalEvents.filter(event => event.accountId === scope.userId)
          if (!persist(next, false)) return publish({ state: 'ERROR', error: 'local-write-failed' })
          if (!writeSyncMetadata(scope, { revision: result.snapshot.revision, dirty: false })) persistenceResult(false, 'local-metadata-write-failed')
          else localDirty = false
          return publish({ state: 'IN_SYNC', error: null, conflict: null })
        }
        if (![REMOTE_SYNC_STATE.REMOTE_ABSENT, REMOTE_SYNC_STATE.LOCAL_AHEAD].includes(result.state)) return publish(result)
        const anonymous = readScopedState(ANONYMOUS_SCOPE, localStorage, DEF)
        const adopted = result.state === REMOTE_SYNC_STATE.REMOTE_ABSENT && !hasData(get().S) && anonymous.status === 'valid' && hasData(anonymous.state)
        if (adopted) get().replaceState(anonymous.state)
        do {
          const snapshot = clone(get().S)
          const uploaded = await service.uploadSnapshot({ state: snapshot, expectedRevision: readSyncMetadata(scope).revision, isUnchanged: () => get().S._ts === snapshot._ts })
          if (!isCurrent(token)) return { state: 'ERROR', error: 'stale-scope' }
          if (uploaded.state === REMOTE_SYNC_STATE.CONFLICT) {
            const latest = await service.fetchRemoteSnapshot()
            if (!isCurrent(token)) return { state: 'ERROR', error: 'stale-scope' }
            return latest.snapshot ? preserveConflict(latest.snapshot) : publish({ state: 'CONFLICT', error: latest.error || 'remote-read-failed', conflict: null })
          }
          if (uploaded.state !== REMOTE_SYNC_STATE.IN_SYNC) return publish(uploaded)
        } while (readSyncMetadata(scope).dirty && isCurrent(token))
        localDirty = false
        if (adopted) get().clearAnonymousState()
        return publish({ state: 'IN_SYNC', error: null, conflict: null })
      }
      const promise = run().finally(() => { if (syncRunning?.token === token) syncRunning = null })
      syncRunning = { token, promise }
      return promise
    },

    async resolveSyncConflict(choice, client) {
      const token = scopeToken()
      const conflict = get().accountSync.conflict
      if (!conflict?.remote || !['local', 'cloud'].includes(choice)) return false
      const archive = { ...conflict, local: clone(get().S), resolved: true, resolution: choice }
      if (!writeSyncConflict(activeScope, archive)) { persistenceResult(false, 'conflict-copy-write-failed'); return false }
      if (choice === 'cloud') {
        const next = normalizeState(conflict.remote.payload)
        next.professionalProgramDrafts = get().S.professionalProgramDrafts
        next.pendingProfessionalEvents = get().S.pendingProfessionalEvents.filter(event => event.accountId === activeScope.userId)
        if (!persist(next, false)) return false
        if (!writeSyncMetadata(activeScope, { revision: conflict.remote.revision, dirty: false })) { persistenceResult(false, 'local-metadata-write-failed'); return false }
        localDirty = false
        set({ accountSync: { state: 'IN_SYNC', error: null, conflict: null } })
        return true
      }
      if (!writeSyncMetadata(activeScope, { revision: conflict.remote.revision, dirty: true })) { persistenceResult(false, 'local-metadata-write-failed'); return false }
      set({ accountSync: { state: 'LOCAL_AHEAD', error: null, conflict: null } })
      const result = await get().syncAccount(client)
      return isCurrent(token) && result.state === 'IN_SYNC'
    },
    getSyncCopy(kind) {
      const conflict = get().accountSync.conflict || readSyncConflict(activeScope)
      return kind === 'cloud' ? conflict?.remote?.payload || null : conflict?.local || get().S
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
      if (currentScope) localDirty = false
      const metadataKey = syncMetadataKey(scope)
      if (metadataKey) localStorage.removeItem(metadataKey)
      clearSyncConflict(scope)
      localStorage.removeItem(appEntryKey(scope))
      if (scope.kind === 'anonymous') localStorage.removeItem('gym_guest')
      if (scope === activeScope || (scope.kind === activeScope.kind && scope.userId === activeScope.userId)) {
        set({ S: empty, accountSync: { state: 'IDLE', error: null, conflict: null } })
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
        syncReminder(get().S)
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
