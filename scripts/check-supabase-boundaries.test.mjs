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

test('rejects server-only Supabase signing environment names in frontend tracked inputs', () => {
  const privateEnvNames = [
    'FPP_SUPABASE_JWT_PRIVATE_KEY',
    'FPP_SUPABASE_JWT_KEY_ID',
    'VITE_FPP_SUPABASE_JWT_PRIVATE_KEY',
    'SUPABASE_SECRET_KEY',
  ]
  const violations = runCheck([
    ...requiredFiles,
    'frontend/src/leak.js',
  ], {
    'frontend/src/leak.js': privateEnvNames
      .map((name) => `const value = import.meta.env.${name}`)
      .join('\n'),
  })

  for (const name of privateEnvNames) {
    assert.match(violations.join('\n'), new RegExp(name))
  }
})

test('rejects explicit frontend bearer persistence', () => {
  const violations = runCheck([
    ...requiredFiles,
    'frontend/src/leak.js',
  ], {
    'frontend/src/leak.js': [
      "localStorage.setItem('supabase-token', accessToken)",
      "sessionStorage.setItem('supabase-token', accessToken)",
      "indexedDB.put('supabase-token', accessToken)",
    ].join('\n'),
  })

  assert.equal(violations.filter((violation) => /persistence/i.test(violation)).length, 3)
})

test('rejects frontend bearer headers outside the manual account endpoint allowlist', () => {
  const violations = runCheck([
    ...requiredFiles,
    'frontend/src/lib/api.js',
    'frontend/src/leak.js',
    'api/supabase/config.js',
  ], {
    'frontend/src/lib/api.js': [
      'function accountRequest(path, accessToken) {',
      '  return api(path, { headers: { Authorization: `Bearer ${accessToken.trim()}` } })',
      '}',
      'export function linkSupabaseIdentity(accessToken) {',
      "  return accountRequest('/api/account/identity-link', accessToken)",
      '}',
    ].join('\n'),
    'frontend/src/leak.js': 'fetch(\'/api/private\', { headers: { Authorization: `Bearer ${accessToken}` } })\n',
    'api/supabase/config.js': [
      'const signingKey = env.FPP_SUPABASE_JWT_PRIVATE_KEY',
      'const keyId = env.FPP_SUPABASE_JWT_KEY_ID',
      'const adminKey = env.SUPABASE_SECRET_KEY',
    ].join('\n'),
  })

  assert.deepEqual(violations, [
    'frontend/src/leak.js:1: frontend contains Authorization Bearer outside the approved manual account endpoint allowlist',
  ])
})

const sharedManualBearerFixture = (extraCall = '') => [
  'function accountRequest(path, accessToken) {',
  '  return api(path, { headers: { Authorization: `Bearer ${accessToken.trim()}` } })',
  '}',
  'export function linkSupabaseIdentity(accessToken) {',
  "  return accountRequest('/api/account/identity-link', accessToken)",
  '}',
  'export function requestSupabaseProfessionalRole(accessToken) {',
  "  return accountRequest('/api/account/roles/professional', accessToken)",
  '}',
  extraCall,
].join('\n')

test('allows the two existing manual bearer endpoints in a structural allowlist', () => {
  const violations = runCheck([
    ...requiredFiles,
    'frontend/src/lib/api.js',
  ], {
    'frontend/src/lib/api.js': sharedManualBearerFixture(),
  })

  assert.deepEqual(violations, [])
})

test('rejects the manual bearer helper when reused for a third endpoint', () => {
  const violations = runCheck([
    ...requiredFiles,
    'frontend/src/lib/api.js',
  ], {
    'frontend/src/lib/api.js': sharedManualBearerFixture(
      "accountRequest('/api/account/other', accessToken)",
    ),
  })

  assert.match(violations.join('\n'), /allowlist|endpoint|manual/i)
})

test('rejects ordinary bearer header syntax and URL mutation APIs', () => {
  const fixtures = [
    [
      'frontend/src/quoted-header.js',
      "fetch('/private', { headers: { 'Authorization': `Bearer ${accessToken}` } })",
      /Authorization Bearer/i,
    ],
    [
      'frontend/src/header-set.js',
      "headers.set('Authorization', `Bearer ${accessToken}`)",
      /Authorization Bearer/i,
    ],
    [
      'frontend/src/url-mutation.js',
      "history.replaceState({}, '', '/callback?access_token=' + accessToken)",
      /URL|url|bearer/i,
    ],
  ]

  for (const [file, source, expected] of fixtures) {
    const violations = runCheck([...requiredFiles, file], { [file]: source })
    assert.match(violations.join('\n'), expected, file)
  }
})

test('rejects property, bracket, and indirect state persistence of bearer material', () => {
  const fixtures = [
    [
      'frontend/src/property-storage.js',
      'localStorage.supabaseToken = accessToken',
    ],
    [
      'frontend/src/bracket-storage.js',
      "localStorage['setItem']('supabase-token', accessToken)",
    ],
    [
      'frontend/src/state-storage.js',
      [
        "const state = { gym_state_v1: { supabaseAccessToken: accessToken } }",
        "localStorage.setItem(KEY, JSON.stringify(state))",
      ].join('\n'),
    ],
  ]

  for (const [file, source] of fixtures) {
    const violations = runCheck([...requiredFiles, file], { [file]: source })
    assert.match(violations.join('\n'), /persistence/i, file)
  }
})

test('ignores bearer wording in harmless frontend prose and comments', () => {
  const violations = runCheck([
    ...requiredFiles,
    'frontend/src/help.js',
  ], {
    'frontend/src/help.js': [
      '// Never send Authorization: Bearer credentials from this screen.',
      'const help = "Store no access_token in the URL or browser storage."',
    ].join('\n'),
  })

  assert.deepEqual(violations, [])
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
