import test from 'node:test'
import assert from 'node:assert/strict'

import { createOriginPolicy } from './origin-policy.js'

const allowedOrigin = 'https://app.fitpro.test'
const request = headers => ({ headers })

test('origin policy accepts only an explicitly allowed normalized web origin', () => {
  const policy = createOriginPolicy({ allowedOrigins: [allowedOrigin] })

  assert.equal(policy.check(request({ origin: 'https://APP.fitpro.test' })), true)
  assert.equal(policy.check(request({ referer: 'https://app.fitpro.test/account?bootstrap=1' })), true)
  assert.equal(policy.check(request({ origin: 'https://app.fitpro.test.evil.test' })), false)
  assert.equal(policy.check(request({ origin: 'null' })), false)
  assert.equal(policy.check(request({ origin: 'https://app.fitpro.test/a/..' })), false)
  assert.equal(policy.check(request({ origin: 'https://app.fitpro.test/%2e%2e' })), false)
})

test('origin policy rejects malformed referers and web requests without an origin signal', () => {
  const policy = createOriginPolicy({ allowedOrigins: [allowedOrigin] })

  assert.equal(policy.check(request({ referer: 'not a URL' })), false)
  assert.equal(policy.check(request({ referer: 'https://app.fitpro.test.evil.test/path' })), false)
  assert.equal(policy.check(request({ origin: 'null', referer: 'https://app.fitpro.test/account' })), false)
  assert.equal(policy.check(request({})), false)
})

test('origin policy keeps Capacitor origins denied until explicitly configured', () => {
  const unconfigured = createOriginPolicy({ allowedOrigins: [allowedOrigin] })
  const configured = createOriginPolicy({
    allowedOrigins: [allowedOrigin],
    nativeOrigins: ['capacitor://localhost'],
  })

  assert.equal(unconfigured.check(request({ origin: 'capacitor://localhost' })), false)
  assert.equal(configured.check(request({ origin: 'capacitor://localhost' })), true)
  assert.equal(configured.check(request({ origin: 'capacitor://localhost.evil.test' })), false)
})

test('origin policy rejects raw backslash path syntax without weakening Referer extraction', () => {
  const policy = createOriginPolicy({ allowedOrigins: [allowedOrigin] })

  for (const origin of [
    String.raw`https://app.fitpro.test\a\..`,
    String.raw`https://app.fitpro.test\..`,
    String.raw`https://app.fitpro.test\path`,
  ]) {
    assert.equal(policy.check(request({ origin })), false, origin)
  }
  assert.equal(policy.check(request({ referer: 'https://app.fitpro.test/a/..' })), true)
})
