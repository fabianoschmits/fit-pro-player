import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '..')
const file = path.join(root, 'supabase/migrations/202609230006_professional_onboarding.sql')

test('professional onboarding migration exposes an authenticated owner-scoped RPC', () => {
  assert.equal(fs.existsSync(file), true, 'professional onboarding migration is required')
  const sql = fs.readFileSync(file, 'utf8')
  assert.match(sql, /create or replace function public\.provision_professional_profile\(/i)
  assert.match(sql, /security definer/i)
  assert.match(sql, /auth\.uid\(\)/i)
  assert.match(sql, /professional_profiles/i)
  assert.match(sql, /professional/i)
  assert.match(sql, /unverified/i)
  assert.match(sql, /grant execute on function public\.provision_professional_profile\(/i)
  assert.doesNotMatch(sql, /grant execute on function public\.provision_professional_profile\([^)]*admin/i)
})
