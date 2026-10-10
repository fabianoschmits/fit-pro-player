import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { professionalDate } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button } from '../components/ui.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel, ManagementEmpty, ManagementStatus, ManagementAvatar } from '../components/ManagementUI.jsx'
import useStudentManagementRequest from '../components/useStudentManagementRequest.js'
import Skeleton from '../features/professional/components/Skeleton.jsx'

export default function StudentProfessionalMaterials() {
  const auth = useAuth()
  return <MaterialsWorkspace key={`${auth.status}:${auth.user?.id}`} />
}
function MaterialsWorkspace() {
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const load = useCallback(() => repo.studentProfessionals(), [repo])
  const { data, busy, error, refresh } = useStudentManagementRequest(load, 'Não foi possível carregar seus profissionais.')
  return <ManagementLayout audience="student" className="student-materials-page" title={t('Materiais recebidos')} subtitle={t('Programas e prescrições dos seus profissionais')} backTo="/student/professionals">
    <p className="muted">{t('Até 100 materiais recentes por profissional com vínculo ativo.')}</p>
    {error && <p role="alert" className="management-error">{error} <Button onClick={refresh}>{t('Tentar novamente')}</Button></p>}
    {busy ? <Skeleton variant="rows" label={t('Carregando materiais…')} /> : data?.length ? data.map(person => <ProfessionalMaterials key={person.professionalId} person={person} repo={repo} />) : !error && <ManagementEmpty title={t('Você ainda não possui profissionais vinculados.')} action={<Link className="management-button" to="/student/professionals/add">{t('Adicionar profissional')}</Link>} />}
  </ManagementLayout>
}
function ProfessionalMaterials({ person, repo }) {
  const load = useCallback(async () => {
    const detail = await repo.studentProfessionalDetail(person.professionalId)
    return detail?.professional?.professionalId === person.professionalId ? detail : null
  }, [repo, person.professionalId])
  const { data, busy, error, refresh } = useStudentManagementRequest(load, 'Não foi possível carregar os materiais deste profissional.')
  return <ManagementPanel title={<span className="management-material-person"><ManagementAvatar name={person.professionalName} photoPath={person.photoPath} />{person.professionalName}</span>} action={<Link className="management-button" to={`/student/professionals/${person.professionalId}`}>{t('Ver profissional')}</Link>}>
    {busy ? <Skeleton variant="rows" count={2} label={t('Carregando materiais…')} /> : error ? <p role="alert" className="management-error">{error} <Button onClick={refresh}>{t('Tentar novamente')}</Button></p> : data?.materials?.length ? <div className="management-material-list">{data.materials.map(item => <Link className="management-material-link" key={item.assignmentId} to={`/student/professionals/${person.professionalId}?section=training&material=${encodeURIComponent(item.assignmentId)}`}><div><h3>{item.title}</h3><p className="muted">{t('Versão {0}', item.versionNumber || '—')}</p><small className="muted">{t('Recebido em {0}', professionalDate(item.assignedAt))}</small></div><ManagementStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{t(item.status === 'active' ? 'Ativo' : 'Encerrado')}</ManagementStatus></Link>)}</div> : <p className="muted">{t('Nenhum material recebido deste profissional.')}</p>}
  </ManagementPanel>
}
