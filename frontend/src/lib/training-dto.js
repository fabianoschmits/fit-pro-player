const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = value => typeof value === 'string' && value.length > 0
const isNullableText = value => value === null || isText(value)
const isRevision = value => Number.isSafeInteger(value) && value > 0
const isIsoDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00`)
  return !Number.isNaN(parsed.getTime())
    && `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` === value
}

function invalid(kind) {
  throw new TypeError(`invalid-${kind}`)
}

export function parseWorkoutSession(value, accountId) {
  if (!isObject(value)
    || !isText(accountId)
    || value.user_id !== accountId
    || !isText(value.id)
    || !isNullableText(value.routine_id)
    || !isNullableText(value.assignment_id)
    || !['active', 'completed', 'abandoned'].includes(value.status)
    || !isRevision(value.revision)
    || !isText(value.writer_token)
    || value.mass_unit !== 'kg'
    || !isObject(value.prescription_snapshot)
    || !isText(value.started_at)
    || !isNullableText(value.completed_at)
    || !isText(value.updated_at)) {
    invalid('workout-session')
  }

  return {
    id: value.id,
    accountId: value.user_id,
    routineId: value.routine_id,
    assignmentId: value.assignment_id,
    status: value.status,
    revision: value.revision,
    writerToken: value.writer_token,
    massUnit: value.mass_unit,
    prescriptionSnapshot: value.prescription_snapshot,
    startedAt: value.started_at,
    completedAt: value.completed_at,
    updatedAt: value.updated_at,
  }
}

export function parsePreferences(value, accountId) {
  if (!isObject(value)
    || !isText(accountId)
    || value.user_id !== accountId
    || !isRevision(value.revision)
    || !['kg', 'lb'].includes(value.display_unit)
    || value.mass_unit !== 'kg'
    || value.state_schema_version !== 2
    || !isObject(value.preferences)
    || !isText(value.updated_at)) {
    invalid('account-preferences')
  }

  return {
    accountId: value.user_id,
    revision: value.revision,
    displayUnit: value.display_unit,
    massUnit: value.mass_unit,
    stateSchemaVersion: value.state_schema_version,
    values: value.preferences,
    updatedAt: value.updated_at,
  }
}

function parseRoutine(value, accountId) {
  if (!isObject(value)
    || value.user_id !== accountId
    || !isText(value.id)
    || !isRevision(value.revision)
    || !isText(value.title)
    || !Number.isSafeInteger(value.position)
    || !isObject(value.prescription)
    || !isText(value.created_at)
    || !isText(value.updated_at)) {
    invalid('athlete-routine')
  }

  return {
    id: value.id,
    accountId: value.user_id,
    revision: value.revision,
    title: value.title,
    position: value.position,
    prescription: value.prescription,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  }
}

function parseSchedule(value, accountId) {
  if (value === null) return null
  if (!isObject(value)
    || value.user_id !== accountId
    || !isRevision(value.revision)
    || !['weekly', 'daily'].includes(value.mode)
    || !isObject(value.schedule)
    || !isText(value.updated_at)) {
    invalid('athlete-schedule')
  }

  return {
    accountId: value.user_id,
    revision: value.revision,
    mode: value.mode,
    values: value.schedule,
    updatedAt: value.updated_at,
  }
}

export function parsePlan(value, accountId) {
  if (!isObject(value) || !Array.isArray(value.routines)) invalid('training-plan')
  return {
    routines: value.routines.map(routine => parseRoutine(routine, accountId)),
    schedule: parseSchedule(value.schedule ?? null, accountId),
  }
}

export function parseWorkoutHistory(value, accountId) {
  if (!Array.isArray(value)) invalid('workout-history')
  return value.map(session => {
    const parsed = parseWorkoutSession(session, accountId)
    if (!['completed', 'abandoned'].includes(parsed.status)) invalid('workout-history')
    return parsed
  })
}

function parseCompletionOperation(value, accountId) {
  if (!isObject(value)
    || value.user_id !== accountId
    || !isText(value.session_id)
    || value.kind !== 'session_completed'
    || !isObject(value.payload)) {
    invalid('workout-operation')
  }
  const workout = value.payload.workout
  if (workout != null && (!isObject(workout) || workout.id !== value.session_id || !Array.isArray(workout.entries))) invalid('workout-operation')
  return { sessionId: value.session_id, workout: workout || null }
}

export function parseCompletedWorkoutRecords(value, accountId) {
  if (!isObject(value) || !Array.isArray(value.sessions) || !Array.isArray(value.operations)) invalid('completed-workout-records')
  const completions = new Map(value.operations.map(operation => {
    const parsed = parseCompletionOperation(operation, accountId)
    return [parsed.sessionId, parsed.workout]
  }))
  return parseWorkoutHistory(value.sessions, accountId).map(session => ({ session, workout: completions.get(session.id) || null }))
}

function parseBodyweightEntry(value, accountId) {
  if (!isObject(value)
    || value.user_id !== accountId
    || !isText(value.id)
    || !isIsoDate(value.measured_on)
    || !Number.isFinite(Number(value.weight_kg)) || Number(value.weight_kg) <= 0 || Number(value.weight_kg) > 1000
    || !isText(value.created_at) || !isText(value.updated_at)) {
    invalid('bodyweight-entry')
  }
  return { id: value.id, accountId: value.user_id, date: value.measured_on, weightKg: Number(value.weight_kg), createdAt: value.created_at, updatedAt: value.updated_at }
}

function parseBodyMeasurementCheckin(value, accountId) {
  if (!isObject(value)
    || value.user_id !== accountId
    || !isText(value.id)
    || !isIsoDate(value.measured_on)
    || !isObject(value.measurements_cm)
    || !isNullableText(value.note)
    || !isText(value.created_at) || !isText(value.updated_at)) {
    invalid('body-measurement-checkin')
  }
  const valuesCm = {}
  for (const [part, measurement] of Object.entries(value.measurements_cm)) {
    if (!isText(part) || !Number.isFinite(Number(measurement)) || Number(measurement) <= 0 || Number(measurement) > 400) invalid('body-measurement-checkin')
    valuesCm[part] = Number(measurement)
  }
  return { id: value.id, accountId: value.user_id, date: value.measured_on, valuesCm, note: value.note, createdAt: value.created_at, updatedAt: value.updated_at }
}

export function parseBodyData(value, accountId) {
  if (!isObject(value) || !Array.isArray(value.weights) || !Array.isArray(value.measurements)) invalid('body-data')
  return {
    weights: value.weights.map(item => parseBodyweightEntry(item, accountId)),
    measurements: value.measurements.map(item => parseBodyMeasurementCheckin(item, accountId)),
  }
}
