import { create } from 'zustand'
import { api } from '../lib/api.js'
import { localTZ } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED, STANDALONE } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { MOBILE, nativeLoad, nativeSave, syncReminder } from '../lib/mobile.js'
import { annotateStarterRoutines, ensureStarterRoutines, isStarterRoutine } from '../lib/starter.js'
import { DEFAULT_PROFILE, normalizeProfile, syncProfileWeightFromBodyweight } from '../lib/profile.js'
import { normalizeBodyMeasurementCheckins, normalizeBodyMeasurementGoals } from '../lib/body-measurements.js'
import { createStatePushQueue, nextStateTimestamp } from '../lib/sync-state.js'

const KEY = 'gym_state_v1'
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

function loadState() {
  let state = null
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) state = JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return normalizeState(state || DEF)
}

const hasData = st => !!(
  st?.onboardingDone || st?.active || st?.profile?.name
  || (st?.workouts || []).length || (st?.bodyweight || []).length || (st?.bodyMeasurements || []).length || (st?.customEx || []).length
  || (st?.routines || []).some(routine => !isStarterRoutine(routine))
)

export const useStore = create((set, get) => {
  let pushTm = null
  let saveTm = null
  let retryTm = null
  const setSyncConflict = value => {
    try {
      if (value) localStorage.setItem('gym_sync_conflict', '1')
      else localStorage.removeItem('gym_sync_conflict')
    } catch { /* best effort */ }
    set({ syncConflict: value })
  }
  const markDirty = error => {
    try { localStorage.setItem('gym_dirty', '1') } catch { /* best effort */ }
    if (error?.status === 409) {
      clearTimeout(retryTm)
      setSyncConflict(true)
    } else if (error && error.status !== 401 && navigator.onLine !== false) {
      clearTimeout(retryTm)
      retryTm = setTimeout(() => get().pushState(), 30000)
    }
  }
  const markClean = () => {
    clearTimeout(retryTm)
    retryTm = null
    try { localStorage.removeItem('gym_dirty') } catch { /* best effort */ }
    setSyncConflict(false)
  }

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; nativeSave(get().S); syncReminder(get().S) }, 800)
  }

  const persist = (S, push = true) => {
    S._ts = nextStateTimestamp(get().S?._ts)
    registerCustom(S.customEx)
    try { localStorage.setItem(KEY, JSON.stringify(S)) } catch { /* keep the in-memory copy usable */ }
    set({ S })
    if (MOBILE) nativePersist()
    if (push && get().user) {
      markDirty()
      if (!get().syncConflict) {
        clearTimeout(pushTm)
        pushTm = setTimeout(() => get().pushState(), 1500)
      }
    }
  }

  const pushLatest = createStatePushQueue({
    getState: () => get().S,
    isEnabled: () => !!get().user && !get().syncConflict,
    markDirty,
    markClean,
    send: state => api('/api/data', { method: 'PUT', body: JSON.stringify({ state }) }),
    shouldRetry: error => error?.status !== 401 && error?.status !== 409 && navigator.onLine !== false,
    retryDelays: [250, 1000, 3000],
  })

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. setting the reminder time then immediately backgrounding to test it). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') {
      if (localStorage.getItem('gym_dirty') === '1' && get().user && !get().syncConflict) get().pushState()
      return
    }
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      nativeSave(get().S)
    }
    if (pushTm) {
      clearTimeout(pushTm)
      pushTm = null
      get().pushState()
    }
  })

  // A failed upload deliberately leaves gym_dirty behind. Reconnection is the earliest safe
  // moment to resume it; no user action should be required after a tunnel or Wi-Fi interruption.
  window.addEventListener('online', () => {
    if (localStorage.getItem('gym_dirty') === '1' && get().user && !get().syncConflict) get().pushState()
  })
  window.addEventListener('focus', () => {
    if (localStorage.getItem('gym_dirty') === '1' && get().user && !get().syncConflict) get().pushState()
  })

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = () => {
    get().setUser(null)
    localStorage.removeItem('gym_guest')
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem('gym_sync_conflict')
    localStorage.removeItem(KEY)
    clearTimeout(retryTm)
    retryTm = null
    set({ syncConflict: false })
    persist(normalizeState(DEF), false)
  }

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    syncConflict: (() => { try { return localStorage.getItem('gym_sync_conflict') === '1' } catch { return false } })(),
    ready: false,

    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true) {
      const S = clone(get().S)
      mut(S)
      persist(S, push)
    },
    replaceState(S, push = false) { persist(normalizeState(S), push) },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    // Public config from /api/config (invite_only, allow_guest). null until the first successful
    // fetch — the login screen and boot both read it, so it is fetched once and cached here
    // rather than by each screen that happens to need it.
    config: null,
    async loadConfig() {
      if (get().config) return get().config
      try { const c = await api('/api/config'); set({ config: c }); return c }
      catch { return null }
    },

    setUser(u) {
      if (u) { localStorage.setItem('gym_user', JSON.stringify(u)); localStorage.removeItem('gym_guest') }
      else localStorage.removeItem('gym_user')
      set({ user: u })
    },

    async pushState() {
      if (!get().user || get().syncConflict) return false
      clearTimeout(pushTm)
      pushTm = null
      return pushLatest()
    },
    async pullState() {
      try {
        const { state } = await api('/api/data')
        const S = get().S
        const dirty = localStorage.getItem('gym_dirty') === '1'
        if (state && (!hasData(S) || ((state._ts || 0) >= (S._ts || 0) && !dirty))) {
          const active = S.active
          const next = normalizeState(state)
          if (active) next.active = active
          persist(next, false)
        } else if (hasData(S)) { await get().pushState() }
      } catch (e) { /* offline — keep local */ }
    },

    async signOut() {
      if (hasData(get().S) && !(await get().pushState())) {
        throw new Error('Could not sync your data. You are still signed in and your data remains on this device.')
      }
      await api('/api/logout', { method: 'POST', body: '{}' })
      clearLocalSession()
    },

    // "Sign out everywhere": the server bumps this profile's session version, which kills every
    // session it has on any device — this browser included, so the app has to end up exactly
    // where a normal signOut leaves it. Unlike signOut the request is NOT swallowed: if it fails
    // the sessions elsewhere are all still valid, and wiping this device's copy of the data
    // would sign the user out of the one place the bump didn't reach. Caller reports the error.
    async signOutAll() {
      if (hasData(get().S) && !(await get().pushState())) {
        throw new Error('Could not sync your data. You are still signed in and your data remains on this device.')
      }
      await api('/api/logout/all', { method: 'POST', body: '{}' })
      clearLocalSession()
    },

    // A whole-state sync cannot safely guess how to merge two devices. Keep both copies intact
    // and let the owner explicitly choose which one wins.
    async resolveSyncConflict(strategy) {
      const { state: cloudState } = await api('/api/data')
      if (strategy === 'cloud') {
        if (!cloudState) throw new Error('No cloud data was found.')
        const active = get().S.active
        const next = normalizeState(cloudState)
        if (active) next.active = active
        setSyncConflict(false)
        markClean()
        persist(next, false)
        return true
      }
      if (strategy !== 'local') throw new Error('Unknown conflict resolution.')

      const current = clone(get().S)
      current._ts = Math.max(Date.now(), Number(current._ts) + 1 || 1, Number(cloudState?._ts) + 1 || 1)
      try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* keep in memory */ }
      registerCustom(current.customEx)
      set({ S: current })
      if (MOBILE) nativePersist()
      setSyncConflict(false)
      markDirty()
      return pushLatest()
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(normalizeState(Object.assign(clone(DEF), buildDemoState())), false)
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      // Public static deployment: show the product landing page first. Entering the app
      // creates the local guest marker; returning visitors keep going straight to their data.
      if (STANDALONE) {
        set({ ready: true })
        return
      }
      // Mobile build: no backend either — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in.
      if (MOBILE) {
        const saved = await nativeLoad()
        const S = get().S
        if (saved && (!hasData(S) || (saved._ts || 0) >= (S._ts || 0))) {
          persist(normalizeState(saved), false)
        } else if (hasData(S)) {
          nativeSave(S)   // first run after an update from a file-less version: seed the mirror
        }
        get().setGuest(true)
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
      // Guests never authenticate, so an instance that turned guest mode off has no request to
      // refuse — the only way the switch reaches someone already inside is here, on their next
      // boot. Ending the session needs a positive `allow_guest: false`; see lib/guest.js for why
      // an unreachable server must not be allowed to lock anyone out (#42).
      const cfg = await get().loadConfig()
      if (!guestAllowed(cfg)) get().setGuest(false)
      try {
        const me = await api('/api/me')
        get().setUser(me.user)
        await get().pullState()
        // Re-stamp the reminder's timezone on every load — keeps it correct if you're travelling,
        // without needing to revisit Settings.
        const tz = localTZ()
        if (get().S.reminder?.on && get().S.reminder.tz !== tz) {
          get().update(s => { s.reminder = { ...s.reminder, tz } })
        }
      } catch (e) {
        if (e.status === 401) get().setUser(null)
      }
      set({ ready: true })
    }
  }
})

export { hasData }
