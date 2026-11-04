import { personalPlanPreview } from '../../lib/personal-plan-preview.js'
import useRelationshipRefresh from '../useRelationshipRefresh.js'
import TrainingPlanPreview from './TrainingPlanPreview.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore } from '../../store/useStore.js'
import { createProfessionalWorkflowRepository } from '../../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { weeklyPlanToWorkspace } from '../../lib/training-workspace.js'
import { DAYS } from '../../lib/professional-program.js'
import { Button } from '../ui.jsx'
import { useUI } from '../../store/useUI.js'
import Icon from '../Icon.jsx'
import { compareProfessionalPlanVersions } from '../../lib/professional-plan-diff.js'
import { useNavigate } from 'react-router-dom'
import ProfessionalPlanApplyButton, { isProfessionalPlanActive, openPlanApplication } from './ProfessionalPlanApplyButton.jsx'
import { exerciseName, exOr } from '../../lib/exercises.js'

const PAGE_SIZE = 5

export function activePlanSource(state, items = []) {
  if (!state.activeLibraryId) return 'self'
  const item = items.find(entry => entry.id === state.activeLibraryId)
  if (item?.source_type === 'self') return 'self'
  if (item) return item.source_type === 'professional' && isProfessionalPlanActive(state, item.id, item.version?.id) ? 'professional' : 'self'
  return state.assignedProgram?.versionId ? 'professional' : 'self'
}

function PlanPreviewSheet({ item, state = undefined, routineId = undefined, close }) {
  return <section className="plan-library-preview-sheet">
    <div className="row between sheet-title-row"><h2>{item.title}</h2><Button size="sm" variant="tinted" onClick={close}>Fechar</Button></div>
    <p>{item.professional_name ? `Prof. ${item.professional_name}` : 'Criado por mim'}</p>
    <TrainingPlanPreview state={state} initialRoutineId={routineId} />
  </section>
}

const fieldNames = { sets: 'Séries', reps: 'Repetições', load: 'Carga', rest: 'Descanso', duration: 'Duração', distance: 'Distância', notes: 'Observações', rir: 'RIR', rpe: 'RPE' }
const exerciseLabel = id => exerciseName(exOr(id))
const displayValue = (field, value) => {
  if (value == null || value === '') return '—'
  if (field === 'rest' || field === 'sec') return `${value}s`
  if (field === 'min' || field === 'duration') return `${value} min`
  if (field === 'load') return `${value} kg`
  if (field === 'mode') return value === 'time' ? 'Por tempo' : value === 'cardio' ? 'Cardio' : 'Repetições'
  if (field === 'unit') return value === 'lb' ? 'lb' : 'kg'
  if (field === 'sg') return value ? 'Em superset' : 'Sem superset'
  return String(value)
}
const fieldLabel = fieldNames => ({ ...fieldNames, duration: 'Duração', distance: 'Distância', speed: 'Velocidade', mode: 'Formato', sec: 'Duração', min: 'Duração', unit: 'Unidade', effort: 'Esforço', sg: 'Superset' })
function PlanUpdateSheet({ item, workout, close, acknowledge, onView }) {
  const update = item.plan_update
  const dayKey = DAYS[workout.day]
  const previousVersion = item.workout_update_bases?.[dayKey]?.version || update?.previous_version
  const diff = compareProfessionalPlanVersions(previousVersion, update?.next_version || item.version)
  const day = diff.days.find(entry => entry.day === dayKey)
  const title = workout.routine?.name || day?.previousTitle || day?.nextTitle || 'Descanso'
  return <section className="plan-library-preview-sheet plan-update-sheet">
    <div className="row between sheet-title-row"><h2>{update?.is_first ? 'Novo plano do seu profissional' : 'Treino atualizado'}</h2><Button size="sm" variant="tinted" onClick={close}>Fechar</Button></div>
    <p><strong>{title}{day?.previousTitle && day.previousTitle !== day.nextTitle ? ` · ${day.previousTitle} → ${day.nextTitle}` : ''}</strong><br />Prof. {item.professional_name || 'Profissional'}</p>
    {day?.type === 'added' && <p><span className="tag acc">Adicionado</span> Novo treino programado para este dia.</p>}
    {day?.type === 'removed' && <p><span className="tag">Removido</span> Este treino não está mais programado neste dia.</p>}
    {day?.titleChanged && <p><span className="tag">Nome do treino alterado</span> {day.previousTitle} → {day.nextTitle}</p>}
    {day?.exercises.added.map(exercise => <p key={`a-${exercise.exerciseId}`}><span className="tag acc">Adicionado</span> {exerciseLabel(exercise.exerciseId)} {exercise.sets ? `· ${exercise.sets} × ${exercise.reps || ''}` : ''}</p>)}
    {day?.exercises.removed.map(exercise => <p key={`r-${exercise.exerciseId}`}><span className="tag">Removido</span> {exerciseLabel(exercise.exerciseId)} {exercise.sets ? `· ${exercise.sets} × ${exercise.reps || ''}` : ''}</p>)}
    {day?.exercises.changed.map(exercise => <div className="card" key={exercise.exerciseId}><strong>{exerciseLabel(exercise.exerciseId)}</strong>{exercise.changes.map(change => <small className="block" key={change.field}>{fieldLabel(fieldNames)[change.field] || 'Configuração'}: {displayValue(change.field, change.previous)} → {displayValue(change.field, change.next)}</small>)}</div>)}
    {day?.exercises.reordered && <p><span className="tag">Alterado</span> A ordem dos exercícios foi atualizada.</p>}
    <div className="row gap">{workout.routine?.id && day?.type !== 'removed' && <Button variant="primary" onClick={() => { acknowledge(); close(); onView() }}>Ver treino atualizado</Button>}<Button variant="tinted" onClick={() => { acknowledge(); close() }}>Entendi</Button></div>
  </section>
}

