import { describe, expect, it, vi } from 'vitest'
import { createProfessionalWorkflowRepository, programMuscleRoutine } from './professional-workflow.js'

describe('professional management repository', () => {
  it('maps the latest published weekly plan into program summaries for muscle previews', async () => {
    const weeklyPlan = { monday: [{ exerciseId: '0025', sets: 3, reps: 8 }] }
    const repo = createProfessionalWorkflowRepository({ client: { rpc: async () => ({ data: { items: [{ id: 'p', title: 'Base', weekly_plan: weeklyPlan }], total: 1, offset: 0, has_more: false }, error: null }) } })
    const page = await repo.programPage()
    expect(page).toMatchObject({ items: [{ id: 'p', weeklyPlan }] })
    expect(programMuscleRoutine(page.items[0]).ex).toEqual([{ id: '0025', sets: 3 }])
    expect(programMuscleRoutine({ weeklyPlan: {} }).ex).toEqual([])
  })
  it('blocks pending exercises in every publication entry point before calling the server', async () => {
    const rpc = vi.fn()
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })
    const weeklyPlan = { monday: [{ exerciseId: '0001', sets: 3, reps: 10 }] }
    await expect(repo.publishVersion('p', weeklyPlan)).rejects.toThrow('weekly-plan-exercise-unavailable')
    await expect(repo.publishProgramVersion('p', weeklyPlan)).rejects.toThrow('weekly-plan-exercise-unavailable')
    await expect(repo.publishProgramDraft({ programId: 'p', weeklyPlan })).rejects.toThrow('weekly-plan-exercise-unavailable')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects missing authoritative totals rather than inventing a zero count', async () => {
    const repo = createProfessionalWorkflowRepository({ client: { rpc: async () => ({ data: { items: [], offset: 0, has_more: false }, error: null }) } })
    await expect(repo.studentPage()).rejects.toThrow('invalid-page')
    await expect(repo.programPage()).rejects.toThrow('invalid-page')
    await expect(repo.executionPage()).rejects.toThrow('invalid-page')
  })
  it('maps exact workspace totals and paginated DTOs with explicit timezone and filters', async () => {
    const calls = []
    const repo = createProfessionalWorkflowRepository({ client: { rpc: async (name, args) => {
      calls.push([name, args])
      const values = {
        professional_dashboard_summary: { active_students: 240, attention_students: 12, today_workouts: 210, active_programs: 4, pending_invites: 2, today: [{ student_user_id: 's', display_name: 'Ana', day_key: 'monday', workout_title: 'A', status: 'scheduled' }], recent_activity: [{ id: 'e', started_at: '2026-10-09', prescription_snapshot: { exercises: [{ notes: 'full' }] } }] },
        professional_students_page: { items: [{ student_user_id: 's', display_name: 'Ana', avatar_ref: 'avatar', current_program: { id: 'p', title: 'Base', assignment_id: 'a', version_id: 'v', version_number: 2, assigned_at: '2026-10-01' }, last_activity_at: '2026-10-09', attention_reasons: ['abandoned'] }], total: 240, offset: 30, has_more: true },
        professional_programs_page: { items: [{ id: 'p', title: 'Base', objective: 'Força', archived: false, workout_count: 3, student_count: 201, last_changed_at: '2026-10-09' }], total: 501, offset: 20, has_more: true },
        professional_executions_page: { items: [{ id: 'e', assignment_id: 'a', day_key: 'monday', started_at: '2026-10-09', prescription_snapshot: { exercises: [{ notes: 'full' }] }, payload: { sets: [1] } }], total: 601, offset: 20, has_more: true },
      }
      return { data: values[name], error: null }
    } } })
    expect(await repo.dashboardSummary({ localDate: '2026-10-08', timeZone: 'America/Sao_Paulo' })).toMatchObject({ activeStudents: 240, attentionStudents: 12, todayWorkouts: 210, activePrograms: 4, pendingInvites: 2, today: [{ studentUserId: 's', dayKey: 'monday', workoutTitle: 'A', status: 'scheduled' }], recentActivity: [{ id: 'e', startedAt: '2026-10-09' }] })
    expect(await repo.studentPage({ search: ' Ana ', status: 'attention', offset: 30, limit: 30 })).toMatchObject({ total: 240, offset: 30, hasMore: true, items: [{ studentUserId: 's', avatarRef: 'avatar', currentProgram: { id: 'p', assignmentId: 'a', versionId: 'v', versionNumber: 2, assignedAt: '2026-10-01' }, lastActivityAt: '2026-10-09', attentionReasons: ['abandoned'] }] })
    expect(await repo.programPage({ archived: false, offset: 20, limit: 20 })).toMatchObject({ total: 501, hasMore: true, items: [{ workoutCount: 3, studentCount: 201, lastChangedAt: '2026-10-09' }] })
    expect(await repo.executionPage({ studentId: 's', search: 'A', status: 'completed', from: '2026-10-01', to: '2026-10-09', offset: 20, limit: 20 })).toMatchObject({ total: 601, items: [{ id: 'e', assignmentId: 'a', dayKey: 'monday', prescriptionSnapshot: { exercises: [{ notes: 'full' }] }, payload: { sets: [1] } }] })
    expect(calls).toEqual([
      ['professional_dashboard_summary', { p_local_date: '2026-10-08', p_timezone: 'America/Sao_Paulo' }],
      ['professional_students_page', { p_search: 'Ana', p_status: 'attention', p_offset: 30, p_limit: 30 }],
      ['professional_programs_page', { p_search: '', p_archived: false, p_offset: 20, p_limit: 20 }],
      ['professional_executions_page', { p_student_id: 's', p_search: 'A', p_status: 'completed', p_from: '2026-10-01', p_to: '2026-10-09', p_offset: 20, p_limit: 20 }],
    ])
  })

  it('deletes only through the owner-scoped safe delete RPC and explains preserved history', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { id: 'p' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'program_in_use' } })
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })

    await expect(repo.deleteProgram('p')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenNthCalledWith(1, 'delete_professional_program', { p_program_id: 'p' })
    await expect(repo.deleteProgram('p')).rejects.toThrow('professional-program-in-use')
    expect(rpc).toHaveBeenNthCalledWith(2, 'delete_professional_program', { p_program_id: 'p' })
  })
  it('updates objective without changing the archived state through the metadata boundary', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'p', professional_user_id: 'owner', title: 'Força', description: null, objective: 'Hipertrofia', archived: true, updated_at: '2026-10-09' }, error: null })
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })
    expect(await repo.updateProgramMetadata({ programId: 'p', title: ' Força ', description: ' ', objective: ' Hipertrofia ' })).toMatchObject({ id: 'p', professionalUserId: 'owner', title: 'Força', description: null, objective: 'Hipertrofia', archived: true, updatedAt: '2026-10-09' })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('update_program_metadata', { p_program_id: 'p', p_title: 'Força', p_description: null, p_objective: 'Hipertrofia' })
  })

  it('publishes a named draft without rewriting prescription arrays', async () => {
    const weeklyPlan = Object.freeze({ monday: Object.freeze([{ exerciseId: '0025', sets: 3, reps: 8, rest: 60, notes: 'Controlado' }]) })
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'v', program_id: 'p', version_number: 2, weekly_plan: weeklyPlan, workout_titles: { monday: 'Força A' }, published_at: '2026-10-09' }, error: null })
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })
    expect(await repo.publishProgramDraft({ programId: 'p', weeklyPlan, workoutTitles: { monday: 'Força A' } })).toMatchObject({ id: 'v', programId: 'p', versionNumber: 2, weeklyPlan, workoutTitles: { monday: 'Força A' }, publishedAt: '2026-10-09' })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('publish_program_version_with_titles', { p_program_id: 'p', p_weekly_plan: weeklyPlan, p_workout_titles: { monday: 'Força A' } })
  })

  it('duplicates an exact version and accepts sources without a published version', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { program: { id: 'copy', title: 'Cópia', archived: false, objective: 'Força' }, version: { id: 'copy-v', program_id: 'copy', version_number: 1, weekly_plan: { monday: [] }, workout_titles: { monday: 'A' } } }, error: null }).mockResolvedValueOnce({ data: { program: { id: 'empty', title: 'Vazio' }, version: null }, error: null })
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })
    expect(await repo.duplicateProgram({ programId: 'p', versionId: 'v', title: ' Cópia ' })).toMatchObject({ program: { id: 'copy', title: 'Cópia', archived: false, objective: 'Força' }, version: { id: 'copy-v', programId: 'copy', versionNumber: 1, workoutTitles: { monday: 'A' } } })
    expect(await repo.duplicateProgram({ programId: 'p2', title: 'Vazio' })).toMatchObject({ program: { id: 'empty' }, version: null })
    expect(rpc).toHaveBeenNthCalledWith(1, 'duplicate_professional_program', { p_program_id: 'p', p_version_id: 'v', p_title: 'Cópia' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'duplicate_professional_program', { p_program_id: 'p2', p_version_id: null, p_title: 'Vazio' })
  })

  it('normalizes private notes and propagates denied access instead of an empty success', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { body: '', updated_at: null }, error: null }).mockResolvedValueOnce({ data: { body: 'Preservar espaço\n', updated_at: '2026-10-09' }, error: null }).mockResolvedValue({ data: null, error: { code: '42501' } })
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })
    expect(await repo.studentNote('student')).toEqual({ body: '', updatedAt: null })
    expect(await repo.saveStudentNote({ studentId: 'student', body: 'Preservar espaço\n' })).toEqual({ body: 'Preservar espaço\n', updatedAt: '2026-10-09' })
    expect(rpc).toHaveBeenNthCalledWith(1, 'professional_student_note', { p_student_id: 'student' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'save_professional_student_note', { p_student_id: 'student', p_body: 'Preservar espaço\n' })
    await expect(repo.studentNote('student')).rejects.toEqual({ code: '42501' })
    await expect(repo.saveStudentNote({ studentId: 'student', body: 'Denied' })).rejects.toEqual({ code: '42501' })
  })
  it('lists private student notes and appends a dated note through protected RPCs', async () => {
    const created = { id: 'note-2', body: 'Nova nota', created_at: '2026-10-28T12:34:00Z' }
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ id: 'note-1', body: 'Legada', created_at: '2026-10-20T12:30:00Z' }], error: null }).mockResolvedValueOnce({ data: created, error: null })
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })
    await expect(repo.studentNotes('student')).resolves.toEqual([{ id: 'note-1', body: 'Legada', createdAt: '2026-10-20T12:30:00Z' }])
    await expect(repo.addStudentNote({ studentId: 'student', body: 'Nova nota' })).resolves.toEqual({ id: 'note-2', body: 'Nova nota', createdAt: '2026-10-28T12:34:00Z' })
    expect(rpc).toHaveBeenNthCalledWith(1, 'list_professional_student_notes', { p_student_id: 'student' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'add_professional_student_note', { p_student_id: 'student', p_body: 'Nova nota' })
  })
  it('rejects invalid private note responses and propagates denied list and append access', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ body: 'missing id' }], error: null }).mockResolvedValueOnce({ data: null, error: { code: '42501' } }).mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })
    await expect(repo.studentNotes('student')).rejects.toThrow('invalid-private-note')
    await expect(repo.studentNotes('student')).rejects.toEqual({ code: '42501' })
    await expect(repo.addStudentNote({ studentId: 'student', body: 'Denied' })).rejects.toEqual({ code: '42501' })
  })

  it('propagates versioned names and objective into received material DTOs', async () => {
    const repo = createProfessionalWorkflowRepository({ client: { rpc: async () => ({ data: [{ materials: [{ assignment_id: 'a', program_id: 'p', version_id: 'v', title: 'Base', objective: 'Força', workout_titles: { monday: 'Superior' }, weekly_plan: { monday: [{ exerciseId: 'x', sets: 3, reps: 8 }] } }] }] }) } })
    expect((await repo.studentProfessionalDetail('pro')).materials[0]).toMatchObject({ objective: 'Força', workoutTitles: { monday: 'Superior' }, weeklyPlan: { monday: [{ exerciseId: 'x', sets: 3, reps: 8 }] } })
  })
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
    const plan = { monday: [{ exerciseId: '0025', sets: 3, reps: 8 }] }

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

  it('normalizes additive overview title metadata while retaining its existing fields', async () => {
    const repository = createProfessionalWorkflowRepository({ client: { rpc: async () => ({ data: { program: { title: 'Base', objective: 'Força' }, version: { id: 'v', versionNumber: 2, weeklyPlan: { monday: [] }, workout_titles: { monday: 'A' } } } }) } })
    expect(await repository.studentOverview()).toEqual({ program: { title: 'Base', objective: 'Força' }, version: { id: 'v', versionNumber: 2, weeklyPlan: { monday: [] }, workoutTitles: { monday: 'A' } } })
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
      linkedAt: '2026-10-01', activeProgramTitle: 'Força', receivedCount: 0,
    }, {
      professionalId: 'pro-2', relationshipId: 'link-2', professionalName: 'Bia',
      bio: null, specialties: [], cityRegion: null, registrationType: null,
      registrationNumber: null, verificationStatus: 'unverified', linkedAt: null, activeProgramTitle: null, receivedCount: 0,
    }])
    expect(rpc).toHaveBeenCalledExactlyOnceWith('student_professional_cards', {})
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
      professional: { professionalId: 'pro-1', relationshipId: 'link-1', professionalName: 'Ana', bio: null, specialties: [], cityRegion: null, registrationType: null, registrationNumber: null, verificationStatus: 'unverified', linkedAt: '2026-10-01', activeProgramTitle: null, receivedCount: 0 },
      relationship: { id: 'link-1', status: 'active', linkedAt: '2026-10-01' },
      materials: [{ assignmentId: 'a-1', programId: 'p-1', versionId: 'v-1', title: 'Força', description: 'Base', objective: null, status: 'revoked', versionNumber: 2, publishedAt: '2026-09-30', assignedAt: '2026-10-02', weeklyPlan: { monday: [] }, workoutTitles: {} }],
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
  it('reads invite rows with personal-code flags and persists personal-code edits through the RPC', async () => {
    const rows = [{ id: 'personal', code: 'ANASOUZA', status: 'pending', is_personal: true, is_custom: false }]
    const query = {
      select: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      then: resolve => resolve({ data: rows, error: null }),
    }
    const from = vi.fn(() => query)
    const rpc = vi.fn().mockResolvedValue({ data: { ...rows[0], code: 'ANAFIT', is_custom: true }, error: null })
    const repo = createProfessionalWorkflowRepository({ client: { from, rpc } })

    expect(await repo.invites()).toEqual(rows)
    expect(await repo.savePersonalInviteCode('Ana Fit')).toMatchObject({ code: 'ANAFIT', is_personal: true, is_custom: true })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('save_professional_personal_invite', { p_code: 'Ana Fit' })
  })

  it('maps personal-code conflicts to a stable repository error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'code_taken' } })
    const repo = createProfessionalWorkflowRepository({ client: { rpc } })
    await expect(repo.savePersonalInviteCode('ANA')).rejects.toThrow('professional-invite-code-taken')
  })

