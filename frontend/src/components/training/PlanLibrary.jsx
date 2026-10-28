import TrainingPlanPreview from './TrainingPlanPreview.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore } from '../../store/useStore.js'
import { createProfessionalWorkflowRepository } from '../../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { weeklyPlanToWorkspace } from '../../lib/training-workspace.js'
import { parsePlan } from '../../lib/training-dto.js'
import { applyDomainState } from '../../lib/domain-state.js'
import { Button } from '../ui.jsx'
import { confirmSheet } from '../../sheets.jsx'
import { useUI } from '../../store/useUI.js'
import Icon from '../Icon.jsx'

const PAGE_SIZE = 5

function PlanPreviewSheet({ item, state, routineId, close }) {
  return <section className="plan-library-preview-sheet">
    <div className="row between sheet-title-row"><h2>{item.title}</h2><Button size="sm" variant="tinted" onClick={close}>Fechar</Button></div>
    <p>{item.professional_name ? `Prof. ${item.professional_name}` : 'Criado por mim'}</p>
    <TrainingPlanPreview state={state} initialRoutineId={routineId} />
  </section>
}

export default function PlanLibrary() {
  const { user } = useAuth()
  return <AccountPlanLibrary key={user?.id || 'guest'} user={user} />
}

function AccountPlanLibrary({ user }) {
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

  const open = (item, previewState, routineId = null) => useUI.getState().openSheet(close => <PlanPreviewSheet item={item} state={previewState} routineId={routineId} close={close} />, { className: 'plan-preview-sheet-shell' })
  const professionalWorkouts = useMemo(() => data.items.filter(item => item.source_type === 'professional').flatMap(item => {
    const workspace = weeklyPlanToWorkspace(item.version?.weekly_plan, item.version?.workout_titles)
    return workspace.routines.map(routine => ({ item, workspace, routine, day: Number(Object.entries(workspace.week).find(([, id]) => id === routine.id)?.[0]) }))
  }), [data.items])
  const shownWorkouts = professionalWorkouts.slice(0, visible)
  const removeFromDay = workout => confirmSheet({
    title: 'Retirar treino deste dia?',
    message: `${workout.routine.name} continuará disponível nos treinos recebidos do profissional.`,
    confirmText: 'Retirar treino',
    onConfirm: () => { update(next => { delete next.week[workout.day] }); return true },
  })

  if (!user?.id) return null
  return <section className="plan-library received-workouts">
    <div className="plan-library-head"><h3>Treinos recebidos do profissional</h3><p>Abra um treino para ver os detalhes e aplique quando quiser usar o plano no seu perfil.</p></div>
    {error && <p role="alert">{error} <Button onClick={() => refresh()}>Tentar novamente</Button></p>}
    {!shownWorkouts.length && !error && <div className="card plan-library-empty"><Icon name="clipboard" /><div><strong>Nenhum treino recebido</strong><p>Quando um profissional enviar um plano, os treinos aparecerão aqui.</p></div></div>}
    <div className="received-workout-list">{shownWorkouts.map(workout => {
      const active = state.assignedProgram?.versionId === workout.item.version?.id && state.week[workout.day]
      return <article className="card received-workout-card" key={`${workout.item.id}:${workout.day}`}>
        <button className="received-workout-main" onClick={() => open({ ...workout.item, title: workout.routine.name }, workout.workspace, workout.routine.id)}>
          <span className="received-workout-copy"><strong>{workout.routine.name}</strong><small>{workout.routine.ex.length} exercícios · Prof. {workout.item.professional_name || 'Profissional'}</small></span>
          <Icon name="chevronRight" />
        </button>
        <Button variant={active ? 'tinted' : 'primary'} disabled={busy} feedback="persistence" onClick={event => { event.stopPropagation(); active ? removeFromDay(workout) : apply(workout.item) }} loadingLabel="Aplicando…" successLabel="Aplicado">{active ? 'Aplicado' : 'Aplicar'}</Button>
      </article>
    })}</div>
    {professionalWorkouts.length > shownWorkouts.length && <Button className="plan-show-more" variant="ghost" onClick={() => setVisible(count => count + PAGE_SIZE)}>Mostrar mais</Button>}
    {data.items.length < data.total && <Button variant="ghost" onClick={() => refresh(data.items.length)}>Carregar mais planos</Button>}
  </section>
}