export default function PlanLibrary({ onUpdates = undefined, onRemoveReady = undefined, children = undefined }) {
  const { user } = useAuth()
  return <AccountPlanLibrary key={user?.id || 'guest'} user={user} onUpdates={onUpdates} onRemoveReady={onRemoveReady}>{children}</AccountPlanLibrary>
}

function AccountPlanLibrary({ user, onUpdates = undefined, onRemoveReady = undefined, children = undefined }) {
  const nav = useNavigate()
  const state = useStore(s => s.S)
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [data, setData] = useState({ items: [], total: 0 }), [error, setError] = useState(''), [visible, setVisible] = useState(PAGE_SIZE)
  const [choice, setChoice] = useState(null)
  const source = activePlanSource(state, data.items)
  const selectionKey = `${state.activeLibraryId || ''}:${state.assignedProgram?.versionId || ''}:${source}`
  if (choice && choice.key !== selectionKey) setChoice(null)
  const choose = value => setChoice({ key: selectionKey, value })
  const generation = useRef(0)
  const refresh = useCallback(async (offset = 0) => {
    const request = ++generation.current
    try {
      const result = await repo.planLibrary(offset)
      // Search every page so personal snapshots cannot hide an available professional plan.
      while (result.items.length + offset < result.total && request === generation.current) {
        const page = await repo.planLibrary(offset + result.items.length)
        if (!page.items.length) break
        result.items.push(...page.items)
      }
      if (request === generation.current) {
        setData(old => ({ ...result, items: offset ? [...old.items, ...result.items] : result.items }))
        setError('')
      }
    }
    catch { if (request === generation.current) setError('Não foi possível carregar seus planos.') }
  }, [repo])
  useRelationshipRefresh(refresh)
  useEffect(() => { if (user?.id) refresh(); return () => { generation.current += 1 } }, [user?.id, refresh])

  const acknowledge = async (item, dayKey) => {
    const update = item.plan_update
    if (!update) return
    const request = generation.current
    try {
      const versionId = update.next_version?.id || item.version?.id
      if (repo.markProfessionalPlanUpdateDaySeen) await repo.markProfessionalPlanUpdateDaySeen(item.id, versionId, dayKey)
      else await repo.markLibraryWorkoutSeen(item.id, dayKey, versionId)
      if (request !== generation.current) return
      setData(current => ({ ...current, items: current.items.map(entry => {
        if (entry.id !== item.id) return entry
        const workoutUpdates = { ...entry.workout_updates }; delete workoutUpdates[dayKey]
        return { ...entry, workout_updates: workoutUpdates, plan_update: Object.keys(workoutUpdates).length ? entry.plan_update : null }
      }) }))
    } catch { if (request === generation.current) setError('Não foi possível marcar a atualização como vista. Tente novamente.') }
  }
  const open = async workout => {
    const { item, day } = workout
    if (item.workout_updates?.[DAYS[day]] && item.plan_update) {
      useUI.getState().openSheet(close => <PlanUpdateSheet item={item} workout={workout} close={close} acknowledge={() => acknowledge(item, DAYS[day])} onView={() => { const current = useStore.getState().S; const activeRoutineId = isProfessionalPlanActive(current, item.id, item.version?.id) && current.week[day]; if (activeRoutineId) nav(`/plan/r/${activeRoutineId}`); else openPreview(workout) }} />, { className: 'plan-preview-sheet-shell' })
      return
    }
    openPreview(workout)
  }
  const openPreview = async workout => {
    const { item, workspace, routine, day } = workout
    if (!routine?.id) return
    useUI.getState().openSheet(close => <PlanPreviewSheet item={{ ...item, title: routine.name }} state={workspace} routineId={routine.id} close={close} />, { className: 'plan-preview-sheet-shell' })
    const dayKey = DAYS[day], changeVersion = item.workout_updates?.[dayKey]
    if (!changeVersion) return
    const request = generation.current
    try {
      await repo.markLibraryWorkoutSeen(item.id, dayKey, changeVersion)
      if (request !== generation.current) return
      setData(current => ({ ...current, items: current.items.map(entry => {
        if (entry.id !== item.id || entry.workout_updates?.[dayKey] !== changeVersion) return entry
        const updates = { ...entry.workout_updates }
        delete updates[dayKey]
        return { ...entry, workout_updates: updates }
      }) }))
    } catch { if (request === generation.current) setError('Não foi possível marcar a atualização como vista. Abra o treino novamente para tentar.') }
  }
  const professionalWorkouts = useMemo(() => data.items.filter(item => item.source_type === 'professional' && (item.available || item.id === state.activeLibraryId)).flatMap(item => {
    const workspace = weeklyPlanToWorkspace(item.version?.weekly_plan, item.version?.workout_titles)
    const previous = weeklyPlanToWorkspace(item.plan_update?.previous_version?.weekly_plan, item.plan_update?.previous_version?.workout_titles)
    const currentByDay = new Map(workspace.routines.map(routine => [Number(Object.entries(workspace.week).find(([, id]) => id === routine.id)?.[0]), routine]))
    const previousByDay = new Map(previous.routines.map(routine => [Number(Object.entries(previous.week).find(([, id]) => id === routine.id)?.[0]), routine]))
    const pendingDays = Object.keys(item.workout_updates || {}).map(day => DAYS.indexOf(day))
    pendingDays.forEach(day => {
      const base = item.workout_update_bases?.[DAYS[day]]?.version
      if (!base) return
      const baseWorkspace = weeklyPlanToWorkspace(base.weekly_plan, base.workout_titles)
      const baseRoutine = baseWorkspace.routines.find(routine => routine.id === baseWorkspace.week[day])
      if (baseRoutine) previousByDay.set(day, baseRoutine)
    })
    return [...new Set([...currentByDay.keys(), ...pendingDays])].map(day => ({ item, workspace, routine: currentByDay.get(day) || previousByDay.get(day), day, removed: !currentByDay.has(day) && pendingDays.includes(day) }))
  }), [data.items, state.activeLibraryId])
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    onUpdates?.(Object.fromEntries(professionalWorkouts.filter(workout => isProfessionalPlanActive(state, workout.item.id, workout.item.version?.id) && workout.item.workout_updates?.[DAYS[workout.day]]).map(workout => [workout.day, () => openRef.current(workout)])))
  }, [professionalWorkouts, onUpdates, state])
  const removeProfessional = useCallback(() => openPlanApplication({
    personal: true, removing: true, userId: user?.id, repo,
    onApplied: refresh,
  }), [user?.id, repo, refresh])
  useEffect(() => {
    onRemoveReady?.(removeProfessional)
    return () => onRemoveReady?.(null)
  }, [onRemoveReady, removeProfessional])
  const professionalPlans = data.items.filter(item => item.source_type === 'professional' && (item.available || item.id === state.activeLibraryId))
  const shownPlans = professionalPlans.slice(0, visible)

  const professionalActive = source === 'professional'
  const hasProfessional = professionalActive || data.items.some(item => item.source_type === 'professional' && item.available)
  const personalPreview = personalPlanPreview(state, data.items)
  const selectedChoice = choice?.key === selectionKey ? choice.value : source
  if (!user?.id || !hasProfessional) return <>{children}</>
  return <section className="plan-library received-workouts">
    {selectedChoice === 'self' ? <>
      <section className="personal-plan-preview" aria-label="Visualização do plano pessoal">
        <h4>Seu plano pessoal</h4>
        <p>{personalPreview.planMode === 'daily' ? 'Plano diário' : 'Plano semanal'}</p>
        {professionalActive && <p>Visualização. O plano ativo só muda após confirmar a aplicação.</p>}
        {children}
        {Object.keys(personalPreview.dayPlan).length > 0 && <ul>
          {Object.entries(personalPreview.dayPlan).sort(([a], [b]) => a.localeCompare(b)).map(([date, id]) => <li key={date}>
            <time>{date}</time>: {id === null || id === 'rest' ? 'Descanso' : personalPreview.routines.find(routine => routine.id === id)?.name}
          </li>)}
        </ul>}
      </section>
      {professionalActive ? <ProfessionalPlanApplyButton personal repo={repo} onApplied={refresh} /> : <span className="tag acc">Em uso</span>}
    </> : <>
    {error && <p role="alert">{error} <Button onClick={() => refresh()}>Tentar novamente</Button></p>}
    {!shownPlans.length && !error && <div className="card plan-library-empty"><Icon name="clipboard" /><div><strong>Nenhum treino recebido</strong><p>Quando um profissional enviar um plano, os treinos aparecerão aqui.</p></div></div>}
    {shownPlans.map(item => {
      const workouts = professionalWorkouts.filter(workout => workout.item.id === item.id)
      const active = isProfessionalPlanActive(state, item.id, item.version?.id)
      return <section className="card professional-plan-preview" key={item.id} aria-label={`Semana de ${item.title || 'plano profissional'}`}>
        <h4>{item.title || 'Plano profissional'}</h4>
        <p>Prof. {item.professional_name || 'Profissional'}</p>
        {item.plan_update && !active && <p className="tag acc">Atualização disponível para a semana</p>}
        <div className="list plan-routine-list">{workouts.map(workout => <button key={`${item.id}:${workout.day}`} className={`item received-workout-card${workout.removed ? ' removed' : ''}`} onClick={() => open(workout)}>
          <span className="grow">
            <span className="tt">{workout.routine?.name || 'Descanso'}</span>
            <span className="ss">{workout.routine?.ex.length || 0} exercícios</span>
            {item.workout_updates?.[DAYS[workout.day]] && <span className="tag acc workout-update-badge">Atualizado</span>}
          </span>
          <Icon name="chevronRight" />
        </button>)}</div>
        <ProfessionalPlanApplyButton libraryPlanId={item.id} versionId={item.version?.id} repo={repo} onApplied={refresh} />
        {active && <Button variant="ghost" onClick={removeProfessional}>Retirar plano profissional</Button>}
      </section>
    })}
    {professionalPlans.length > shownPlans.length && <Button className="plan-show-more" variant="ghost" onClick={() => setVisible(count => count + PAGE_SIZE)}>Ver mais planos</Button>}
    {data.items.length < data.total && <Button variant="ghost" onClick={() => refresh(data.items.length)}>Carregar mais planos</Button>}
    </>}
    <div className="plan-mode-options plan-library-chooser" role="group" aria-label="Escolher plano">
      <button className={selectedChoice === 'professional' ? 'on' : ''} aria-pressed={selectedChoice === 'professional'} onClick={() => choose('professional')}>Treino do profissional</button>
      <button className={selectedChoice === 'self' ? 'on' : ''} aria-pressed={selectedChoice === 'self'} onClick={() => choose('self')}>Meus treinos</button>
    </div>
  </section>
}
