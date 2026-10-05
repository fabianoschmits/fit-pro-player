import { create } from 'zustand'
import { uid } from '../lib/format.js'
import { beep, vibrate } from '../lib/sound.js'
import { t } from '../lib/i18n.js'
import { useStore } from './useStore.js'
import { normalizeNotificationPreferences } from '../lib/notification-preferences.js'
import { MOBILE } from '../lib/mobile.js'
import { scheduleNativeTimer, cancelNativeTimer, nativeTimerOwnsAlert } from '../lib/native-timer-notifications.js'

const timerAlertsEnabled = kind => normalizeNotificationPreferences(useStore.getState().S.notifications, useStore.getState().S.reminder)[kind === 'timed_set' ? 'timedSet' : 'rest']
const scheduleLocalTimer = (kind, endsAt, interactive = true) => {
  if (MOBILE) void scheduleNativeTimer(kind, endsAt, { enabled: timerAlertsEnabled(kind), sound: useStore.getState().S.sound, interactive })
  else if (timerAlertsEnabled(kind)) void requestRestNotificationPermission()
}
const localCompletionSound = (kind, sound) => {
  if (!timerAlertsEnabled(kind) || nativeTimerOwnsAlert(kind)) return
  beep(sound, 880, 0.15); beep(sound, 880, 0.15, 0.25); beep(sound, 1320, 0.4, 0.5)
  vibrate([200, 100, 200])
}

const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window
let requestRestNotificationPermissionP = null

const requestRestNotificationPermission = async () => {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  if (!requestRestNotificationPermissionP) {
    requestRestNotificationPermissionP = Notification.requestPermission()
      .then(perm => perm === 'granted')
      .catch(() => false)
      .finally(() => {
        requestRestNotificationPermissionP = null
      })
  }
  return requestRestNotificationPermissionP
}

const maybeRestNotification = async (kind = 'rest') => {
  if (MOBILE) return // OS deadline was scheduled at native timer start.
  if (!timerAlertsEnabled(kind)) return
  if (!notificationsSupported()) return
  if (!document.hidden && document.visibilityState !== 'hidden') return
  if (Notification.permission !== 'granted' && !(await requestRestNotificationPermission())) return
  try {
    // Android Chrome forbids the Notification constructor (Illegal constructor) - the
    // service-worker registration path is the one that actually pops there.
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg?.showNotification) {
      const title = t(kind === 'rest' ? 'Rest over — next set!' : 'Your timed set is complete.')
      reg.showNotification(title, { body: title })
      return
    }
    const title = t(kind === 'rest' ? 'Rest over — next set!' : 'Your timed set is complete.')
    new Notification(title, { body: title })
  } catch {
    // Intentionally ignore: notification APIs vary by browser and policy in edge cases.
  }
}

let toastTm = null
let timerInt = null
let timerTick = null
let timerDone = null
let workInt = null
let workTick = null
let workDone = null
let workRestDone = null

const validManualSet = (manualSet, active) => {
  if (!manualSet || !active?.start || manualSet.sessionId !== `${active.id}:${active.start}`) return false
  if (!Number.isInteger(manualSet.entryIdx) || manualSet.entryIdx < 0 || !Number.isInteger(manualSet.setIdx) || manualSet.setIdx < 0) return false
  const entry = active.entries?.[manualSet.entryIdx]
  const row = entry?.sets?.[manualSet.setIdx]
  return !!row && !row.done && entry.id === manualSet.exerciseId
}

