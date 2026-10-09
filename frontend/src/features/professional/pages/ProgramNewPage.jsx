import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { useStore } from '../../../store/useStore.js'
import { Button } from '../../../components/ui.jsx'
import { useProfessionalSession } from '../hooks/useProfessionalSession.js'
import { useProfessionalMutation } from '../hooks/useProfessionalMutation.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import ProgramMetadataFields from '../components/ProgramMetadataFields.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
export default function ProgramNewPage() {
  const session = useProfessionalSession()
  return <NewProgram key={`${session.accountId}:${session.authInitializing}`} session={session} />
}
function NewProgram({ session }) {
  const location = useLocation(), navigate = useNavigate()
  const [form, setForm] = useState({ title: '', description: '', objective: '' })
  const created = useRef(null)
  const mutation = useProfessionalMutation(session.isScopeCurrent)
  const backTo = location.state?.programsReturn || preserveProfessionalIdentity('/professional/programs', location.search)
  const create = event => {
    event.preventDefault()
    if (!form.title.trim() || form.title.length > 160 || form.objective.length > 160 || form.description.length > 2000) return
    mutation.run(async current => {
      const result = created.current || await session.repo.createProgram(session.accountId, form.title, form.description)
      if (!current()) return
      if (!result?.id) throw new Error('missing-program')
      created.current = result
      await session.repo.updateProgramMetadata({ programId: result.id, ...form })
      if (!current()) return
      const saved = useStore.getState().writeProgramDraft({ accountId: session.accountId, programId: result.id, scopeToken: session.scope,
        value: { ...form, weeklyPlan: {}, workoutTitles: {}, _revision: 1, dirty: true } })
      if (!saved) throw new Error('draft-save-failed')
      return result
    }, result => navigate(preserveProfessionalIdentity(professionalPath({ kind: 'programEdit', id: result.id }), location.search), { state: location.state }), t('Não foi possível criar o programa.'))
  }
  return <ProfessionalLayout title={t('Novo programa')} backTo={backTo}>
    {session.authExpired ? <EmptyState title={t('Não foi possível confirmar sua sessão. Tente novamente.')} /> : session.authInitializing ? <Skeleton variant="detail" />
      : !session.accountId ? <EmptyState title={t('Entre na sua conta para continuar.')} /> : <form className="professional-program-form" onSubmit={create}>
        <ProgramMetadataFields value={form} onChange={setForm} disabled={mutation.pending} />
        {mutation.error && <p role="alert" className="management-error">{mutation.error}</p>}
        <div className="row-actions"><Button type="submit" variant="primary" disabled={mutation.pending || !form.title.trim()}>{t(mutation.pending ? 'Salvando…' : 'Criar programa')}</Button><Link className="management-button" to={backTo} state={location.state}>{t('Cancelar')}</Link></div>
      </form>}
  </ProfessionalLayout>
}
