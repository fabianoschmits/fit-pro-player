import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient,
}))

const accessTokenFor = serial => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1_000) + 300 })).toString('base64url')
  return `header.${payload}.token-${serial}`
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.resetModules()
})

afterEach(() => vi.unstubAllEnvs())

describe('FPP Supabase client', () => {
  it('creates a public-key client with the FPP bearer callback and no persisted Supabase session', async () => {
    const accessToken = vi.fn()
    const client = { from: vi.fn() }
    supabaseMocks.createClient.mockReturnValue(client)

    const { createFppSupabaseClient } = await import('./supabase-client.js')

    expect(createFppSupabaseClient({
      url: 'https://project.supabase.co',
      publishableKey: 'public-publishable-key',
      accessToken,
    })).toBe(client)

    expect(supabaseMocks.createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'public-publishable-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        accessToken,
      },
    )
  })

  it('returns null rather than creating a client when public configuration is incomplete', async () => {
    const { createFppSupabaseClient } = await import('./supabase-client.js')

    expect(createFppSupabaseClient({
      url: 'https://project.supabase.co',
      publishableKey: '',
      accessToken: vi.fn(),
    })).toBeNull()
    expect(supabaseMocks.createClient).not.toHaveBeenCalled()
  })

  it('creates one configured singleton and clears its broker-backed bearer state', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-publishable-key')
    const client = { from: vi.fn() }
    supabaseMocks.createClient.mockReturnValue(client)

    const { clearFppSupabaseAuth, getFppSupabaseClient } = await import('./supabase-client.js')

    expect(getFppSupabaseClient()).toBe(client)
    expect(getFppSupabaseClient()).toBe(client)
    expect(supabaseMocks.createClient).toHaveBeenCalledTimes(1)

    clearFppSupabaseAuth()
  })

  it('returns null from the singleton getter when Vite public configuration is absent', async () => {
    const { getFppSupabaseClient } = await import('./supabase-client.js')

    expect(getFppSupabaseClient()).toBeNull()
    expect(supabaseMocks.createClient).not.toHaveBeenCalled()
  })

  it('bootstraps a new bearer after a reload while the FPP cookie survives and reaches an authenticated endpoint', async () => {
    vi.doUnmock('@supabase/supabase-js')
    vi.resetModules()

    let bootstrapPosts = 0
    const emittedTokens = []
    const authorizations = []
    const server = createServer((request, response) => {
      if (request.method === 'POST' && request.url === '/login') {
        response.writeHead(204, { 'Set-Cookie': 'gymsid=authenticated-session; HttpOnly; SameSite=Lax' })
        response.end()
        return
      }

      if (request.method === 'POST' && request.url === '/api/account/supabase-token') {
        if (request.headers.cookie !== 'gymsid=authenticated-session') {
          response.writeHead(401, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ error: 'unauthorized' }))
          return
        }
        bootstrapPosts += 1
        const accessToken = accessTokenFor(bootstrapPosts)
        emittedTokens.push(accessToken)
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ access_token: accessToken }))
        return
      }

      if (request.method === 'GET' && request.url.startsWith('/rest/v1/workouts')) {
        authorizations.push(request.headers.authorization)
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify([{ id: 'workout-1' }]))
        return
      }

      response.writeHead(404)
      response.end()
    })

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    const url = `http://127.0.0.1:${port}`
    let cookie = ''
    const browserFetch = async (path, options = {}) => {
      const headers = new Headers(options.headers)
      if (cookie) headers.set('Cookie', cookie)
      const response = await fetch(`${url}${path}`, { ...options, headers })
      const setCookie = response.headers.get('set-cookie')
      if (setCookie) cookie = setCookie.split(';', 1)[0]
      return response
    }

    try {
      await browserFetch('/login', { method: 'POST' })
      expect(cookie).toBe('gymsid=authenticated-session')

      const { createSupabaseTokenBroker } = await import('./supabase-token-broker.js')
      const { createFppSupabaseClient } = await import('./supabase-client.js')
      const firstBroker = createSupabaseTokenBroker({
        requestBootstrap: () => browserFetch('/api/account/supabase-token', { method: 'POST' }).then(response => response.json()),
      })
      let firstClient = createFppSupabaseClient({
        url,
        publishableKey: 'public-publishable-key',
        accessToken: () => firstBroker.getAccessToken(),
      })

      await expect(firstClient.from('workouts').select('id')).resolves.toMatchObject({ data: [{ id: 'workout-1' }], error: null })
      expect(bootstrapPosts).toBe(1)
      expect(authorizations).toEqual(emittedTokens.slice(0, 1).map(token => `Bearer ${token}`))

      firstClient = null

      const secondBroker = createSupabaseTokenBroker({
        requestBootstrap: () => browserFetch('/api/account/supabase-token', { method: 'POST' }).then(response => response.json()),
      })
      const secondClient = createFppSupabaseClient({
        url,
        publishableKey: 'public-publishable-key',
        accessToken: () => secondBroker.getAccessToken(),
      })

      await expect(secondClient.from('workouts').select('id')).resolves.toMatchObject({ data: [{ id: 'workout-1' }], error: null })
      expect(bootstrapPosts).toBe(2)
      expect(authorizations).toEqual(emittedTokens.map(token => `Bearer ${token}`))
      expect(cookie).toBe('gymsid=authenticated-session')
    } finally {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
})
