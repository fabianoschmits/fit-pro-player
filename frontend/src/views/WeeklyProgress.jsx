import WeeklyCheckinSummary from '../components/training/checkin/WeeklyCheckinSummary.jsx'
import { useTrainingCheckins } from '../lib/training-checkin-state.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { buildWeeklyProgress } from '../lib/weekly-progress.js'
import { getWeekStart, normalizeWeekParam } from '../lib/weekly-progress-calendar.js'
import { workoutCalendarDate } from '../lib/weekly-progress-core.js'
import { useWeeklyClock } from '../lib/use-weekly-clock.js'
import { useWeeklyHistory } from '../lib/use-weekly-history.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { workoutDetailSheet, startFlow } from '../sheets.jsx'
import { trainingComparisonHref } from '../components/training/TrainingComparisonPreview.jsx'
import WeeklyProgressHeader from '../components/training/weekly/WeeklyProgressHeader.jsx'
import WeeklyProgressMetrics from '../components/training/weekly/WeeklyProgressMetrics.jsx'
import WeeklyActivityChart from '../components/training/weekly/WeeklyActivityChart.jsx'
import WeeklyProgressComparison from '../components/training/weekly/WeeklyProgressComparison.jsx'
import WeeklyProgressInsights from '../components/training/weekly/WeeklyProgressInsights.jsx'
import WeeklyMuscleSummary from '../components/training/weekly/WeeklyMuscleSummary.jsx'
import WeeklyPlanningSummary from '../components/training/weekly/WeeklyPlanningSummary.jsx'
import WeeklyPerformanceSummary from '../components/training/weekly/WeeklyPerformanceSummary.jsx'
import WeeklyWorkoutList from '../components/training/weekly/WeeklyWorkoutList.jsx'
import WeeklyProgressEmptyState from '../components/training/weekly/WeeklyProgressEmptyState.jsx'
import WeeklyProgressSkeleton from '../components/training/weekly/WeeklyProgressSkeleton.jsx'
import AppHeader from '../components/AppHeader.jsx'
import { Button } from '../components/ui.jsx'
import '../weekly-progress.css'

export default function WeeklyProgress() {
  const body = useStore(state => state.S.body), displayUnit = useStore(state => state.S.displayUnit)
  const zone = useStore(state => state.S.profile?.timeZone || state.S.reminder?.tz)
  const sync = useStore(state => state.accountSync)
  const { now, online, timeZone } = useWeeklyClock(zone)
  const { workouts, availability, exerciseCatalog, scopeKey } = useWeeklyHistory(online)
  const [params, setParams] = useSearchParams(), navigate = useNavigate(), location = useLocation()
  const { records: checkinRecords } = useTrainingCheckins()
  const requested = params.get('week'), current = getWeekStart(now, timeZone)
  const week = normalizeWeekParam(requested, now, timeZone)
  const previousCurrent = useRef(current)
  const [selectedDay, setSelectedDay] = useState(null)
  const { historyComplete, canComparePeriods, status } = availability
  const summary = useMemo(() => status !== 'loading' ? buildWeeklyProgress({ workouts, weekStart: week, now, timeZone, exerciseCatalog, historyComplete, canComparePeriods, checkinRecords }) : null, [status, workouts, week, now, timeZone, exerciseCatalog, historyComplete, canComparePeriods, checkinRecords])
  const firstWeek = useMemo(() => workouts.reduce((first, workout) => { const date = workoutCalendarDate(workout, timeZone); const start = date && getWeekStart(date, timeZone); return start && start < first ? start : first }, current), [workouts, current, timeZone])
  useEffect(() => { if (requested !== week) setParams({ week }, { replace: true, state: location.state }) }, [requested, week, setParams, location.state])
  useEffect(() => {
    if (previousCurrent.current !== current) {
      if (requested == null || requested === previousCurrent.current) setParams({ week: current }, { replace: true, state: location.state })
      previousCurrent.current = current
    }
  }, [current, requested, setParams, location.state])
  useEffect(() => { setSelectedDay(null) }, [week, workouts, scopeKey])
  useEffect(() => { document.body.classList.add('weekly-progress-mode'); return () => document.body.classList.remove('weekly-progress-mode') }, [])
  const openWorkout = id => { const workout = workouts.find(item => item.id === id); if (workout) workoutDetailSheet(workout) }
  const select = value => setParams({ week: normalizeWeekParam(value, now, timeZone) }, { state: location.state })
  const start = () => {
    const state = useStore.getState().S
    if (state.active) return navigate('/workout')
    if (!state.routines.length) return navigate('/plan')
    const routine = effectiveRoutine(state, todayISO())
    if (routine?.ex.length) return startFlow(routine.id)
    navigate('/workout')
  }
  const backTo = location.state?.weeklyBackTo === '/home' ? '/home' : location.state?.weeklyBackTo === '/progress/history' ? '/progress/history' : '/progress'
  return <div key={scopeKey} className="weekly-progress-view fpp-ui-view">
    {summary ? <>
      <WeeklyProgressHeader summary={summary} firstWeek={firstWeek} currentWeek={current} onSelect={select} backTo={backTo} backState={backTo === '/home' ? { homeWeek: location.state?.homeWeek } : undefined} />
      {!online && <p className="weekly-notice" role="status">{t("You're offline. Showing data available on this device.")}</p>}
      {availability.updating && <p className="weekly-notice" role="status">{t('Updating your history…')}</p>}
      {!historyComplete && <p className="weekly-notice" role="status">{t(availability.unavailable ? 'Your history is not available on this device yet.' : 'History partially available.')}</p>}
      {(sync.state === 'error' || status === 'error') && <div className="weekly-notice" role="status"><p>{t('Could not update history. Your local data is available.')}</p><Button variant="ghost" onClick={() => useStore.getState().retryAccountSync()}>{t('Try again')}</Button></div>}
      {!summary.metrics.workouts && availability.canShowEmpty && <WeeklyProgressEmptyState current={summary.period.isCurrentWeek} onStart={start} />}
      {(!summary.metrics.workouts && !availability.canShowEmpty) ? null : <>
      <WeeklyProgressMetrics summary={summary} />
      <WeeklyActivityChart key={`activity:${week}`} summary={summary} onDay={date => { setSelectedDay(date); document.getElementById('weekly-workouts')?.scrollIntoView({ block: 'start' }) }} />
      <WeeklyProgressComparison summary={summary} />
      <WeeklyProgressInsights insights={summary.insights} />
      <WeeklyMuscleSummary key={`muscles:${week}`} muscles={summary.muscles} body={body} workouts={summary.workouts} onWorkout={openWorkout} />
      <WeeklyPlanningSummary planning={summary.planning} />
      <WeeklyCheckinSummary key={`checkins:${scopeKey}:${week}`} workouts={summary.workouts} partial={!historyComplete} />
      <WeeklyPerformanceSummary key={`performance:${week}`} performance={summary.performance} exerciseCatalog={exerciseCatalog} displayUnit={displayUnit || 'kg'} />
      <WeeklyWorkoutList workouts={summary.workouts} selectedDay={selectedDay} onClearDay={() => setSelectedDay(null)} onWorkout={openWorkout} onMap={id => navigate(trainingComparisonHref(id))} />
      </>}
    </> : <><AppHeader title={t('Weekly summary')} subtitle={t('Track your progress each week.')} backTo={backTo} backState={backTo === '/home' ? { homeWeek: location.state?.homeWeek } : undefined} /><WeeklyProgressSkeleton /></>}
  </div>
}
