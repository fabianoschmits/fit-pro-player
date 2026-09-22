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

const FRONTEND_PRIVATE_ENV_NAMES = new Set([
  'service_role',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SECRET_KEY',
  'VITE_SUPABASE_DB_PASSWORD',
  'VITE_SUPABASE_ACCESS_TOKEN',
  'FPP_SUPABASE_JWT_PRIVATE_KEY',
  'FPP_SUPABASE_JWT_KEY_ID',
  'VITE_FPP_SUPABASE_JWT_PRIVATE_KEY',
  'VITE_FPP_SUPABASE_JWT_KEY_ID',
])
const MANUAL_IDENTITY_LINK_FILE = 'frontend/src/lib/api.js'
const MANUAL_BEARER_ENDPOINTS = new Set([
  '/api/account/identity-link',
  '/api/account/roles/professional',
])
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

const isIdentifierStart = (character) => /[A-Za-z_$]/.test(character ?? '')
const isIdentifierPart = (character) => /[A-Za-z0-9_$]/.test(character ?? '')

function tokenizeJavaScript(source) {
  const tokens = []
  let index = 0
  let line = 1

  const add = (kind, start, value, quote) => tokens.push({ kind, start, line, value, quote })
  const advance = (end) => {
    line += (source.slice(index, end).match(/\n/g) || []).length
    index = end
  }

  while (index < source.length) {
    const character = source[index]
    if (/\s/.test(character)) {
      advance(index + 1)
      continue
    }

    if (character === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index + 2)
      advance(end === -1 ? source.length : end)
      continue
    }

    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2)
      advance(end === -1 ? source.length : end + 2)
      continue
    }

    if (character === '\'' || character === '"' || character === '`') {
      const quote = character
      const start = index
      let end = index + 1
      let value = ''
      while (end < source.length) {
        if (source[end] === '\\') {
          value += source.slice(end, end + 2)
          end += 2
          continue
        }
        if (source[end] === quote) break
        value += source[end]
        end += 1
      }
      add('literal', start, value, quote)
      advance(Math.min(end + 1, source.length))
      continue
    }

    if (isIdentifierStart(character)) {
      const start = index
      index += 1
      while (isIdentifierPart(source[index])) index += 1
      add('identifier', start, source.slice(start, index))
      continue
    }

    add('punctuation', index, character)
    advance(index + 1)
  }

  return tokens
}

const tokenIs = (token, value) => token?.value === value
const tokenText = (token) => typeof token?.value === 'string' ? token.value.replaceAll('\\"', '"').replaceAll("\\'", "'") : ''
const tokenMatches = (token, pattern) => pattern.test(tokenText(token))
const isSensitiveName = (token) => tokenMatches(token, /(?:access[_-]?token|bearer|jwt|supabase[_-]?(?:access[_-]?token|token|bearer))/i)
const isSensitiveTokenIdentifier = (token) => token?.kind === 'identifier' && tokenMatches(token, /(?:access[_-]?token|bearer|jwt)/i)
const isAuthorizationKey = (token) => token?.kind === 'identifier' || token?.kind === 'literal'
  ? tokenText(token).toLowerCase() === 'authorization'
  : false
const isBearerValue = (token) => token?.kind === 'literal' && /^\s*Bearer\b/i.test(tokenText(token))

const matchingToken = (tokens, start, opening, closing) => {
  let depth = 0
  for (let index = start; index < tokens.length; index += 1) {
    if (tokenIs(tokens[index], opening)) depth += 1
    if (tokenIs(tokens[index], closing)) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return tokens.length - 1
}

const tokensBetween = (tokens, start, end) => tokens.slice(start + 1, end)

function functionRanges(tokens) {
  const ranges = []
  for (let index = 0; index < tokens.length; index += 1) {
    if (!tokenIs(tokens[index], 'function')) continue
    const name = tokens[index + 1]
    const bodyStart = tokens.findIndex((token, candidate) => candidate > index && tokenIs(token, '{'))
    if (bodyStart === -1) continue
    ranges.push({ name: name?.value, start: index, bodyStart, end: matchingToken(tokens, bodyStart, '{', '}') })
  }
  return ranges
}

function enclosingFunction(ranges, tokenIndex) {
  return ranges.find((range) => tokenIndex > range.bodyStart && tokenIndex < range.end)
}

const approvedAccountRoute = (call) => (
  call[0]?.kind === 'literal'
  && (call[0].quote === '\'' || call[0].quote === '"')
  && tokenIs(call[1], ',')
  && MANUAL_BEARER_ENDPOINTS.has(tokenText(call[0]))
)

function accountRequestReferences(tokens) {
  const calls = []
  const invalidReferences = []
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (!tokenIs(tokens[index], 'accountRequest')) continue
    if (tokens[index - 1]?.value === 'function') continue
    if (!tokenIs(tokens[index + 1], '(')) {
      invalidReferences.push(tokens[index])
      continue
    }
    const end = matchingToken(tokens, index + 1, '(', ')')
    const call = tokensBetween(tokens, index + 1, end)
    calls.push({ token: tokens[index], call })
    if (!approvedAccountRoute(call)) invalidReferences.push(tokens[index])
  }
  return { calls, invalidReferences }
}

