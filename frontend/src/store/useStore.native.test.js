// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), clear: vi.fn() }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: true, nativeLoad: native.load, nativeSave: native.save, nativeClear: native.clear, clearLegacyReminders: vi.fn() }))
let useStore, DEF
beforeEach(async () => {
  vi.resetModules(); localStorage.clear(); native.load.mockReset(); native.save.mockReset(); native.clear.mockReset()
  native.save.mockResolvedValue(true); native.clear.mockResolvedValue(true)
  ;({ useStore, DEF } = await import('./useStore.js'))
})

describe('native recovery lifecycle', () => {
  it('preserves recovered account edits when WebView sync metadata was evicted', async () => {
    const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    native.load.mockResolvedValue({ ...DEF, profile: { ...DEF.profile, name: 'recovered edits' }, _ts: 20 })
    await useStore.getState().activateLocalScope(userId)
    const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:userId,revision:4,state_schema_version:1,payload:{...DEF,_ts:10}}})})})}),rpc:vi.fn()}
    await useStore.getState().syncAccount(client)
    expect(useStore.getState().S.profile.name).toBe('Recovered Edits')
    expect(useStore.getState().accountSync.state).toBe('CONFLICT')
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('flushes a pending mirror before switching account scope', async () => {
    native.load.mockResolvedValue(null)
    await useStore.getState().boot()
    native.save.mockClear()
    useStore.getState().update(s => { s.profile.name = 'before switch' })
    await useStore.getState().activateLocalScope('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(native.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'anonymous' }), expect.objectContaining({ profile: expect.objectContaining({ name: 'before switch' }) }))
  })
  it('uses the newest local copy instead of an older native mirror', async () => {
    localStorage.setItem('gym_state_v1', JSON.stringify({ ...DEF, profile: { ...DEF.profile, name: 'newer' }, _ts: 20 }))
    native.load.mockResolvedValue({ ...DEF, profile: { ...DEF.profile, name: 'older' }, _ts: 10 })
    await useStore.getState().boot()
    expect(useStore.getState().S.profile.name).toBe('Newer')
    expect(native.load).toHaveBeenCalledTimes(1)
  })

  it('recovers a newer native copy and repairs the local mirror', async () => {
    localStorage.setItem('gym_state_v1', JSON.stringify({ ...DEF, _ts: 10 }))
    native.load.mockResolvedValue({ ...DEF, profile: { ...DEF.profile, name: 'recovered' }, _ts: 20 })
    await useStore.getState().boot()
    expect(useStore.getState().S.profile.name).toBe('Recovered')
    expect(JSON.parse(localStorage.getItem('gym_state_v1'))._ts).toBe(20)
  })

  it('discards a native restore started before a device reset', async () => {
    let finish
    native.load.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const boot = useStore.getState().boot()
    useStore.getState().clearAnonymousState()
    finish({ ...DEF, profile: { ...DEF.profile, name: 'deleted' }, _ts: 30 })
    await boot
    expect(useStore.getState().S.profile.name).not.toBe('Deleted')
    expect(native.clear).toHaveBeenCalledWith(expect.objectContaining({ kind: 'anonymous' }), expect.objectContaining({ workouts: [], _ts: expect.any(Number) }))
  })
})
