/** @typedef {{title:string,description:string,objective:string,weeklyPlan:Object,workoutTitles:Object<string,string>}} WeekDraft */
/** @typedef {{id:string,professionalUserId:string,title:string,description:?string,objective:?string,archived:boolean,createdAt:?string,updatedAt:?string}} ProgramMetadata */
/** @typedef {{id:string,programId:string,versionNumber:number,weeklyPlan:Object,workoutTitles:Object<string,string>,publishedAt:?string,createdAt:?string}} ProgramVersion */
/** @typedef {{body:string,updatedAt:?string}} StudentNote */
/** @template T @typedef {{items:T[],total:number,offset:number,hasMore:boolean}} Page */
/** @typedef {{id:string,title:string,assignmentId:string,versionId:string,versionNumber:number,assignedAt:string}} CurrentProgram */
/** @typedef {{studentUserId:string,displayName:string,avatarRef:?string,relationshipCreatedAt:string,currentProgram:?CurrentProgram,lastActivityAt:?string,attentionReasons:string[]}} StudentSummary */
/** @typedef {{id:string,title:string,description:?string,objective:?string,archived:boolean,workoutCount:number,studentCount:number,lastChangedAt:string}} ProgramSummary */
/** @typedef {{activeStudents:number,attentionStudents:number,todayWorkouts:number,activePrograms:number,pendingInvites:number,today:Object[],recentActivity:Object[]}} DashboardSummary */
const toCurrentProgram = value => value ? ({ id: value.id, title: value.title, assignmentId: value.assignment_id, versionId: value.version_id, versionNumber: value.version_number, assignedAt: value.assigned_at }) : null
const toStudentSummary = value => ({ ...toClientSummary(value), currentProgram: toCurrentProgram(value.current_program), lastActivityAt: value.last_activity_at || null, attentionReasons: value.attention_reasons || [] })
const toProgramSummary = value => ({ id: value.id, title: value.title, description: value.description || null, objective: value.objective || null, archived: Boolean(value.archived), workoutCount: Number(value.workout_count), studentCount: Number(value.student_count), lastChangedAt: value.last_changed_at || null })
const toExecution = value => ({ id: value.id, assignmentId: value.assignment_id || null, versionId: value.version_id || null, studentUserId: value.student_user_id, displayName: value.display_name || 'Aluno', avatarRef: value.avatar_ref || null, dayKey: value.day_key, status: value.status, startedAt: value.started_at, completedAt: value.completed_at || null, programTitle: value.program_title || null, versionNumber: value.version_number || null, prescriptionSnapshot: value.prescription_snapshot || {}, payload: value.payload || {} })
const toPage = (value, map) => {
  if (!value || !Array.isArray(value.items) || !Number.isSafeInteger(value.total) || value.total < 0 || !Number.isSafeInteger(value.offset) || value.offset < 0 || typeof value.has_more !== 'boolean') throw new Error('invalid-page')
  return { items: value.items.map(map), total: value.total, offset: value.offset, hasMore: value.has_more }
}
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
  const invites = () => read('professional_invites', q => q.select('id,kind,code,status,created_at,expires_at,accepted_at,accepted_by').order('created_at', { ascending: false }).limit(500))
  const createInvite = kind => rpc('create_professional_invite', { p_kind: kind || 'code' })
  const previewInvite = code => rpc('preview_professional_invite', { p_code: code })
  const acceptInvite = code => rpc('accept_professional_invite', { p_code: code })
  const revokeRelationship = id => rpc('revoke_professional_relationship', { p_relationship_id: id })
  const revokeInvite = id => rpc('revoke_professional_invite', { p_invite_id: id })
  const programs = () => read('programs', q => q.select('*').order('updated_at', { ascending: false }).limit(500))
  const program = programId => read('programs', q => q.select('*').eq('id', programId)).then(rows => rows[0] || null)
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
  const dashboardSummary = ({ localDate, timeZone }) => rpc('professional_dashboard_summary', { p_local_date: localDate, p_timezone: timeZone }).then(value => ({ activeStudents: Number(value.active_students), attentionStudents: Number(value.attention_students), todayWorkouts: Number(value.today_workouts), activePrograms: Number(value.active_programs), pendingInvites: Number(value.pending_invites), today: (value.today || []).map(item => ({ ...toStudentSummary(item), dayKey: item.day_key, workoutTitle: item.workout_title, status: item.status, executionId: item.execution_id || null })), recentActivity: (value.recent_activity || []).map(toExecution) }))
  const studentPage = ({ search = '', status = 'all', offset = 0, limit = 30 } = {}) => rpc('professional_students_page', { p_search: search.trim(), p_status: status, p_offset: offset, p_limit: limit }).then(value => toPage(value, toStudentSummary))
  const programPage = ({ search = '', archived = null, offset = 0, limit = 20 } = {}) => rpc('professional_programs_page', { p_search: search.trim(), p_archived: archived, p_offset: offset, p_limit: limit }).then(value => toPage(value, toProgramSummary))
  const executionPage = ({ studentId = null, search = '', status = 'all', from = null, to = null, offset = 0, limit = 20 } = {}) => rpc('professional_executions_page', { p_student_id: studentId, p_search: search.trim(), p_status: status, p_from: from, p_to: to, p_offset: offset, p_limit: limit }).then(value => toPage(value, toExecution))
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
  return Object.freeze({ toProfile, toClientSummary, toClientDetail, professionalRole, relationships, invites, createInvite, previewInvite, acceptInvite, revokeRelationship, revokeInvite, programs, program, versions, version, createProgram, updateProgram, publishVersion, updateProgramMetadata, publishProgramDraft, duplicateProgram, studentNote, saveStudentNote, dashboardSummary, studentPage, programPage, executionPage, revokeAssignment, assignments, assignedPrograms, assign, executions, clientSummaries, clientDetail, publishProgramVersion, assignProgramVersion, studentOverview, studentProfessionals, studentProfessionalDetail })
}
