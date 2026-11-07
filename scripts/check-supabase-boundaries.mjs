import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../frontend/node_modules/typescript/lib/typescript.js'

export const REQUIRED_FILES = [
  'supabase/config.toml',
  'supabase/migrations/202609210001_identity_profiles_roles_links.sql',
  'supabase/tests/202609210001_identity_profiles_roles_links.sql',
  'supabase/migrations/202609240007_account_lifecycle.sql',
  'supabase/tests/202609240007_account_lifecycle.sql',
  'supabase/migrations/202609240008_professional_workflow.sql',
  'supabase/tests/202609240008_professional_workflow.sql',
  'supabase/migrations/202609240011_assigned_program_read_acl.sql',
  'supabase/tests/202609240011_assigned_program_read_acl.sql',
  'supabase/migrations/202609240012_professional_management_rpc.sql',
  'supabase/tests/202609240012_professional_management_rpc.sql',
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

const FRONTEND_PRIVATE_ENV_PATTERN = /\bservice_role\b|\bSUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)\b|\bVITE_SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY|DB_PASSWORD|ACCESS_TOKEN)\b/i
const TABLE_PATTERN = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>[a-z_][\w]*|"[^"]+")\s*\.\s*)?(?<table>[a-z_][\w]*|"[^"]+")/gi
const REQUIRED_SUPABASE_ORIGIN = 'https://bgqavxoxwgheloeubbpf.supabase.co'
const TOKEN_PATTERN = /\b(?:access_token|refresh_token)\b/i
const TOKEN_SINKS = [
  ['gym_state_v1', /gym_state_v1/i],
  ['custom cache', /\b(?:caches|cacheStorage)\b/i],
  ['sessionStorage', /\bsessionStorage\b/i],
  ['IndexedDB', /\bindexedDB\b/i],
  ['console', /\bconsole\s*\./i],
  ['URL mutation', /\b(?:history\s*\.\s*(?:pushState|replaceState)|location\s*\.\s*(?:assign|replace|href)|(?:URLSearchParams|searchParams)\s*\.\s*(?:set|append))\b/i],
]

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

export function checkVercelCsp({ text, requiredSupabaseOrigin = REQUIRED_SUPABASE_ORIGIN }) {
  const violations = []
  let vercelConfig

  try {
    vercelConfig = JSON.parse(text)
  } catch {
    return ['vercel.json: invalid JSON; cannot verify Content-Security-Policy']
  }

  const csp = vercelConfig.headers
    ?.flatMap((rule) => rule.headers ?? [])
    .find((header) => header.key?.toLowerCase() === 'content-security-policy')
    ?.value

  if (typeof csp !== 'string') {
    return ['vercel.json: missing Content-Security-Policy header']
  }

  const connectSrc = csp.match(/(?:^|;)\s*connect-src\s+([^;]+)/i)?.[1]
  if (!connectSrc) {
    return ['vercel.json: Content-Security-Policy is missing connect-src']
  }

  const sources = connectSrc.trim().split(/\s+/)
  if (!sources.includes("'self'")) {
    violations.push("vercel.json: connect-src must include 'self'")
  }
  if (!sources.includes(requiredSupabaseOrigin)) {
    violations.push(`vercel.json: connect-src must include ${requiredSupabaseOrigin}`)
  }

  for (const source of sources) {
    if (source === "'self'" || source === requiredSupabaseOrigin || source === 'wss://bgqavxoxwgheloeubbpf.supabase.co' || source === 'https://servicodados.ibge.gov.br') continue
    if (source === '*' || source.includes('*')) {
      violations.push(`vercel.json: connect-src must not allow wildcard source ${source}`)
    } else if (source.toLowerCase() !== 'wss://bgqavxoxwgheloeubbpf.supabase.co') {
      violations.push(`vercel.json: connect-src contains an unrelated WebSocket source ${source}`)
    } else {
      violations.push(`vercel.json: connect-src must not allow unrelated source ${source}`)
    }
  }

  return violations
}

