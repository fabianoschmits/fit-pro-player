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

const FRONTEND_PRIVATE_ENV_PATTERN = /\bservice_role\b|\bSUPABASE_SERVICE_ROLE_KEY\b|\bVITE_SUPABASE_(?:SERVICE_ROLE_KEY|SECRET|DB_PASSWORD|ACCESS_TOKEN)\b/i
const TABLE_PATTERN = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>[a-z_][\w]*)\s*\.\s*)?(?<table>[a-z_][\w]*)/gi

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
    if (!files.includes(requiredFile) && (hasExplicitFiles || !existsSync(join(normalizedRoot, ...requiredFile.split('/'))))) {
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

    const match = text.match(FRONTEND_PRIVATE_ENV_PATTERN)
    if (match) {
      const line = lineNumberAt(text, match.index ?? 0)
      violations.push(`${file}:${line}: frontend contains private Supabase/service-role reference "${match[0]}"`)
    }
  }

  if (files.includes(PHASE_1_MIGRATION) || (!hasExplicitFiles && existsSync(join(normalizedRoot, ...PHASE_1_MIGRATION.split('/'))))) {
    const migration = readText(normalizedRoot, PHASE_1_MIGRATION, fileContents)
    if (migration !== null) {
      const forbidden = new Set(FORBIDDEN_FUTURE_TABLES)
      for (const match of migration.matchAll(TABLE_PATTERN)) {
        const table = match.groups?.table?.toLowerCase()
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
