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

  it('retries a transient failure and sends the latest snapshot', async () => {
    let state = { _ts: 1, value: 'old' }
    const sent = []
    const wait = vi.fn(async () => { state = { _ts: 2, value: 'new' } })
    const send = vi.fn(async snapshot => {
      sent.push(snapshot.value)
      if (sent.length === 1) throw Object.assign(new Error('temporary'), { status: 503 })
    })
    const markDirty = vi.fn()
    const markClean = vi.fn()
    const push = createStatePushQueue({
      getState: () => state,
      isEnabled: () => true,
      send,
      markDirty,
      markClean,
      shouldRetry: error => error.status >= 500,
      retryDelays: [250],
      wait,
    })

    await expect(push()).resolves.toBe(true)
    expect(sent).toEqual(['old', 'new'])
    expect(wait).toHaveBeenCalledWith(250)
    expect(markDirty).toHaveBeenCalledTimes(1)
    expect(markClean).toHaveBeenCalledTimes(1)
  })

  it('does not retry a conflict and exposes the error to the dirty marker', async () => {
    const conflict = Object.assign(new Error('conflict'), { status: 409 })
    const markDirty = vi.fn()
    const send = vi.fn().mockRejectedValue(conflict)
    const push = createStatePushQueue({
      getState: () => ({ _ts: 1 }),
      isEnabled: () => true,
      send,
      markDirty,
      markClean: vi.fn(),
      shouldRetry: error => error.status !== 409,
      retryDelays: [1, 2],
      wait: vi.fn(),
    })

    await expect(push()).resolves.toBe(false)
    expect(send).toHaveBeenCalledTimes(1)
    expect(markDirty).toHaveBeenCalledWith(conflict)
  })

  it('keeps changes dirty while disabled and can sync them on a later call', async () => {
    let enabled = false
    const markClean = vi.fn()
    const send = vi.fn()
    const push = createStatePushQueue({
      getState: () => ({ _ts: 1 }),
      isEnabled: () => enabled,
      send,
      markDirty: vi.fn(),
      markClean,
    })

    await expect(push()).resolves.toBe(false)
    expect(send).not.toHaveBeenCalled()
    enabled = true
    await expect(push()).resolves.toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(markClean).toHaveBeenCalledTimes(1)
  })
})
