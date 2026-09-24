import { describe, expect, it, vi } from 'vitest'
import { createProfessionalExecutionRepository, groupExecutionsByDate } from './professional-execution.js'

describe('professional execution repository', () => {
  it('starts an assigned execution idempotently', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const single = vi.fn().mockResolvedValue({ data: { id: 'execution-1', status: 'in_progress' }, error: null })
    const eq = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) })) }))
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) , insert: vi.fn(() => ({ select: vi.fn(() => ({ single })) })) })) }
    const repo = createProfessionalExecutionRepository({ client })

    const result = await repo.startAssignedExecution({ assignmentId: 'a', versionId: 'v', studentUserId: 's', dayKey: 'monday' })

    expect(result.id).toBe('execution-1')
    expect(client.from).toHaveBeenCalledWith('workout_executions')
  })

  it('returns the existing in-progress execution instead of duplicating it', async () => {
    const existing = { id: 'execution-existing', status: 'in_progress' }
    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null })
    const eq = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) })) }))
    const insert = vi.fn()
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })), insert })) }

    const result = await createProfessionalExecutionRepository({ client }).startAssignedExecution({ assignmentId: 'a', versionId: 'v', studentUserId: 's', dayKey: 'monday' })

    expect(result).toEqual(existing)
    expect(insert).not.toHaveBeenCalled()
  })

  it('groups executions by calendar date', () => {
    expect(groupExecutionsByDate([
      { id: 'a', started_at: '2026-09-24T08:00:00.000Z' },
      { id: 'b', started_at: '2026-09-24T13:00:00.000Z' },
      { id: 'c', started_at: '2026-09-25T08:00:00.000Z' },
    ])).toEqual({
      '2026-09-24': [{ id: 'a', started_at: '2026-09-24T08:00:00.000Z' }, { id: 'b', started_at: '2026-09-24T13:00:00.000Z' }],
      '2026-09-25': [{ id: 'c', started_at: '2026-09-25T08:00:00.000Z' }],
    })
  })
})
