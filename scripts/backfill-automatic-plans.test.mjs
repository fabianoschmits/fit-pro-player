import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareBackfill, backfillSql } from './backfill-automatic-plans.mjs'
import { PGlite } from '@electric-sql/pglite'

const fixture = () => ({
  account_preferences: [{ user_id: 'a', revision: 1, preferences: { profile: { goal: 'build_muscle' } } }],
  athlete_schedules: [{ user_id: 'a', revision: 3, mode: 'weekly', schedule: { week: { 1: 'r' } } }],
  athlete_routines: [{ user_id: 'a', id: 'r', revision: 2, title: 'Old', position: 0, prescription: { managed: true, ex: [{ id: 'x', weight: 20 }] } }],
  athlete_plan_library: [{ user_id: 'a', id: 'l', source_type: 'self', personal_plan: { mode: 'weekly', schedule: { week: { 1: 'r' } }, routines: [{ id: 'r', title: 'Old', prescription: { managed: true, ex: [{ id: 'x', weight: 20 }] } }] } }],
  account_snapshots: [{ user_id: 'a', revision: 4, payload: { profile: {}, routines: [{ id: 'r', name: 'Old', managed: true, ex: [{ id: 'x', weight: 20 }] }], workouts: [{ id: 'h' }] } }],
  athlete_plan_selection: [{ user_id: 'a', plan_id: 'l' }], active: [],
})
const upgrade = state => { for (const routine of state.routines || []) if (routine.managed) routine.name = 'New' }

test('backfill updates all personal projections and revision while preserving history and inputs', () => {
  const data = fixture(), before = structuredClone(data), manifest = prepareBackfill(data, upgrade)
  assert.deepEqual(data, before)
  assert.equal(manifest.summary.athlete_routines, 1)
  assert.equal(manifest.summary.athlete_plan_library, 1)
  assert.equal(manifest.summary.athlete_schedules, 1)
  assert.equal(manifest.changes.find(row => row.table === 'account_preferences').values.preferences.profile.preferredWorkoutMinutes, 60)
  const snapshot = manifest.changes.find(row => row.table === 'account_snapshots').values.payload
  assert.deepEqual(snapshot.workouts, [{ id: 'h' }])
  assert.equal(snapshot.routines[0].ex[0].weight, 20)
  const sql = backfillSql(manifest)
  assert.match(sql, /revision=revision\+1/)
  assert.match(sql, /backfill compare-and-swap failed/)
  assert.match(sql, /lock table public.workout_sessions in share mode/)
  assert.doesNotMatch(sql, /update public.workout_sessions/)
})

test('active session preserves all plan projections, but missing default can be filled', () => {
  const data = fixture()
  data.active = [{ user_id: 'a', routine_id: 'r' }]
  const manifest = prepareBackfill(data, upgrade)
  assert.equal(manifest.summary.athlete_routines, 0)
  assert.equal(manifest.summary.athlete_plan_library, 0)
  assert.equal(manifest.summary.athlete_schedules, 0)
  assert.equal(manifest.summary.account_preferences, 1)
})

test('identified active routine stays unchanged while other routines of that account can upgrade', () => {
  const data = fixture()
  data.active = [{ user_id: 'a', routine_id: 'r' }]
  data.athlete_routines.push({ ...structuredClone(data.athlete_routines[0]), id: 'other', position: 1 })
  data.athlete_plan_library[0].personal_plan.routines.push({ ...structuredClone(data.athlete_plan_library[0].personal_plan.routines[0]), id: 'other' })
  data.account_snapshots[0].payload.active = { routineId: 'r', start: 123, entries: [{ id: 'x', done: true }] }
  data.account_snapshots[0].payload.routines.push({ ...structuredClone(data.account_snapshots[0].payload.routines[0]), id: 'other' })
  const manifest = prepareBackfill(data, upgrade)
  assert.deepEqual(manifest.changes.filter(row => row.table === 'athlete_routines').map(row => row.before.id), ['other'])
  const library = manifest.changes.find(row => row.table === 'athlete_plan_library').values.personal_plan
  assert.equal(library.routines[0].title, 'Old')
  assert.equal(library.routines[1].title, 'New')
  const payload = manifest.changes.find(row => row.table === 'account_snapshots').values.payload
  assert.deepEqual(payload.active, data.account_snapshots[0].payload.active)
  assert.equal(payload.routines[0].name, 'Old')
  assert.equal(payload.routines[1].name, 'New')
})

