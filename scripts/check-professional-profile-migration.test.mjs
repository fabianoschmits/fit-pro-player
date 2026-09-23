import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202609210005_professional_profiles.sql'), 'utf8')

test('professional profile migration is additive and owner/capability gated', () => {
  assert.match(migration, /create table public\.professional_profiles/i)
  assert.match(migration, /references auth\.users \(id\) on delete cascade/i)
  assert.match(migration, /verification_status public\.professional_verification_status not null default 'unverified'/i)
  assert.match(migration, /user_roles\.role = 'professional'/i)
  assert.match(migration, /using \(user_id = auth\.uid\(\)\)/i)
  assert.match(migration, /verification is server-controlled/i)
  assert.doesNotMatch(migration, /drop table|truncate|delete from public\.professional_profiles/i)
})
