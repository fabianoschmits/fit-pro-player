import { afterEach, describe, expect, it, vi } from 'vitest'
import * as helpers from './native-timer-notifications.js'
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

function fixture({ permission = 'granted' } = {}) {
  let now = 1000000
  const pending = new Map(), delivered = new Map(), channels = new Map(), calls = []
  const native = {
    async checkPermissions() { calls.push('checkPermissions'); return { display: permission } },
    async requestPermissions() { calls.push('requestPermissions'); return { display: permission } },
    async checkExactNotificationSetting() { calls.push('checkExactNotificationSetting'); return { exact_alarm: 'denied' } },
    async changeExactNotificationSetting() { calls.push('changeExactNotificationSetting') },
    async createChannel(channel) { channels.set(channel.id, channel) },
    async schedule({ notifications }) { for (const notification of notifications) pending.set(notification.id, notification); return { notifications } },
    async cancel({ notifications }) { for (const { id } of notifications) { pending.delete(id); delivered.delete(id) } },
  }
  const controller = helpers.createNativeTimerNotifications?.({ localNotifications: native, now: () => now, translate: value => value, platform: 'android' })
  return { native, pending, delivered, channels, calls, controller,
    advance(milliseconds) { now += milliseconds; for (const [id, notification] of pending) if (notification.schedule.at.getTime() <= now) { pending.delete(id); delivered.set(id, notification) } },
  }
}

describe('native local workout timer deadlines', () => {
  it('schedules distinct one-shot OS deadlines outside existing reminder ids', async () => {
    const f = fixture()
    expect(await f.controller?.schedule('rest', 1090000)).toBe(true)
    expect(await f.controller?.schedule('timed_set', 1045000)).toBe(true)
    expect([...f.pending.keys()]).toEqual([2001, 2002])
    expect(f.pending.get(2001)?.schedule).toEqual({ at: new Date(1090000), allowWhileIdle: true })
    expect(f.pending.get(2002)?.title).toBe('Your timed set is complete.')
    expect(f.controller?.ownsAlert('rest')).toBe(true)
    expect(f.calls).not.toContain('changeExactNotificationSetting')
  })

  it('replaces the deadline after adjustments and cancels on skip', async () => {
    const f = fixture()
    await f.controller?.schedule('rest', 1090000)
    await f.controller?.schedule('rest', 1105000, { interactive: false })
    expect(f.pending.get(2001)?.schedule.at.getTime()).toBe(1105000)
    expect(f.pending.size).toBe(1)
    const cancel = f.controller?.cancel('rest')
    expect(f.controller?.ownsAlert('rest')).toBe(false)
    expect(await cancel).toBe(true)
    expect(f.pending.size).toBe(0)
  })

  it('leaves the native OS deadline effective while browser execution is frozen', async () => {
    const f = fixture()
    await f.controller?.schedule('rest', 1090000)
    f.advance(120000)
    expect([...f.delivered.keys()]).toEqual([2001])
    expect(f.controller?.ownsAlert('rest')).toBe(true)
    await f.controller?.cancel('rest')
    expect(f.delivered.size).toBe(0)
  })

  it('does not schedule categories that are disabled or request permission for a passive refresh', async () => {
    const f = fixture({ permission: 'prompt' })
    expect(await f.controller?.schedule('rest', 1090000, { enabled: false })).toBe(false)
    expect(await f.controller?.schedule('timed_set', 1090000, { interactive: false })).toBe(false)
    expect(f.pending.size).toBe(0)
    expect(f.calls).not.toContain('requestPermissions')
  })

  it('requests display permission only for an interactive start and handles denial', async () => {
    const f = fixture({ permission: 'prompt' })
    f.native.requestPermissions = async () => { f.calls.push('requestPermissions'); return { display: 'denied' } }
    expect(await f.controller?.schedule('rest', 1090000, { interactive: true })).toBe(false)
    expect(f.calls).toContain('requestPermissions')
    expect(f.pending.size).toBe(0)
    expect(f.controller?.ownsAlert('rest')).toBe(false)
  })

  it('ignores a late permission grant after the user cancels', async () => {
    const f = fixture({ permission: 'prompt' }), permission = deferred()
    f.native.requestPermissions = () => permission.promise
    const schedule = f.controller?.schedule('rest', 1090000)
    await flush()
    expect(await f.controller?.cancel('rest')).toBe(true)
    permission.resolve({ display: 'granted' })
    expect(await schedule).toBe(false)
    expect(f.pending.size).toBe(0)
    expect(f.controller?.ownsAlert('rest')).toBe(false)
  })

  it('serializes cancellation after an in-flight native schedule', async () => {
    const f = fixture(), gate = deferred(), entered = deferred()
    const scheduleNative = f.native.schedule
    f.native.schedule = async options => { entered.resolve(); await gate.promise; return scheduleNative(options) }
    const scheduled = f.controller?.schedule('rest', 1090000)
    await entered.promise
    expect(f.controller?.ownsAlert('rest')).toBe(false)
    const canceled = f.controller?.cancel('rest')
    gate.resolve()
    expect(await scheduled).toBe(false)
    expect(await canceled).toBe(true)
    expect(f.pending.size).toBe(0)
  })

  it('keeps only the latest adjustment when an earlier native schedule resolves late', async () => {
    const f = fixture(), gate = deferred(), entered = deferred()
    const original = f.native.schedule
    let first = true
    f.native.schedule = async options => { if (first) { first = false; entered.resolve(); await gate.promise }; return original(options) }
    const earlier = f.controller?.schedule('rest', 1090000)
    await entered.promise
    const later = f.controller?.schedule('rest', 1105000, { interactive: false })
    gate.resolve()
    expect(await earlier).toBe(false)
    expect(await later).toBe(true)
    expect(f.pending.get(2001)?.schedule.at.getTime()).toBe(1105000)
    expect(f.controller?.ownsAlert('rest')).toBe(true)
  })

  it('does not resurrect expired deadlines after a slow permission response', async () => {
    const f = fixture({ permission: 'prompt' }), permission = deferred()
    f.native.requestPermissions = () => permission.promise
    const schedule = f.controller?.schedule('rest', 1001000)
    await flush(); f.advance(2000); permission.resolve({ display: 'granted' })
    expect(await schedule).toBe(false)
    expect(f.pending.size).toBe(0)
  })

  it('reports display and exact-alarm permissions without opening OS settings', async () => {
    const f = fixture()
    expect(await f.controller?.status()).toEqual({ supported: true, permission: 'granted', exactPermission: 'denied', error: null })
    expect(f.calls).not.toContain('requestPermissions')
    expect(f.calls).not.toContain('changeExactNotificationSetting')
  })

  it('keeps the existing sound choice through separate native Android channels', async () => {
    const f = fixture()
    await f.controller?.schedule('rest', 1090000, { sound: true })
    const audible = f.channels.get(f.pending.get(2001)?.channelId)
    expect(audible?.importance).toBe(4)
    await f.controller?.schedule('rest', 1090000, { sound: false })
    const silent = f.channels.get(f.pending.get(2001)?.channelId)
    expect(silent?.importance).toBe(2)
    expect(silent?.vibration).toBe(false)
    expect(silent?.id).not.toBe(audible?.id)
  })

  it('still schedules native deadlines on Android versions without channels', async () => {
    const f = fixture()
    f.native.createChannel = async () => { throw Object.assign(new Error('unavailable'), { code: 'UNAVAILABLE' }) }
    expect(await f.controller.schedule('rest', 1090000)).toBe(true)
    expect(f.pending.get(2001)?.channelId).toBeUndefined()
    expect(f.pending.get(2001)?.schedule.at.getTime()).toBe(1090000)
  })

  it('avoids a stale schedule when channel creation finishes after a cancellation', async () => {
    const f = fixture(), channel = deferred(), entered = deferred()
    f.native.createChannel = async () => { entered.resolve(); await channel.promise }
    const scheduled = f.controller.schedule('rest', 1090000)
    await entered.promise
    const canceled = f.controller.cancel('rest')
    channel.resolve()
    expect(await scheduled).toBe(false)
    expect(await canceled).toBe(true)
    expect(f.pending.size).toBe(0)
  })

  it('recovers the native operations queue after a failed deadline', async () => {
    const f = fixture(), original = f.native.schedule
    f.native.schedule = async () => { throw new Error('native failure') }
    expect(await f.controller.schedule('rest', 1090000)).toBe(false)
    f.native.schedule = original
    expect(await f.controller.schedule('rest', 1105000)).toBe(true)
    expect(f.pending.get(2001)?.schedule.at.getTime()).toBe(1105000)
  })

  it('keeps web exports inert and handles native bridge failures without ownership', async () => {
    const f = fixture()
    f.native.schedule = async () => { throw new Error('native failure') }
    expect(await f.controller?.schedule('rest', 1090000)).toBe(false)
    expect(f.controller?.ownsAlert('rest')).toBe(false)
    expect(await helpers.scheduleNativeTimer?.('rest', 1090000)).toBe(false)
    expect(await helpers.cancelNativeTimer?.('rest')).toBe(false)
    expect(helpers.nativeTimerOwnsAlert?.('rest')).toBe(false)
  })
})