const manualTokenSinkViolation = (file, text) => {
  if (!TOKEN_PATTERN.test(text)) return null
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const aliases = new Set()
  const sinkAliases = new Map()
  const sinkOf = node => {
    if (!node) return null
    if (ts.isIdentifier(node) && sinkAliases.has(node.text)) return sinkAliases.get(node.text)
    const expression = node.getText(source)
    if (/\b(?:URLSearchParams|searchParams)\b/.test(expression)) return 'URL mutation'
    if (/\bindexedDB\b/.test(expression)) return 'IndexedDB'
    if (/\b(?:caches|cacheStorage)\b/.test(expression)) return 'custom cache'
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isAwaitExpression(node)) return sinkOf(node.expression)
    return null
  }
  const containsToken = node => {
    if (!node) return false
    if (ts.isPropertyAccessExpression(node) && TOKEN_PATTERN.test(node.name.text)) return true
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && TOKEN_PATTERN.test(node.argumentExpression.text)) return true
    if (ts.isIdentifier(node) && (TOKEN_PATTERN.test(node.text) || aliases.has(node.text))) return true
    return !!ts.forEachChild(node, child => containsToken(child) || undefined)
  }
  const visit = (node, action) => { action(node); ts.forEachChild(node, child => visit(child, action)) }
  // Propagate local aliases, including multi-step JSON payloads. Inspect syntax,
  // not comments or unrelated functions which merely mention the SDK token.
  let changed = true
  while (changed) {
    changed = false
    visit(source, node => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const sink = sinkOf(node.initializer)
        if (sink && !sinkAliases.has(node.name.text)) {
          sinkAliases.set(node.name.text, sink); changed = true
        }
      }
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
        for (const binding of node.name.elements) {
          if (ts.isIdentifier(binding.name) && TOKEN_PATTERN.test((binding.propertyName || binding.name).getText(source)) && !aliases.has(binding.name.text)) {
            aliases.add(binding.name.text); changed = true
          }
        }
      }
      if (ts.isFunctionDeclaration(node) && node.name && containsToken(node.body) && !aliases.has(node.name.text)) {
        aliases.add(node.name.text); changed = true
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && containsToken(node.initializer) && !aliases.has(node.name.text)) {
        aliases.add(node.name.text); changed = true
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left) && containsToken(node.right) && !aliases.has(node.left.text)) {
        aliases.add(node.left.text); changed = true
      }
    })
  }
  let violation = null
  visit(source, node => {
    if (violation) return
    const assignment = ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && containsToken(node.right)
    const callWithToken = ts.isCallExpression(node) && node.arguments.some(containsToken)
    if (!assignment && !callWithToken) return
    const destination = assignment ? node.left : node.expression
    const call = destination.getText(source)
    const aliasSink = sinkOf(destination)
    for (const [sink, pattern] of TOKEN_SINKS) {
      const matches = sink === 'gym_state_v1'
        ? callWithToken && /(?:localStorage|storage)\s*\.\s*setItem/.test(call) && node.arguments.some(argument => ts.isStringLiteral(argument) && argument.text === 'gym_state_v1')
        : pattern.test(call) || aliasSink === sink
      if (matches) {
        violation = `${file}:${lineNumberAt(text, node.getStart(source))}: frontend writes Supabase access_token/refresh_token to ${sink}`
        break
      }
    }
  })
  return violation
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

    const match = text.match(FRONTEND_PRIVATE_ENV_PATTERN)
    if (match) {
      const line = lineNumberAt(text, match.index ?? 0)
      violations.push(`${file}:${line}: frontend contains private Supabase/service-role reference "${match[0]}"`)
    }

    const tokenViolation = manualTokenSinkViolation(file, text)
    if (tokenViolation) violations.push(tokenViolation)
  }

  if (files.includes('vercel.json') || (!hasExplicitFiles && existsSync(join(normalizedRoot, 'vercel.json')))) {
    const vercelText = readText(normalizedRoot, 'vercel.json', fileContents)
    if (vercelText === null) {
      violations.push('missing required file: vercel.json')
    } else {
      violations.push(...checkVercelCsp({ text: vercelText }))
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
