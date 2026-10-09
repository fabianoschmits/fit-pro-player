/** @typedef {{title:string,description:string,objective:string,weeklyPlan:Object,workoutTitles:Object<string,string>}} WeekDraft */
/** @typedef {{id:string,professionalUserId:string,title:string,description:?string,objective:?string,archived:boolean,createdAt:?string,updatedAt:?string}} ProgramMetadata */
/** @typedef {{id:string,programId:string,versionNumber:number,weeklyPlan:Object,workoutTitles:Object<string,string>,publishedAt:?string,createdAt:?string}} ProgramVersion */
/** @typedef {{body:string,updatedAt:?string}} StudentNote */
const toProgram = value => value ? ({
  id: value.id, professionalUserId: value.professional_user_id,
  title: value.title, description: value.description || null, objective: value.objective || null,
  archived: Boolean(value.archived), createdAt: value.created_at || null, updatedAt: value.updated_at || null,
}) : null

const toVersion = value => value ? ({
  id: value.id, programId: value.program_id, versionNumber: value.version_number,
  weeklyPlan: value.weekly_plan || {}, workoutTitles: value.workout_titles || {},
  publishedAt: value.published_at || null, createdAt: value.created_at || null,
}) : null

const toNote = value => ({ body: value?.body || '', updatedAt: value?.updated_at || null })

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

const toStudentProfessional = value => ({
  professionalId: value?.professional_user_id || null,
  relationshipId: value?.relationship_id || null,
  professionalName: value?.professional_name || 'Profissional',
  bio: value?.bio || null,
  specialties: value?.specialties || [],
  cityRegion: value?.city_region || null,
  registrationType: value?.registration_type || null,
  registrationNumber: value?.registration_number || null,
  verificationStatus: value?.verification_status || 'unverified',
  linkedAt: value?.linked_at || null,
  activeProgramTitle: value?.active_program_title || null,
})

