import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createSessionRecovery,
  hasPendingSessionCompletion,
  readSessionRecoveryDraft,
  sessionRecoveryKey,
} from './session-recovery.js'

const accountA = '11111111-1111-4111-8111-111111111111'
const accountB = '22222222-2222-4222-8222-222222222222'
const activeSession = (overrides = {}) => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  accountId: accountA,
  routineId: null,
  assignmentId: null,
  status: 'active',
  revision: 1,
  writerToken: 'writer-1',
  massUnit: 'kg',
  prescriptionSnapshot: { exercises: [] },
  startedAt: '2026-10-19T12:00:00Z',
  completedAt: null,
  updatedAt: '2026-10-19T12:00:00Z',
  ...overrides,
})

const operation = (overrides = {}) => ({
  operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  kind: 'set_upserted',
  payload: { entryIndex: 0, setIndex: 0, set: { w: 40, r: 10, done: true }, massUnit: 'kg' },
  ...overrides,
})

function memoryStorage() {
  const values = new Map()
  return {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn(key => values.delete(key)),
    values,
  }
}

function repository(overrides = {}) {
  return {
    startSession: vi.fn(async () => activeSession()),
    appendOperation: vi.fn(async ({ expectedRevision }) => activeSession({ revision: expectedRevision + 1 })),
    completeSession: vi.fn(async ({ expectedRevision }) => activeSession({ status: 'completed', revision: expectedRevision + 1, completedAt: '2026-10-19T13:00:00Z' })),
    takeOverSession: vi.fn(async ({ expectedRevision }) => activeSession({ revision: expectedRevision + 1, writerToken: 'writer-2' })),
    loadActiveSession: vi.fn(async () => activeSession()),
    ...overrides,
  }
}

