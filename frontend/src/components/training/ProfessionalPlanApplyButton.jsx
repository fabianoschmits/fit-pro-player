import { useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { parsePlan } from '../../lib/training-dto.js'
import { applyDomainState } from '../../lib/domain-state.js'
import { Button } from '../ui.jsx'

export const isProfessionalPlanActive = (state, libraryPlanId, versionId) => Boolean(
  libraryPlanId && versionId && state.activeLibraryId === libraryPlanId && state.assignedProgram?.versionId === versionId,
)

const applicationError = error => error.message === 'pending-plan'
  ? 'Existem alterações dos seus treinos aguardando sincronização. Tente sincronizar novamente antes de aplicar.'
  : error.code === '42501' || error.code === '22023'
    ? 'Este plano não está mais disponível. Atualize os treinos recebidos.'
    : error.code === '40001' || error.kind === 'revision-conflict'
      ? 'Seus treinos foram alterados em outra sessão. Sincronize e tente novamente.'
      : error.message === 'account-scope'
        ? 'Sua conta mudou. Feche este modal e entre novamente para aplicar o plano.'
        : 'Não foi possível aplicar o plano. Tente novamente; se persistir, contate o suporte.'

const planSnapshot = state => JSON.stringify([state.routines, state.week, state.dayPlan, state.planMode, state.activeLibraryId, state.assignedProgram, state.planServerRevision])

function validateExecutionPlan(parsed, current, versionId) {
  const routines = new Map(parsed.routines.map(routine => [routine.id, routine]))
  const week = parsed.schedule?.values?.week
  if (!week || typeof week !== 'object' || Array.isArray(week) || !Object.keys(week).length || routines.size !== parsed.routines.length) throw new Error('invalid-execution-plan')
  for (const id of Object.values(week)) {
    const routine = routines.get(id)?.prescription
    if (!routine?.assigned || routine.programVersionId !== versionId || !Array.isArray(routine.ex) || !routine.ex.length) throw new Error('invalid-execution-plan')
  }
  for (const routine of parsed.routines) {
    if (!Array.isArray(routine.prescription.ex)) throw new Error('invalid-execution-plan')
  }
  for (const routine of current.routines || []) {
    if (!routine.assigned && (!routines.has(routine.id) || routines.get(routine.id).prescription.assigned)) throw new Error('missing-personal-routine')
  }
}

function ProfessionalPlanApplyDialog({ libraryPlanId, versionId, userId, repo, token, close, lock, onApplied }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const requireScope = () => {
    const store = useStore.getState()
    if (token.scope.kind !== 'account' || token.scope.userId !== userId || !store.isScopeCurrent(token)) throw new Error('account-scope')
    return store
  }
  const apply = async () => {
    if (inFlight.current) return
    inFlight.current = true; setPending(true); setError(''); lock(true)
    try {
      await requireScope().retryAccountSync()
      let store = requireScope()
      if (store.S._pendingSync?.plan) throw new Error('pending-plan')
      const before = planSnapshot(store.S)
      const result = await repo.applyLibraryPlan(libraryPlanId)
      store = requireScope()
      const parsed = parsePlan(result, userId)
      validateExecutionPlan(parsed, store.S, versionId)
      // Never overwrite a plan edited or synchronized while the request was outstanding.
      if (store.S._pendingSync?.plan || planSnapshot(store.S) !== before) throw Object.assign(new Error('revision-conflict'), { code: '40001' })
      const next = applyDomainState(store.S, 'plan', parsed)
      if (next === store.S || !isProfessionalPlanActive(next, libraryPlanId, versionId)) throw new Error('unexpected-active-plan')
      next._pendingSync = { ...next._pendingSync, plan: false }
      next.onboardingDone = true
      store.replaceState(next, false)
      if (!isProfessionalPlanActive(useStore.getState().S, libraryPlanId, versionId)) throw new Error('unexpected-active-plan')
      close()
      // A failed list refresh must not turn a confirmed application into a retry.
      void Promise.resolve().then(() => onApplied?.()).catch(() => {})
    } catch (cause) {
      console.error('Plan library operation failed', cause)
      setError(applicationError(cause))
    } finally {
      inFlight.current = false; setPending(false); lock(false)
    }
  }
  return <section aria-label="Aplicar plano profissional?">
    <h3>Aplicar plano profissional?</h3>
    <p>Os treinos recebidos serão usados no seu perfil. Seus treinos criados continuarão salvos.</p>
    {error && <p role="alert">{error}</p>}
    <Button variant="primary" activation="immediate" disabled={pending} aria-busy={pending} onClick={apply}>{pending ? 'Aplicando…' : 'Aplicar plano'}</Button>
    <Button variant="ghost" activation="immediate" disabled={pending} onClick={close}>Cancelar</Button>
  </section>
}

export default function ProfessionalPlanApplyButton({ libraryPlanId, versionId, repo, onApplied = undefined }) {
  const { user } = useAuth()
  const active = useStore(s => isProfessionalPlanActive(s.S, libraryPlanId, versionId))
  const open = () => {
    const ui = useUI.getState()
    if (ui.sheets.some(sheet => sheet.className === 'professional-plan-apply')) return
    const token = useStore.getState().getScopeToken()
    let handle
    handle = ui.openSheet(close => <ProfessionalPlanApplyDialog libraryPlanId={libraryPlanId} versionId={versionId} userId={user?.id} repo={repo} token={token} close={close} lock={value => handle.lock(value)} onApplied={onApplied} />, { kind: 'center', className: 'professional-plan-apply' })
  }
  return <Button variant={active ? 'tinted' : 'primary'} disabled={active || !libraryPlanId || !versionId} activation="immediate" onClick={open}>{active ? 'Aplicado' : 'Aceitar'}</Button>
}
