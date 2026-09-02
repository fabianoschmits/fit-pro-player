import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { needsOnboarding, planSetupProgress } from '../lib/ux.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, repeatLastWorkout, WorkoutRow, workoutDetailSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import Onboarding from '../components/Onboarding.jsx'
import PlanProgress from '../components/PlanProgress.jsx'

export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const update = useStore(s => s.update)
  const [weekOffset, setWeekOffset] = useState(0)
  const [calOpen, setCalOpen] = useState(false)
  const calRef = useRef(null)

  useEffect(() => {
    if (!calOpen) return
    const handler = e => {
      if (calRef.current && !calRef.current.contains(e.target)) setCalOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [calOpen])

  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null
  const lastWorkout = S.workouts.length ? S.workouts[S.workouts.length - 1] : null
  const recentWorkouts = [...S.workouts].reverse().slice(0, 3)
  const planProgress = planSetupProgress(S)

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} onClick={() => dayOverrideSheet(iso)}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  // Helper: build a week strip for a given offset relative to today's monday
  const buildStrip = (offset) => {
    const mon = new Date(today)
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const label = `${mon.getDate()} ${mon.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sun.getDate()} ${sun.toLocaleDateString(dateLocale(), { month: 'short' })}`
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + i)
      const iso = isoOf(d)
      const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
      const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
      days.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} onClick={() => { dayOverrideSheet(iso); setCalOpen(false) }}>
        <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
    }
    return { label, days }
  }
  const expandedWeeks = calOpen ? [1, 2, 3].map(o => ({ offset: weekOffset + o, ...buildStrip(weekOffset + o) })) : []

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  const onToday = () => {
    if (S.active) nav('/workout')
    else if (routine?.ex.length) startFlow(routine.id)
    else if (routine) nav('/plan/r/' + routine.id)
    else dayOverrideSheet(todayISO())
  }

  const onRepeat = () => {
    if (!repeatLastWorkout()) nav('/workout')
  }

  return <div className="narrow">
    {needsOnboarding(S) && <Onboarding />}

    <div className="hdr">
      <div><h1>{user ? t('Hi {0}', user.name) : 'Fit Pro Player'}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button className="iconbtn" onClick={() => update(s => { s.theme = s.theme === 'light' ? 'dark' : 'light' })} aria-label={t('Theme')} title={t('Theme')}>
        <Icon name={S.theme === 'light' ? 'sun' : 'moon'} />
      </button>
    </div>

    {planProgress && <PlanProgress progress={planProgress} />}

    <div className="card" ref={calRef}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
        <button
          className="wk-label-btn"
          onClick={() => setCalOpen(o => !o)}
          aria-expanded={calOpen}
          aria-label={t('Toggle month calendar')}
        >
          <span className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</span>
          <Icon name={calOpen ? 'chevronUp' : 'chevronDown'} style={{ fontSize: 11, opacity: 0.5 }} />
        </button>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
      </div>
      <div className="week">{strip}</div>
      <div className={`month-cal-wrap${calOpen ? ' open' : ''}`}>
        <div className="month-cal">
          {expandedWeeks.map(({ offset, label, days }) => (
            <div key={offset} className="weeks-expand-item">
              <div className="weeks-expand-lbl">{label}</div>
              <div className="week">{days}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="today-row" onClick={onToday}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? t('{0} — in progress', S.active.name) : routine ? routine.name : t('Rest day')}{todayOvr && routine ? ' · ' + t('rescheduled') : ''}</div>
          </div>
        </div>
        {S.active ? <span className="tag" style={{ color: 'var(--orange)', background: 'color-mix(in srgb,var(--orange) 16%,transparent)' }}>{t('Resume')}</span>
          : routine?.ex.length ? <span className="tag acc">{t('Start')}</span>
          : routine ? <span className="tag acc">{t('Edit')}</span>
          : <Icon name="plus" className="chev" />}
      </div>
    </div>

    {lastWorkout && !S.active && (
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{t('Repeat last workout')}</h2>
        </div>
        <div className="muted small" style={{ marginBottom: 10 }}>{lastWorkout.name} · {fmtDate(lastWorkout.d, true)}</div>
        <Button variant="primary" icon="reset" onClick={onRepeat}>{t('Repeat {0}', lastWorkout.name)}</Button>
      </div>
    )}

    {!S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="sparkles" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
        <Button variant="primary" icon="plus" onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
        <div style={{ height: 8 }} /><Button icon="sparkles" onClick={() => { loadStarterPlan(); nav('/plan') }}>{t('Load starter plan (PPL)')}</Button>
      </div>
    )}

    {recentWorkouts.length > 0 && (
      <>
        <div className="row between" style={{ margin: '18px 0 10px' }}>
          <h4 className="sec" style={{ margin: 0 }}>{t('Recent workouts')}</h4>
          <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>{t('All')}</Button>
        </div>
        <div className="list">{recentWorkouts.map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
      </>
    )}

    <div className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
          {!!delta && (
            <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
              {fmtNum(Math.abs(delta))}
            </span>
          )}
          <span className="dim small" style={{ marginLeft: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
      </> : <div className="muted small">{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</div>}
    </div>

    <div className="card tappable" style={{ cursor: 'pointer' }} onClick={() => calendarSheet()}>
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="flame" style={{ color: 'var(--orange)' }} />
            {t('{0} week streak', streakWeeks(S))}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>{wThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {t(S.workouts.length === 1 ? '{0} workout total' : '{0} workouts total', S.workouts.length)}</div>
        </div>
        <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  </div>
}
