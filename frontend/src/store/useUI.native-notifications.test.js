// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ controller: null, beep: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/mobile.js', async importOriginal => ({ ...await importOriginal(), MOBILE: true }))
vi.mock('../lib/sound.js', () => ({ beep: runtime.beep, vibrate: runtime.vibrate }))
vi.mock('../lib/native-timer-notifications.js', async importOriginal => ({
  ...await importOriginal(),
  scheduleNativeTimer: (...args) => runtime.controller.schedule(...args),
  cancelNativeTimer: (...args) => runtime.controller.cancel(...args),
  nativeTimerOwnsAlert: kind => runtime.controller.ownsAlert(kind),
}))

import { createNativeTimerNotifications } from '../lib/native-timer-notifications.js'
import { DEF, useStore } from './useStore.js'
import { useUI } from './useUI.js'

let native, pending, delivered
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve() }
const completionBeeps = () => runtime.beep.mock.calls.filter(([, frequency]) => frequency === 880 || frequency === 1320)
const dispatchNativeAlarms = () => {
  for (const [id, notification] of pending) if (notification.schedule.at.getTime() <= Date.now()) {
    pending.delete(id); delivered.push(notification)
  }
}

beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T12:00:00Z'))
  pending = new Map(); delivered = []
  native = {
    checkPermissions: async () => ({ display: 'granted' }),
    requestPermissions: async () => ({ display: 'granted' }),
    createChannel: async () => {},
    schedule: async ({ notifications }) => { for (const notification of notifications) pending.set(notification.id, notification) },
    cancel: async ({ notifications }) => { for (const { id } of notifications) pending.delete(id) },
  }
  runtime.controller = createNativeTimerNotifications({ localNotifications: native, platform: 'android', now: Date.now })
  useUI.getState().stopWork(); useUI.getState().stopRest(false); await flush()
  useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), sound: true } })
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  runtime.beep.mockClear(); runtime.vibrate.mockClear()
})
afterEach(async () => {
  useUI.getState().stopWork(); useUI.getState().stopRest(false); await flush()
  vi.clearAllTimers(); vi.useRealTimers()
})

describe('native workout timer integration', () => {
  it('schedules the initial rest deadline, replaces an adjustment and cancels a skip', async () => {
    const done = vi.fn(), start = Date.now()
    useUI.getState().startRest(30, done); await flush()
    expect(pending.get(2001)?.schedule.at.getTime()).toBe(start + 30000)
    useUI.getState().addRest(15); await flush()
    expect(pending.size).toBe(1)
    expect(pending.get(2001)?.schedule.at.getTime()).toBe(start + 45000)
    useUI.getState().stopRest(); await flush()
    expect(pending.size).toBe(0)
    expect(done).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(60000)
    dispatchNativeAlarms()
    expect(delivered).toEqual([])
  })

  it('leaves the natural foreground rest alert for the OS without duplicate completion audio', async () => {
    const done = vi.fn()
    useUI.getState().startRest(1, done); await flush()
    await vi.advanceTimersByTimeAsync(1000)
    expect(useUI.getState().timer).toBeNull()
    expect(done).toHaveBeenCalledOnce()
    expect(completionBeeps()).toEqual([])
    expect(runtime.vibrate).not.toHaveBeenCalled()
    expect(pending.has(2001)).toBe(true)
    dispatchNativeAlarms()
    expect(delivered.map(notification => notification.id)).toEqual([2001])
  })

  it('leaves a natural timed-set alert while the foreground overlay enters done', async () => {
    const done = vi.fn()
    useUI.getState().startWork(1, 'Plank', done); await flush()
    await vi.advanceTimersByTimeAsync(1000)
    expect(useUI.getState().work.phase).toBe('done')
    expect(done).toHaveBeenCalledWith(1)
    expect(completionBeeps()).toEqual([])
    expect(runtime.vibrate).not.toHaveBeenCalled()
    expect(pending.has(2002)).toBe(true)
    dispatchNativeAlarms()
    expect(delivered.map(notification => notification.id)).toEqual([2002])
  })

  it('preserves native rest completion inside the timed-set overlay', async () => {
    useUI.getState().startWork(1, 'Plank'); await flush()
    await vi.advanceTimersByTimeAsync(1000)
    dispatchNativeAlarms(); delivered.length = 0
    const done = vi.fn()
    useUI.getState().startRest(1, done); await flush()
    await vi.advanceTimersByTimeAsync(1000)
    expect(useUI.getState().work).toBeNull()
    expect(done).toHaveBeenCalledOnce()
    expect(pending.has(2001)).toBe(true)
    expect(completionBeeps()).toEqual([])
    dispatchNativeAlarms()
    expect(delivered.map(notification => notification.id)).toEqual([2001])
  })

  it.each(['rest', 'timed_set', 'work_rest'])('does not complete %s 499ms before its deadline on visibility change', async kind => {
    const done = vi.fn()
    if (kind === 'rest') useUI.getState().startRest(2, done)
    else {
      useUI.getState().startWork(2, 'Plank', kind === 'timed_set' ? done : undefined)
      if (kind === 'work_rest') useUI.getState().startRest(2, done)
    }
    await flush()
    await vi.advanceTimersByTimeAsync(1501)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(done).not.toHaveBeenCalled()
    if (kind === 'rest') expect(useUI.getState().timer?.left).toBe(1)
    else if (kind === 'timed_set') expect(useUI.getState().work?.phase).toBe('work')
    else expect(useUI.getState().work?.phase).toBe('rest')
    await vi.advanceTimersByTimeAsync(499)
    expect(done).toHaveBeenCalledOnce()
  })

  it('falls back to local completion audio when native scheduling fails', async () => {
    native.schedule = async () => { throw new Error('bridge failed') }
    useUI.getState().startWork(1, 'Plank'); await flush()
    await vi.advanceTimersByTimeAsync(1000)
    expect(pending.size).toBe(0)
    expect(completionBeeps().map(([, frequency]) => frequency)).toEqual([880, 880, 1320])
    expect(runtime.vibrate).toHaveBeenCalledWith([200, 100, 200])
    expect(useUI.getState().work.phase).toBe('done')
  })

  it('cancels timed-set alerts on early finish and overlay rest on skip', async () => {
    useUI.getState().startWork(30, 'Plank'); await flush()
    useUI.getState().finishWorkEarly(); await flush()
    expect(pending.has(2002)).toBe(false)
    useUI.getState().startRest(30); await flush()
    expect(pending.has(2001)).toBe(true)
    useUI.getState().skipWorkRest(); await flush()
    expect(pending.size).toBe(0)
  })

  it('cleans up delayed natural alerts on explicit end or account cleanup', async () => {
    useUI.getState().startRest(1); await flush()
    await vi.advanceTimersByTimeAsync(1000)
    useUI.getState().stopRest(false); useUI.getState().stopWork(); await flush()
    expect(pending.size).toBe(0)
    useUI.getState().startWork(1, 'Plank'); await flush()
    await vi.advanceTimersByTimeAsync(1000)
    useUI.getState().stopWork(); await flush()
    expect(pending.size).toBe(0)
  })
})
