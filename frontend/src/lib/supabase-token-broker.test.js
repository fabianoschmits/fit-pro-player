// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseTokenBroker } from './supabase-token-broker.js'

const jwtWithExpiry = exp => `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ exp })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.signature`

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('Supabase token broker', () => {
  it('reuses a healthy in-memory bearer before its renewal window', async () => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const accessToken = jwtWithExpiry((now + 300_000) / 1_000)
    const requestBootstrap = vi.fn().mockResolvedValue({ access_token: accessToken })
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    await expect(broker.getAccessToken()).resolves.toBe(accessToken)
    await expect(broker.getAccessToken()).resolves.toBe(accessToken)

    expect(requestBootstrap).toHaveBeenCalledTimes(1)
  })

  it('forgets its in-memory bearer when cleared', async () => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const firstToken = jwtWithExpiry((now + 300_000) / 1_000)
    const secondToken = jwtWithExpiry((now + 600_000) / 1_000)
    const requestBootstrap = vi.fn()
      .mockResolvedValueOnce({ access_token: firstToken })
      .mockResolvedValueOnce({ access_token: secondToken })
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    await broker.getAccessToken()
    broker.clear()

    await expect(broker.getAccessToken()).resolves.toBe(secondToken)
    expect(requestBootstrap).toHaveBeenCalledTimes(2)
  })

  it('shares one bootstrap request among ten simultaneous callers', async () => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const accessToken = jwtWithExpiry((now + 300_000) / 1_000)
    let resolveBootstrap
    const requestBootstrap = vi.fn(() => new Promise(resolve => { resolveBootstrap = resolve }))
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    const callers = Array.from({ length: 10 }, () => broker.getAccessToken())

    expect(requestBootstrap).toHaveBeenCalledTimes(1)
    resolveBootstrap({ access_token: accessToken })
    await expect(Promise.all(callers)).resolves.toEqual(Array(10).fill(accessToken))
  })

  it('does not reinstall a bearer returned by a bootstrap cleared in flight', async () => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const staleToken = jwtWithExpiry((now + 300_000) / 1_000)
    const freshToken = jwtWithExpiry((now + 600_000) / 1_000)
    const resolveBootstraps = []
    const requestBootstrap = vi.fn(() => new Promise(resolve => { resolveBootstraps.push(resolve) }))
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    const staleRequest = broker.getAccessToken()
    broker.clear()
    const freshRequest = broker.getAccessToken()

    expect(requestBootstrap).toHaveBeenCalledTimes(2)
    resolveBootstraps[1]({ access_token: freshToken })
    await expect(freshRequest).resolves.toBe(freshToken)
    resolveBootstraps[0]({ access_token: staleToken })
    await expect(staleRequest).resolves.toBe(staleToken)
    await expect(broker.getAccessToken()).resolves.toBe(freshToken)
    expect(requestBootstrap).toHaveBeenCalledTimes(2)
  })

  it('renews a five-minute bearer at the final thirty-second boundary', async () => {
    let now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const firstToken = jwtWithExpiry((now + 300_000) / 1_000)
    const secondToken = jwtWithExpiry((now + 600_000) / 1_000)
    const requestBootstrap = vi.fn()
      .mockResolvedValueOnce({ access_token: firstToken })
      .mockResolvedValueOnce({ access_token: secondToken })
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    await broker.getAccessToken()
    now += 270_000

    await expect(broker.getAccessToken()).resolves.toBe(secondToken)
    expect(requestBootstrap).toHaveBeenCalledTimes(2)
  })

  it.each([401, 403])('clears a cached bearer after bootstrap responds with %i', async status => {
    let now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const firstToken = jwtWithExpiry((now + 300_000) / 1_000)
    const freshToken = jwtWithExpiry((now + 600_000) / 1_000)
    const denied = Object.assign(new Error('not signed in'), { status })
    const requestBootstrap = vi.fn()
      .mockResolvedValueOnce({ access_token: firstToken })
      .mockRejectedValueOnce(denied)
      .mockResolvedValueOnce({ access_token: freshToken })
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    await broker.getAccessToken()
    now += 270_000
    await expect(broker.getAccessToken()).rejects.toBe(denied)
    now -= 270_000

    await expect(broker.getAccessToken()).resolves.toBe(freshToken)
    expect(requestBootstrap).toHaveBeenCalledTimes(3)
  })

  it.each([401, 403])('ignores a stale %i after a newer generation installed a token', async status => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const staleToken = jwtWithExpiry((now + 300_000) / 1_000)
    const freshToken = jwtWithExpiry((now + 600_000) / 1_000)
    const denied = Object.assign(new Error('not signed in'), { status })
    const resolveBootstraps = []
    const requestBootstrap = vi.fn(() => new Promise((resolve, reject) => { resolveBootstraps.push({ resolve, reject }) }))
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    const staleRequest = broker.getAccessToken()
    broker.clear()
    const freshRequest = broker.getAccessToken()
    resolveBootstraps[1].resolve({ access_token: freshToken })
    await expect(freshRequest).resolves.toBe(freshToken)
    resolveBootstraps[0].reject(denied)
    await expect(staleRequest).rejects.toBe(denied)

    await expect(broker.getAccessToken()).resolves.toBe(freshToken)
    expect(requestBootstrap).toHaveBeenCalledTimes(2)
    expect(staleToken).not.toBe(freshToken)
  })

  it.each([401, 403])('does not let a stale %i clear a newer request in flight', async status => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const freshToken = jwtWithExpiry((now + 600_000) / 1_000)
    const denied = Object.assign(new Error('not signed in'), { status })
    const resolveBootstraps = []
    const requestBootstrap = vi.fn(() => new Promise((resolve, reject) => { resolveBootstraps.push({ resolve, reject }) }))
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    const staleRequest = broker.getAccessToken()
    broker.clear()
    const freshRequest = broker.getAccessToken()
    resolveBootstraps[0].reject(denied)
    await expect(staleRequest).rejects.toBe(denied)
    resolveBootstraps[1].resolve({ access_token: freshToken })
    await expect(freshRequest).resolves.toBe(freshToken)

    await expect(broker.getAccessToken()).resolves.toBe(freshToken)
    expect(requestBootstrap).toHaveBeenCalledTimes(2)
  })

  it('rejects a bootstrap response with no access token', async () => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const accessToken = jwtWithExpiry((now + 300_000) / 1_000)
    const requestBootstrap = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ access_token: accessToken })
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    await expect(broker.getAccessToken()).rejects.toThrow('Invalid Supabase access token')
    await expect(broker.getAccessToken()).resolves.toBe(accessToken)
    expect(requestBootstrap).toHaveBeenCalledTimes(2)
  })

  it.each(['', 42])('rejects a bootstrap response with an %s access token', async invalidToken => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const accessToken = jwtWithExpiry((now + 300_000) / 1_000)
    const requestBootstrap = vi.fn()
      .mockResolvedValueOnce({ access_token: invalidToken })
      .mockResolvedValueOnce({ access_token: accessToken })
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    await expect(broker.getAccessToken()).rejects.toThrow('Invalid Supabase access token')
    await expect(broker.getAccessToken()).resolves.toBe(accessToken)
    expect(requestBootstrap).toHaveBeenCalledTimes(2)
  })

  it('releases a failed bootstrap for a later caller', async () => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const accessToken = jwtWithExpiry((now + 300_000) / 1_000)
    const requestBootstrap = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ access_token: accessToken })
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    await expect(broker.getAccessToken()).rejects.toThrow('network unavailable')
    await expect(broker.getAccessToken()).resolves.toBe(accessToken)

    expect(requestBootstrap).toHaveBeenCalledTimes(2)
  })

  it.each(['eyJhbGciOiJFUzI1NiJ9.e30.signature', 'not-a-jwt'])('renews a bearer with %s because it has no usable expiry', async accessToken => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const renewedToken = jwtWithExpiry((now + 300_000) / 1_000)
    const requestBootstrap = vi.fn()
      .mockResolvedValueOnce({ access_token: accessToken })
      .mockResolvedValueOnce({ access_token: renewedToken })
    const broker = createSupabaseTokenBroker({ requestBootstrap, clock: () => now })

    await expect(broker.getAccessToken()).resolves.toBe(accessToken)
    await expect(broker.getAccessToken()).resolves.toBe(renewedToken)

    expect(requestBootstrap).toHaveBeenCalledTimes(2)
  })

  it('keeps the bearer out of browser storage and existing workout state', async () => {
    const now = Date.UTC(2026, 8, 22, 12, 0, 0)
    const accessToken = jwtWithExpiry((now + 300_000) / 1_000)
    localStorage.setItem('gym_state_v1', JSON.stringify({ workouts: [{ id: 'workout-1' }] }))
    const broker = createSupabaseTokenBroker({
      requestBootstrap: vi.fn().mockResolvedValue({ access_token: accessToken }),
      clock: () => now,
    })

    await broker.getAccessToken()

    expect(localStorage).toHaveLength(1)
    expect(localStorage.getItem('gym_state_v1')).toBe(JSON.stringify({ workouts: [{ id: 'workout-1' }] }))
    expect(sessionStorage).toHaveLength(0)
    expect([...Array(localStorage.length)].map((_, index) => localStorage.getItem(localStorage.key(index))).join('')).not.toContain(accessToken)
  })
})
