import { describe, expect, it } from 'vitest'
import { createProfessionalExecutionRepository, groupExecutionsByDate } from './professional-execution.js'

describe('professional execution repository', () => {
  it('replays a supplied stable session id through the authenticated start RPC', async () => {
    const calls = []; const client = { rpc: async (name, args) => { calls.push([name, args]); return { data: { id: args.p_execution_id } } } }
    const repo = createProfessionalExecutionRepository({ client })
    const result = await repo.startAssignedExecution({ executionId: 'e', assignmentId: 'a', dayKey: 'monday', startedAt: '2026-10-02T12:00:00Z' })
    expect(result.id).toBe('e')
    expect(calls).toEqual([['start_workout_execution', { p_execution_id: 'e', p_assignment_id: 'a', p_day_key: 'monday', p_payload: {}, p_started_at: '2026-10-02T12:00:00Z' }]])
  })
  it('sends terminal states only through RPC and preserves payload', async () => {
    const calls = []; const client = { rpc: async (name, args) => { calls.push([name, args]); return { data: { id: args.p_execution_id } } } }
    const repo = createProfessionalExecutionRepository({ client })
    await repo.completeAssignedExecution({ executionId: 'e', payload: { entries: [] }, completedAt: '2026-10-02T12:00:00Z' })
    await repo.abandonAssignedExecution({ executionId: 'e2', completedAt: '2026-10-02T12:00:00Z' })
    expect(calls[0]).toEqual(['complete_workout_execution', { p_execution_id: 'e', p_payload: { entries: [] }, p_completed_at: '2026-10-02T12:00:00Z' }])
    expect(calls[1][0]).toBe('abandon_workout_execution')
  })
  it('groups executions by local calendar date', () => {
    const date = new Date(2026, 9, 2, 23, 30)
    expect(groupExecutionsByDate([{ id: 'a', started_at: date.toISOString() }])).toHaveProperty('2026-10-02')
  })
})
