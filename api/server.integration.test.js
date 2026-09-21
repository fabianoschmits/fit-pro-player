import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

const listenPort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    server.close(error => error ? reject(error) : resolve(port))
  })
})

const waitForHealth = async base => {
  let lastError
  // Importing WebAuthn/web-push can take a few seconds on a cold or busy CI
  // runner. Poll readiness instead of relying on a startup-sized fixed delay.
  for (let attempt = 0; attempt < 300; attempt++) {
    try {
      const response = await fetch(base + '/api/health')
      if (response.ok) return
    } catch (error) { lastError = error }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw lastError || new Error('API did not start')
}

test('API rejects malformed bodies and prevents stale or divergent state writes', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitproplayer-api-'))
  const secret = crypto.randomBytes(32).toString('hex')
  const user = { id: 'qa-user', name: 'QA', sv: 0 }
  fs.writeFileSync(path.join(dataDir, 'secret'), secret)
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users: [user], creds: [], subs: [], invites: [] }))

  const port = await listenPort()
  const base = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), ORIGIN: base, RP_ID: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk })
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill()
      await once(child, 'exit')
    }
    fs.rmSync(dataDir, { recursive: true, force: true })
  })
  try { await waitForHealth(base) }
  catch (error) { throw new Error(`API did not start: ${error.message}\n${stderr}`) }

  const payload = `${user.id}:${Date.now() + 60_000}:0`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const authHeaders = { 'Content-Type': 'application/json', Cookie: `gymsid=${payload}.${signature}` }
  const request = (pathname, body, headers = authHeaders) => fetch(base + pathname, { method: 'POST', headers, body })
  const put = state => fetch(base + '/api/data', { method: 'PUT', headers: authHeaders, body: JSON.stringify({ state }) })

  const malformed = await request('/api/register/options', '{')
  assert.equal(malformed.status, 400)
  assert.equal((await malformed.json()).error, 'bad json')

  const primitive = await request('/api/register/options', 'null')
  assert.equal(primitive.status, 400)
  assert.equal((await primitive.json()).error, 'json object required')

  const tooLarge = await request('/api/register/options', JSON.stringify({ value: 'x'.repeat(5 * 1024 * 1024) }))
  assert.equal(tooLarge.status, 413)

  assert.equal((await put({ _ts: 200, value: 'newest', active: { entries: [] } })).status, 200)
  assert.equal((await put({ _ts: 199, value: 'stale' })).status, 409)
  assert.equal((await put({ _ts: 200, value: 'different' })).status, 409)
  assert.equal((await put({ _ts: 200, value: 'newest', active: { entries: [] } })).status, 200)

  const raced = await Promise.all([
    put({ _ts: 201, value: 'alpha' }),
    put({ _ts: 201, value: 'beta' }),
  ])
  assert.deepEqual(raced.map(response => response.status).sort(), [200, 409])

  const savedResponse = await fetch(base + '/api/data', { headers: authHeaders })
  assert.equal(savedResponse.status, 200)
  const { state } = await savedResponse.json()
  assert.equal(state._ts, 201)
  assert.ok(state.value === 'alpha' || state.value === 'beta')
  assert.equal('active' in state, false)
  assert.equal(stderr, '')
})