describe('active session recovery', () => {
  let storage
  beforeEach(() => { storage = memoryStorage() })

  it('isolates drafts by account and rejects a foreign payload stored under an account key', () => {
    const draft = { schemaVersion: 1, accountId: accountA, phase: 'active', session: activeSession(), pendingOperations: [], updatedAt: 1 }
    storage.setItem(sessionRecoveryKey(accountA), JSON.stringify(draft))
    storage.setItem(sessionRecoveryKey(accountB), JSON.stringify(draft))

    expect(readSessionRecoveryDraft({ accountId: accountA, storage })).toMatchObject({ accountId: accountA })
    expect(readSessionRecoveryDraft({ accountId: accountB, storage })).toBeNull()
    expect(storage.getItem(sessionRecoveryKey(accountB))).toBeNull()
  })

  it('removes corrupt drafts instead of exposing or replaying them', () => {
    storage.setItem(sessionRecoveryKey(accountA), '{bad json')
    expect(readSessionRecoveryDraft({ accountId: accountA, storage })).toBeNull()
    expect(storage.getItem(sessionRecoveryKey(accountA))).toBeNull()
  })

  it('persists an operation before dispatch and removes it only after the response', async () => {
    let resolveRequest
    const pending = new Promise(resolve => { resolveRequest = resolve })
    const repo = repository({ appendOperation: vi.fn(() => pending) })
    const recovery = createSessionRecovery({ repository: repo, accountId: accountA, storage })
    recovery.adopt(activeSession())

    const request = recovery.enqueue(operation())
    expect(readSessionRecoveryDraft({ accountId: accountA, storage }).pendingOperations).toHaveLength(1)
    expect(repo.appendOperation).toHaveBeenCalledWith(expect.objectContaining({
      operationId: operation().operationId,
      expectedRevision: 1,
      writerToken: 'writer-1',
    }))

    resolveRequest(activeSession({ revision: 2 }))
    await expect(request).resolves.toMatchObject({ state: 'saved' })
    expect(readSessionRecoveryDraft({ accountId: accountA, storage }).pendingOperations).toHaveLength(0)
  })

  it('replays the same operation id after an offline response without duplicating it', async () => {
    const repo = repository({ appendOperation: vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { kind: 'offline', retryable: true }))
      .mockResolvedValueOnce(activeSession({ revision: 2 })) })
    const recovery = createSessionRecovery({ repository: repo, accountId: accountA, storage })
    recovery.adopt(activeSession())

    await expect(recovery.enqueue(operation())).resolves.toMatchObject({ state: 'waiting' })
    expect(readSessionRecoveryDraft({ accountId: accountA, storage }).pendingOperations).toHaveLength(1)
    await expect(recovery.flush()).resolves.toMatchObject({ state: 'saved' })
    expect(repo.appendOperation.mock.calls.map(([value]) => value.operationId)).toEqual([operation().operationId, operation().operationId])
  })

  it('recovers a lost completion response as the same completed session', async () => {
    const completion = operation({ operationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', kind: 'session_completed', payload: { durationMs: 3_600_000, massUnit: 'kg' } })
    const repo = repository({ completeSession: vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('network response lost'), { kind: 'offline', retryable: true }))
      .mockResolvedValueOnce(activeSession({ status: 'completed', revision: 2, completedAt: '2026-10-19T13:00:00Z' })) })
    const recovery = createSessionRecovery({ repository: repo, accountId: accountA, storage })
    recovery.adopt(activeSession())

    await expect(recovery.complete(completion)).resolves.toMatchObject({ state: 'waiting' })
    expect(hasPendingSessionCompletion(readSessionRecoveryDraft({ accountId: accountA, storage }))).toBe(true)
    await expect(recovery.flush()).resolves.toMatchObject({ state: 'saved', completed: true })
    expect(repo.completeSession.mock.calls.map(([value]) => value.operationId)).toEqual([completion.operationId, completion.operationId])
    expect(readSessionRecoveryDraft({ accountId: accountA, storage })).toBeNull()
  })

  it('finalizes a discarded session on the server before allowing a new start', async () => {
    const abandoned = activeSession({ status: 'abandoned', revision: 2, completedAt: '2026-10-19T12:10:00Z' })
    const repo = repository({ abandonSession: vi.fn(async () => abandoned) })
    const recovery = createSessionRecovery({ repository: repo, accountId: accountA, storage })
    recovery.adopt(activeSession())

    const request = recovery.abandon(operation({ kind: 'session_abandoned', payload: { reason: 'discarded' } }))
    expect(readSessionRecoveryDraft({ accountId: accountA, storage })).toMatchObject({ phase: 'abandoning' })
    await expect(request).resolves.toMatchObject({ state: 'saved', abandoned: true })
    expect(repo.abandonSession).toHaveBeenCalledWith(expect.objectContaining({ operationId: operation().operationId }))
    expect(readSessionRecoveryDraft({ accountId: accountA, storage })).toBeNull()
  })

  it('keeps the queue and asks for sign-in again when authentication expires', async () => {
    const repo = repository({ appendOperation: vi.fn().mockRejectedValue(Object.assign(new Error('JWT expired'), { kind: 'forbidden' })) })
    const recovery = createSessionRecovery({ repository: repo, accountId: accountA, storage })
    recovery.adopt(activeSession())

    await expect(recovery.enqueue(operation())).resolves.toMatchObject({ state: 'auth-required' })
    expect(readSessionRecoveryDraft({ accountId: accountA, storage }).pendingOperations).toHaveLength(1)
  })

  it('keeps a stale writer queued until takeover and then replays it with the new token', async () => {
    const repo = repository({ appendOperation: vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('stale writer'), { kind: 'stale-writer' }))
      .mockResolvedValueOnce(activeSession({ revision: 4, writerToken: 'writer-2' })),
      loadActiveSession: vi.fn(async () => activeSession({ revision: 2, writerToken: 'other-writer' })),
      takeOverSession: vi.fn(async () => activeSession({ revision: 3, writerToken: 'writer-2' })),
    })
    const recovery = createSessionRecovery({ repository: repo, accountId: accountA, storage })
    recovery.adopt(activeSession())

    await expect(recovery.enqueue(operation())).resolves.toMatchObject({ state: 'takeover-required' })
    await expect(recovery.takeOver()).resolves.toMatchObject({ state: 'saved' })
    expect(repo.loadActiveSession).toHaveBeenCalledOnce()
    expect(repo.takeOverSession).toHaveBeenCalledWith({ sessionId: activeSession().id, expectedRevision: 2 })
    expect(repo.appendOperation.mock.calls[1][0]).toMatchObject({ writerToken: 'writer-2', expectedRevision: 3 })
  })

  it('persists the start intent before calling the server and blocks another start while completion is pending', async () => {
    let inspected
    const repo = repository({ startSession: vi.fn(async () => {
      inspected = readSessionRecoveryDraft({ accountId: accountA, storage })
      return activeSession()
    }) })
    const recovery = createSessionRecovery({ repository: repo, accountId: accountA, storage })
    await recovery.start({ sessionId: activeSession().id, prescriptionSnapshot: { exercises: [] } })
    expect(inspected).toMatchObject({ phase: 'starting', session: { id: activeSession().id, massUnit: 'kg' } })

    storage.setItem(sessionRecoveryKey(accountA), JSON.stringify({
      schemaVersion: 1, accountId: accountA, phase: 'completing', session: activeSession(),
      pendingOperations: [operation({ kind: 'session_completed' })], updatedAt: 2,
    }))
    const second = createSessionRecovery({ repository: repo, accountId: accountA, storage })
    await expect(second.start({ sessionId: 'new-session', prescriptionSnapshot: {} })).rejects.toThrow('pending-session-completion')
  })
})
