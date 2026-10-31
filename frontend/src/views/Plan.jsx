import { hasAssignedProgram } from '../lib/assigned-program.js'
import { PlanWeek, RoutineList } from '../components/training/TrainingPlanWorkspace.jsx'
import PlanLibrary from '../components/training/PlanLibrary.jsx'
import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { routineId, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { effectiveRoutineId } from '../lib/history.js'
import { ensureStarterRoutines } from '../lib/starter.js'
import { planSetupProgress } from '../lib/ux.js'
import { confirmSheet, dayAssignSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { DEFAULT_GLYPH } from '../lib/glyphs.js'
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
  const [updatedDays, setUpdatedDays] = useState({})
  const receiveUpdates = useCallback(updates => setUpdatedDays(updates), [])

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
  const scheduledDays = WEEK_DAYS.filter(day => S.week[day] && S.routines.some(r => r.id === S.week[day])).length
  const planProgress = planSetupProgress(S)
  const mode = S.planMode === 'daily' ? 'daily' : 'weekly'
  const usingProfessionalPlan = hasAssignedProgram(S)
  const headerTitle = usingProfessionalPlan
    ? (S.activeLibraryTitle || 'Plano profissional')
    : mode === 'weekly' ? 'Seu plano semanal' : 'Seu plano diário'
  const headerSubtitle = usingProfessionalPlan
    ? 'Plano profissional ativo'
    : mode === 'daily' ? 'Organize seus treinos para começar quando quiser.' : t('Your weekly routine')

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

  const personalRoutines = S.routines.filter(routine => !routine.assigned)
  const removeProfessionalDay = day => {
    const routine = S.routines.find(item => item.id === S.week[day])
    if (!routine) return
    confirmSheet({
      title: 'Retirar treino deste dia?',
      message: `${routine.name} continuará disponível nos seus planos recebidos.`,
      confirmText: 'Retirar treino',
      onConfirm: () => { update(state => { delete state.week[day] }); return true },
    })
  }

  return <div className="plan-view page-scenery">
    <AppHeader
      title={headerTitle}
      subtitle={headerSubtitle}
    />

    {planProgress && <PlanProgress progress={planProgress} />}

    {mode === 'weekly' && <div className="training-plan-workspace"><PlanWeek state={S} updates={updatedDays} onDay={day => updatedDays[day] ? updatedDays[day]() : (usingProfessionalPlan ? removeProfessionalDay(day) : dayAssignSheet(day))} /></div>}

    <PlanLibrary onUpdates={receiveUpdates} />

    <RoutineList state={S} onOpen={id => nav('/plan/r/' + id)} onAdd={addRoutine} routines={personalRoutines} title="Seus treinos criados" className="created-workouts" />

    <section className="plan-mode-section">
      <h4 className="sec">{t('Plan style')}</h4>
      <div className="plan-mode-card">
        {usingProfessionalPlan ? <div className="plan-professional-mode"><strong>Plano profissional ativo</strong><small>A prescrição é protegida. Escolha outro plano na sua biblioteca para alterar o que você executa.</small></div> : <><div><strong>{t('Change plan mode')}</strong><small>{t('Your profile, routines and history are kept in both modes.')}</small></div>
          <div className="plan-mode-options">
            <button className={mode === 'weekly' ? 'on' : ''} aria-pressed={mode === 'weekly'} onClick={() => switchMode('weekly')}><Icon name="calendar" /><span>{t('Weekly plan')}</span>{mode === 'weekly' && <Icon name="check" />}</button>
            <button className={mode === 'daily' ? 'on' : ''} aria-pressed={mode === 'daily'} onClick={() => switchMode('daily')}><Icon name="dumbbell" /><span>{t('Daily plan')}</span>{mode === 'daily' && <Icon name="check" />}</button>
          </div></>}
      </div>
    </section>
  </div>
}
