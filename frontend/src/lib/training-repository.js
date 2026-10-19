import {
  parsePlan,
  parsePreferences,
  parseWorkoutHistory,
  parseWorkoutSession,
} from './training-dto.js'

export class TrainingRepositoryError extends Error {
  constructor(kind, { code = null, retryable = false, cause } = {}) {
    super(kind, cause ? { cause } : undefined)
    this.name = 'TrainingRepositoryError'
    this.kind = kind
    this.code = code
    this.retryable = retryable
  }
}

function mapError(error) {
  if (error instanceof TrainingRepositoryError) return error
  const message = String(error?.message ?? error ?? '').toLowerCase()
  const code = error?.code ?? null

  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('network request')) {
    return new TrainingRepositoryError('offline', { code, retryable: true, cause: error })
  }
  if (code === '40001' && message.includes('stale workout writer')) {
    return new TrainingRepositoryError('stale-writer', { code, cause: error })
  }
  if (code === '40001') {
    return new TrainingRepositoryError('revision-conflict', { code, retryable: true, cause: error })
  }
  if (code === '42501') return new TrainingRepositoryError('forbidden', { code, cause: error })
  if (code === '55000') return new TrainingRepositoryError('finalized', { code, cause: error })
  if (code === '23505') return new TrainingRepositoryError('active-session', { code, cause: error })
  return new TrainingRepositoryError('request-failed', { code, retryable: false, cause: error })
}

function parseResponse(parser, value, accountId) {
  try {
    return parser(value, accountId)
  } catch (cause) {
    throw new TrainingRepositoryError('invalid-response', { cause })
  }
}

export function createTrainingRepository({ client, accountId }) {
  if (!client || typeof client.rpc !== 'function' || typeof accountId !== 'string' || accountId.length === 0) {
    throw new TypeError('invalid-training-repository-scope')
  }

  async function rpc(name, parameters, parser) {
    let result
    try {
      result = await client.rpc(name, parameters)
    } catch (error) {
      throw mapError(error)
    }
    if (result?.error) throw mapError(result.error)
    return parseResponse(parser, result?.data, accountId)
  }

  async function read(query, parser) {
    let result
    try {
      result = await query
    } catch (error) {
      throw mapError(error)
    }
    if (result?.error) throw mapError(result.error)
    return parseResponse(parser, result?.data, accountId)
  }

  return {
    startSession({ sessionId, prescriptionSnapshot, routineId = null, assignmentId = null }) {
      return rpc('start_workout_session', {
        p_session_id: sessionId,
        p_prescription_snapshot: prescriptionSnapshot,
        p_routine_id: routineId,
        p_assignment_id: assignmentId,
      }, parseWorkoutSession)
    },

    appendOperation({ sessionId, writerToken, expectedRevision, operationId, kind, payload }) {
      return rpc('append_workout_operation', {
        p_session_id: sessionId,
        p_writer_token: writerToken,
        p_expected_revision: expectedRevision,
        p_operation_id: operationId,
        p_kind: kind,
        p_payload: payload,
      }, parseWorkoutSession)
    },

    takeOverSession({ sessionId, expectedRevision }) {
      return rpc('take_over_workout_session', {
        p_session_id: sessionId,
        p_expected_revision: expectedRevision,
      }, parseWorkoutSession)
    },

    completeSession({ sessionId, writerToken, expectedRevision, operationId, payload = {} }) {
      return rpc('complete_workout_session', {
        p_session_id: sessionId,
        p_writer_token: writerToken,
        p_expected_revision: expectedRevision,
        p_operation_id: operationId,
        p_payload: payload,
      }, parseWorkoutSession)
    },

    async loadPlan() {
      if (typeof client.from !== 'function') throw new TypeError('training-repository-read-client-required')
      const [routines, schedule] = await Promise.all([
        read(client.from('athlete_routines').select('*').eq('user_id', accountId).order('position', { ascending: true }).limit(200), value => value),
        read(client.from('athlete_schedules').select('*').eq('user_id', accountId).maybeSingle(), value => value),
      ])
      return parseResponse(parsePlan, { routines, schedule }, accountId)
    },

    loadHistory({ limit = 50 } = {}) {
      if (typeof client.from !== 'function') throw new TypeError('training-repository-read-client-required')
      const query = client.from('workout_sessions')
        .select('*')
        .eq('user_id', accountId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(limit)
      return read(query, parseWorkoutHistory)
    },

    savePreferences({ expectedRevision, displayUnit, values }) {
      return rpc('save_account_preferences', {
        p_expected_revision: expectedRevision,
        p_display_unit: displayUnit,
        p_preferences: values,
      }, parsePreferences)
    },
  }
}
