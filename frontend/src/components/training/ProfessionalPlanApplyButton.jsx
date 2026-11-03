import { useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore, normalizeState } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { parsePlan } from '../../lib/training-dto.js'
import { applyDomainState } from '../../lib/domain-state.js'
import { Button } from '../ui.jsx'

export const isProfessionalPlanActive = (state, libraryPlanId, versionId) => Boolean(
  libraryPlanId && versionId && state.activeLibraryId === libraryPlanId && state.assignedProgram?.versionId === versionId,
)

const applicationError = error => error.message === 'pending-plan'
  ? error.syncKind === 'sync-conflict'
    ? 'Há um conflito de sincronização com outra sessão. Suas alterações pessoais foram preservadas; o plano ainda não foi aplicado.'
    : error.syncKind === 'offline'
      ? 'Sem conexão para sincronizar seus treinos. Conecte-se e tente aplicar novamente.'
      : 'Existem alterações dos seus treinos aguardando sincronização. Tente sincronizar novamente antes de aplicar.'
  : error.code === '42501' || error.code === '22023'
    ? 'Este plano não está mais disponível. Atualize os treinos recebidos.'
    : error.code === '40001' || error.kind === 'revision-conflict'
      ? 'Seus treinos foram alterados em outra sessão. Sincronize e tente novamente.'
      : error.message === 'account-scope'
        ? 'Sua conta mudou. Feche este modal e entre novamente para aplicar o plano.'
        : 'Não foi possível aplicar o plano. Tente novamente; se persistir, contate o suporte.'

const canonical = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry)

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

function ProfessionalPlanApplyDialog({ libraryPlanId, versionId, personal, removing, userId, repo, token, close, lock, onApplied }) {
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
      if (store.S._pendingSync?.plan) throw Object.assign(new Error('pending-plan'), { syncKind: store.accountSync?.error, path: store.S._syncConflicts?.plan?.path })
      const before = planSnapshot(store.S)
      const targetId = personal ? await repo.savePersonalPlan('Meu plano') : libraryPlanId
      store = requireScope()
      if (store.S._pendingSync?.plan || planSnapshot(store.S) !== before) throw Object.assign(new Error('revision-conflict'), { code: '40001' })
      if (typeof targetId !== 'string' || !targetId) throw new Error('invalid-library-id')
      const result = await repo.applyLibraryPlan(targetId, store.S.planServerRevision || 0)
      store = requireScope()
      const parsed = parsePlan(result, userId)
      if (parsed.schedule?.revision !== (store.S.planServerRevision || 0) + 1) throw new Error('unexpected-plan-revision')
      if (personal) {
        const current = store.S.routines.filter(routine => !routine.assigned)
        if (!parsed.schedule || parsed.schedule.values.assignedProgram != null || parsed.routines.some(routine => routine.prescription.assigned) || parsed.routines.length !== current.length || new Set(parsed.routines.map(routine => routine.id)).size !== current.length) throw new Error('invalid-personal-plan')
        // Compare the representation the store actually uses. Loading legacy starter
        // routines can add metadata without making the plan dirty or changing its prescription.
        const restored = normalizeState({ ...store.S, ...applyDomainState(store.S, 'plan', parsed), onboardingDone: true }).routines
        for (const routine of current) {
          const match = restored.find(item => item.id === routine.id)
          if (!match || canonical(match) !== canonical(routine)) throw new Error('changed-personal-routine')
        }
      } else validateExecutionPlan(parsed, store.S, versionId)
      // Never overwrite a plan edited or synchronized while the request was outstanding.
      if (store.S._pendingSync?.plan || planSnapshot(store.S) !== before) throw Object.assign(new Error('revision-conflict'), { code: '40001' })
      const next = applyDomainState(store.S, 'plan', parsed)
      const isActive = state => personal ? state.activeLibraryId === targetId && state.assignedProgram === null : isProfessionalPlanActive(state, targetId, versionId)
      if (next === store.S || !isActive(next)) throw new Error('unexpected-active-plan')
      if (!store.acceptConfirmedAccountPlan(parsed, token)) throw Object.assign(new Error('revision-conflict'), { code: '40001' })
      store = requireScope()
      store.replaceState({ ...store.S, onboardingDone: true }, false)
      if (!isActive(useStore.getState().S)) throw new Error('unexpected-active-plan')
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
  const title = removing ? 'Retirar plano profissional?' : personal ? 'Usar meus treinos?' : 'Aplicar plano profissional?'
  return <section aria-label={title}>
    <h3>{title}</h3>
    <p>{personal ? 'Todos os dias do plano profissional serão substituídos pela sua configuração pessoal de semana e modo. Seus treinos pessoais atuais serão preservados. O plano profissional continuará salvo e poderá ser usado novamente.' : 'A semana completa deste plano será aplicada, incluindo os treinos sem alterações e os dias de descanso. Seus treinos criados continuarão salvos.'}</p>
    {error && <p role="alert">{error}</p>}
    <Button variant="primary" activation="immediate" disabled={pending} aria-busy={pending} onClick={apply}>{pending ? 'Aplicando…' : personal ? 'Aplicar meus treinos' : 'Aplicar plano'}</Button>
    <Button variant="ghost" activation="immediate" disabled={pending} onClick={close}>Cancelar</Button>
  </section>
}

export function openPlanApplication({ libraryPlanId = undefined, versionId = undefined, personal = false, removing = false, userId, repo, onApplied = undefined }) {
  const ui = useUI.getState()
  if (ui.sheets.some(sheet => sheet.className === 'professional-plan-apply')) return
  const token = useStore.getState().getScopeToken()
  let handle
  handle = ui.openSheet(close => <ProfessionalPlanApplyDialog libraryPlanId={libraryPlanId} versionId={versionId} personal={personal} removing={removing} userId={userId} repo={repo} token={token} close={close} lock={value => handle.lock(value)} onApplied={onApplied} />, { kind: 'center', className: 'professional-plan-apply' })
}

export default function ProfessionalPlanApplyButton({ libraryPlanId = undefined, versionId = undefined, personal = false, repo, onApplied = undefined }) {
  const { user } = useAuth()
  const active = useStore(s => isProfessionalPlanActive(s.S, libraryPlanId, versionId))
  const open = () => openPlanApplication({ libraryPlanId, versionId, personal, userId: user?.id, repo, onApplied })
  return <Button variant={active ? 'tinted' : 'primary'} disabled={active || (!personal && (!libraryPlanId || !versionId))} activation="immediate" onClick={open}>{active ? 'Em uso' : personal ? 'Usar meus treinos' : 'Usar este plano'}</Button>
}
