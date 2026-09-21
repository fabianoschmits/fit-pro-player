import test from 'node:test'
import assert from 'node:assert/strict'
import { newerStateExists, stateTimestamp, stateVersionConflict } from './state-version.js'

test('stateTimestamp rejects invalid timestamps', () => {
  assert.equal(stateTimestamp({ _ts: '120' }), 120)
  assert.equal(stateTimestamp({ _ts: 'invalid' }), 0)
  assert.equal(stateTimestamp({ _ts: -1 }), 0)
})

test('newerStateExists catches an out-of-order upload', () => {
  assert.equal(newerStateExists({ _ts: 200 }, { _ts: 199 }), true)
  assert.equal(newerStateExists({ _ts: 200 }, { _ts: 200 }), false)
  assert.equal(newerStateExists(null, { _ts: 1 }), false)
})

test('stateVersionConflict accepts idempotent retries but rejects equal-version divergence', () => {
  assert.equal(stateVersionConflict({ _ts: 200, value: 'same' }, { _ts: 200, value: 'same' }), false)
  assert.equal(stateVersionConflict({ _ts: 200, value: 'server' }, { _ts: 200, value: 'client' }), true)
  assert.equal(stateVersionConflict({ _ts: 200 }, { _ts: 199 }), true)
  assert.equal(stateVersionConflict(null, { _ts: 1 }), false)
})
