import { describe, expect, it } from 'vitest'
import { mergeSessionComparison, parseActiveWorkoutSession } from './training-dto.js'

const comparison = count => ({ version: 1, origin: 'personal', planned: [{ exerciseId: 'x', workSets: 4, muscleWeights: { chest: 1 } }], adjusted: count === null ? null : [{ exerciseId: 'x', workSets: count, muscleWeights: { chest: 1 } }], flexApplied: count === 2 })
const session = { id: 'session', user_id: 'owner', routine_id: null, assignment_id: null, status: 'active', revision: 4, writer_token: 'writer', mass_unit: 'kg', prescription_snapshot: { comparison: comparison(null) }, started_at: 'start', completed_at: null, updated_at: 'updated' }
const operation = (revision, count) => ({ user_id: 'owner', session_id: 'session', session_revision: revision, payload: { active: { id: 'session', comparison: comparison(count) } } })

describe('single historical adjusted reference', () => {
  it('never overwrites an already frozen adjusted snapshot with a later payload', () => {
    expect(mergeSessionComparison(comparison(2), comparison(4))).toEqual(comparison(2))
  })
  it('restores the first confirmation by revision, even if a later valid operation differs', () => {
    const result = parseActiveWorkoutSession(session, [operation(3, 4), operation(2, 2)], 'owner')
    expect(result.prescriptionSnapshot.comparison).toEqual(comparison(2))
  })
})
