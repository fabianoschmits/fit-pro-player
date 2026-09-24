import { describe, expect, it, vi } from 'vitest'
import { createProfessionalWorkflowRepository } from './professional-workflow.js'

describe('professional management repository', () => {
  it('reads normalized client summaries and detail through protected RPCs', async () => {
    const rpc = vi.fn(async name => name === 'professional_client_summaries'
      ? { data: [{ student_user_id: 'student-1', display_name: 'Ana', active_assignment_id: 'assignment-1' }], error: null }
      : { data: [{ student_user_id: 'student-1', assignments: [], executions: [] }], error: null })
    const repository = createProfessionalWorkflowRepository({ client: { rpc } })

    expect(await repository.clientSummaries()).toMatchObject([{ studentUserId: 'student-1', displayName: 'Ana', activeAssignmentId: 'assignment-1' }])
    expect(await repository.clientDetail('student-1')).toMatchObject({ studentUserId: 'student-1', assignments: [], executions: [] })
    expect(rpc).toHaveBeenNthCalledWith(1, 'professional_client_summaries', {})
    expect(rpc).toHaveBeenNthCalledWith(2, 'professional_client_detail', { p_student_user_id: 'student-1' })
  })

  it('publishes and assigns only through explicit RPC arguments', async () => {
    const rpc = vi.fn(async (name, args) => ({ data: { id: name, ...args }, error: null }))
    const repository = createProfessionalWorkflowRepository({ client: { rpc } })
    const plan = { monday: [{ exerciseId: '1254', sets: 3, reps: 8 }] }

    await repository.publishProgramVersion('program-1', plan)
    await repository.assignProgramVersion({ programId: 'program-1', versionId: 'version-1', studentUserId: 'student-1' })

    expect(rpc).toHaveBeenNthCalledWith(1, 'publish_program_version', { p_program_id: 'program-1', p_weekly_plan: plan })
    expect(rpc).toHaveBeenNthCalledWith(2, 'assign_program_version', { p_program_id: 'program-1', p_version_id: 'version-1', p_student_user_id: 'student-1' })
  })

  it('reads the current student overview through its caller-scoped RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { program: { title: 'Força' }, executions: [] }, error: null })
    const repository = createProfessionalWorkflowRepository({ client: { rpc } })
    expect(await repository.studentOverview()).toMatchObject({ program: { title: 'Força' } })
    expect(rpc).toHaveBeenCalledWith('student_program_overview', {})
  })

  it('revokes a pending invite through its owner-scoped RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'invite-1', status: 'revoked' }, error: null })
    const repository = createProfessionalWorkflowRepository({ client: { rpc } })
    await repository.revokeInvite('invite-1')
    expect(rpc).toHaveBeenCalledWith('revoke_professional_invite', { p_invite_id: 'invite-1' })
  })
})