function manualBearerAllowed(file, tokens, bearerIndex, bearerCount, ranges) {
  if (file !== MANUAL_IDENTITY_LINK_FILE || bearerCount !== 1) return false
  const range = enclosingFunction(ranges, bearerIndex)
  if (range?.name !== 'accountRequest') return false

  const { calls, invalidReferences } = accountRequestReferences(tokens)
  return calls.length > 0 && invalidReferences.length === 0
}

function frontendBoundaryViolations(file, source) {
  const tokens = tokenizeJavaScript(source)
  const ranges = functionRanges(tokens)
  const violations = []
  const add = (token, message) => violations.push(`${file}:${token.line}: ${message}`)

  const accountReferences = file === MANUAL_IDENTITY_LINK_FILE
    ? accountRequestReferences(tokens)
    : { invalidReferences: [] }
  for (const token of accountReferences.invalidReferences) {
    add(token, 'frontend manual bearer helper is outside the approved account endpoint allowlist')
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (FRONTEND_PRIVATE_ENV_NAMES.has(tokenText(token))) {
      const previous = tokens[index - 1]
      if (token.kind === 'identifier' || tokenIs(previous, 'env') || tokenIs(tokens[index - 2], 'env')) {
        add(token, `frontend contains private Supabase/service-role reference "${tokenText(token)}"`)
      }
    }
  }

  const bearerHeaders = []
  for (let index = 0; index < tokens.length; index += 1) {
    if (isAuthorizationKey(tokens[index]) && tokenIs(tokens[index + 1], ':') && isBearerValue(tokens[index + 2])) {
      bearerHeaders.push(index + 2)
    }
    if (tokenIs(tokens[index], '.') && tokenIs(tokens[index + 1], 'set') && tokenIs(tokens[index + 2], '(')
      && isAuthorizationKey(tokens[index + 3]) && tokenIs(tokens[index + 4], ',') && isBearerValue(tokens[index + 5])) {
      bearerHeaders.push(index + 5)
    }
  }

  for (const bearerIndex of bearerHeaders) {
    if (manualBearerAllowed(file, tokens, bearerIndex, bearerHeaders.length, ranges)) continue
    const range = enclosingFunction(ranges, bearerIndex)
    if (file === MANUAL_IDENTITY_LINK_FILE && range?.name === 'accountRequest') {
      add(tokens[bearerIndex], 'frontend manual bearer helper is outside the approved account endpoint allowlist')
    } else {
      add(tokens[bearerIndex], 'frontend contains Authorization Bearer outside the approved manual account endpoint allowlist')
    }
  }

  const sensitiveBindings = new Set()
  for (let index = 0; index < tokens.length - 3; index += 1) {
    if (!['const', 'let', 'var'].includes(tokens[index]?.value)) continue
    const binding = tokens[index + 1]
    if (binding?.kind !== 'identifier' || !tokenIs(tokens[index + 2], '=')) continue
    const end = tokens.findIndex((token, candidate) => candidate > index + 2 && tokenIs(token, ';'))
    const statement = tokens.slice(index + 3, end === -1 ? tokens.length : end)
    if (statement.some((token) => tokenText(token) === 'gym_state_v1' || tokenText(token) === 'supabaseAccessToken')
      && statement.some((token) => isSensitiveTokenIdentifier(token))) {
      sensitiveBindings.add(binding.value)
    }
  }

  for (let index = 0; index < tokens.length - 4; index += 1) {
    if (tokens[index]?.kind !== 'identifier' || !tokenIs(tokens[index + 1], '.')
      || !tokenMatches(tokens[index + 2], /supabaseAccessToken|access[_-]?token/i)
      || !tokenIs(tokens[index + 3], '=') || !isSensitiveTokenIdentifier(tokens[index + 4])) continue
    sensitiveBindings.add(tokens[index].value)
  }

  for (let index = 0; index < tokens.length - 6; index += 1) {
    if (tokens[index]?.kind !== 'identifier'
      || !tokenIs(tokens[index + 1], '.')
      || !tokenIs(tokens[index + 2], 'gym_state_v1')
      || !tokenIs(tokens[index + 3], '.')
      || !tokenMatches(tokens[index + 4], /supabaseAccessToken|access[_-]?token/i)
      || !tokenIs(tokens[index + 5], '=')
      || !isSensitiveTokenIdentifier(tokens[index + 6])) continue
    sensitiveBindings.add(tokens[index].value)
  }

  const storageRoots = new Set(['localStorage', 'sessionStorage', 'indexedDB'])
  for (let index = 0; index < tokens.length; index += 1) {
    if (!storageRoots.has(tokens[index]?.value)) continue

    let property
    let afterProperty
    if (tokenIs(tokens[index + 1], '.')) {
      property = tokens[index + 2]
      afterProperty = index + 3
    } else if (tokenIs(tokens[index + 1], '[')) {
      property = tokens[index + 2]
      afterProperty = index + 3
      while (afterProperty < tokens.length && !tokenIs(tokens[afterProperty], ']')) afterProperty += 1
      afterProperty += 1
    }
    if (!property) continue

    if (['setItem', 'set', 'put', 'add'].includes(tokenText(property)) && tokenIs(tokens[afterProperty], '(')) {
      const end = matchingToken(tokens, afterProperty, '(', ')')
        const args = tokensBetween(tokens, afterProperty, end)
        if (args.some((token) => isSensitiveName(token) || sensitiveBindings.has(token.value))) {
          add(tokens[index], 'frontend contains explicit bearer persistence')
        }
    } else if (tokenIs(tokens[afterProperty], '=')) {
      const valueStart = afterProperty + 1
      const end = tokens.findIndex((token, candidate) => candidate >= valueStart && tokenIs(token, ';'))
      const value = tokens.slice(valueStart, end === -1 ? tokens.length : end)
      if (value.some((token) => isSensitiveName(token) || sensitiveBindings.has(token.value))) {
        add(tokens[index], 'frontend contains explicit bearer persistence')
      }
    }
  }

  const urlReceiverBindings = new Set()
  for (let index = 0; index < tokens.length - 4; index += 1) {
    if (tokens[index]?.kind === 'identifier' && tokenIs(tokens[index + 1], '=')
      && tokenIs(tokens[index + 2], 'new')
      && (tokenIs(tokens[index + 3], 'URL') || tokenIs(tokens[index + 3], 'URLSearchParams'))) {
      urlReceiverBindings.add(tokens[index].value)
    }
  }

  for (let index = 0; index < tokens.length - 3; index += 1) {
    let receiver
    let method
    let callStart
    if (tokenIs(tokens[index + 1], '.')) {
      receiver = tokens[index]?.value
      method = tokens[index + 2]?.value
      callStart = index + 3
      if (receiver === 'window' && (tokenIs(tokens[index + 2], 'history') || tokenIs(tokens[index + 2], 'location'))
        && tokenIs(tokens[index + 3], '.')) {
        receiver = tokens[index + 2].value
        method = tokens[index + 4]?.value
        callStart = index + 5
      }
    }
    const recognizedMethod = (receiver === 'history' && ['replaceState', 'pushState'].includes(method))
      || (receiver === 'location' && ['assign', 'replace'].includes(method))
      || (urlReceiverBindings.has(receiver) && ['set', 'append'].includes(method))
    if (!recognizedMethod || !tokenIs(tokens[callStart], '(')) continue
    const end = matchingToken(tokens, callStart, '(', ')')
    const args = tokensBetween(tokens, callStart, end)
    if (args.some((token) => isSensitiveName(token))) add(tokens[index], 'frontend contains bearer material in a URL mutation')
  }

  for (let index = 0; index < tokens.length - 4; index += 1) {
    const directLocation = tokenIs(tokens[index], 'location')
      && tokenIs(tokens[index + 1], '.')
      && ['href', 'search', 'hash'].includes(tokens[index + 2]?.value)
      && tokenIs(tokens[index + 3], '=')
    const windowLocation = tokenIs(tokens[index], 'window')
      && tokenIs(tokens[index + 1], '.')
      && tokenIs(tokens[index + 2], 'location')
      && tokenIs(tokens[index + 3], '.')
      && ['href', 'search', 'hash'].includes(tokens[index + 4]?.value)
      && tokenIs(tokens[index + 5], '=')
    if (!directLocation && !windowLocation) continue
    const valueStart = directLocation ? index + 4 : index + 6
    const end = tokens.findIndex((token, candidate) => candidate >= valueStart && tokenIs(token, ';'))
    const value = tokens.slice(valueStart, end === -1 ? tokens.length : end)
    if (value.some((token) => isSensitiveName(token))) add(tokens[index], 'frontend contains bearer material in a URL mutation')
  }

  return violations
}

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
    violations.push(...frontendBoundaryViolations(file, text))
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
