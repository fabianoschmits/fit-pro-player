import { describe, expect, it, vi } from 'vitest'
import { createProfessionalWorkflowRepository } from './professional-workflow.js'

describe('professional management repository', () => {
  it('creates and updates program metadata through owner-scoped RPCs', async () => {
    const calls = []; const repo = createProfessionalWorkflowRepository({ client: { rpc: async (name, args) => { calls.push([name, args]); return { data: { id: 'p' } } } } })
    await repo.createProgram('owner', ' Força ', ' Base ')
    await repo.updateProgram('p', { title: 'Força', description: 'Base', archived: true })
    expect(calls).toEqual([['create_program', { p_title: 'Força', p_description: 'Base' }], ['update_program', { p_program_id: 'p', p_title: 'Força', p_description: 'Base', p_archived: true }]])
  })
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

  it('reads caller-scoped professional summaries with full profile and relationship fields', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{
      professional_user_id: 'pro-1', relationship_id: 'link-1', professional_name: 'Ana',
      bio: 'Treino adaptado', specialties: ['força'], city_region: 'São Paulo',
      registration_type: 'CREF', registration_number: '123', verification_status: 'verified',
      linked_at: '2026-10-01', active_program_title: 'Força',
    }, { professional_user_id: 'pro-2', relationship_id: 'link-2', professional_name: 'Bia' }], error: null })
    const repository = createProfessionalWorkflowRepository({ client: { rpc } })

    expect(await repository.studentProfessionals()).toEqual([{
      professionalId: 'pro-1', relationshipId: 'link-1', professionalName: 'Ana',
      bio: 'Treino adaptado', specialties: ['força'], cityRegion: 'São Paulo',
      registrationType: 'CREF', registrationNumber: '123', verificationStatus: 'verified',
      linkedAt: '2026-10-01', activeProgramTitle: 'Força',
    }, {
      professionalId: 'pro-2', relationshipId: 'link-2', professionalName: 'Bia',
      bio: null, specialties: [], cityRegion: null, registrationType: null,
      registrationNumber: null, verificationStatus: 'unverified', linkedAt: null, activeProgramTitle: null,
    }])
    expect(rpc).toHaveBeenCalledExactlyOnceWith('student_professional_summaries', {})
  })

  it('normalizes selected professional detail and assigned material without changing execution shape', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{
      professional: { professional_user_id: 'pro-1', relationship_id: 'link-1', professional_name: 'Ana', specialties: [], linked_at: '2026-10-01' },
      relationship: { id: 'link-1', status: 'active', linked_at: '2026-10-01' },
      materials: [{ assignment_id: 'a-1', program_id: 'p-1', version_id: 'v-1', title: 'Força', description: 'Base', status: 'revoked', version_number: 2, published_at: '2026-09-30', assigned_at: '2026-10-02', weekly_plan: { monday: [] } }],
      executions: [{ id: 'e-1', assignment_id: 'a-1', version_id: 'v-1', student_user_id: 's-1', day_key: 'monday', status: 'completed', payload: { sets: 3 }, started_at: '2026-10-02', completed_at: '2026-10-02', prescription_snapshot: {}, program_title: 'Força', version_number: 2 }],
    }], error: null })
    const repository = createProfessionalWorkflowRepository({ client: { rpc } })

    expect(await repository.studentProfessionalDetail('pro-1')).toEqual({
      professional: { professionalId: 'pro-1', relationshipId: 'link-1', professionalName: 'Ana', bio: null, specialties: [], cityRegion: null, registrationType: null, registrationNumber: null, verificationStatus: 'unverified', linkedAt: '2026-10-01', activeProgramTitle: null },
      relationship: { id: 'link-1', status: 'active', linkedAt: '2026-10-01' },
      materials: [{ assignmentId: 'a-1', programId: 'p-1', versionId: 'v-1', title: 'Força', description: 'Base', status: 'revoked', versionNumber: 2, publishedAt: '2026-09-30', assignedAt: '2026-10-02', weeklyPlan: { monday: [] } }],
      executions: [{ id: 'e-1', assignment_id: 'a-1', version_id: 'v-1', student_user_id: 's-1', day_key: 'monday', status: 'completed', payload: { sets: 3 }, started_at: '2026-10-02', completed_at: '2026-10-02', prescription_snapshot: {}, program_title: 'Força', version_number: 2 }],
    })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('student_professional_detail', { p_professional_user_id: 'pro-1' })
  })

  it('returns empty summaries and null for a detail denied by linkage', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const repository = createProfessionalWorkflowRepository({ client: { rpc } })
    expect(await repository.studentProfessionals()).toEqual([])
    expect(await repository.studentProfessionalDetail('unrelated')).toBeNull()
  })

  it('defaults missing material and execution lists and propagates read errors', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ professional: { professional_user_id: 'pro-1' }, relationship: { id: 'link-1', status: 'active' } }], error: null })
    const repository = createProfessionalWorkflowRepository({ client: { rpc } })
    expect(await repository.studentProfessionalDetail('pro-1')).toMatchObject({ relationship: { id: 'link-1', status: 'active', linkedAt: null }, materials: [], executions: [] })
    const denied = { code: '42501', message: 'authentication required' }
    rpc.mockResolvedValue({ data: null, error: denied })
    await expect(repository.studentProfessionals()).rejects.toEqual(denied)
    await expect(repository.studentProfessionalDetail('pro-1')).rejects.toEqual(denied)
  })
})
