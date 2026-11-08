export function classifyFriction({ failures = 0, windowMs = 0, exhausted = false, queuedOffline = false, abandoned = false, slow = false } = {}) {
  if (queuedOffline) return null
  if (exhausted || (abandoned && failures > 0)) return 'high'
  if (failures >= 3 && windowMs <= 60000) return 'medium'
  if (failures > 0 || slow) return 'low'
  return null
}
export function createFrictionDetector(track, account = () => '') {
  const attempts = new Map()
  return (action, operationId, category, { exhausted = false, queuedOffline = false } = {}) => {
    if (queuedOffline) return
    const now = Date.now(), key = account() + ':' + action
    const times = [...(attempts.get(key) || []).filter(t => now - t <= 60000), now]
    attempts.set(key, times.slice(-3))
    if (attempts.size > 100) attempts.delete(attempts.keys().next().value)
    const severity = classifyFriction({ failures: times.length, exhausted })
    track(times.length === 3 ? 'action_retried' : 'action_failed', { action, operation_id: operationId, error_category: category, outcome: severity })
  }
}
