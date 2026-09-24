const executionRows = client => {
  if (!client?.from) throw new Error('supabase-unavailable')
  return client.from('workout_executions')
}

const unwrap = response => {
  if (response?.error) throw response.error
  return response?.data || null
}

export function createProfessionalExecutionRepository({ client } = {}) {
  const startAssignedExecution = async ({ assignmentId, versionId, studentUserId, dayKey, payload = {} }) => {
    const query = executionRows(client)
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('version_id', versionId)
      .eq('student_user_id', studentUserId)
      .eq('day_key', dayKey)
      .eq('status', 'in_progress')
    const existing = unwrap(await query.maybeSingle())
    if (existing) return existing
    return unwrap(await executionRows(client).insert({
      assignment_id: assignmentId,
      version_id: versionId,
      student_user_id: studentUserId,
      day_key: dayKey,
      payload: { source: 'professional-program', ...payload },
      status: 'in_progress',
    }).select('*').single())
  }

  const completeAssignedExecution = async ({ executionId, payload = {} }) => unwrap(await executionRows(client)
    .update({ status: 'completed', completed_at: new Date().toISOString(), payload })
    .eq('id', executionId)
    .select('*')
    .single())

  const abandonAssignedExecution = async ({ executionId, payload = {} }) => unwrap(await executionRows(client)
    .update({ status: 'abandoned', completed_at: new Date().toISOString(), payload })
    .eq('id', executionId)
    .select('*')
    .single())

  return Object.freeze({ startAssignedExecution, completeAssignedExecution, abandonAssignedExecution })
}

export function groupExecutionsByDate(executions = []) {
  return executions.reduce((groups, execution) => {
    const date = String(execution.started_at || execution.completed_at || '').slice(0, 10) || 'unknown'
    ;(groups[date] ||= []).push(execution)
    return groups
  }, {})
}
