import TrainingPlanWorkspace, { RoutineList } from '../components/training/TrainingPlanWorkspace.jsx'
import PlanLibrary from '../components/training/PlanLibrary.jsx'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, DAYS, routineId, exCount, fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { effectiveRoutine, effectiveRoutineId } from '../lib/history.js'
import { EXPERIENCE_LABELS, PROFILE_GOAL_LABELS } from '../lib/profile.js'
import { ensureStarterRoutines, routineName } from '../lib/starter.js'
import { planSetupProgress } from '../lib/ux.js'
import { dayAssignSheet, dayOverrideSheet, workoutDetailSheet, WorkoutRow } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import RoutineMuscleThumb from '../components/RoutineMuscleThumb.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import PlanProgress from '../components/PlanProgress.jsx'
import PlanWizard from '../components/PlanWizard.jsx'
import AppHeader from '../components/AppHeader.jsx'

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
    return <><PlanLibrary /><PlanWizard editing={editingProfile} onCancel={closeEditor} onDone={closeEditor} /></>
  }

  const addRoutine = () => {
    const suffix = String.fromCharCode(65 + Math.min(S.routines.length, 25))
    const r = { id: routineId(), name: `${t('Routine')} ${suffix}`, emoji: DEFAULT_GLYPH, ex: [] }
    update(state => { state.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  const today = todayISO()
  const todayRoutine = effectiveRoutine(S, today)
  const scheduledDays = WEEK_DAYS.filter(day => S.week[day] && S.routines.some(r => r.id === S.week[day])).length
  const planProgress = planSetupProgress(S)
  const recentWorkouts = [...S.workouts].reverse().slice(0, 5)
  const mode = S.planMode === 'daily' ? 'daily' : 'weekly'
  const usingProfessionalPlan = Boolean(S.assignedProgram)
  const headerTitle = usingProfessionalPlan
    ? (S.activeLibraryTitle || 'Plano profissional')
    : mode === 'weekly' ? 'Seu plano semanal' : 'Seu plano diário'
  const headerSubtitle = usingProfessionalPlan
    ? 'Plano profissional ativo'
    : mode === 'daily' ? t('Choose your workout day by day') : t('Your weekly routine')

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

  const routineList = <RoutineList state={S} onOpen={id => nav('/plan/r/' + id)} onAdd={usingProfessionalPlan ? undefined : addRoutine} />

  return <div className="plan-view page-scenery">
    <AppHeader
      title={headerTitle}
      subtitle={headerSubtitle}
    />

    {planProgress && <PlanProgress progress={planProgress} />}

    {mode === 'weekly' ? <TrainingPlanWorkspace state={S} onDay={usingProfessionalPlan ? undefined : dayAssignSheet} onOpen={id => nav('/plan/r/' + id)} onAdd={usingProfessionalPlan ? undefined : addRoutine} /> : <div className="cols plan-cols daily-plan-cols">
      <section>
        <div className="row between plan-section-head">
          <h4 className="sec">{t("Today's workout")}</h4>
          <span className="plan-section-value">{fmtDate(today, true)}</span>
        </div>
        <button className={'card daily-plan-today' + (todayRoutine ? ' has-routine' : '')} onClick={() => dayOverrideSheet(today)}>
          <span className="daily-plan-icon">{todayRoutine ? <RoutineMuscleThumb routine={todayRoutine} body={S.body} /> : <Icon name="plus" />}</span>
          <span className="grow"><small>{t('Your choice for today')}</small><strong>{todayRoutine ? routineName(todayRoutine) : t("Choose today's workout")}</strong>{todayRoutine && <i>{exCount(todayRoutine.ex.length)}</i>}</span>
          <Icon name="chevronRight" className="chev" />
        </button>
        <p className="sect-f daily-plan-help">{t('Pick a workout each day. Weekly assignments stay saved in case you switch back.')}</p>

        <div className="row between plan-section-head">
          <h4 className="sec">{t('Previous workouts')}</h4>
          {!!recentWorkouts.length && <button className="small accent" onClick={() => nav('/history', { state: { fromContext: 'training' } })}>{t('View all')}</button>}
        </div>
        {recentWorkouts.length ? <div className="list">{recentWorkouts.map(workout => <WorkoutRow key={workout.id} w={workout} onClick={() => workoutDetailSheet(workout)} />)}</div>
          : <div className="card daily-plan-empty"><Icon name="history" /><strong>{t('Your completed workouts will appear here.')}</strong></div>}
      </section>
      {routineList}
    </div>}

    <section className="plan-mode-section">
      <h4 className="sec">{t('Plan style')}</h4>
      <div className="plan-mode-card">
        {usingProfessionalPlan ? <div className="plan-professional-mode"><strong>Plano profissional ativo</strong><small>A prescrição é protegida. Escolha outro plano na sua biblioteca para alterar o que você executa.</small></div> : <><div><strong>{t('Change plan mode')}</strong><small>{t('Your profile, routines and history are kept in both modes.')}</small></div>
          <div className="plan-mode-options">
            <button className={mode === 'weekly' ? 'on' : ''} aria-pressed={mode === 'weekly'} onClick={() => switchMode('weekly')}><Icon name="calendar" /><span>{t('Weekly plan')}</span>{mode === 'weekly' && <Icon name="check" />}</button>
            <button className={mode === 'daily' ? 'on' : ''} aria-pressed={mode === 'daily'} onClick={() => switchMode('daily')}><Icon name="dumbbell" /><span>{t('Daily plan')}</span>{mode === 'daily' && <Icon name="check" />}</button>
          </div></>}
      </div>
      <PlanLibrary />
    </section>
  </div>
}
