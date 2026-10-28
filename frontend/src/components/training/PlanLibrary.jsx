import TrainingPlanPreview from './TrainingPlanPreview.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore } from '../../store/useStore.js'
import { createProfessionalWorkflowRepository } from '../../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { weeklyPlanToWorkspace } from '../../lib/training-workspace.js'
import { DAYS } from '../../lib/professional-program.js'
import { parsePlan } from '../../lib/training-dto.js'
import { applyDomainState } from '../../lib/domain-state.js'
import { Button } from '../ui.jsx'
import { confirmSheet } from '../../sheets.jsx'
import { useUI } from '../../store/useUI.js'
import Icon from '../Icon.jsx'
import { compareProfessionalPlanVersions } from '../../lib/professional-plan-diff.js'
import { useNavigate } from 'react-router-dom'
import { exerciseName, exOr } from '../../lib/exercises.js'

const PAGE_SIZE = 5

function PlanPreviewSheet({ item, state, routineId, close }) {
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
  const diff = compareProfessionalPlanVersions(update?.previous_version, update?.next_version || item.version)
  const day = diff.days.find(entry => entry.day === DAYS[workout.day])
  const title = workout.routine.name
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
    <div className="row gap"><Button variant="primary" onClick={() => { acknowledge(); close(); onView() }}>Ver treino atualizado</Button><Button variant="tinted" onClick={() => { acknowledge(); close() }}>Entendi</Button></div>
  </section>
}

export default function PlanLibrary({ onUpdates }) {
  const { user } = useAuth()
  return <AccountPlanLibrary key={user?.id || 'guest'} user={user} onUpdates={onUpdates} />
}

function AccountPlanLibrary({ user, onUpdates }) {
  const nav = useNavigate()
  const state = useStore(s => s.S)
  const update = useStore(s => s.update)
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [data, setData] = useState({ items: [], total: 0 }), [error, setError] = useState(''), [busy, setBusy] = useState(false), [visible, setVisible] = useState(PAGE_SIZE)
  const generation = useRef(0)
  const refresh = useCallback(async (offset = 0) => {
    const request = ++generation.current
    try { const result = await repo.planLibrary(offset); if (request === generation.current) { setData(old => ({ ...result, items: offset ? [...old.items, ...result.items] : result.items })); setError('') } }
    catch { if (request === generation.current) setError('Não foi possível carregar seus planos.') }
  }, [repo])
  useEffect(() => { if (user?.id) refresh(); return () => { generation.current++ } }, [user?.id, refresh])

  const mutate = async action => {
    const store = useStore.getState(), token = store.getScopeToken()
    setBusy(true); setError('')
    try {
      await store.retryAccountSync()
      if (!store.isScopeCurrent(token)) return false
      if (useStore.getState().S._pendingSync?.plan) throw new Error('pending-plan')
      await action(token)
      if (store.isScopeCurrent(token)) { await refresh(); return true }
      return false
    } catch { if (store.isScopeCurrent(token)) setError('Não foi possível salvar. Verifique a conexão e tente novamente.'); return false }
    finally { if (store.isScopeCurrent(token)) setBusy(false) }
  }

  const apply = item => confirmSheet({ title: 'Aplicar plano profissional?', message: 'Os treinos recebidos serão usados no seu perfil. Seus treinos criados continuam salvos.', confirmText: 'Aplicar plano', onConfirm: async () => {
    return mutate(async token => {
      const result = await repo.applyLibraryPlan(item.id)
      const store = useStore.getState()
      if (!store.isScopeCurrent(token)) return
      const next = applyDomainState(store.S, 'plan', parsePlan(result, user.id))
      next._pendingSync = { ...next._pendingSync, plan: false }
      next.onboardingDone = true
      store.replaceState(next, false)
    })
  } })

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
    const { item, workspace, routine, day } = workout
    if (item.workout_updates?.[DAYS[day]] && item.plan_update) {
      useUI.getState().openSheet(close => <PlanUpdateSheet item={item} workout={workout} close={close} acknowledge={() => acknowledge(item, DAYS[day])} onView={() => { const activeRoutineId = useStore.getState().S.week[day]; if (activeRoutineId) nav(`/plan/r/${activeRoutineId}`); else openPreview(workout) }} />, { className: 'plan-preview-sheet-shell' })
      return
    }
    openPreview(workout)
  }
  const openPreview = async workout => {
    const { item, workspace, routine, day } = workout
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
  const professionalWorkouts = useMemo(() => data.items.filter(item => item.source_type === 'professional').flatMap(item => {
    const workspace = weeklyPlanToWorkspace(item.version?.weekly_plan, item.version?.workout_titles)
    return workspace.routines.map(routine => ({ item, workspace, routine, day: Number(Object.entries(workspace.week).find(([, id]) => id === routine.id)?.[0]) }))
  }), [data.items])
  useEffect(() => {
    onUpdates?.(Object.fromEntries(professionalWorkouts.filter(workout => workout.item.workout_updates?.[DAYS[workout.day]]).map(workout => [workout.day, () => open(workout)])))
  }, [professionalWorkouts, onUpdates])
  const shownWorkouts = professionalWorkouts.slice(0, visible)
  const removeFromDay = workout => confirmSheet({
    title: 'Retirar treino deste dia?',
    message: `${workout.routine.name} continuará disponível nos treinos recebidos do profissional.`,
    confirmText: 'Retirar treino',
    onConfirm: () => { update(next => { delete next.week[workout.day] }); return true },
  })

  if (!user?.id) return null
  return <section className="plan-library received-workouts">
    <div className="plan-library-head"><h3>Treinos recebidos do profissional</h3><p>Seu plano profissional ativo é atualizado automaticamente. Abra um treino para ver os detalhes.</p></div>
    {error && <p role="alert">{error} <Button onClick={() => refresh()}>Tentar novamente</Button></p>}
    {!shownWorkouts.length && !error && <div className="card plan-library-empty"><Icon name="clipboard" /><div><strong>Nenhum treino recebido</strong><p>Quando um profissional enviar um plano, os treinos aparecerão aqui.</p></div></div>}
    <div className="received-workout-list">{shownWorkouts.map(workout => {
      const active = state.assignedProgram?.versionId === workout.item.version?.id && state.week[workout.day]
      return <article className="card received-workout-card" key={`${workout.item.id}:${workout.day}`}>
        <button className="received-workout-main" onClick={() => open(workout)}>
          <span className="received-workout-copy"><strong>{workout.routine.name}</strong>{workout.item.workout_updates?.[DAYS[workout.day]] && <span className="tag acc workout-update-badge">Atualizado</span>}<small>{workout.routine.ex.length} exercícios · Prof. {workout.item.professional_name || 'Profissional'}</small></span>
          <Icon name="chevronRight" />
        </button>
        <Button variant={active ? 'tinted' : 'primary'} disabled={busy} feedback="persistence" onClick={event => { event.stopPropagation(); active ? removeFromDay(workout) : apply(workout.item) }} loadingLabel="Aplicando…" successLabel="Aplicado">{active ? 'Aplicado' : 'Aplicar'}</Button>
      </article>
    })}</div>
    {professionalWorkouts.length > shownWorkouts.length && <Button className="plan-show-more" variant="ghost" onClick={() => setVisible(count => count + PAGE_SIZE)}>Ver mais</Button>}
    {data.items.length < data.total && <Button variant="ghost" onClick={() => refresh(data.items.length)}>Carregar mais planos</Button>}
  </section>
}
