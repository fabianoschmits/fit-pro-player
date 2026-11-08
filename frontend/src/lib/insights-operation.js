import { detectInsightFailure, getInsightsAccount, trackInsight } from './insights-client.js'
import { operationEventId } from './insights-events.js'
const definitions = {
  start_workout_session: ['workout_start_requested','workout_start_confirmed','workout','requested','confirmed'],
  complete_workout_session: ['workout_finish_requested','workout_finish_confirmed','workout','finish_requested','finished'],
  abandon_workout_session: [null,'workout_abandon_confirmed','workout',null,'abandoned'],
  take_over_workout_session: [null,'workout_recovery_succeeded','workout',null,'recovered'],
}
const reported = new Map()
const remember = key => { reported.set(key,true); if(reported.size>500) reported.delete(reported.keys().next().value) }
export function beginInsightOperation(name, parameters, accountId = getInsightsAccount()) {
  const owner = getInsightsAccount()
  if (!owner || owner !== accountId) return () => {}
  if (name === 'append_workout_operation' && parameters.p_kind === 'set_upserted') {
    const session = parameters.p_session_id
    return error => {
      if (error || getInsightsAccount() !== owner) return
      if (!reported.has(owner + ':first:' + session)) {
        remember(owner + ':first:' + session)
        trackInsight('workout_set_recorded',{event_id:operationEventId(session,'first_set'),flow:'workout',step:'first_set',journey_id:session,operation_id:parameters.p_operation_id})
      }
      trackInsight('workout_progress_recorded',{event_id:operationEventId(parameters.p_operation_id,'progress'),flow:'workout',step:'progress',journey_id:session,operation_id:parameters.p_operation_id})
    }
  }
  const definition = definitions[name]
  if (!definition) return () => {}
  const [start,success,flow,entry,exit] = definition
  const journey = parameters.p_session_id || crypto.randomUUID()
  const operation = parameters.p_operation_id || journey
  const key = owner + ':' + name + ':' + operation
  const startedAt = performance.now()
  const properties = { flow,journey_id:journey,operation_id:operation,action:name }
  const timeout = setTimeout(() => {
    if (getInsightsAccount() === owner && globalThis.navigator?.onLine !== false && globalThis.document?.visibilityState === 'visible') trackInsight('operation_slow',{...properties,duration_ms:15000,outcome:'pending'})
  },15000)
  if (start && !reported.has(key + ':start')) { trackInsight(start,{...properties,event_id:operationEventId(operation,start),step:entry}); remember(key + ':start') }
  return error => {
    clearTimeout(timeout)
    if (getInsightsAccount() !== owner) return
    if (error) {
      if (error.kind === 'offline' || error.retryable) return
      detectInsightFailure(name,operation,error.kind || 'request_failed')
      if (name === 'take_over_workout_session') trackInsight('workout_recovery_failed',properties)
      return
    }
    if (reported.has(key + ':success')) return
    remember(key + ':success')
    trackInsight(success,{...properties,event_id:operationEventId(operation,success),step:exit,duration_ms:performance.now()-startedAt,outcome:'server_confirmed'})
  }
}
