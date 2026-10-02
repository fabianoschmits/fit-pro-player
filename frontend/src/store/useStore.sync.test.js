// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readSyncMetadata, writeSyncMetadata } from '../lib/account-sync.js'
import { resolveLocalScope } from '../lib/local-state-scope.js'

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
let useStore, DEF
const remote = (revision, name = 'cloud') => ({ user_id: USER, revision, state_schema_version: 1, payload: { ...DEF, profile: { ...DEF.profile, name } } })
const clientWith = (read, rpc = vi.fn()) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: read }) }) }), rpc })
beforeEach(async () => { vi.resetModules(); localStorage.clear(); ({ useStore, DEF } = await import('./useStore.js')); await useStore.getState().boot({ supabaseUserId: USER }) })

describe('scoped account coordinator', () => {
  it('preserves local and remote copies when both devices changed from the base', async () => {
    writeSyncMetadata(resolveLocalScope(USER), { revision: 2, dirty: false })
    useStore.getState().update(s => { s.profile.name = 'device' })
    const client = clientWith(async () => ({ data: remote(4) }))
    await useStore.getState().syncAccount(client)
    expect(useStore.getState().S.profile.name).toBe('device')
    expect(useStore.getState().accountSync).toMatchObject({ state: 'CONFLICT', conflict: { local: { profile: { name: 'device' } }, remote: { revision: 4, payload: { profile: { name: 'cloud' } } } } })
    expect(client.rpc).not.toHaveBeenCalled()
    expect(readSyncMetadata(resolveLocalScope(USER)).revision).toBe(2)
  })

  it('sends the base revision and fetches the winning snapshot after a CAS race', async () => {
    writeSyncMetadata(resolveLocalScope(USER), { revision: 2, dirty: false })
    useStore.getState().update(s => { s.profile.name = 'device' })
    let reads = 0
    const rpc = vi.fn(async (_name, args) => { expect(args.p_expected_revision).toBe(2); return { data: [{ status: 'CONFLICT', revision: 3 }] } })
    await useStore.getState().syncAccount(clientWith(async () => ({ data: remote(++reads === 1 ? 2 : 3, reads === 1 ? 'old' : 'winner') }), rpc))
    expect(useStore.getState().S.profile.name).toBe('device')
    expect(useStore.getState().accountSync.conflict.remote.payload.profile.name).toBe('winner')
  })

  it('ignores a deferred cloud response after a local reset', async () => {
    let resolve
    const pending = useStore.getState().syncAccount(clientWith(() => new Promise(done => { resolve = done })))
    useStore.getState().clearLocalScope(USER)
    resolve({ data: remote(4) })
    await pending
    expect(useStore.getState().S.profile.name).not.toBe('cloud')
    expect(readSyncMetadata(resolveLocalScope(USER)).revision).toBe(0)
  })

  it('shows a failed local write and retains the edited state for export', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('private quota text') })
    useStore.getState().update(s => { s.profile.name = 'unsaved' })
    expect(useStore.getState().S.profile.name).toBe('unsaved')
    expect(useStore.getState().persistence).toMatchObject({ state: 'error', error: 'local-write-failed' })
    spy.mockRestore()
  })

  it('retries the dirty marker along with the state after quota recovers', async () => {
    writeSyncMetadata(resolveLocalScope(USER), { revision: 2, dirty: false })
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    useStore.getState().update(s => { s.profile.name = 'must sync' })
    spy.mockRestore()
    expect(await useStore.getState().flushPersistence()).toBe(true)
    expect(readSyncMetadata(resolveLocalScope(USER))).toEqual({ revision: 2, dirty: true })
  })

  it('restores remote state without marking it as a local edit', () => {
    useStore.getState().replaceState({ ...DEF, profile: { ...DEF.profile, name: 'cloud' } }, false)
    expect(readSyncMetadata(resolveLocalScope(USER)).dirty).toBe(false)
  })

  it('uploads edits made while an older upload was in flight using the new base', async () => {
    writeSyncMetadata(resolveLocalScope(USER), { revision: 2, dirty: false })
    useStore.getState().update(s => { s.profile.name = 'first' })
    let finish
    let calls = 0
    const rpc = vi.fn(async (_name, args) => {
      if (++calls === 1) return new Promise(resolve => { finish = resolve })
      expect(args.p_expected_revision).toBe(3)
      expect(args.p_payload.profile.name).toBe('latest')
      return { data: [{ status: 'APPLIED', revision: 4 }] }
    })
    const pending = useStore.getState().syncAccount(clientWith(async () => ({ data: remote(2) }), rpc))
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    useStore.getState().update(s => { s.profile.name = 'latest' })
    finish({ data: [{ status: 'APPLIED', revision: 3 }] })
    await pending
    expect(readSyncMetadata(resolveLocalScope(USER))).toEqual({ revision: 4, dirty: false })
  })

  it('retains both conflict backups after explicitly choosing the cloud', async () => {
    useStore.getState().update(s => { s.profile.name = 'device' })
    await useStore.getState().syncAccount(clientWith(async () => ({ data: remote(4) })))
    expect(await useStore.getState().resolveSyncConflict('cloud')).toBe(true)
    expect(useStore.getState().S.profile.name).toBe('Cloud')
    expect(useStore.getState().getSyncCopy('local').profile.name).toBe('device')
    expect(useStore.getState().getSyncCopy('cloud').profile.name).toBe('cloud')
  })
})
