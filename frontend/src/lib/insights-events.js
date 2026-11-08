export const INSIGHT_EVENTS = Object.freeze(`app_session_started screen_viewed onboarding_started onboarding_step_viewed onboarding_step_completed onboarding_validation_failed onboarding_completed plan_creation_started plan_creation_step_completed plan_creation_completed plan_creation_failed workout_start_requested workout_start_confirmed workout_set_recorded workout_progress_recorded workout_finish_requested workout_finish_confirmed workout_abandon_confirmed workout_recovery_succeeded workout_recovery_failed flex_adjustment_started flex_adjustment_completed flex_adjustment_failed professional_link_requested professional_link_established professional_plan_selected professional_step_completed community_feed_viewed community_publish_started community_upload_completed community_publish_completed community_publish_failed photo_feature_opened photo_selection_started photo_upload_started photo_upload_completed photo_upload_failed photo_comparison_opened photo_comparison_interacted action_failed action_retried operation_slow sync_failed sync_recovered asset_load_failed runtime_error flow_interrupted app_open_measured interface_usable page_loaded storage_failed service_worker_failed`.split(' '))
const names = new Set(INSIGHT_EVENTS)
const routes = new Set(['/home', '/plan', '/workout', '/community', '/progress', '/more', '/support', '/student/professionals', '/professional'])
export function operationEventId(operationId, name) {
  if (!/^[0-9a-f-]{36}$/i.test(operationId || '')) return undefined
  let hash = 2166136261
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0),16777619)
  return operationId.slice(0,28) + ((parseInt(operationId.slice(28),16) ^ hash) >>> 0).toString(16).padStart(8,'0')
}
export function normalizeInsight(name, properties = {}) {
  if (!names.has(name)) return null
  const event = { name, event_id: properties.event_id || crypto.randomUUID(), occurred_at: new Date().toISOString() }
  for (const key of ['flow', 'step', 'action', 'outcome', 'error_category', 'operation_id', 'journey_id', 'app_version']) {
    const value = properties[key]
    if (['operation_id','journey_id'].includes(key) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) continue
    if (typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,80}$/.test(value)) event[key] = value
  }
  event.route = routes.has(properties.route) ? properties.route : '/other'
  if (Number.isFinite(properties.duration_ms)) event.duration_ms = Math.min(3600000, Math.max(0, Math.round(properties.duration_ms)))
  if (['web', 'pwa', 'native'].includes(properties.platform)) event.platform = properties.platform
  if (['ios', 'android', 'desktop'].includes(properties.device)) event.device = properties.device
  return event
}
