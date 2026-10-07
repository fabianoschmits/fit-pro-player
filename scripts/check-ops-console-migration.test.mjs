import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(root, 'supabase/migrations/202610060016_ops_console.sql')
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''

const FUNCTIONS = [
  ['ops_require_admin', ''],
  ['ops_overview', ''],
  ['ops_list_users', 'text, integer, integer'],
  ['ops_user_detail', 'uuid'],
  ['ops_list_professionals', 'text, public.professional_verification_status, integer, integer'],
  ['ops_set_display_name', 'uuid, text'],
  ['ops_set_suspended', 'uuid, boolean'],
  ['ops_set_professional_role', 'uuid, boolean'],
  ['ops_set_verification', 'uuid, public.professional_verification_status'],
  ['ops_update_professional_profile', 'uuid, text, text, text[], text, text, text'],
  ['ops_delete_user', 'uuid'],
]

test('ops console migration seeds admin and gates every RPC', () => {
  assert.ok(migration, 'ops console migration must exist')
  assert.match(migration, /4871d9b4-09ba-4768-806c-c608ebbfe42f/i)
  assert.match(migration, /role = 'admin'::public\.user_role/i)
  assert.match(migration, /add column if not exists suspended_at timestamptz/i)
  assert.match(migration, /ops capability required/i)

  for (const [name, signature] of FUNCTIONS) {
    const body = migration.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$[\\s\\S]*?\\$\\$;`, 'i'))?.[0]
    assert.ok(body, `${name} must exist`)
    assert.match(body, /security definer/i)
    assert.match(body, /set search_path\s*=\s*public(?:,\s*auth)?,\s*pg_temp/i)
    if (name !== 'ops_require_admin') {
      assert.match(body, /ops_require_admin\(\)/i)
    }
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\(${escaped}\\) from public,\\s*anon(?:,\\s*authenticated)?`, 'i'))
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(${escaped}\\) to authenticated`, 'i'))
  }

  assert.match(migration, /cannot suspend own account/i)
  assert.match(migration, /cannot delete own account via ops/i)
  assert.match(migration, /cannot delete admin account/i)
  assert.doesNotMatch(migration, /grant execute[^;]*to (?:public|anon)/i)
})
