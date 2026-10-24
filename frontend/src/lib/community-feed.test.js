import { describe, expect, it, vi } from 'vitest'
import { createCommunityFeedStore } from './community-feed.js'

const post = (id, author = 'alice') => ({ id, author_id: author, created_at: `2026-10-23T12:00:00Z`, likes: [], comments: [] })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const clientFor = handler => ({ from: () => {
  const query = { filters: [], select: vi.fn(() => query), eq: vi.fn((...args) => { query.filters.push(args); return query }), order: vi.fn(() => query), limit: vi.fn(() => query), or: vi.fn(() => query), then: (ok, fail) => handler(query).then(ok, fail) }
  return query
} })
describe('community feed sessions', () => {
  it('isolates profile results from a delayed feed and preserves cached feed order/scroll', async () => {
    const pending = deferred()
    const client = clientFor(q => q.filters.length ? Promise.resolve({ data: [post('b', 'bob'), post('wrong')] }) : pending.promise)
    const store = createCommunityFeedStore(client)
    const loading = store.load('feed')
    await store.load('bob')
    expect(store.snapshot('bob').posts.map(p => p.id)).toEqual(['b'])
    pending.resolve({ data: [post('a')] }); await loading
    store.saveScroll('feed', 640)
    expect(store.snapshot('bob').posts.map(p => p.id)).toEqual(['b'])
    expect(store.snapshot('feed').scrollY).toBe(640)
    expect(store.snapshot('feed').posts.map(p => p.id)).toEqual(['a'])
  })
  it('does not overwrite a new like or resurrect a deletion when an old read completes', async () => {
    let next = Promise.resolve({ data: [post('a'), post('b')] })
    const store = createCommunityFeedStore(clientFor(() => next))
    await store.load('feed')
    const pending = deferred(); next = pending.promise
    const loading = store.load('feed', true)
    store.updatePost('a', p => ({ ...p, likes: [{ user_id: 'me' }] }))
    store.removePost('b')
    pending.resolve({ data: [post('a'), post('b')] }); await loading
    expect(store.snapshot('feed').posts).toHaveLength(1)
    expect(store.snapshot('feed').posts[0].likes).toEqual([{ user_id: 'me' }])
  })
  it('keeps posts and permits retry after a network error', async () => {
    let fail = false
    const store = createCommunityFeedStore(clientFor(async () => { if (fail) throw Error('offline'); return { data: [post('a')] } }))
    await store.load('feed'); fail = true; await store.load('feed', true)
    expect(store.snapshot('feed').posts).toHaveLength(1)
    expect(store.snapshot('feed').loading).toBe(false)
    expect(store.snapshot('feed').error).toBeTruthy()
    fail = false; await store.load('feed', true)
    expect(store.snapshot('feed').error).toBe('')
  })
  it('appends subsequent pages without reordering what was already visible', async () => {
    let count = 0
    const first = Array.from({ length: 20 }, (_, i) => post(`p${i}`))
    const store = createCommunityFeedStore(clientFor(async () => ({ data: count++ ? [post('older')] : first })))
    await store.load('feed'); const order = store.snapshot('feed').posts.map(p => p.id)
    await store.load('feed')
    expect(store.snapshot('feed').posts.map(p => p.id)).toEqual([...order, 'older'])
    expect(store.snapshot('feed').hasMore).toBe(false)
  })
})
