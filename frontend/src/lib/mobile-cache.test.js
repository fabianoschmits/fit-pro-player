import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLocalScope } from './local-state-scope.js'

const readFile = vi.fn()
const writeFile = vi.fn()
const cancelNotifications = vi.fn()
const scheduleNotifications = vi.fn()
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { cancel: cancelNotifications, schedule: scheduleNotifications } }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { readFile, writeFile }, Directory: { Data: 'DATA' }, Encoding: { UTF8: 'utf8' } }))

import { nativeLoad, nativeSave, nativeClear, clearLegacyReminders } from './mobile.js'

describe('Capacitor cache isolation', () => {
  it('retires old weekly alerts without requesting permission or creating replacement alarms', async () => {
    cancelNotifications.mockResolvedValue(undefined)
    await clearLegacyReminders()
    expect(cancelNotifications).toHaveBeenCalledWith({ notifications: Array.from({ length: 7 }, (_, day) => ({ id: 100 + day })) })
    expect(scheduleNotifications).not.toHaveBeenCalled()
  })
  it('clears only after a previous write finishes, preventing resurrection', async () => {
    let complete
    const scope = resolveLocalScope(null)
    writeFile.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const save = nativeSave(scope, { routines: [], workouts: [{ id: 'old', entries: [] }] })
    await vi.waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1))
    const clear = nativeClear(scope, { routines: [], workouts: [], _ts: 10 })
    expect(writeFile).toHaveBeenCalledTimes(1)
    complete({})
    await Promise.all([save, clear])
    expect(JSON.parse(writeFile.mock.calls.at(-1)[0].data)).toMatchObject({ workouts: [], _ts: 10 })
  })

  it('reports native write failure', async () => {
    writeFile.mockRejectedValueOnce(new Error('native storage unavailable'))
    expect(await nativeSave(resolveLocalScope(null), { routines: [], workouts: [] })).toBe(false)
  })
  beforeEach(() => { readFile.mockReset(); writeFile.mockReset(); readFile.mockResolvedValue({ data: '{}' }); writeFile.mockResolvedValue({}) })

  it('reads an account-specific private file', async () => {
    await nativeLoad(resolveLocalScope('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2'))
    expect(readFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'fitproplayer-account-v1-72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2.json' }))
  })

  it('writes anonymous data to the compatibility file', async () => {
    await nativeSave(resolveLocalScope(null), { workouts: [] })
    expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'fitproplayer-state.json' }))
  })
})
