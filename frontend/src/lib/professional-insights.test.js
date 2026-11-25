import { describe, it, expect } from 'vitest'
import { buildProfessionalInsights, applyInsightState, insightCounts } from './professional-insights.js'
const now = new Date('2026-11-25T15:00:00Z')
const student = { id: 'student', relationshipId: 'cycle', relationshipCreatedAt: '2026-10-01', activePlan: true }
const workout = (id, d = '2026-11-23', actual = 2, planned = 4) => ({ id, d, status: 'completed', entries: [{ id: 'bench', sets: Array.from({ length: actual }, () => ({ done: true, reps: 8 })) }], comparison: { version: 1, origin: 'professional', flexApplied: false, planned: [{ exerciseId: 'bench', workSets: planned, muscleWeights: {} }], adjusted: [{ exerciseId: 'bench', workSets: planned, muscleWeights: {} }] } })
const build = (extra = {}) => buildProfessionalInsights({ student, workouts: [workout('a'), workout('b'), workout('c')], coverage: { complete: true }, now, timeZone: 'America/Sao_Paulo', ...extra })
describe('professional insights — authorized input', () => {
 it('counts only explicitly shared reasons once per session', () => {
  const sharedCheckins = ['a', 'b', 'c'].map(workoutId => ({ workoutId, reasons: ['time_constraint', 'fatigue', 'equipment_unavailable', 'time_constraint'] }))
  const alerts = build({ sharedCheckins })
  for (const type of ['recurring_time_constraint', 'recurring_fatigue', 'recurring_equipment_unavailable']) expect(alerts.find(a => a.type === type)?.evidence.workoutIds).toHaveLength(3)
 })
 it('uses weighted adjusted totals and respects Flex fulfillment', () => {
  expect(build().find(a => a.type === 'recurring_low_completion')?.evidence.completion).toBe(50)
  expect(build({ workouts: ['a','b','c'].map(id => workout(id, undefined, 4, 4)) }).some(a => a.type === 'recurring_low_completion')).toBe(false)
 })
 it('does not infer replacements from additions', () => {
  const workouts = ['a','b','c'].map(id => ({ ...workout(id), entries: [{ id: 'other', sets: [{ done: true }] }] }))
  const alert = build({ workouts }).find(a => a.type === 'recurring_exercise_changes')
  expect(alert.evidence.changes.every(c => c.replacedExercises.length === 0 && c.skippedExercises.includes('bench'))).toBe(true)
 })
 it('compares complete weeks only and suppresses incomplete absence claims', () => {
  const workouts = [0,1,2,3].map(i => workout('old'+i,'2026-11-10')).concat([workout('new','2026-11-18')])
  expect(build({ workouts }).some(a => a.type === 'reduced_training_frequency')).toBe(true)
  expect(build({ workouts, coverage: { complete: false } }).some(a => a.type === 'reduced_training_frequency')).toBe(false)
 })
 it('requires three complete weeks for consistency', () => {
  const workouts = ['2026-11-02','2026-11-09','2026-11-16'].flatMap((d,i) => [workout(i+'a',d),workout(i+'b',d)])
  expect(build({ workouts }).some(a => a.type === 'positive_training_consistency')).toBe(true)
 })
 it('never reads a private checkin or note as consent', () => {
  const workouts = [{ ...workout('a'), checkIn: { reasons: ['pain_or_discomfort'], note: 'private' } }]
  expect(build({ workouts }).some(a => a.type === 'reported_discomfort')).toBe(false)
  const result = build({ workouts, sharedCheckins: [{ workoutId:'a', reasons:['pain_or_discomfort'] }] })
  expect(result.some(a => a.type === 'reported_discomfort')).toBe(true)
  expect(JSON.stringify(result)).not.toContain('private')
 })
 it('deduplicates sessions, excludes future/active records and stabilizes identities', () => {
  const a = build()
  expect(build({ workouts:[workout('a'),workout('a'),workout('future','2026-12-01'),{...workout('active'),status:'active'}] }).some(a => a.type==='recurring_low_completion')).toBe(false)
  expect(build()).toEqual(a)
 })
 it('keeps reviewed state until materially new session evidence', () => {
  const alert = build().find(a => a.type === 'recurring_low_completion')
  const state = { status:'reviewed', evidenceFingerprint:alert.evidenceFingerprint }
  expect(applyInsightState(alert,state,now).status).toBe('reviewed')
  expect(applyInsightState({...alert,evidence:{...alert.evidence,workoutIds:alert.evidence.workoutIds.slice(1)},evidenceFingerprint:JSON.stringify([alert.type,alert.evidence.workoutIds.slice(1),null])},state,now).status).toBe('reviewed')
  expect(applyInsightState({...alert,evidence:{...alert.evidence,workoutIds:[...alert.evidence.workoutIds,'new-session']},evidenceFingerprint:JSON.stringify([alert.type,[...alert.evidence.workoutIds,'new-session'],null])},state,now).status).toBe('new')
 })
 it('snoozes until due and counts students separately from alerts', () => {
  const alerts = build().map(a => applyInsightState(a,{status:'snoozed',evidenceFingerprint:a.evidenceFingerprint,snoozedUntil:'2026-11-26T00:00:00Z'},now))
  expect(alerts.every(a => a.status==='snoozed')).toBe(true)
  expect(insightCounts(build().map(a=>({...a,status:'new'})),1).pendingStudents).toBe(1)
 })
 it('requires explicit Flex evidence and conservative relationship coverage', () => {
  const absent=build({workouts:[workout('last','2026-11-10')] }).find(a=>a.type==='no_recent_workouts')
  const later=build({workouts:[workout('last','2026-11-10')],now:new Date('2026-11-26T15:00:00Z')}).find(a=>a.type==='no_recent_workouts')
  expect(later.evidenceFingerprint).toBe(absent.evidenceFingerprint)
  const workouts = ['a','b','c'].map(id=>({...workout(id),comparison:{...workout(id).comparison,flexApplied:true,planned:[{exerciseId:'bench',workSets:8,muscleWeights:{}}]}}))
  expect(build({workouts}).some(a=>a.type==='frequent_flex_adjustments')).toBe(true)
  expect(build({workouts,student:{...student,relationshipCreatedAt:'2026-11-24'},coverage:{complete:false}}).some(a=>a.type==='no_recent_workouts')).toBe(false)
 })
})
