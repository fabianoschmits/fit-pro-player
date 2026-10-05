import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { professionalDate, statusLabel, withTimeout } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button } from '../components/ui.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel, ManagementEmpty, ManagementAvatar, ManagementStatus } from '../components/ManagementUI.jsx'
import { ProfessionalPrescription, ProfessionalSessionDetail, professionalDayLabel } from '../components/ProfessionalPrescription.jsx'
import useStudentManagementRequest from '../components/useStudentManagementRequest.js'
import { studentVerificationLabel } from '../components/StudentProfessionalVerification.jsx'

const SECTIONS = [['summary', 'Apresentação'], ['training', 'Treino'], ['history', 'Histórico'], ['relationship', 'Vínculo']]
export default function StudentProfessionalDetail() {
  const auth = useAuth(); const { professionalId } = useParams()
  return <DetailWorkspace key={`${auth.status}:${auth.user?.id}:${professionalId}`} professionalId={professionalId} />
}
function DetailWorkspace({ professionalId }) {
  const navigate = useNavigate(); const [params] = useSearchParams()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const alive = useRef(false); const mutationPending = useRef(false); const currentQuery = useRef(params.toString()); currentQuery.current = params.toString()
  const [confirm, setConfirm] = useState(false); const [saving, setSaving] = useState(false); const [actionError, setActionError] = useState('')
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const load = useCallback(async () => {
    const detail = await repo.studentProfessionalDetail(professionalId)
    return detail?.professional?.professionalId === professionalId ? detail : null
  }, [repo, professionalId])
  const { data, busy, error, refresh } = useStudentManagementRequest(load, 'Não foi possível carregar este profissional.')
  const section = SECTIONS.some(([value]) => value === params.get('section')) ? params.get('section') : 'summary'
  const sectionUrl = value => { const next = new URLSearchParams(params); next.set('section', value); return `?${next}` }
  const revoke = async () => {
    if (!data?.relationship?.id || mutationPending.current) return
    mutationPending.current = true
    const requestQuery = currentQuery.current
    setSaving(true); setActionError('')
    try { await withTimeout(repo.revokeRelationship(data.relationship.id), 10000); if (alive.current) { if (currentQuery.current === requestQuery) navigate('/student/professionals', { replace: true }); else { setConfirm(false); await refresh() } } }
    catch { if (alive.current) setActionError(t('Não foi possível encerrar o vínculo.')) }
    finally { mutationPending.current = false; if (alive.current) setSaving(false) }
  }
  if (busy || !data) return <ManagementLayout audience="student" title={t('Profissional')} backTo="/student/professionals">{busy ? <p role="status">{t('Carregando profissional…')}</p> : <ManagementEmpty title={error || t('Profissional não encontrado.')} action={<div className="row-actions">{error && <Button onClick={refresh}>{t('Tentar novamente')}</Button>}<Link className="management-button" to="/student/professionals">{t('Voltar para meus profissionais')}</Link></div>} />}</ManagementLayout>
  const person = data.professional
  const materials = data.materials || []; const materialId = params.get('material')
  const selectedMaterial = materials.find(item => item.assignmentId === materialId)
  const displayed = materialId ? selectedMaterial ? [selectedMaterial] : [] : materials
  return <ManagementLayout audience="student" className="student-professional-detail" title={person.professionalName} subtitle={t('Acompanhamento profissional')} backTo="/student/professionals">
    {actionError && <p role="alert" className="management-error">{actionError}</p>}
    <div className="management-person-strip"><ManagementAvatar name={person.professionalName} /><div><strong>{person.professionalName}</strong>{person.specialties?.length > 0 && <p className="muted">{person.specialties.join(' · ')}</p>}</div><ManagementStatus tone="success">{t('Vínculo ativo')}</ManagementStatus></div>
    <nav className="management-section-nav" aria-label={t('Detalhe do profissional')}>{SECTIONS.map(([value, label]) => <Link key={value} to={sectionUrl(value)} aria-current={section === value ? 'page' : undefined}>{t(label)}</Link>)}</nav>
    {section === 'summary' && <div className="management-person-facts"><ManagementPanel title={t('Apresentação')}><p>{person.bio || t('O profissional ainda não adicionou uma apresentação.')}</p>{person.specialties?.length > 0 && <><h3>{t('Especialidades')}</h3><p>{person.specialties.join(' · ')}</p></>}{person.cityRegion && <><h3>{t('Localização')}</h3><p>{person.cityRegion}</p></>}</ManagementPanel><ManagementPanel title={t('Registro profissional')}>{person.registrationType || person.registrationNumber ? <p>{[person.registrationType, person.registrationNumber].filter(Boolean).join(' ')}</p> : <p className="muted">{t('Registro não informado.')}</p>}<p className="muted">{t('Verificação: {0}', studentVerificationLabel(person.verificationStatus))}</p><Link className="management-button" to={sectionUrl('training')}>{t('Ver treino recebido')}</Link></ManagementPanel></div>}
    {section === 'training' && <ManagementPanel title={t('Treino recebido')} description={t('Até 100 materiais recentes deste profissional.')}>
      {materialId && <Link className="management-button" to="?section=training">{t('Ver todos os materiais deste profissional')}</Link>}
      {displayed.length ? displayed.map(item => <details key={item.assignmentId} className="management-material-detail" open={Boolean(materialId)}><summary><strong>{item.title}</strong><span>{t('Versão {0}', item.versionNumber || '—')}</span><ManagementStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{t(item.status === 'active' ? 'Ativo' : 'Encerrado')}</ManagementStatus></summary><p className="muted">{t('Recebido em {0}', professionalDate(item.assignedAt))}</p>{item.publishedAt && <p className="muted">{t('Publicado em {0}', professionalDate(item.publishedAt))}</p>}{item.description && <p>{item.description}</p>}<ProfessionalPrescription plan={item.weeklyPlan} />{item.status === 'active' && <Link className="management-button" to="/student/professionals">{t('Abrir programa atual')}</Link>}</details>) : <p className="muted">{t(materialId ? 'Material não encontrado nesta janela recente.' : 'Nenhum material recebido deste profissional.')}</p>}
    </ManagementPanel>}
    {section === 'history' && <ManagementPanel title={t('Histórico de treinos')} description={t('Até 100 execuções recentes deste profissional.')}>
      {data.executions?.length ? data.executions.map(item => <details className="management-material-detail" key={item.id}><summary><strong>{professionalDayLabel(item.day_key)}</strong><span className="muted">{statusLabel(item.status)} · {professionalDate(item.started_at, true)}</span></summary><ProfessionalSessionDetail execution={item} /></details>) : <p className="muted">{t('Nenhuma execução registrada.')}</p>}
    </ManagementPanel>}
    {section === 'relationship' && <ManagementPanel title={t('Vínculo')}><p>{t('Desde {0}', professionalDate(data.relationship.linkedAt))}</p><p>{t('Vínculo ativo')}</p><p className="muted">{t('Desvincular encerra os programas deste profissional. Seu histórico pessoal é preservado.')}</p>{confirm ? <div className="danger-confirm"><strong>{t('Desvincular este profissional?')}</strong><Button variant="danger" disabled={saving} onClick={revoke}>{t(saving ? 'Desvinculando…' : 'Confirmar')}</Button><Button disabled={saving} onClick={() => setConfirm(false)}>{t('Cancelar')}</Button></div> : <Button variant="ghost" disabled={saving} onClick={() => setConfirm(true)}>{t('Desvincular')}</Button>}</ManagementPanel>}
  </ManagementLayout>
}
