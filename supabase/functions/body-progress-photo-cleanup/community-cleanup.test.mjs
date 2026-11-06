import { test } from 'node:test'
import assert from 'node:assert/strict'
import { removeCommunityPost, removeAccountObjects } from './community-cleanup.mjs'

test('Storage failure preserves the post for retry; successful retry removes the file first', async () => {
  const events = []
  let fail = true
  const query = {
    select() { return this }, eq() { return this },
    maybeSingle: async () => ({ data: { image_path: 'owner/photo.jpg' } }),
    delete() { events.push('database'); return this },
    then(resolve) { resolve({ error: null }) },
  }
  const db = { from: () => query }
  const store = { remove: async paths => { events.push(paths); return { error: fail ? new Error('offline') : null } } }
  await assert.rejects(removeCommunityPost({ db, store, owner: 'owner', postId: 'post' }))
  assert.deepEqual(events, [['owner/photo.jpg']])
  fail = false
  await removeCommunityPost({ db, store, owner: 'owner', postId: 'post' })
  assert.equal(events.at(-1), 'database')
})

test('account cleanup lists all pages before removing objects, without skipping shifted pages', async () => {
  const files = Array.from({ length: 205 }, (_, i) => ({ id: String(i), name: `${i}.jpg` }))
  const removed = []
  const store = {
    list: async (prefix, { offset, limit }) => ({ data: files.slice(offset, offset + limit) }),
    remove: async paths => { removed.push(...paths); files.splice(0, paths.length); return {} },
  }
  await removeAccountObjects({ store, owner: 'owner' })
  assert.equal(removed.length, 205)
  assert.ok(removed.every(path => path.startsWith('owner/')))
})

test('foreign post paths are rejected before Storage is touched', async () => {
  const db = { from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: { image_path: 'someone-else/photo.jpg' } }) }) }
  await assert.rejects(removeCommunityPost({ db, store: { remove: () => assert.fail() }, owner: 'owner', postId: 'post' }))
})
