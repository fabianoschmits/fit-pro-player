export function createProfessionalExecutionRepository({ client } = {}) {
  const rpc = async (name, args) => {
    if (!client?.rpc) throw new Error('supabase-unavailable')
    const response = await client.rpc(name, args)
    if (response?.error) throw response.error
    return response?.data || null
  }
  const startAssignedExecution = ({ executionId = crypto.randomUUID(), assignmentId, dayKey, payload = {}, startedAt = new Date().toISOString() }) => rpc('start_workout_execution', { p_execution_id: executionId, p_assignment_id: assignmentId, p_day_key: dayKey, p_payload: payload, p_started_at: startedAt })
  const completeAssignedExecution = ({ executionId, payload = {}, completedAt = new Date().toISOString() }) => rpc('complete_workout_execution', { p_execution_id: executionId, p_payload: payload, p_completed_at: completedAt })
  const abandonAssignedExecution = ({ executionId, payload = {}, completedAt = new Date().toISOString() }) => rpc('abandon_workout_execution', { p_execution_id: executionId, p_payload: payload, p_completed_at: completedAt })
  return Object.freeze({ startAssignedExecution, completeAssignedExecution, abandonAssignedExecution })
}

export function groupExecutionsByDate(executions = []) {
  return executions.reduce((groups, execution) => {
    const value = new Date(execution.started_at || execution.completed_at || '')
    const date = Number.isFinite(value.getTime()) ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : 'unknown'
    ;(groups[date] ||= []).push(execution)
    return groups
  }, {})
}
