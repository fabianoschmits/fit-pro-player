import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { exOr, exerciseName } from '../lib/exercises.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, workoutVolume, setsDone, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, fmtDur, fmtVol, todayISO, isoOf, weekKey, DAYS, exCount, sentenceCase } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { planSetupProgress } from '../lib/ux.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, repeatWorkout, WorkoutRow, workoutDetailSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { routineName } from '../lib/starter.js'
import PlanProgress from '../components/PlanProgress.jsx'

function nextPlannedWorkout(S, from) {
  for (let offset = 1; offset <= 14; offset++) {
    const date = new Date(from)
    date.setDate(from.getDate() + offset)
    const iso = isoOf(date)
    const routine = effectiveRoutine(S, iso)
    if (routine?.ex?.length) return { date, iso, routine }
  }
  return null
}

function SessionMetrics({ workout, unit }) {
  return <div className="home-now-metrics">
    <span><small>{t('Duration')}</small><b>{fmtDur(Math.max(0, (workout.end || workout.start) - workout.start))}</b></span>
    <span><small>{t('Sets')}</small><b>{setsDone(workout)}</b></span>
    <span><small>{t('Volume')}</small><b>{fmtVol(workoutVolume(workout), unit)}</b></span>
  </div>
}

export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const isoToday = todayISO()
  const routine = effectiveRoutine(S, isoToday)
  const todayWorkout = [...S.workouts].reverse().find(workout => workout.d === isoToday) || null
  const nextWorkout = nextPlannedWorkout(S, today)
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null
  const lastWorkout = S.workouts.length ? S.workouts[S.workouts.length - 1] : null
  const recentWorkouts = [...S.workouts].reverse().slice(0, 2)
  const planProgress = planSetupProgress(S)

  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const doneDays = new Set(S.workouts.map(workout => workout.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const iso = isoOf(date)
    const effectiveId = effectiveRoutineId(S, iso)
    const override = S.dayPlan[iso] !== undefined
    const done = doneDays.has(iso)
    const dot = done ? ' done' : override && effectiveId ? ' ovr' : effectiveId ? ' plan' : ''
    strip.push(<button type="button" key={iso} className={'wday' + (iso === isoToday ? ' today' : '')} onClick={() => dayOverrideSheet(iso)}
      aria-label={date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}>
      <span className="lbl">{t(DAYS[date.getDay()])}</span><span className="num">{date.getDate()}</span><span className={'dot' + dot} />
    </button>)
  }
  const weekLabel = weekOffset === 0
    ? t('This week')
    : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} - ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`
  const workoutsThisWeek = S.workouts.filter(workout => weekKey(workout.d) === weekKey(isoToday)).length
  const plannedPerWeek = S.planMode === 'daily' ? 0 : Object.keys(S.week).filter(key => S.week[key]).length
  const bwPoints = S.bodyweight.slice(-30).map(entry => ({ t: entry.t || new Date(entry.d).getTime(), y: entry.w, d: entry.d, iso: entry.d }))

  const active = S.active
  const activeTotal = active?.entries.reduce((count, entry) => count + entry.sets.length, 0) || 0
  const activeDone = setsDoneActive(active)
  const activeIndex = active?.entries.length ? Math.min(active.cur || 0, active.entries.length - 1) : -1
  const activeEntry = activeIndex >= 0 ? active.entries[activeIndex] : null
  const matchingPrevious = routine?.id
    ? [...S.workouts].reverse().find(workout => workout.routineId === routine.id || workout.name === routineName(routine))
    : null
  const routineMuscles = routine?.ex
    ? [...new Set(routine.ex.map(entry => exOr(entry.id).tg || exOr(entry.id).bp).filter(Boolean))].slice(0, 3)
    : []

  const renderNow = () => {
    if (active) return <section className="home-now home-now--active">
      <div className="home-now-top">
        <span className="home-now-kicker"><i />{t('{0} — in progress', active.name)}</span>
        <span className="home-now-glyph"><Icon name="timer" /></span>
      </div>
      <h2>{active.name}</h2>
      <div className="home-now-context">
        {activeEntry ? <><b>{t('Exercise {0} / {1}', activeIndex + 1, active.entries.length)}</b><span>{exerciseName(exOr(activeEntry.id))}</span></> : <span>{t('Freestyle workout — add your first exercise.')}</span>}
      </div>
      <div className="home-now-progress"><i style={{ '--progress': activeTotal ? activeDone / activeTotal : 0 }} /></div>
      <div className="home-now-progress-label"><span>{t('{0} sets', `${activeDone}/${activeTotal}`)}</span><span>{Math.round((activeTotal ? activeDone / activeTotal : 0) * 100)}%</span></div>
      <Button variant="primary" icon={active.start ? 'play' : 'timer'} onClick={() => nav('/workout')}>{active.start ? t('Resume') : t('Start workout')}</Button>
    </section>

    if (todayWorkout) return <section className="home-now home-now--done">
      <div className="home-now-top">
        <span className="home-now-kicker"><i />{t('Workout complete!')}</span>
        <span className="home-now-glyph"><Icon name="check" /></span>
      </div>
      <h2>{todayWorkout.name}</h2>
      <SessionMetrics workout={todayWorkout} unit={S.unit} />
      {nextWorkout && <div className="home-next-session"><span>{t('Next')}</span><b>{routineName(nextWorkout.routine)}</b><small>{fmtDate(nextWorkout.iso, true)}</small></div>}
      <Button variant="primary" icon="history" onClick={() => workoutDetailSheet(todayWorkout)}>{t('Details')}</Button>
    </section>

    if (routine?.ex?.length) return <section className="home-now home-now--planned">
      <div className="home-now-top">
        <span className="home-now-kicker"><i />{t("Today's plan")}</span>
        <span className="home-now-glyph"><Icon name={glyphOf(routine.emoji)} /></span>
      </div>
      <h2>{routineName(routine)}</h2>
      <div className="home-now-context home-now-context--wrap">
        <b>{exCount(routine.ex.length)}</b>
        {routineMuscles.map(muscle => <span key={muscle}>{sentenceCase(t(muscle))}</span>)}
      </div>
      {matchingPrevious && matchingPrevious.end > matchingPrevious.start && <div className="home-last-session"><span>{t('Last time')}</span><b>{fmtDur(matchingPrevious.end - matchingPrevious.start)}</b><small>{fmtDate(matchingPrevious.d, true)}</small></div>}
      <Button variant="primary" icon="play" onClick={() => startFlow(routine.id)}>{t('Start {0}', routineName(routine))}</Button>
    </section>

    if (routine) return <section className="home-now home-now--rest">
      <div className="home-now-top"><span className="home-now-kicker"><i />{t("Today's plan")}</span><span className="home-now-glyph"><Icon name={glyphOf(routine.emoji)} /></span></div>
      <h2>{routineName(routine)}</h2>
      <p>{t('No exercises yet — add your first one.')}</p>
      <Button variant="primary" icon="plus" onClick={() => nav('/plan/r/' + routine.id)}>{t('Add exercise')}</Button>
    </section>

    if (!S.routines.length) return <section className="home-now home-now--setup">
      <div className="home-now-top"><span className="home-now-kicker"><i />{t('Welcome!')}</span><span className="home-now-glyph"><Icon name="dumbbell" /></span></div>
      <h2>{t('Build my own plan')}</h2>
      <p>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</p>
      <Button variant="primary" icon="plus" onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      <Button variant="ghost" icon="dumbbell" onClick={() => { loadStarterPlan(); nav('/plan') }}>{t('Load starter plan (PPL)')}</Button>
    </section>

    return <section className="home-now home-now--rest">
      <div className="home-now-top"><span className="home-now-kicker"><i />{t('Rest day')}</span><span className="home-now-glyph"><Icon name="moon" /></span></div>
      <h2>{nextWorkout ? routineName(nextWorkout.routine) : t('Freestyle')}</h2>
      <div className="home-now-context">
        {nextWorkout ? <><b>{t('Next')}</b><span>{fmtDate(nextWorkout.iso, true)} · {exCount(nextWorkout.routine.ex.length)}</span></> : <span>{t('Freestyle workout — add your first exercise.')}</span>}
      </div>
      {lastWorkout && <Button variant="primary" icon="reset" onClick={() => repeatWorkout(lastWorkout)}>{t('Repeat {0}', lastWorkout.name)}</Button>}
      <Button variant={lastWorkout ? 'ghost' : 'primary'} icon="shuffle" onClick={() => nav('/workout')}>{t('Start workout')}</Button>
    </section>
  }

  return <div className="narrow home-view">
    <div className="hdr home-titlebar">
      <div><h1>{t('Today')}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button className="iconbtn" onClick={() => update(state => { state.theme = state.theme === 'light' ? 'dark' : 'light' })} aria-label={t('Theme')} title={t('Theme')}>
        <Icon name={S.theme === 'light' ? 'sun' : 'moon'} />
      </button>
    </div>

    {planProgress && <PlanProgress progress={planProgress} />}
    {renderNow()}

    <section className="home-week-block">
      <div className="home-section-head">
        <div><h2>{weekLabel}</h2><span>{workoutsThisWeek}{plannedPerWeek ? ` / ${plannedPerWeek}` : ''} {t('this week')} · {t('{0} week streak', streakWeeks(S))}</span></div>
        <div className="home-week-actions">
          <button className="iconbtn" onClick={() => setWeekOffset(offset => offset - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
          <button className="iconbtn" onClick={() => setWeekOffset(0)} aria-label={t('This week')} disabled={weekOffset === 0}><Icon name="dot" /></button>
          <button className="iconbtn" onClick={() => setWeekOffset(offset => offset + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
          <button className="iconbtn" onClick={() => calendarSheet()} aria-label={t('Toggle month calendar')}><Icon name="calendar" /></button>
        </div>
      </div>
      <div className="week home-week-strip">{strip}</div>
    </section>

    <section className="home-weight-block">
      <div className="home-section-head">
        <div><h2>{t('Body weight')}</h2>{bw && <span>{fmtDate(bw.d, true)}</span>}</div>
        <div className="row home-weight-actions">
          <Button size="sm" variant="ghost" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" variant="tinted" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        <div className="home-weight-reading">
          <button type="button" onClick={() => bwSheet({ date: bw.d || isoToday })} title={t('Edit current weight')} aria-label={t('Edit current weight')}>
            <strong>{fmtNum(bw.w)}</strong><span>{S.unit}</span>
          </button>
          {!!delta && <span style={{ color: bwDeltaColor(delta, bw.w) }}><Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} />{fmtNum(Math.abs(delta))} {S.unit}</span>}
          {S.targetW && <small><Icon name="target" />{Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', `${fmtNum(Math.abs(S.targetW - bw.w))} ${S.unit}`)}</small>}
        </div>
        <div className="chart home-weight-chart"><LineChart points={bwPoints} h={104} unit={S.unit} goal={S.targetW} onPointEdit={point => bwSheet({ date: point.iso || point.d || isoToday })} /></div>
      </> : <div className="home-weight-empty"><span>{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</span><Button size="sm" variant="primary" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button></div>}
    </section>

    {recentWorkouts.length > 0 && <section className="home-recent-block">
      <div className="home-section-head">
        <div><h2>{t('Recent workouts')}</h2><span>{t(S.workouts.length === 1 ? '{0} workout total' : '{0} workouts total', S.workouts.length)}</span></div>
        <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>{t('All')}</Button>
      </div>
      <div className="list">{recentWorkouts.map(workout => <WorkoutRow key={workout.id} w={workout} onClick={() => workoutDetailSheet(workout)} />)}</div>
    </section>}
  </div>
}