describe('native build timer API', () => {
  afterEach(() => {
    vi.doUnmock('./mobile.js')
    vi.doUnmock('@capacitor/local-notifications')
    vi.doUnmock('@capacitor/core')
    vi.resetModules()
  })
  const loadNative = async native => {
    vi.resetModules()
    vi.doMock('./mobile.js', () => ({ MOBILE: true }))
    vi.doMock('@capacitor/local-notifications', () => ({ LocalNotifications: native }))
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }))
    return import('./native-timer-notifications.js')
  }

  it('exposes ownership only after a successful schedule and clears it immediately on cancel', async () => {
    const f = fixture(), api = await loadNative(f.native)
    expect(api.nativeTimerOwnsAlert('rest')).toBe(false)
    expect(await api.scheduleNativeTimer('rest', Date.now() + 90000)).toBe(true)
    expect(api.nativeTimerOwnsAlert('rest')).toBe(true)
    const canceled = api.cancelNativeTimer('rest')
    expect(api.nativeTimerOwnsAlert('rest')).toBe(false)
    expect(await canceled).toBe(true)
    expect(f.pending.size).toBe(0)
  })

  it('does not schedule after cancellation while native plugins are loading', async () => {
    const f = fixture(), loading = deferred()
    vi.resetModules()
    vi.doMock('./mobile.js', () => ({ MOBILE: true }))
    vi.doMock('@capacitor/local-notifications', async () => { await loading.promise; return { LocalNotifications: f.native } })
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }))
    const api = await import('./native-timer-notifications.js')
    const scheduled = api.scheduleNativeTimer('rest', Date.now() + 90000)
    const canceled = api.cancelNativeTimer('rest')
    loading.resolve()
    expect(await scheduled).toBe(false)
    expect(await canceled).toBe(true)
    expect(f.pending.size).toBe(0)
    expect(api.nativeTimerOwnsAlert('rest')).toBe(false)
  })
})
