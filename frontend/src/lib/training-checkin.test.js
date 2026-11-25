import { readFileSync } from 'node:fs'
import { createAccountDomainSync } from './account-domain-sync.js'
import { buildWeeklyInsights } from './weekly-progress-insights.js'
import { describe, it, expect } from 'vitest'
import { detectTrainingChanges, normalizeTrainingCheckin, withTrainingCheckin, buildWeeklyCheckinSummary } from './training-checkin.js'
import { projectPersistedState } from './persisted-state.js'
import { preferenceValues } from './domain-sync-state.js'
import { mergeChanges } from './three-way-merge.js'
const now = '2026-11-25T12:00:00.000Z'
const workout = (planned = 10, actual = 10) => ({ id: 'session-1', d: '2026-11-25', entries: [{ id: 'exercise-1', sets: Array.from({ length: actual }, () => ({ done: true })) }], comparison: { version: 1, origin: 'personal', planned: [{ exerciseId: 'exercise-1', workSets: 24, muscleWeights: {} }], adjusted: [{ exerciseId: 'exercise-1', workSets: planned, muscleWeights: {} }], flexApplied: true } })
const answer = { status: 'answered', reasons: ['time_constraint'], note: '  Observação sintética  ' }
describe('training check-in', () => {
 it('does not prompt for a fulfilled adjusted Flex plan or a small change', () => {
  expect(detectTrainingChanges(workout()).shouldPrompt).toBe(false)
  expect(detectTrainingChanges(workout(10, 9)).shouldPrompt).toBe(false)
 })
 it('detects significant missing and extra work using the adjusted reference', () => {
  expect(detectTrainingChanges(workout(10, 8)).triggers).toContain('significant_set_reduction')
  expect(detectTrainingChanges(workout(10, 12)).triggers).toContain('significant_set_increase')
 })
 it('keeps omitted and added exercises distinct from explicit replacements', () => {
  const w = workout(); w.entries[0].id = 'other'
  expect(detectTrainingChanges(w).changes.replacedExercises).toHaveLength(0)
  expect(detectTrainingChanges(w).triggers).toEqual(expect.arrayContaining(['skipped_exercise', 'added_exercise']))
  w.entries[0].replacedFrom = 'exercise-1'
  expect(detectTrainingChanges(w).triggers).toContain('replaced_exercise')
 })
 it('handles repeated exercise occurrences and excludes warmup and unfinished rows', () => {
  const w = workout(10, 8); w.entries.push({ id: 'exercise-1', sets: [{ done: true }, { done: true }, { done: false }, { done: true, phase: 'warmup' }] })
  expect(detectTrainingChanges(w).changes.completedSets).toBe(10)
  expect(detectTrainingChanges(w).shouldPrompt).toBe(false)
 })
 it('never invents a reference for legacy, active or cancelled workouts', () => {
  expect(detectTrainingChanges({ ...workout(), comparison: undefined }).eligible).toBe(false)
  for (const status of ['active', 'cancelled', 'abandoned', 'discarded']) expect(detectTrainingChanges({ ...workout(), status }).shouldPrompt).toBe(false)
 })
 it('saves context without changing execution or snapshots and supports legacy sessions', () => {
  const w = { ...workout(), comparison: undefined }; const state = { workouts: [w] }
  const next = withTrainingCheckin(state, w.id, answer, now, 'operation-1')
  expect(next.workouts).toBe(state.workouts)
  expect(next.trainingCheckIns[w.id].note).toBe('Observação sintética')
  expect(state.trainingCheckIns).toBeUndefined()
 })
 it('normalizes stable reasons, private sharing, text bounds and rejects empty responses', () => {
  const next = withTrainingCheckin({ workouts: [workout()] }, 'session-1', { ...answer, sharing: 'professional', reasons: ['fatigue', 'fatigue', 'unknown'], note: '<b>texto</b>' }, now, 'op')
  expect(next.trainingCheckIns['session-1']).toMatchObject({ sharing: 'private', reasons: ['fatigue'], note: '<b>texto</b>' })
  expect(() => withTrainingCheckin(next, 'session-1', { status: 'answered', reasons: [], note: '  ' }, now, 'empty')).toThrow()
  expect(normalizeTrainingCheckin({ version: 99 })).toBeNull()
 })
 it('dismissal and removal suppress automatic prompts without deleting the workout', () => {
  let state = { workouts: [workout(10, 4)] }
  for (const status of ['dismissed', 'removed']) {
   state = withTrainingCheckin(state, 'session-1', { status }, now, status)
   expect(detectTrainingChanges({ ...state.workouts[0], checkIn: state.trainingCheckIns['session-1'] }).shouldPrompt).toBe(false)
   expect(state.workouts).toHaveLength(1)
  }
 })
 it('aggregates each reason once per answered session, omitting notes and tombstones', () => {
  const value = { version: 1, ...answer, reasons: ['fatigue', 'fatigue', 'time_constraint'], updatedAt: now }
  expect(buildWeeklyCheckinSummary([{ id: 'a', checkIn: value }, { id: 'a', checkIn: value }, { id: 'b', checkIn: { version: 1, status: 'removed' } }])).toMatchObject({ answeredWorkouts: 1, reasons: [{ reason: 'time_constraint', count: 1 }, { reason: 'fatigue', count: 1 }] })
 })
 it('survives the existing persisted projection and private preference wire without copying workouts', () => {
  const state = withTrainingCheckin({ workouts: [workout()] }, 'session-1', answer, now, 'op')
  const restored = projectPersistedState(JSON.parse(JSON.stringify(state)))
  expect(restored.trainingCheckIns).toEqual(state.trainingCheckIns)
  const wire = preferenceValues(state)
  expect(wire.workouts).toBeUndefined()
  expect(wire.trainingCheckIns).toEqual(state.trainingCheckIns)
 })
 it('keeps pending local edits against stale reads and preserves conflicting offline edits', () => {
  const base = { trainingCheckIns: {} }
  const local = { trainingCheckIns: { a: { status: 'removed', operationId: 'new' } } }
  expect(mergeChanges(base, local, base)).toEqual(local)
  expect(() => mergeChanges(base, local, { trainingCheckIns: { a: { status: 'answered', operationId: 'other' } } })).toThrow('sync-conflict')
 })
 it('rejects an identifier outside the active state instead of creating another session', () => {
  expect(() => withTrainingCheckin({ workouts: [workout()] }, 'other-account-session', answer, now, 'op')).toThrow()
 })
})

