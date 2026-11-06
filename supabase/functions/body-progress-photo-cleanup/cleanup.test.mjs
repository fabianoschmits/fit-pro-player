import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanupPhotos } from './cleanup.mjs'

const owner = '11111111-1111-4111-8111-111111111111'
const now = Date.parse('2026-11-06T12:00:00Z')
const row = (id, pending = false, age = 2 * 3600000) => ({ id, user_id: owner, storage_path: `${owner}/${id}/original.webp`, upload_pending: pending, deleting: false, updated_at: new Date(now - age).toISOString() })
function fake(initial) {
  const state = { rows: [...initial], removed: [], failRemoval: false, beforeQuery: null, afterRemoval: null }
  const db = { from() {
    let operation = 'select', values, filters = [], start = 0, end = Infinity
    const query = {
      select() { return query },
      update(next) { operation = 'update'; values = next; return query },
      delete() { operation = 'delete'; return query },
      eq(field, value) { filters.push(item => item[field] === value); return query },
      lt(field, value) { filters.push(item => item[field] < value); return query },
      in(field, list) { filters.push(item => list.includes(item[field])); return query },
      order() { return query },
      range(from, to) { start = from; end = to; return query },
      then(resolve, reject) {
        try {
          state.beforeQuery?.(operation)
          const selected = state.rows.filter(item => filters.every(predicate => predicate(item))).slice(start, end === Infinity ? undefined : end + 1)
          if (operation === 'update') selected.forEach(item => Object.assign(item, values))
          if (operation === 'delete') state.rows = state.rows.filter(item => !selected.includes(item))
          return Promise.resolve({ data: structuredClone(selected), error: null }).then(resolve, reject)
        } catch (error) { return Promise.reject(error).then(resolve, reject) }
      },
    }
    return query
  } }
  const store = {
    async remove(paths) {
      if (state.failRemoval) return { data: null, error: new Error('offline') }
      state.removed.push(...paths)
      state.afterRemoval?.()
      return { data: [], error: null }
    },
    async list() { return { data: [], error: null } },
  }
  return { state, db, store }
}

test('failure preserves retryable tombstone and retry removes metadata only after Storage succeeds', async () => {
  const photo = row('22222222-2222-4222-8222-222222222222')
  const context = fake([photo])
  context.state.failRemoval = true
  await assert.rejects(cleanupPhotos({ ...context, owner, action: 'photo', photoId: photo.id, now }))
  assert.equal(context.state.rows.length, 1)
  assert.equal(context.state.rows[0].deleting, true)
  context.state.failRemoval = false
  await cleanupPhotos({ ...context, owner, action: 'photo', photoId: photo.id, now })
  assert.equal(context.state.rows.length, 0)
  assert.deepEqual(context.state.removed, [photo.storage_path])
})

test('orphan cleanup preserves recent reservations and uploads finalized after snapshot', async () => {
  const older = row('22222222-2222-4222-8222-222222222222', true)
  const recent = row('33333333-3333-4333-8333-333333333333', true, 1000)
  const context = fake([older, recent])
  context.state.beforeQuery = operation => { if (operation === 'update') older.upload_pending = false }
  await cleanupPhotos({ ...context, owner, action: 'orphans', now })
  assert.equal(context.state.rows.length, 2)
  assert.deepEqual(context.state.removed, [])
})

test('account cleanup never deletes a concurrent newly reserved photo outside its snapshot', async () => {
  const first = row('22222222-2222-4222-8222-222222222222')
  const next = row('33333333-3333-4333-8333-333333333333', true, 1000)
  const context = fake([first])
  context.state.afterRemoval = () => { context.state.rows.push(next); context.state.afterRemoval = null }
  await cleanupPhotos({ ...context, owner, action: 'account', now })
  assert.deepEqual(context.state.rows.map(item => item.id), [next.id])
  assert.deepEqual(context.state.removed, [first.storage_path])
})

test('account cleanup removes recent unreferenced files but retains concurrent referenced uploads', async () => {
  const context = fake([])
  const concurrent = row('33333333-3333-4333-8333-333333333333', true, 1000)
  const orphanId = '44444444-4444-4444-8444-444444444444'
  context.store.list = async prefix => {
    if (prefix === owner) {
      context.state.rows.push(concurrent)
      return { data: [{ name: concurrent.id, id: null }, { name: orphanId, id: null }], error: null }
    }
    return { data: [{ name: 'original.webp', id: 'file', created_at: new Date(now - 1000).toISOString() }], error: null }
  }
  await cleanupPhotos({ ...context, owner, action: 'account', now })
  assert.deepEqual(context.state.removed, [`${owner}/${orphanId}/original.webp`])
  assert.equal(context.state.rows[0].id, concurrent.id)
})
