// Administrative maintenance only. No credentials or account data are printed.
// Dry run: node scripts/backfill-automatic-plans.mjs
// Apply the reviewed, private manifest: node scripts/backfill-automatic-plans.mjs --apply <manifest.json>
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { pathToFileURL } from 'node:url'

const tables = ['account_preferences', 'athlete_routines', 'athlete_schedules', 'athlete_plan_library', 'account_snapshots', 'athlete_plan_selection']
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${literal(JSON.stringify(value))}::jsonb`
const same = isDeepStrictEqual
const defaultDuration = (state, createProfile = false) => {
  if (createProfile && state.profile == null) state.profile = { preferredWorkoutMinutes: 60 }
  if (state.profile && !Object.hasOwn(state.profile, 'preferredWorkoutMinutes')) state.profile.preferredWorkoutMinutes = 60
}

export function prepareBackfill(data, upgrade) {
  const changes = []
  const active = new Map()
  const recordActive = (user, routineId) => {
    const ids = active.get(user) || new Set()
    ids.add(typeof routineId === 'string' && routineId.length ? routineId : null)
    active.set(user, ids)
  }
  for (const row of data.active) recordActive(row.user_id, row.routine_id)
  for (const row of data.account_snapshots) if (row.payload.active) recordActive(row.user_id, row.payload.active.routineId)
  // An unidentified/free session or conflicting recovery identities cannot be
  // safely associated with a prescription; preserve that whole account's plans.
  const ambiguousActive = new Set([...active].filter(([, ids]) => ids.size !== 1 || ids.has(null)).map(([user]) => user))
  const profiles = new Map(data.account_preferences.map(row => [row.user_id, row.preferences.profile]))
  const transform = (state, userId) => {
    defaultDuration(state)
    if (!ambiguousActive.has(userId) && !state.assignedProgram) {
      const activeId = active.get(userId)?.values().next().value
      const hadActive = Object.hasOwn(state, 'active')
      const originalActive = state.active
      const protectedRoutine = structuredClone(state.routines?.find(routine => routine.id === activeId))
      if (activeId) state.active = { ...(state.active || {}), routineId: activeId }
      upgrade(state)
      // Preserve both the prescription and every detail of the actual session,
      // independently of generator behavior. Injected preparation data is transient.
      if (protectedRoutine) state.routines = state.routines.map(routine => routine.id === activeId ? protectedRoutine : routine)
      if (hadActive) state.active = originalActive
      else delete state.active
    }
    return state
  }
  const change = (table, before, values) => {
    if (Object.entries(values).some(([key, value]) => !same(before[key], value))) changes.push({ table, before, values })
  }
  for (const row of data.account_preferences) {
    const values = structuredClone(row.preferences)
    defaultDuration(values, true)
    change('account_preferences', row, { preferences: values })
  }
  for (const schedule of data.athlete_schedules) {
    const rows = data.athlete_routines.filter(row => row.user_id === schedule.user_id).sort((a, b) => a.position - b.position)
    const state = transform({ profile: structuredClone(profiles.get(schedule.user_id) || {}), planMode: schedule.mode,
      ...structuredClone(schedule.schedule), routines: rows.map(row => ({ ...structuredClone(row.prescription), id: row.id, name: row.title })) }, schedule.user_id)
    for (const before of rows) {
      const routine = state.routines.find(item => item.id === before.id)
      if (!routine) throw new Error('Upgrade must preserve routine identifiers')
      const { id: _id, name, ...prescription } = routine
      change('athlete_routines', before, { title: name, prescription })
    }
  }
  for (const row of data.athlete_plan_library.filter(row => row.source_type === 'self')) {
    const plan = structuredClone(row.personal_plan)
    const state = transform({ ...plan.schedule, profile: structuredClone(profiles.get(row.user_id) || {}), planMode: plan.mode,
      routines: (plan.routines || []).map(item => ({ ...item.prescription, id: item.id, name: item.title })) }, row.user_id)
    plan.routines = state.routines.map(({ id, name, ...prescription }) => ({ id, title: name, prescription }))
    change('athlete_plan_library', row, { personal_plan: plan })
  }
  for (const row of data.account_snapshots) {
    const payload = transform(structuredClone(row.payload), row.user_id)
    change('account_snapshots', row, { payload })
  }
  // Changing routine rows must also invalidate the existing plan revision protocol.
  const planUsers = new Set(changes.filter(row => row.table === 'athlete_routines').map(row => row.before.user_id))
  for (const row of data.athlete_schedules.filter(row => planUsers.has(row.user_id))) change('athlete_schedules', row, { schedule: row.schedule, mode: row.mode, revision: row.revision + 1 })
  return { version: 1, data, changes, summary: { ...Object.fromEntries(tables.map(table => [table, changes.filter(row => row.table === table).length])), ambiguousActiveAccounts: ambiguousActive.size } }
}

export function backfillSql(manifest) {
  if (manifest.version !== 1) throw new Error('Unsupported manifest')
  const changedUsers = new Set(manifest.changes.map(row => row.before.user_id))
  // Lock the same account domains as their writers. Exact row comparisons catch
  // edits, selection changes, newly started sessions, and stale reviewed manifests.
  const sql = ['begin;', "set local lock_timeout = '5s';", "set local statement_timeout = '60s';"]
  for (const user of [...changedUsers].sort()) for (const domain of ['library', 'plan', 'preferences']) sql.push(`select pg_advisory_xact_lock(hashtextextended(${literal(`fitpp.${domain}:${user}`)},0));`)
  const checks = []
  for (const table of tables) for (const user of changedUsers) {
    const count = manifest.data[table].filter(row => row.user_id === user).length
    checks.push(`if (select count(*) from public.${table} where user_id=${literal(user)}) <> ${count} then raise exception 'backfill conflict: ${table} row count'; end if;`)
  }
  for (const table of tables) for (const before of manifest.data[table].filter(row => changedUsers.has(row.user_id))) checks.push(`if not exists(select 1 from public.${table} t where to_jsonb(t)=${json(before)}) then raise exception 'backfill conflict: ${table}'; end if;`)
  // Serialize session creation while checking active sessions. Never update sessions.
  sql.push('lock table public.workout_sessions in share mode;')
  const expectedActive = manifest.data.active.filter(row => changedUsers.has(row.user_id))
  if (changedUsers.size) checks.push(`if (select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'routine_id',routine_id) order by user_id),'[]'::jsonb) from public.workout_sessions where status='active' and user_id in (${[...changedUsers].map(literal).join(',')})) <> ${json(expectedActive.sort((a,b) => a.user_id.localeCompare(b.user_id)))} then raise exception 'backfill conflict: active sessions'; end if;`)
  for (const item of manifest.changes) {
    if (!tables.includes(item.table)) throw new Error('Unexpected table')
    if (item.table === 'athlete_routines') checks.push(`if exists(select 1 from public.workout_sessions where user_id=${literal(item.before.user_id)} and status='active' and (routine_id is null or routine_id::text=${literal(item.before.id)})) then raise exception 'backfill protected active prescription'; end if;`)
    const setters = Object.entries(item.values).map(([key, value]) => {
      if (!['title', 'prescription', 'preferences', 'personal_plan', 'payload', 'schedule', 'mode', 'revision'].includes(key)) throw new Error('Unexpected column')
      return `${key}=${typeof value === 'object' ? json(value) : literal(value)}`
    })
    if (['account_preferences', 'athlete_routines', 'account_snapshots'].includes(item.table)) setters.push('revision=revision+1')
    setters.push('updated_at=now()')
    checks.push(`update public.${item.table} t set ${setters.join(',')} where to_jsonb(t)=${json(item.before)}; if not found then raise exception 'backfill compare-and-swap failed'; end if;`)
  }
  sql.push(`do $backfill$ begin ${checks.join('\n')} end $backfill$;`, 'commit;')
  return sql.join('\n')
}

function query(sql, directory) {
  const file = resolve(directory, 'query.sql')
  writeFileSync(file, sql, { mode: 0o600 })
  const output = execFileSync(process.execPath, [resolve('node_modules/supabase/dist/supabase.js'), 'db', 'query', '--linked', '--output', 'json', '--file', file], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  return JSON.parse(output).rows
}

async function main() {
  const directory = resolve('.supabase/fpp-plan-backfill', new Date().toISOString().replaceAll(':', '-'))
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  if (process.argv[2] === '--apply') {
    const manifest = JSON.parse(readFileSync(resolve(process.argv[3]), 'utf8'))
    query(backfillSql(manifest), directory)
    console.log(JSON.stringify({ applied: true, ...manifest.summary }))
    return
  }
  const columns = tables.map(table => `${literal(table)},(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.${table} t)`).join(',')
  const [result] = query(`select jsonb_build_object(${columns},'active',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'routine_id',routine_id) order by user_id),'[]') from public.workout_sessions where status='active')) data;`, directory)
  writeFileSync(resolve(directory, 'backup.json'), JSON.stringify(result.data), { mode: 0o600 })
  const { createServer } = await import('../frontend/node_modules/vite/dist/node/index.js')
  const server = await createServer({ root: resolve('frontend'), server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { upgradeAutomaticPlans } = await server.ssrLoadModule('/src/lib/plan-template-migration.js')
    const manifest = prepareBackfill(result.data, upgradeAutomaticPlans)
    writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify(manifest), { mode: 0o600 })
    console.log(JSON.stringify({ dryRun: true, manifest: resolve(directory, 'manifest.json'), ...manifest.summary }))
  } finally { await server.close() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Backfill stopped; inspect private local files. No account data or credentials logged.'); process.exitCode = 1 })
