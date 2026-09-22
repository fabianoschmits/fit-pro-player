import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REQUIRED_FILES = [
  'supabase/config.toml',
  'supabase/migrations/202609210001_identity_profiles_roles_links.sql',
  'supabase/tests/202609210001_identity_profiles_roles_links.sql',
]

const PHASE_1_MIGRATION = REQUIRED_FILES[1]

// These entities belong to later professional-domain phases and must not be
// created by the identity-only Phase 1 migration.
export const FORBIDDEN_FUTURE_TABLES = [
  'professional_profiles',
  'professional_student_relationships',
  'invitations',
  'programs',
  'program_versions',
  'workout_templates',
  'workout_days',
  'assignments',
  'workout_executions',
  'exercise_executions',
  'feedback',
  'notifications',
  'analytics',
]

const FRONTEND_PRIVATE_ENV_PATTERN = /\b(?:service_role|SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)|VITE_SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY|DB_PASSWORD|ACCESS_TOKEN)|(?:VITE_)?FPP_SUPABASE_JWT_(?:PRIVATE_KEY|KEY_ID))\b/gi
const FRONTEND_BEARER_HEADER_PATTERN = /\bauthorization\s*:\s*(?:['"`]\s*)?bearer\b/gi
const FRONTEND_TOKEN_PERSISTENCE_PATTERNS = [
  /\b(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|set|put|add)\s*\([^)]*\b(?:access[_-]?token|bearer|jwt|supabase[_-]?(?:access[_-]?token|token|bearer))\b[^)]*\)/gi,
  /\b(?:indexedDB|IDBObjectStore|objectStore)\b[\s\S]{0,240}?\b(?:put|add|set)\s*\([^)]*\b(?:access[_-]?token|bearer|jwt|supabase[_-]?(?:access[_-]?token|token|bearer))\b[^)]*\)/gi,
  /\bgym_state_v1\b[\s\S]{0,240}?\b(?:access[_-]?token|bearer|jwt|supabase[_-]?(?:access[_-]?token|token|bearer))\b/gi,
  /\b(?:URLSearchParams|location(?:\.href)?|window\.location)\b[\s\S]{0,240}?\b(?:access[_-]?token|bearer|jwt|supabase[_-]?(?:access[_-]?token|token|bearer))\b/gi,
]
const MANUAL_IDENTITY_LINK_FILE = 'frontend/src/lib/api.js'
const TABLE_PATTERN = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>[a-z_][\w]*|"[^"]+")\s*\.\s*)?(?<table>[a-z_][\w]*|"[^"]+")/gi

const slashPath = (value) => value.replaceAll('\\', '/')

const trackedFilesFromGit = (rootDir) => execFileSync(
  'git',
  ['ls-files', '-z'],
  { cwd: rootDir, encoding: 'utf8' },
).split('\0').filter(Boolean).map(slashPath)

const readText = (rootDir, file, fileContents) => {
  if (Object.hasOwn(fileContents, file)) return fileContents[file]

  const absolute = join(rootDir, ...file.split('/'))
  if (!existsSync(absolute)) return null

  const buffer = readFileSync(absolute)
  if (buffer.includes(0)) return null
  return buffer.toString('utf8')
}

const lineNumberAt = (text, index) => text.slice(0, index).split('\n').length
const unquoteIdentifier = (identifier) => identifier.replace(/^"|"$/g, '')
const findMatches = (text, pattern) => [...text.matchAll(new RegExp(pattern.source, pattern.flags))]

const isManualIdentityLinkBearer = (file, text, bearerMatches) => (
  file === MANUAL_IDENTITY_LINK_FILE
  && bearerMatches.length === 1
  && /\bfunction\s+accountRequest\b/.test(text)
  && /\baccountRequest\(\s*['"]\/api\/account\/identity-link['"]/.test(text)
)

/**
 * Return human-readable violations for the tracked repository boundary.
 * `trackedFiles` and `fileContents` are injectable for deterministic tests;
 * normal CLI use reads the repository's tracked files through git.
 */
export function checkSupabaseBoundaries({
  rootDir = process.cwd(),
  trackedFiles,
  fileContents = {},
} = {}) {
  const normalizedRoot = resolve(rootDir)
  const hasExplicitFiles = trackedFiles !== undefined
  const files = (trackedFiles ?? trackedFilesFromGit(normalizedRoot)).map(slashPath)
  const violations = []

  for (const requiredFile of REQUIRED_FILES) {
    if (!existsSync(join(normalizedRoot, ...requiredFile.split('/')))) {
      violations.push(`missing required file: ${requiredFile}`)
    }
  }

  // Tests may mention the forbidden name to assert that it stays out of the
  // public shape; they are not Vite/Capacitor build inputs.
  for (const file of files.filter((candidate) => (
    candidate.startsWith('frontend/') && !/(^|\/)[^/]+\.(?:test|spec)\.[^.]+$/i.test(candidate)
  ))) {
    const text = readText(normalizedRoot, file, fileContents)
    if (text === null) continue

    for (const match of findMatches(text, FRONTEND_PRIVATE_ENV_PATTERN)) {
      const line = lineNumberAt(text, match.index ?? 0)
      violations.push(`${file}:${line}: frontend contains private Supabase/service-role reference "${match[0]}"`)
    }

    for (const pattern of FRONTEND_TOKEN_PERSISTENCE_PATTERNS) {
      for (const match of findMatches(text, pattern)) {
        const line = lineNumberAt(text, match.index ?? 0)
        violations.push(`${file}:${line}: frontend contains explicit bearer persistence "${match[0].trim()}"`)
      }
    }

    const bearerMatches = findMatches(text, FRONTEND_BEARER_HEADER_PATTERN)
    if (!isManualIdentityLinkBearer(file, text, bearerMatches)) {
      for (const match of bearerMatches) {
        const line = lineNumberAt(text, match.index ?? 0)
        violations.push(`${file}:${line}: frontend contains Authorization Bearer outside the manual identity-link contract`)
      }
    }
  }

  if (files.includes(PHASE_1_MIGRATION) || (!hasExplicitFiles && existsSync(join(normalizedRoot, ...PHASE_1_MIGRATION.split('/'))))) {
    const migration = readText(normalizedRoot, PHASE_1_MIGRATION, fileContents)
    if (migration !== null) {
      const forbidden = new Set(FORBIDDEN_FUTURE_TABLES)
      for (const match of migration.matchAll(TABLE_PATTERN)) {
        const table = unquoteIdentifier(match.groups?.table ?? '').toLowerCase()
        if (forbidden.has(table)) {
          const line = lineNumberAt(migration, match.index ?? 0)
          violations.push(`${PHASE_1_MIGRATION}:${line}: forbidden future-domain table "${table}"`)
        }
      }
    }
  }

  return violations
}

export function formatBoundaryReport(violations) {
  return violations.length === 0
    ? 'Supabase boundary check passed.'
    : ['Supabase boundary check failed:', ...violations.map((violation) => `- ${violation}`)].join('\n')
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === normalize(currentFile)) {
  const violations = checkSupabaseBoundaries({ rootDir: dirname(currentFile) === '.' ? process.cwd() : resolve(dirname(currentFile), '..') })
  console.log(formatBoundaryReport(violations))
  if (violations.length > 0) process.exitCode = 1
}