const toStudentProfessionalDetail = value => value ? ({
  professional: toStudentProfessional(value.professional),
  relationship: {
    id: value.relationship?.id || null,
    status: value.relationship?.status || null,
    linkedAt: value.relationship?.linked_at || null,
  },
  materials: (value.materials || []).map(material => ({
    assignmentId: material.assignment_id,
    programId: material.program_id,
    versionId: material.version_id,
    title: material.title,
    description: material.description || null,
    objective: material.objective || null,
    status: material.status,
    versionNumber: material.version_number,
    publishedAt: material.published_at,
    assignedAt: material.assigned_at,
    weeklyPlan: material.weekly_plan || {},
    workoutTitles: material.workout_titles || {},
  })),
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
  const relationships = userId => read('professional_student_relationships', q => q.select('*').or(`professional_user_id.eq.${userId},student_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(500))
  const professionalRole = userId => read('user_roles', q => q.select('role').eq('user_id', userId)).then(rows => rows.some(row => row.role === 'professional'))
  const invites = () => read('professional_invites', q => q.select('id,kind,code,status,created_at,accepted_at').order('created_at', { ascending: false }).limit(500))
  const createInvite = kind => rpc('create_professional_invite', { p_kind: kind || 'code' })
  const previewInvite = code => rpc('preview_professional_invite', { p_code: code })
  const acceptInvite = code => rpc('accept_professional_invite', { p_code: code })
  const revokeRelationship = id => rpc('revoke_professional_relationship', { p_relationship_id: id })
  const revokeInvite = id => rpc('revoke_professional_invite', { p_invite_id: id })
  const programs = () => read('programs', q => q.select('*').order('updated_at', { ascending: false }).limit(500))
  const versions = programId => read('program_versions', q => q.select('*').eq('program_id', programId).order('version_number', { ascending: false }).limit(100))
  const version = versionId => read('program_versions', q => q.select('*').eq('id', versionId)).then(rows => rows[0] || null)
  const createProgram = (_userId, title, description = '') => rpc('create_program', { p_title: title.trim(), p_description: description.trim() || null })
  const updateProgram = (programId, { title, description = '', archived = false }) => rpc('update_program', { p_program_id: programId, p_title: title.trim(), p_description: description.trim() || null, p_archived: archived })
  const publishVersion = (programId, weeklyPlan) => rpc('publish_program_version', { p_program_id: programId, p_weekly_plan: weeklyPlan })
  const updateProgramMetadata = ({ programId, title, description = '', objective = '' }) => rpc('update_program_metadata', { p_program_id: programId, p_title: title.trim(), p_description: description.trim() || null, p_objective: objective.trim() || null }).then(toProgram)
  const publishProgramDraft = ({ programId, weeklyPlan, workoutTitles = {} }) => rpc('publish_program_version_with_titles', { p_program_id: programId, p_weekly_plan: weeklyPlan, p_workout_titles: workoutTitles }).then(toVersion)
  const duplicateProgram = ({ programId, versionId = null, title }) => rpc('duplicate_professional_program', { p_program_id: programId, p_version_id: versionId, p_title: title.trim() }).then(value => ({ program: toProgram(value?.program), version: toVersion(value?.version) }))
  const studentNote = studentId => rpc('professional_student_note', { p_student_id: studentId }).then(toNote)
  const saveStudentNote = ({ studentId, body }) => rpc('save_professional_student_note', { p_student_id: studentId, p_body: body }).then(toNote)
  const assignments = () => read('program_assignments', q => q.select('*').order('created_at', { ascending: false }).limit(500))
  const assignedPrograms = studentId => read('program_assignments', q => q.select('*').eq('student_user_id', studentId).eq('status', 'active').order('created_at', { ascending: false }).limit(500))
  const assign = ({ programId, versionId, studentUserId }) => rpc('assign_program_version', { p_program_id: programId, p_version_id: versionId, p_student_user_id: studentUserId })
  const revokeAssignment = assignmentId => rpc('revoke_program_assignment', { p_assignment_id: assignmentId })
  const executions = () => read('workout_executions', q => q.select('*').order('started_at', { ascending: false }).limit(500))
  const clientSummaries = () => rpc('professional_client_summaries', {}).then(rows => (rows || []).map(toClientSummary))
  const clientDetail = studentUserId => rpc('professional_client_detail', { p_student_user_id: studentUserId }).then(rows => toClientDetail(rows?.[0]))
  const publishProgramVersion = (programId, weeklyPlan) => rpc('publish_program_version', { p_program_id: programId, p_weekly_plan: weeklyPlan })
  const assignProgramVersion = ({ programId, versionId, studentUserId }) => rpc('assign_program_version', { p_program_id: programId, p_version_id: versionId, p_student_user_id: studentUserId })
  const studentOverview = () => rpc('student_program_overview', {}).then(value => {
    if (!value?.version) return value
    const { workout_titles, ...version } = value.version
    return { ...value, version: { ...version, workoutTitles: workout_titles || {} } }
  })
  const studentProfessionals = () => rpc('student_professional_summaries', {}).then(rows => (rows || []).map(toStudentProfessional))
  const studentProfessionalDetail = professionalId => rpc('student_professional_detail', { p_professional_user_id: professionalId }).then(rows => toStudentProfessionalDetail(rows?.[0]))
  return Object.freeze({ toProfile, toClientSummary, toClientDetail, professionalRole, relationships, invites, createInvite, previewInvite, acceptInvite, revokeRelationship, revokeInvite, programs, versions, version, createProgram, updateProgram, publishVersion, updateProgramMetadata, publishProgramDraft, duplicateProgram, studentNote, saveStudentNote, revokeAssignment, assignments, assignedPrograms, assign, executions, clientSummaries, clientDetail, publishProgramVersion, assignProgramVersion, studentOverview, studentProfessionals, studentProfessionalDetail })
}
