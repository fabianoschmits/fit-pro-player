// Message IDs + interpolation data only. Translation and display formatting belong
// to the presentation layer; calculations never depend on the active locale.
export function buildWeeklyInsights(summary) {
  const current = summary.metrics.workouts, previous = summary.previousMetrics?.workouts || 0
  if (!current) return [{ key: summary.period.isCurrentWeek ? 'weekly.empty.current' : 'weekly.empty.past', args: [] }]
  const messages = []
  const records = summary.historyComplete === true ? summary.performance?.personalRecords?.length || 0 : 0
  const first = summary.historyComplete === true ? summary.performance?.improvements?.filter(item => item.type === 'first').length || 0 : 0
  if (records) messages.push({ key: 'weekly.records', args: [records] })
  if (first) messages.push({ key: 'weekly.first', args: [first] })
  if (summary.historyComplete === true && !previous && summary.hasEarlierHistory === false) messages.push({ key: 'weekly.firstWeek', args: [] })
  else if (summary.canComparePeriods !== false) messages.push({ key: `weekly.frequency.${current === previous ? 'same' : current > previous ? 'up' : 'down'}`, args: [current, Math.abs(current - previous)] })
  const duration = summary.deltas?.durationSeconds
  if (duration?.comparable && duration.absolute > 0) messages.push({ key: 'weekly.time.up', args: [Math.round(duration.absolute / 60)] })
  if (summary.checkins?.answeredWorkouts) messages.push({ key: 'weekly.checkins', args: [summary.checkins.answeredWorkouts] })
  const ranking = summary.muscles?.ranking || []
  if (ranking.length) messages.push({ key: 'weekly.muscles', args: ranking.slice(0, 2).map(item => item.id) })
  if (summary.planning?.flexWorkouts) messages.push({ key: 'weekly.flex', args: [] })
  if (summary.coverage?.unknownDurationWorkouts || summary.coverage?.unknownMuscleSets || summary.coverage?.legacyWorkouts) messages.push({ key: 'weekly.coverage', args: [] })
  return messages.slice(0, 3)
}
