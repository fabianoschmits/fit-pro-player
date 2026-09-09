import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, DAYS, uid, exCount, fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { effectiveRoutine, effectiveRoutineId } from '../lib/history.js'
import { EXPERIENCE_LABELS, PROFILE_GOAL_LABELS, ageFromBirthDate, heightText, weightText } from '../lib/profile.js'
import { ensureStarterRoutines, routineName } from '../lib/starter.js'
import { planSetupProgress } from '../lib/ux.js'
import { dayAssignSheet, dayOverrideSheet, planToolsSheet, workoutDetailSheet, WorkoutRow } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import PlanProgress from '../components/PlanProgress.jsx'
import PlanWizard from '../components/PlanWizard.jsx'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]
const DEFAULT_DAYS = [1, 3, 5]

export default function Plan() {
  const nav = useNavigate()
  const location = useLocation()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [editingProfile, setEditingProfile] = useState(() => new URLSearchParams(location.search).get('profile') === 'edit')

  if (!S.onboardingDone || editingProfile) {
    const closeEditor = () => { setEditingProfile(false); nav('/plan', { replace: true }) }
    return <PlanWizard editing={editingProfile} onCancel={closeEditor} onDone={closeEditor} />
  }

  const addRoutine = () => {
    const suffix = String.fromCharCode(65 + Math.min(S.routines.length, 25))
    const r = { id: uid(), name: `${t('Routine')} ${suffix}`, emoji: DEFAULT_GLYPH, ex: [] }
    update(state => { state.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  const today = todayISO()
  const todayRoutine = effectiveRoutine(S, today)
  const scheduledDays = WEEK_DAYS.filter(day => S.week[day] && S.routines.some(r => r.id === S.week[day])).length
  const planProgress = planSetupProgress(S)
  const recentWorkouts = [...S.workouts].reverse().slice(0, 5)
  const age = ageFromBirthDate(S.profile?.birthDate)
  const mode = S.planMode === 'daily' ? 'daily' : 'weekly'

  const switchMode = nextMode => {
    if (nextMode === mode) return
    const currentId = effectiveRoutineId(S, today)
    update(state => {
      state.planMode = nextMode
      if (nextMode === 'weekly') {
        const hasWeek = WEEK_DAYS.some(day => state.week[day] && state.routines.some(r => r.id === state.week[day]))
        if (!hasWeek) {
          const ready = state.routines.length ? state.routines : ensureStarterRoutines(state)
          DEFAULT_DAYS.forEach((day, index) => { if (ready[index]) state.week[day] = ready[index].id })
        }
      } else if (state.dayPlan[today] === undefined && currentId) {
        state.dayPlan[today] = currentId
      }
    })
  }

  const routineList = <section>
    <div className="row between plan-section-head">
      <h4 className="sec">{t('Routines')}</h4>
      <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
    </div>
    <div className="list plan-routine-list">{S.routines.map(routine => {
      const days = WEEK_DAYS.filter(day => S.week[day] === routine.id)
      return <button key={routine.id} className="item" onClick={() => nav('/plan/r/' + routine.id)}>
        <span className="lrow-i"><Icon name={glyphOf(routine.emoji)} /></span>
        <span className="grow">
          <span className="tt">{routineName(routine)}</span>
          <span className="ss">{exCount(routine.ex.length)}{mode === 'weekly' && days.length ? ` · ${days.map(day => t(DAYS[day])).join(' · ')}` : ''}</span>
        </span>
        <Icon name="chevronRight" className="chev" />
      </button>
    })}</div>
    <div style={{ height: 10 }} />
    <Button variant="tinted" icon="plus" onClick={addRoutine}>{t('New routine')}</Button>
  </section>

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{mode === 'daily' ? t('Choose your workout day by day') : t('Your weekly routine')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>

    <button className="card plan-profile-card" onClick={() => setEditingProfile(true)}>
      <span className="plan-profile-avatar"><Icon name="person" /></span>
      <span className="grow"><strong>{S.profile?.name}</strong><small>{[age != null ? t('{0} years', age) : '', S.profile?.heightCm ? `${heightText(S.profile.heightCm)} m` : '', S.profile?.startWeight ? `${weightText(S.profile.startWeight)} ${S.unit}` : ''].filter(Boolean).join(' · ')}</small>
        {S.profile?.goal && S.profile?.experience && <em>{t(PROFILE_GOAL_LABELS[S.profile.goal])} · {t(EXPERIENCE_LABELS[S.profile.experience])}</em>}
      </span>
      <span className="plan-profile-edit">{t('Edit')} <Icon name="chevronRight" /></span>
    </button>

    {planProgress && <PlanProgress progress={planProgress} />}

    {mode === 'weekly' ? <div className="cols plan-cols">
      <section>
        <div className="row between plan-section-head">
          <h4 className="sec">{t('Week schedule')}</h4>
          <span className={'tag' + (scheduledDays ? ' acc' : '')}>{scheduledDays} / 7</span>
        </div>
        <div className="card plan-week-card">
          <div className="plan-week-grid">
            {WEEK_DAYS.map(day => {
              const routine = S.routines.find(r => r.id === S.week[day])
              return <button key={day} className={'plan-day' + (routine ? ' on' : '')}
                aria-label={`${t(DAYN[day])}: ${routine ? routineName(routine) : t('Rest')}`}
                aria-pressed={!!routine} onClick={() => dayAssignSheet(day)}>
                <span className="plan-day-label">{t(DAYS[day])}</span>
                <span className="plan-day-icon"><Icon name={routine ? glyphOf(routine.emoji) : 'moon'} /></span>
                <span className="plan-day-name">{routine ? routineName(routine) : t('Rest')}</span>
              </button>
            })}
          </div>
        </div>
      </section>
      {routineList}
    </div> : <div className="cols plan-cols daily-plan-cols">
      <section>
        <div className="row between plan-section-head">
          <h4 className="sec">{t("Today's workout")}</h4>
          <span className="tag acc">{fmtDate(today, true)}</span>
        </div>
        <button className={'card daily-plan-today' + (todayRoutine ? ' has-routine' : '')} onClick={() => dayOverrideSheet(today)}>
          <span className="daily-plan-icon"><Icon name={todayRoutine ? glyphOf(todayRoutine.emoji) : 'plus'} /></span>
          <span className="grow"><small>{t('Your choice for today')}</small><strong>{todayRoutine ? routineName(todayRoutine) : t("Choose today's workout")}</strong>{todayRoutine && <i>{exCount(todayRoutine.ex.length)}</i>}</span>
          <Icon name="chevronRight" className="chev" />
        </button>
        <p className="sect-f daily-plan-help">{t('Pick a workout each day. Weekly assignments stay saved in case you switch back.')}</p>

        <div className="row between plan-section-head">
          <h4 className="sec">{t('Previous workouts')}</h4>
          {!!recentWorkouts.length && <button className="small accent" onClick={() => nav('/history')}>{t('View all')}</button>}
        </div>
        {recentWorkouts.length ? <div className="list">{recentWorkouts.map(workout => <WorkoutRow key={workout.id} w={workout} onClick={() => workoutDetailSheet(workout)} />)}</div>
          : <div className="card daily-plan-empty"><Icon name="history" /><strong>{t('Your completed workouts will appear here.')}</strong></div>}
      </section>
      {routineList}
    </div>}

    <section className="plan-mode-section">
      <h4 className="sec">{t('Plan style')}</h4>
      <div className="card plan-mode-card">
        <div><strong>{t('Change plan mode')}</strong><small>{t('Your profile, routines and history are kept in both modes.')}</small></div>
        <div className="plan-mode-options">
          <button className={mode === 'weekly' ? 'on' : ''} aria-pressed={mode === 'weekly'} onClick={() => switchMode('weekly')}><Icon name="calendar" /><span>{t('Weekly plan')}</span>{mode === 'weekly' && <Icon name="check" />}</button>
          <button className={mode === 'daily' ? 'on' : ''} aria-pressed={mode === 'daily'} onClick={() => switchMode('daily')}><Icon name="dumbbell" /><span>{t('Daily plan')}</span>{mode === 'daily' && <Icon name="check" />}</button>
        </div>
      </div>
    </section>
  </>
}