export const useUI = create((set, get) => ({
  sheets: [],          // { id, render:(close)=>JSX, kind:'sheet'|'center', locked }
  toastMsg: '',
  timer: null,         // rest countdown between sets — { left, total, endsAt }
  work: null,          // work countdown DURING a timed set (issue #16) — { left, total, endsAt, label }
  manualSet: null,     // transient execution — { sessionId, entryIdx, setIdx, exerciseId }
  profilePreview: null,
  setProfilePreview(profilePreview) { set({ profilePreview }) },

  openSheet(render, { kind = 'sheet', locked = false } = {}) {
    const id = uid()
    set(s => ({ sheets: [...s.sheets, { id, render, kind, locked }] }))
    const close = () => get().closeSheet(id)
    return { id, close, lock: v => set(s => ({ sheets: s.sheets.map(x => x.id === id ? { ...x, locked: v } : x) })) }
  },
  closeSheet(id) { set(s => ({ sheets: s.sheets.filter(x => x.id !== id) })) },
  closeAll() { set({ sheets: [] }) },

  toast(msg) {
    set({ toastMsg: msg })
    clearTimeout(toastTm)
    toastTm = setTimeout(() => set({ toastMsg: '' }), 2200)
  },

  startManualSet(sessionId, entryIdx, setIdx) {
    const active = useStore.getState().S.active
    if (!active?.start || sessionId !== `${active.id}:${active.start}`) return false
    if (!Number.isInteger(entryIdx) || entryIdx < 0 || !Number.isInteger(setIdx) || setIdx < 0) return false
    const entry = active.entries?.[entryIdx]
    const row = entry?.sets?.[setIdx]
    if (!row || row.done) return false
    const { timer, work, manualSet } = get()
    if (timer || work?.phase === 'work' || work?.phase === 'rest' || validManualSet(manualSet, active)) return false
    if (work?.phase === 'done') get().stopWork()
    set({ manualSet: { sessionId, entryIdx, setIdx, exerciseId: entry.id } })
    return true
  },
  stopManualSet() { set({ manualSet: null }) },

  startRest(sec, onDone) {
    get().stopManualSet()
    get().stopRest(false)
    const wk = get().work
    if (wk) {
      if (!sec || sec <= 0) {
        const cb = onDone
        get().stopWork()
        if (cb) cb()
        return
      }
      workRestDone = onDone
      const endsAt = Date.now() + sec * 1000
      scheduleLocalTimer('rest', endsAt)
      set({
        work: {
          ...wk,
          phase: 'rest',
          restLeft: sec,
          restTotal: sec,
          restEndsAt: endsAt,
        },
      })
      return
    }
    if (!sec || sec <= 0) {
      if (onDone) onDone()
      return
    }
    const endsAt = Date.now() + sec * 1000
    timerDone = onDone
    set({ timer: { left: sec, total: sec, endsAt } })
    scheduleLocalTimer('rest', endsAt)
    timerTick = () => {
      const tm = get().timer
      if (!tm) return
      const left = Math.max(0, Math.ceil((tm.endsAt - Date.now()) / 1000))
      if (left === tm.left) return
      const snd = useStore.getState().S.sound
      if (left <= 0) {
        localCompletionSound('rest', snd)
        if (timerAlertsEnabled('rest')) { maybeRestNotification(); get().toast(t('Rest over — next set!')) }
        const cb = timerDone
        get().stopRest(false, true)
        if (cb) cb()
        return
      }
      if (left <= 3 && timerAlertsEnabled('rest')) beep(snd, 660, 0.1)
      set({ timer: { ...tm, left } })
    }
    timerInt = setInterval(timerTick, 1000)
    document.addEventListener('visibilitychange', timerTick)
  },
  addRest(sec) {
    const tm = get().timer
    if (!tm) return
    const left = tm.left + sec
    // taking off more than is left means "I'm ready now" — same as skipping, and it keeps a
    // negative duration out of the progress bar
    if (left <= 0) { get().stopRest(true); return }
    set({ timer: { ...tm, left, total: tm.total + sec, endsAt: tm.endsAt + sec * 1000 } })
    scheduleLocalTimer('rest', tm.endsAt + sec * 1000, false)
  },
  stopRest(triggerCb = true, completed = false) {
    // A natural finish leaves the successful OS alert in charge, even in the foreground.
    // Explicit cleanup also removes delayed alarms after the UI timer has already ended.
    if (MOBILE && !completed) void cancelNativeTimer('rest')
    if (timerInt) clearInterval(timerInt); timerInt = null
    if (timerTick) document.removeEventListener('visibilitychange', timerTick); timerTick = null
    const cb = triggerCb ? timerDone : null
    timerDone = null
    set({ timer: null })
    if (cb) cb()
  },

  /* ---- work timer (issue #16) ----
     Times the set itself inside the workout overlay; rest after a timed hold stays in the
     same overlay so the animation stays visible above the clock. */
  startWork(sec, label, onDone, opts = {}) {
    if (get().manualSet && !validManualSet(get().manualSet, useStore.getState().S.active)) get().stopManualSet()
    get().stopWork()
    get().stopRest()
    const total = Math.max(1, Math.round(sec) || 1)
    const endsAt = Date.now() + total * 1000
    scheduleLocalTimer('timed_set', endsAt)
    workDone = onDone
    workRestDone = null
    set({
      work: {
        left: total,
        total,
        endsAt,
        label,
        phase: 'work',
        entryIdx: opts.entryIdx,
        setIdx: opts.setIdx,
        isLastSet: opts.isLastSet,
        onNext: opts.onNext,
      },
    })
    const tick = () => {
      const wk = get().work
      if (!wk) return
      const snd = useStore.getState().S.sound
      if (wk.phase === 'rest') {
        const left = Math.max(0, Math.ceil((wk.restEndsAt - Date.now()) / 1000))
        if (left === wk.restLeft) return
        if (left <= 0) {
          localCompletionSound('rest', snd)
          if (timerAlertsEnabled('rest')) { maybeRestNotification(); get().toast(t('Rest over — next set!')) }
          const cb = workRestDone
          workRestDone = null
          get().stopWork(true)
          if (cb) cb()
          return
        }
        if (left <= 3 && timerAlertsEnabled('rest')) beep(snd, 660, 0.1)
        set({ work: { ...wk, restLeft: left } })
        return
      }
      if (wk.phase === 'done') return
      const left = Math.max(0, Math.ceil((wk.endsAt - Date.now()) / 1000))
      if (left === wk.left) return
      if (left <= 0) {
        localCompletionSound('timed_set', snd)
        if (timerAlertsEnabled('timed_set')) maybeRestNotification('timed_set')
        const done = workDone
        workDone = null
        // Transition to 'done' phase — overlay stays open, user chooses next action
        set({ work: { ...wk, phase: 'done', left: 0 } })
        if (done) done(wk.total)
        return
      }
      if (left <= 3 && timerAlertsEnabled('timed_set')) beep(snd, 660, 0.1)
      set({ work: { ...wk, left } })
    }
    workTick = tick
    workInt = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
  },
  finishWorkEarly() {
    const wk = get().work
    if (!wk || wk.phase !== 'work') return
    if (MOBILE) void cancelNativeTimer('timed_set')
    const elapsed = Math.max(1, wk.total - wk.left)
    const done = workDone
    workDone = null
    vibrate(30)
    set({ work: { ...wk, phase: 'done', left: 0 } })
    if (done) done(elapsed)
  },
  skipWorkRest() {
    const wk = get().work
    if (!wk || wk.phase !== 'rest') return
    const cb = workRestDone
    workRestDone = null
    get().stopWork()
    if (cb) cb()
  },
  stopWork(completed = false) {
    if (MOBILE && !completed) {
      void cancelNativeTimer('timed_set')
      void cancelNativeTimer('rest')
    }
    if (workInt) clearInterval(workInt); workInt = null
    if (workTick) document.removeEventListener('visibilitychange', workTick); workTick = null
    workDone = null
    workRestDone = null
    set({ work: null })
  }
}))
