export function resolveInsightsFilters(filters, now = new Date()) {
  if (!['1','7','30','90'].includes(filters.period)) return filters
  const from=new Date(now.getTime()-Number(filters.period)*86400000)
  if(filters.period==='1') {
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
    from.setTime(new Date(`${day}T00:00:00-03:00`).getTime())
  }
  return {...filters,from:from.toISOString(),to:now.toISOString()}
}
export function createInsightsRepository(client) {
  const cache = new Map()
  async function query(section, filters, { signal = undefined, fresh = false, userId = null } = {}) {
    const key = JSON.stringify([section, filters, userId])
    const previous = cache.get(key)
    if (!fresh && previous && Date.now() - previous.at < 20000) return previous.data
    if (!client) throw Error('supabase-unavailable')
    let request = client.rpc('ops_insights', { p_section: section, p_filters: resolveInsightsFilters(filters), p_user_id: userId })
    if (signal) request = request.abortSignal(signal)
    const { data, error } = await request
    if (error) throw error
    cache.set(key, { data, at: Date.now() })
    if (cache.size > 30) cache.delete(cache.keys().next().value)
    return data
  }
  return {
    getInsightsOverview: (f, o = {}) => query('overview', f, o),
    getInsightsFriction: (f, o = {}) => query('friction', f, o),
    getInsightsFunnels: (f, o = {}) => query('funnels', f, o),
    getInsightsWorkouts: (f, o = {}) => query('workouts', f, o),
    getInsightsRetention: (f, o = {}) => query('retention', f, o),
    async getInsightsActivation(f, o = {}) {
      let request=client.rpc('ops_insights_workout_engagement',{p_filters:resolveInsightsFilters(f)})
      if(o.signal) request=request.abortSignal(o.signal)
      const {data,error}=await request
      if(error) throw error
      return data
    },
    getInsightsPerformance: (f, o = {}) => query('performance', f, o),
    getInsightsSupport: (f, o = {}) => query('support', f, o),
    async getInsightsAlerts(f, o = {}) {
      let request=client.rpc('ops_insights_refresh_alerts',{p_filters:resolveInsightsFilters(f)})
      if(o.signal) request=request.abortSignal(o.signal)
      const {error}=await request
      if(error) throw error
      return query('alerts',f,{...o,fresh:true})
    },
    async getUserInsights(userId, f, o = {}) {
      const data = await query('user', f, { ...o, userId })
      if (data?.restricted) return data
      try {
        let request = client.rpc('ops_user_insights_support',{p_user_id:userId})
        if (o.signal) request=request.abortSignal(o.signal)
        const related=await request
        return {...data,related_tickets:related.error ? null : related.data}
      } catch { return data }
    },
    async setAlertState(id, state) {
      const { error } = await client.rpc('ops_insights_alert_state', { p_id: id, p_state: state })
      if (error) throw error
      cache.clear()
    },
  }
}
