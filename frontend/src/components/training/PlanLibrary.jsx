import TrainingPlanPreview from './TrainingPlanPreview.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore } from '../../store/useStore.js'
import { createProfessionalWorkflowRepository } from '../../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { weeklyPlanToWorkspace } from '../../lib/training-workspace.js'
import { parsePlan } from '../../lib/training-dto.js'
import { applyDomainState } from '../../lib/domain-state.js'
import { Button, TextField } from '../ui.jsx'
import { confirmSheet } from '../../sheets.jsx'
export default function PlanLibrary() {
  const { user } = useAuth()
  return <AccountPlanLibrary key={user?.id || 'guest'} user={user} />
}
function AccountPlanLibrary({ user }) {
  const state = useStore(s => s.S)
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [data, setData] = useState({ items: [], total: 0 }), [error, setError] = useState(''), [preview, setPreview] = useState(null), [name, setName] = useState('Meu plano'), [busy, setBusy] = useState(false)
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
      if (!store.isScopeCurrent(token)) return
      if (useStore.getState().S._pendingSync?.plan) throw new Error('pending-plan')
      await action(token)
      if (store.isScopeCurrent(token)) { await refresh(); return true }
      return false
    } catch { if (store.isScopeCurrent(token)) setError('Não foi possível salvar. Verifique a conexão e tente novamente.'); return false }
    finally { if (store.isScopeCurrent(token)) setBusy(false) }
  }
  const apply = item => confirmSheet({ title: 'Usar este plano?', message: 'Seu plano atual continuará salvo e você poderá voltar para ele depois.', confirmText: 'Aplicar plano', onConfirm: async () => {
    return mutate(async token => { const result = await repo.applyLibraryPlan(item.id); const store = useStore.getState(); if (!store.isScopeCurrent(token)) return
      const next = applyDomainState(store.S, 'plan', parsePlan(result, user.id)); next._pendingSync = { ...next._pendingSync, plan: false }; next.onboardingDone = true; store.replaceState(next, false)
    })
  } })
  if (!user?.id) return null
  const open = item => { setPreview(item.source_type === 'professional' ? weeklyPlanToWorkspace(item.version.weekly_plan, item.version.workout_titles) : { routines: item.personal_plan.routines.map(r => ({ ...r.prescription, id: r.id, name: r.title })), week: item.personal_plan.schedule.week || {} }) }
  return <section className="plan-library">
    <div className="plan-library-head"><h3>Biblioteca de planos</h3><p>Escolha qual plano você quer usar sem perder os demais.</p></div>
    <div className="card"><small>Plano ativo</small><h2>{state.activeLibraryTitle || 'Meu plano'}</h2><p>{state.assignedProgram ? `Prof. ${data.items.find(item => item.id === state.activeLibraryId)?.professional_name || 'Profissional'}` : 'Criado por mim'}</p></div>
    {error && <p role="alert">{error} <Button onClick={() => refresh()}>Tentar novamente</Button></p>}
    {preview ? <div className="card"><Button onClick={() => setPreview(null)}>Fechar visualização</Button><TrainingPlanPreview state={preview} /></div> : null}
    {[['self','Meus planos'],['professional','Planos dos profissionais']].map(([type, title]) => <section key={type}><h3>{title}</h3>{data.items.filter(item => item.source_type === type).map(item => {
      const active = state.activeLibraryId === item.id
      const update = type === 'professional' && item.version?.version_number > 1 && !active && !data.items.some(other => other.program_id === item.program_id && other.version?.version_number > item.version.version_number)
      return <article className="card" key={item.id}><h4>{item.title}</h4><p>{item.professional_name ? `Prof. ${item.professional_name}` : 'Criado por mim'}</p><p>{active ? 'Ativo' : update ? 'Atualização disponível' : type === 'professional' ? 'Plano recebido' : 'Plano salvo'}</p><div className="row"><Button onClick={() => open(item)}>Visualizar</Button>{!active && item.available && <Button variant="primary" disabled={busy} onClick={() => apply(item)}>Aplicar</Button>}</div></article>
    })}</section>)}
    {data.items.length < data.total && <Button onClick={() => refresh(data.items.length)}>Carregar mais</Button>}
    {!state.assignedProgram && <details className="card"><summary>Salvar uma cópia do meu plano</summary><TextField aria-label="Nome do plano" maxLength={160} value={name} onChange={e => setName(e.target.value)} /><Button disabled={busy || !name.trim()} onAction={() => mutate(() => repo.savePersonalPlan(name.trim()))}>Salvar plano</Button></details>}
  </section>
}
