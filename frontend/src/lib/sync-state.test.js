import { describe, expect, it, vi } from 'vitest'
import { createStatePushQueue, nextStateTimestamp } from './sync-state.js'

it('keeps state versions monotonic when two changes share a clock tick', () => {
  expect(nextStateTimestamp(100, 100)).toBe(101)
  expect(nextStateTimestamp(100, 200)).toBe(200)
})

describe('createStatePushQueue', () => {
  it('serializes uploads and sends the newest state after an in-flight change', async () => {
    let state = { _ts: 1, value: 'old' }
    let release
    const first = new Promise(resolve => { release = resolve })
    const sent = []
    const markDirty = vi.fn()
    const markClean = vi.fn()
    const send = vi.fn(async snapshot => {
      sent.push(snapshot.value)
      if (sent.length === 1) await first
    })
    const push = createStatePushQueue({ getState: () => state, isEnabled: () => true, send, markDirty, markClean })

    const pending = push()
    state = { _ts: 2, value: 'new' }
    expect(push()).toBe(pending)
    expect(send).toHaveBeenCalledTimes(1)
    release()
    await pending

    expect(sent).toEqual(['old', 'new'])
    expect(markDirty).toHaveBeenCalled()
    expect(markClean).toHaveBeenCalledTimes(1)
  })

  it('keeps the dirty marker when an upload fails', async () => {
    const markDirty = vi.fn()
    const markClean = vi.fn()
    const push = createStatePushQueue({
      getState: () => ({ _ts: 1 }),
      isEnabled: () => true,
      send: vi.fn().mockRejectedValue(new Error('offline')),
      markDirty,
      markClean
    })

    await expect(push()).resolves.toBe(false)
    expect(markDirty).toHaveBeenCalledTimes(1)
    expect(markClean).not.toHaveBeenCalled()
  })
})