test('unidentified or conflicting active recovery identity preserves all account plans', () => {
  for (const routineId of [null, 'different']) {
    const data = fixture()
    data.active = [{ user_id: 'a', routine_id: routineId }]
    data.account_snapshots[0].payload.active = { routineId: 'r' }
    const manifest = prepareBackfill(data, upgrade)
    assert.equal(manifest.summary.athlete_routines, 0)
    assert.equal(manifest.summary.athlete_plan_library, 0)
    assert.equal(manifest.summary.ambiguousActiveAccounts, 1)
  }
})

test('explicit duration, manual and professional plans remain unchanged', () => {
  const data = fixture()
  data.account_preferences[0].preferences.profile.preferredWorkoutMinutes = 40
  data.athlete_routines[0].prescription.managed = false
  data.athlete_plan_library[0].source_type = 'professional'
  const manifest = prepareBackfill(data, upgrade)
  assert.equal(manifest.summary.account_preferences, 0)
  assert.equal(manifest.summary.athlete_routines, 0)
  assert.equal(manifest.summary.athlete_plan_library, 0)
})

test('absent or null profile receives only the duration default, preserving other preferences', () => {
  for (const profile of [null, undefined]) {
    const data = fixture()
    data.account_preferences[0].preferences = { theme: 'dark', accent: 'blue', ...(profile === null ? { profile } : {}) }
    const manifest = prepareBackfill(data, upgrade)
    assert.deepEqual(manifest.changes.find(row => row.table === 'account_preferences').values.preferences,
      { theme: 'dark', accent: 'blue', profile: { preferredWorkoutMinutes: 60 } })
  }
})

test('SQL atomically applies once and rejects stale reviewed backup without partial writes', async () => {
  const db = new PGlite()
  try {
    const data = fixture()
    const declarations = {
      account_preferences: 'user_id text,revision bigint,preferences jsonb',
      athlete_routines: 'user_id text,id text,revision bigint,title text,position int,prescription jsonb',
      athlete_schedules: 'user_id text,revision bigint,mode text,schedule jsonb',
      athlete_plan_library: 'user_id text,id text,source_type text,personal_plan jsonb',
      account_snapshots: 'user_id text,revision bigint,payload jsonb',
      athlete_plan_selection: 'user_id text,plan_id text',
    }
    for (const [table, columns] of Object.entries(declarations)) {
      await db.exec(`create table ${table}(${columns}, updated_at timestamptz default now());`)
      for (const row of data[table]) {
        const keys = Object.keys(row)
        await db.query(`insert into ${table}(${keys.join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map(key => typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key]))
      }
      data[table] = (await db.query(`select to_jsonb(t) row from ${table} t`)).rows.map(item => item.row)
    }
    await db.exec('create table workout_sessions(user_id text,routine_id text,status text);')
    const manifest = prepareBackfill(data, upgrade)
    await db.exec("insert into workout_sessions values('a','r','active');")
    await assert.rejects(db.exec(backfillSql(manifest)), /backfill conflict: active sessions/)
    await db.exec('rollback;')
    assert.equal((await db.query('select title from athlete_routines')).rows[0].title, 'Old')
    await db.exec('delete from workout_sessions;')
    await db.exec(backfillSql(manifest))
    assert.equal((await db.query('select title,revision from athlete_routines')).rows[0].title, 'New')
    assert.equal(Number((await db.query('select revision from athlete_schedules')).rows[0].revision), 4)
    await assert.rejects(db.exec(backfillSql(manifest)), /backfill conflict/)
    await db.exec('rollback;')
    assert.equal(Number((await db.query('select revision from athlete_routines')).rows[0].revision), 3)
  } finally { await db.close() }
})

test('JSONB object key ordering does not cause repeat library updates', () => {
  const data = fixture()
  data.account_preferences[0].preferences.profile.preferredWorkoutMinutes = 60
  data.account_snapshots[0].payload.profile.preferredWorkoutMinutes = 60
  const canonical = value => JSON.parse(JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item))
  const manifest = prepareBackfill(canonical(data), () => {})
  assert.deepEqual(manifest.changes, [])
})
