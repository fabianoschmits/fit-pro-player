import { normalizeInsight } from './insights-events.js'

// Memory only: no identity or optional events survive logout, reload or revocation.
export function createInsightsCollector({ permitted, send, online = () => navigator.onLine, now = () => Date.now() }) {
  let account = null, session = null, queue = [], sending = false, lastHumanActivity = 0
  const seen = new Set()
  const journeys = new Map()
  const clear = () => { queue = []; seen.clear(); journeys.clear(); session = null; lastHumanActivity=0 }
  const allowed = () => { if (!account || !permitted()) { clear(); return false } return true }
  return {
    setAccount(value) { if (value !== account) { clear(); account = value } },
    clear,
    size: () => queue.length,
    track(name, properties = {}) {
      try {
        if (!allowed()) return
        const event = normalizeInsight(name, properties)
        if (!event || seen.has(event.event_id)) return
        if(['screen_viewed','onboarding_step_completed','workout_start_requested','workout_set_recorded','community_publish_started','photo_selection_started'].includes(name)) {
          if(lastHumanActivity && now()-lastHumanActivity>=1800000) session=null
          lastHumanActivity=now()
        }
        if (!session) {
          session = crypto.randomUUID()
          const start = normalizeInsight('app_session_started')
          queue.push({ ...start, app_version: event.app_version, platform: event.platform, device: event.device, route: '/other', session_id: session, queued: now() })
        }
        seen.add(event.event_id)
        if (seen.size > 500) seen.delete(seen.values().next().value)
        queue = [...queue.filter(e => now() - e.queued < 86400000), { ...event, session_id: session, queued: now() }].slice(-100)
        if (name === 'onboarding_started' && event.journey_id) journeys.set(event.journey_id,{flow:'onboarding',route:'/plan',errors:false})
        if (['action_failed','onboarding_validation_failed'].includes(name) && journeys.has(event.journey_id)) journeys.get(event.journey_id).errors=true
        if (name === 'onboarding_completed') journeys.delete(event.journey_id)
        // Only explicit navigation away counts as an interruption. Visibility/offline never do.
        if (name === 'screen_viewed') for (const [id,journey] of journeys) {
          if (event.route === journey.route) continue
          const interruption = normalizeInsight('flow_interrupted',{...properties,flow:journey.flow,journey_id:id,action:'onboarding_exit',outcome:journey.errors?'high':'neutral',error_category:journey.errors?'after_errors':'navigation_exit'})
          queue.push({...interruption,session_id:session,queued:now()});queue=queue.slice(-100)
          journeys.delete(id)
        }
      } catch { /* optional telemetry never changes product behavior */ }
    },
    async flush() {
      try {
        if (!allowed() || !online() || sending || !queue.length) return
        queue = queue.filter(e => now() - e.queued < 86400000)
        const owner = account, batch = queue.slice(0, 25)
        sending = true
        await send(batch.map(({ queued: _queued, ...event }) => event), owner)
        if (owner === account && allowed()) { const ids = new Set(batch.map(e => e.event_id)); queue = queue.filter(e => !ids.has(e.event_id)) }
      } catch { /* retain a bounded batch for a later attempt */ }
      finally { sending = false }
    },
  }
}
