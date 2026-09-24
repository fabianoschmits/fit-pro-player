const toProfile = value => value ? ({
  userId: value.professional_user_id,
  professionalName: value.professional_name,
  bio: value.bio,
  specialties: value.specialties || [],
  verificationStatus: value.verification_status,
}) : null

const toClientSummary = value => ({
  studentUserId: value?.student_user_id || null,
  displayName: value?.display_name || 'Aluno',
  avatarRef: value?.avatar_ref || null,
  relationshipCreatedAt: value?.relationship_created_at || null,
  activeAssignmentId: value?.active_assignment_id || null,
  programId: value?.program_id || null,
  programTitle: value?.program_title || null,
  versionId: value?.version_id || null,
  versionNumber: value?.version_number || null,
  lastExecutionAt: value?.last_execution_at || null,
  lastExecutionStatus: value?.last_execution_status || null,
})

const toClientDetail = value => value ? ({
  studentUserId: value.student_user_id || null,
  displayName: value.display_name || 'Aluno',
  avatarRef: value.avatar_ref || null,
  relationshipCreatedAt: value.relationship_created_at || null,
  assignments: value.assignments || [],
  executions: value.executions || [],
}) : null

export function createProfessionalWorkflowRepository({ client } = {}) {
  const rpc = async (name, args) => {
    if (!client?.rpc) throw new Error('supabase-unavailable')
    const { data, error } = await client.rpc(name, args)
    if (error) throw error
    return data
  }
  const read = async (table, query) => {
    if (!client?.from) throw new Error('supabase-unavailable')
    const response = await query(client.from(table))
    if (response?.error) throw response.error
    return response.data || []
  }
  const relationships = userId => read('professional_student_relationships', q => q.select('*').or(`professional_user_id.eq.${userId},student_user_id.eq.${userId}`).order('created_at', { ascending: false }))
  const professionalRole = userId => read('user_roles', q => q.select('role').eq('user_id', userId)).then(rows => rows.some(row => row.role === 'professional'))
  const invites = () => read('professional_invites', q => q.select('id,kind,code,status,created_at,accepted_at').order('created_at', { ascending: false }))
  const createInvite = kind => rpc('create_professional_invite', { p_kind: kind || 'code' })
  const previewInvite = code => rpc('preview_professional_invite', { p_code: code })
  const acceptInvite = code => rpc('accept_professional_invite', { p_code: code })
  const revokeRelationship = id => rpc('revoke_professional_relationship', { p_relationship_id: id })
  const revokeInvite = id => rpc('revoke_professional_invite', { p_invite_id: id })
  const programs = () => read('programs', q => q.select('*').order('updated_at', { ascending: false }))
  const versions = programId => read('program_versions', q => q.select('*').eq('program_id', programId).order('version_number', { ascending: false }))
  const version = versionId => read('program_versions', q => q.select('*').eq('id', versionId)).then(rows => rows[0] || null)
  const createProgram = async (userId, title, description = '') => {
    const { data, error } = await client.from('programs').insert({ professional_user_id: userId, title: title.trim(), description: description.trim() || null }).select('*').single()
    if (error) throw error
    return data
  }
  const publishVersion = async (programId, weeklyPlan) => {
    const current = await read('program_versions', q => q.select('version_number').eq('program_id', programId).order('version_number', { ascending: false }).limit(1))
    const versionNumber = Number(current[0]?.version_number || 0) + 1
    const { data, error } = await client.from('program_versions').insert({ program_id: programId, version_number: versionNumber, weekly_plan: weeklyPlan, published_at: new Date().toISOString() }).select('*').single()
    if (error) throw error
    return data
  }
  const assignments = () => read('program_assignments', q => q.select('*').order('created_at', { ascending: false }))
  const assignedPrograms = studentId => read('program_assignments', q => q.select('*').eq('student_user_id', studentId).eq('status', 'active').order('created_at', { ascending: false }))
  const assign = async ({ programId, versionId, professionalUserId, studentUserId }) => {
    const { data, error } = await client.from('program_assignments').insert({ program_id: programId, version_id: versionId, professional_user_id: professionalUserId, student_user_id: studentUserId }).select('*').single()
    if (error) throw error
    return data
  }
  const executions = () => read('workout_executions', q => q.select('*').order('started_at', { ascending: false }))
  const clientSummaries = () => rpc('professional_client_summaries', {}).then(rows => (rows || []).map(toClientSummary))
  const clientDetail = studentUserId => rpc('professional_client_detail', { p_student_user_id: studentUserId }).then(rows => toClientDetail(rows?.[0]))
  const publishProgramVersion = (programId, weeklyPlan) => rpc('publish_program_version', { p_program_id: programId, p_weekly_plan: weeklyPlan })
  const assignProgramVersion = ({ programId, versionId, studentUserId }) => rpc('assign_program_version', { p_program_id: programId, p_version_id: versionId, p_student_user_id: studentUserId })
  const studentOverview = () => rpc('student_program_overview', {})
  return Object.freeze({ toProfile, toClientSummary, toClientDetail, professionalRole, relationships, invites, createInvite, previewInvite, acceptInvite, revokeRelationship, revokeInvite, programs, versions, version, createProgram, publishVersion, assignments, assignedPrograms, assign, executions, clientSummaries, clientDetail, publishProgramVersion, assignProgramVersion, studentOverview })
}
