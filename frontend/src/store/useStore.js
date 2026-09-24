import { create } from 'zustand'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED, STANDALONE } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave, syncReminder } from '../lib/mobile.js'
import { annotateStarterRoutines, ensureStarterRoutines, isStarterRoutine } from '../lib/starter.js'
import { DEFAULT_PROFILE, normalizeProfile, syncProfileWeightFromBodyweight } from '../lib/profile.js'
import { normalizeBodyMeasurementCheckins, normalizeBodyMeasurementGoals } from '../lib/body-measurements.js'
import { nextStateTimestamp } from '../lib/sync-state.js'
import { ANONYMOUS_SCOPE, resolveLocalScope } from '../lib/local-state-scope.js'
import { readScopedState, writeScopedState } from '../lib/account-cache.js'
import { readSyncMetadata, syncMetadataKey, writeSyncMetadata } from '../lib/account-sync.js'

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
  reminder: { on: false, time: '08:00', tz: null }, effort: null,
  // UX prefs — weighBeforeWorkout defaults true; skipped automatically when already weighed today.
  weighBeforeWorkout: true, onboardingDone: false, simpleMode: true, seenTips: {}
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
  let saveTm = null

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = (scope = activeScope, generation = scopeGeneration) => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => {
      saveTm = null
      if (generation !== scopeGeneration || scope !== activeScope) return
      nativeSave(scope, get().S)
      syncReminder(get().S)
    }, 800)
  }

  const persist = S => {
    const scope = activeScope
    const generation = scopeGeneration
    S._ts = nextStateTimestamp(get().S?._ts)
    registerCustom(S.customEx)
    writeScopedState(scope, S, localStorage)
    if (scope.kind === 'account') {
      const sync = readSyncMetadata(scope, localStorage)
      writeSyncMetadata(scope, { ...sync, dirty: true }, localStorage)
    }
    set({ S })
    if (MOBILE) nativePersist(scope, generation)
  }

  // Flush the native file mirror before a mobile WebView is suspended.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      nativeSave(activeScope, get().S)
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
    getActiveLocalScope: () => activeScope,

    async activateLocalScope(userId) {
      const scope = resolveLocalScope(userId)
      const generation = ++scopeGeneration
      activeScope = scope
      set({ S: normalizeState(readScopedState(scope, localStorage, DEF).state), ready: false })
      if (MOBILE) {
        const nativeState = await nativeLoad(scope)
        if (generation !== scopeGeneration || scope !== activeScope) return false
        if (nativeState) set({ S: normalizeState(nativeState) })
      }
      return true
    },

    // Mutate a draft of S via producer fn, then persist it in the active local scope.
    update(mut) {
      const S = clone(get().S)
      mut(S)
      persist(S)
    },
    replaceState(S) { persist(normalizeState(S)) },

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
      get().clearLocalScope(null)
      localStorage.removeItem('gym_guest')
      localStorage.removeItem('fpp_app_entered:anonymous')
      localStorage.removeItem('gym_dirty')
      localStorage.removeItem('gym_sync_conflict')
      set({})
    },
    clearLocalScope(userId = null) {
      const scope = resolveLocalScope(userId)
      writeScopedState(scope, normalizeState(DEF), localStorage)
      const metadataKey = syncMetadataKey(scope)
      if (metadataKey) localStorage.removeItem(metadataKey)
      localStorage.removeItem(appEntryKey(scope))
      if (scope.kind === 'anonymous') localStorage.removeItem('gym_guest')
      if (scope === activeScope || (scope.kind === activeScope.kind && scope.userId === activeScope.userId)) {
        set({ S: normalizeState(DEF) })
      }
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
        const saved = await nativeLoad(activeScope)
        const S = get().S
        if (saved && (!hasData(S) || (saved._ts || 0) >= (S._ts || 0))) {
          persist(normalizeState(saved))
        } else if (hasData(S)) {
          nativeSave(activeScope, S)   // first run after an update from a file-less version: seed the mirror
        }
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