it('uses owner-only JSONB and never includes private metadata in the workout payload', () => {
 const migration = readFileSync(new URL('../../../supabase/migrations/202610190001_domain_training_state.sql', import.meta.url), 'utf8')
 expect(migration).toContain('account_preferences_owner_read')
 expect(migration).toContain('user_id = auth.uid()')
 const state = withTrainingCheckin({ workouts: [workout()] }, 'session-1', answer, now, 'private')
 expect(JSON.stringify(state.workouts)).not.toContain('Observação sintética')
 expect(state.workouts[0].checkIn).toBeUndefined()
})
it('reuses the durable preferences journal offline and keeps a removal against stale remote reads', async () => {
 let online = false, writes = 0, revision = 2
 let state = { routines: [], week: {}, dayPlan: {}, workouts: [workout()], trainingCheckIns: {}, displayUnit: 'kg', _pendingSync: {} }
 const original = { displayUnit: 'kg', values: preferenceValues(state), revision }
 const sync = createAccountDomainSync({ repository: { savePreferences: async input => { writes++; expect(input.expectedRevision).toBe(revision); return { displayUnit: 'kg', values: input.values, revision: ++revision } } }, getState: () => state, replaceState: next => { state = next }, isOnline: () => online, isCurrent: () => true })
 sync.acceptRemote('preferences', original)
 state = { ...withTrainingCheckin(state, 'session-1', answer, now, 'offline-answer'), _pendingSync: { preferences: true } }
 state = projectPersistedState(JSON.parse(JSON.stringify(state)))
 await sync.start(); expect(writes).toBe(0)
 sync.acceptRemote('preferences', original)
 expect(state.trainingCheckIns['session-1'].status).toBe('answered')
 online = true; await sync.retry(); expect(writes).toBe(1)
 online = false
 state = { ...withTrainingCheckin(state, 'session-1', { status: 'removed' }, now, 'offline-remove'), _pendingSync: { preferences: true } }
 sync.acceptRemote('preferences', original)
 expect(state.trainingCheckIns['session-1'].status).toBe('removed')
 online = true; await sync.retry(); expect(writes).toBe(2)
 expect(state.workouts).toHaveLength(1)
 expect(state.trainingCheckIns['session-1'].status).toBe('removed')
 sync.dispose()
})
it('adds factual context insights without exceeding the existing limit or displacing records', () => {
 const summary = { metrics: { workouts: 1 }, previousMetrics: { workouts: 1 }, historyComplete: true, performance: { personalRecords: [{}] }, period: { isCurrentWeek: true }, canComparePeriods: true, checkins: { answeredWorkouts: 1 } }
 const insights = buildWeeklyInsights(summary)
 expect(insights).toHaveLength(3)
 expect(insights[0].key).toBe('weekly.records')
 expect(insights[2]).toEqual({ key: 'weekly.checkins', args: [1] })
})
