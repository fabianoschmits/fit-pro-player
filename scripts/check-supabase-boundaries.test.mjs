import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { checkSupabaseBoundaries } from './check-supabase-boundaries.mjs'

const requiredFiles = [
  'supabase/config.toml',
  'supabase/migrations/202609210001_identity_profiles_roles_links.sql',
  'supabase/tests/202609210001_identity_profiles_roles_links.sql',
]

const runCheck = (files, contents = {}, rootDir = process.cwd()) => checkSupabaseBoundaries({
  rootDir,
  trackedFiles: files,
  fileContents: contents,
})

test('rejects private Supabase environment names in frontend tracked inputs', () => {
  const violations = runCheck([
    ...requiredFiles,
    'frontend/src/leak.js',
  ], {
    'frontend/src/leak.js': 'const key = import.meta.env.VITE_SUPABASE_SECRET_KEY\n',
  })

  assert.match(violations.join('\n'), /frontend\/src\/leak\.js:1/)
  assert.match(violations.join('\n'), /service-role|private/i)
})

test('rejects missing reproducibility files', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'supabase-boundaries-'))

  try {
    const violations = runCheck([
      'supabase/config.toml',
      'supabase/migrations/202609210001_identity_profiles_roles_links.sql',
    ], {}, rootDir)

    assert.deepEqual(violations, [
      'missing required file: supabase/config.toml',
      'missing required file: supabase/migrations/202609210001_identity_profiles_roles_links.sql',
      'missing required file: supabase/tests/202609210001_identity_profiles_roles_links.sql',
    ])
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})

test('rejects required files that are tracked but missing physically', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'supabase-boundaries-'))

  try {
    const violations = runCheck(requiredFiles, {}, rootDir)

    assert.deepEqual(violations, requiredFiles.map((file) => `missing required file: ${file}`))
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})

test('rejects future-domain tables in the Phase 1 migration', () => {
  const violations = runCheck([
    'supabase/config.toml',
    'supabase/tests/202609210001_identity_profiles_roles_links.sql',
    'supabase/migrations/202609210001_identity_profiles_roles_links.sql',
  ], {
    'supabase/migrations/202609210001_identity_profiles_roles_links.sql':
      'create table public.profiles (id uuid);\ncreate table public.professional_profiles (id uuid);\n',
  })

  assert.match(violations.join('\n'), /professional_profiles/)
  assert.match(violations.join('\n'), /migration.*2|:2/i)
})

test('rejects quoted future-domain table identifiers in the Phase 1 migration', () => {
  const violations = runCheck([
    ...requiredFiles,
  ], {
    'supabase/migrations/202609210001_identity_profiles_roles_links.sql':
      'CREATE TABLE public."programs" (id uuid);\n',
  })

  assert.match(violations.join('\n'), /programs/)
  assert.match(violations.join('\n'), /migration.*1|:1/i)
})

test('allows public frontend configuration and backend-only private env parsing', () => {
  const violations = runCheck([
    ...requiredFiles,
    'frontend/src/config.js',
    'api/supabase/config.js',
  ], {
    'frontend/src/config.js':
      'const url = import.meta.env.VITE_SUPABASE_URL\nconst key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY\n',
    'api/supabase/config.js': 'const key = env.SUPABASE_SECRET_KEY\n',
  })

  assert.deepEqual(violations, [])
})

test('migration declares least-privilege schema, table, and RPC grants', () => {
  const migration = readFileSync(resolve(
    process.cwd(),
    'supabase/migrations/202609210001_identity_profiles_roles_links.sql',
  ), 'utf8')

  assert.match(migration, /revoke all on schema public from public, anon, authenticated;/i)
  assert.match(migration, /grant usage on schema public to authenticated, service_role;/i)
  for (const table of ['profiles', 'user_roles', 'legacy_identity_links']) {
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated;`, 'i'))
    assert.match(migration, new RegExp(`grant (?:select, update on table public\\.profiles|select on table public\\.${table}) to authenticated;`, 'i'))
    assert.match(migration, new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role;`, 'i'))
  }
  assert.doesNotMatch(migration, /grant .* on table .* to anon\s*;/i)
  assert.match(migration, /grant execute on function public\.link_legacy_identity\(text, uuid\) to service_role;/i)
})

test('corrective migration removes default RPC execute grants from client roles', () => {
  const migration = readFileSync(resolve(
    process.cwd(),
    'supabase/migrations/202609210002_link_legacy_identity_acl.sql',
  ), 'utf8')

  assert.match(migration, /revoke execute on function public\.link_legacy_identity\(text, uuid\) from public, anon, authenticated;/i)
  assert.match(migration, /grant execute on function public\.link_legacy_identity\(text, uuid\) to service_role;/i)
  assert.doesNotMatch(migration, /grant execute on function public\.link_legacy_identity\(text, uuid\) to (?:public|anon|authenticated);/i)
})
