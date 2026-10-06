import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { professionalDate, statusLabel } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button, TextField } from '../components/ui.jsx'
import { ProfessionalPrescription, ProfessionalSessionDetail, professionalDayLabel } from '../components/ProfessionalPrescription.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel as Section, ManagementEmpty, ManagementAvatar, ManagementStatus } from '../components/ManagementUI.jsx'

const TABS = [['summary', 'Resumo'], ['training', 'Treino'], ['history', 'Histórico'], ['relationship', 'Vínculo']]

export default function ProfessionalStudentPage() {
  const auth = useAuth(); const { studentId } = useParams()
  return <StudentWorkspace key={`${auth.user?.id}:${studentId}`} userId={auth.user?.id} studentId={studentId} />
}

function StudentWorkspace({ userId, studentId }) {
  const navigate = useNavigate(); const [params, setParams] = useSearchParams()
  const currentParams = useRef(params); currentParams.current = params
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const identity = `${userId}:${studentId}`; const owner = useRef(identity); owner.current = identity
  const [client, setClient] = useState(null); const [detail, setDetail] = useState(null); const [versions, setVersions] = useState([])
  const tab = params.has('section') ? (TABS.some(([value]) => value === params.get('section')) ? params.get('section') : 'summary') : params.get('version') ? 'training' : 'summary'
  const versionId = params.get('version') || ''; const programId = params.get('program') || ''
  const [programs, setPrograms] = useState([]); const [assignedVersion, setAssignedVersion] = useState(null); const [trainingBusy, setTrainingBusy] = useState(false); const [trainingError, setTrainingError] = useState(''); const [trainingReload, setTrainingReload] = useState(0); const [confirmEnd, setConfirmEnd] = useState(false)
  const sectionUrl = value => { const next = new URLSearchParams(params); next.set('section', value); return `?${next}` }
  const choose = (key, value) => { const next = new URLSearchParams(params); next.set(key, value); if (key === 'program') next.delete('version'); setParams(next) }
  const [busy, setBusy] = useState(Boolean(userId)); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [query, setQuery] = useState(''); const [limit, setLimit] = useState(20)
  const refresh = async () => {
    const requestOwner = identity; setBusy(true); setError('')
    try {
      const [summaries, nextDetail, relationships] = await Promise.all([repo.clientSummaries(), repo.clientDetail(studentId), repo.relationships(userId)])
      if (owner.current !== requestOwner) return
      setClient(summaries.find(item => item.studentUserId === studentId) || (nextDetail ? { studentUserId: studentId, displayName: nextDetail.displayName || t('Aluno') } : null))
      setDetail(nextDetail ? { ...nextDetail, relationship: relationships.find(item => item.student_user_id === studentId && item.status === 'active') || null } : null)

    } catch { if (owner.current === requestOwner) setError(t('Não foi possível carregar este aluno.')) }
    finally { if (owner.current === requestOwner) setBusy(false) }
  }
  useEffect(() => { owner.current = identity; if (userId && studentId) refresh(); return () => { owner.current = null } }, [identity])
  useEffect(() => {
    if (tab !== 'training' || !detail) return
    let activeRequest = true
    setTrainingBusy(true); setTrainingError(''); setVersions([]); setAssignedVersion(null)
    const active = detail.assignments?.find(item => item.status === 'active')
    Promise.all([repo.programs(), active?.version_id ? repo.version(active.version_id) : null]).then(async ([items, current]) => {
      if (!activeRequest) return
      const available = items.filter(item => !item.archived)
      setPrograms(available); setAssignedVersion(current)
      const selected = available.find(item => item.id === programId)
      const list = selected ? await repo.versions(selected.id) : []
      if (activeRequest) setVersions(list.map(version => ({ ...version, programTitle: selected.title })))
    }).catch(() => { if (activeRequest) setTrainingError(t('Não foi possível carregar as versões.')) }).finally(() => { if (activeRequest) setTrainingBusy(false) })
    return () => { activeRequest = false }
  }, [tab, programId, detail, trainingReload])
  const assign = async () => {
    const version = versions.find(item => item.id === versionId); if (!version || saving) return
    const requestOwner = identity; setSaving(true)
    try { await repo.assignProgramVersion({ programId: version.program_id, versionId: version.id, studentUserId: studentId }); if (owner.current !== requestOwner) return; const next = new URLSearchParams(currentParams.current); if (next.get('version') === version.id) { next.delete('version'); if (!next.has('section')) next.set('section', 'training') } setParams(next, { replace: true }); await refresh() }
    catch { if (owner.current === requestOwner) setError(t('Não foi possível enviar esta versão.')) }
    finally { if (owner.current === requestOwner) setSaving(false) }
  }
  const revoke = async () => {
    const relationship = detail?.relationship; if (!relationship?.id || saving) return
    const requestOwner = identity; setSaving(true)
    try { await repo.revokeRelationship(relationship.id); if (owner.current === requestOwner) navigate('/professional/students', { replace: true }) }
    catch { if (owner.current === requestOwner) setError(t('Não foi possível encerrar o vínculo.')) }
    finally { if (owner.current === requestOwner) setSaving(false) }
  }
  const endAssignment = async id => {
    if (saving) return; const requestOwner = identity; setSaving(true)
    try { await repo.revokeAssignment(id); if (owner.current === requestOwner) { setConfirmEnd(false); await refresh() } }
    catch { if (owner.current === requestOwner) setError(t('Não foi possível encerrar o programa.')) }
    finally { if (owner.current === requestOwner) setSaving(false) }
  }
  if (!userId || busy || !client || !detail) return <ManagementLayout className="professional-page" title={t('Aluno')} backTo="/professional/students">{busy ? <p role="status">{t('Carregando aluno…')}</p> : <ManagementEmpty title={!userId ? t('Entre na sua conta para continuar.') : error || t('Aluno não encontrado.')} action={<div className="row-actions">{error && <Button onClick={refresh}>{t('Tentar novamente')}</Button>}<Link className="management-button" to="/professional/students">{t('Voltar para alunos')}</Link></div>} />}</ManagementLayout>
  const executions = detail.executions || []; const latestExecution = executions[0]
  const active = detail.assignments?.find(assignment => assignment.status === 'active')
  const selectedVersion = versions.find(version => version.id === versionId)
  const visible = executions.filter(item => `${professionalDayLabel(item.day_key)} ${statusLabel(item.status)} ${professionalDate(item.started_at, true)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))
  return <ManagementLayout className="professional-page professional-student-page" title={client.displayName} subtitle={client.programTitle || t('Sem programa ativo')} backTo="/professional/students">
    {error && <p role="alert" className="management-error">{error} <button className="link" onClick={refresh}>{t('Tentar novamente')}</button></p>}
    <div className="management-person-strip"><ManagementAvatar name={client.displayName} /><div><strong>{client.displayName}</strong><p className="muted">{t('Vínculo criado em {0}.', professionalDate(client.relationshipCreatedAt))}</p></div><ManagementStatus tone={detail.relationship ? 'success' : 'neutral'}>{t(detail.relationship ? 'Vínculo ativo' : 'Vínculo encerrado')}</ManagementStatus></div>
    <nav className="management-section-nav" aria-label={t('Detalhe do aluno')}>{TABS.map(([value, label]) => <Link to={sectionUrl(value)} aria-current={tab === value ? 'page' : undefined} key={value}>{t(label)}</Link>)}</nav>
    {tab === 'summary' && <Section title={t('Resumo')}><dl className="management-summary-facts"><div><dt>{t('programa atual')}</dt><dd>{client.programTitle || t('Sem programa ativo')}</dd></div><div><dt>{t('último treino')}</dt><dd>{latestExecution ? statusLabel(latestExecution.status) : t('Nenhum treino registrado')}</dd>{latestExecution && <dd className="muted small">{professionalDate(latestExecution.started_at, true)}</dd>}</div><div><dt>{t('execuções')}</dt><dd>{executions.length}</dd></div></dl><div className="row-actions"><Link className="management-button management-button-primary" to={sectionUrl('training')}>{t('Gerenciar treino')}</Link><Link className="management-button" to={sectionUrl('history')}>{t('Histórico de treinos')}</Link></div></Section>}
    {tab === 'training' && <Section title={t('Gerenciar treino')}>{trainingError && <p role="alert" className="management-error">{trainingError} <button className="link" onClick={() => setTrainingReload(value => value + 1)}>{t('Tentar novamente')}</button></p>}{trainingBusy && <p role="status">{t('Carregando versões…')}</p>}<div className="professional-current-prescription"><h3>{t('Programa atual')}</h3><p>{client.programTitle || t('Nenhum programa enviado')}</p>{assignedVersion && <ProfessionalPrescription plan={assignedVersion.weekly_plan} />}</div>
      <div className="professional-send-prescription"><h3>{t('Enviar nova versão')}</h3><label>{t('Programa')}<select aria-label={t('Programa')} value={programId} disabled={saving || trainingBusy} onChange={event => choose('program', event.target.value)}><option value="">{t('Selecione um programa')}</option>{programs.map(program => <option key={program.id} value={program.id}>{program.title}</option>)}</select></label>
      <label>{t('Enviar nova versão')}<select aria-label={t('Versão do programa')} value={versionId} disabled={saving || trainingBusy || !programId} onChange={event => choose('version', event.target.value)}><option value="">{t('Selecione uma versão')}</option>{versions.map(version => <option key={version.id} value={version.id}>{version.programTitle} / {t('Versão {0}', version.version_number)}</option>)}</select></label>
      {selectedVersion && <div className="card"><strong>{selectedVersion.programTitle} / {t('Versão {0}', selectedVersion.version_number)}</strong><ProfessionalPrescription plan={selectedVersion.weekly_plan} /><p className="muted">{t('Ao enviar, o programa ativo anterior será encerrado.')}</p></div>}
      <div className="row-actions"><Button variant="primary" disabled={!selectedVersion || saving || trainingBusy || !detail.relationship} onClick={assign}>{t(saving ? 'Enviando…' : 'Enviar versão')}</Button><Button onClick={() => navigate('/professional/programs')}>{t('Abrir programas')}</Button>{active && <Button variant="ghost" disabled={saving} onClick={() => setConfirmEnd(true)}>{t('Encerrar programa ativo')}</Button>}</div>
      </div>{confirmEnd && active && <div className="danger-confirm"><p>{t('Encerrar programa ativo?')}</p><Button variant="danger" disabled={saving} onClick={() => endAssignment(active.id)}>{t('Confirmar')}</Button><Button disabled={saving} onClick={() => setConfirmEnd(false)}>{t('Cancelar')}</Button></div>}
    </Section>}
    {tab === 'history' && <Section title={t('Histórico de treinos')}><TextField aria-label={t('Buscar execução')} placeholder={t('Buscar por dia ou status')} value={query} onChange={event => { setQuery(event.target.value); setLimit(20) }} />{visible.length ? visible.slice(0, limit).map(item => <details className="card" key={item.id}><summary><strong>{professionalDayLabel(item.day_key)}</strong><span className="muted"> {statusLabel(item.status)} · {professionalDate(item.started_at, true)}</span></summary><ProfessionalSessionDetail execution={item} /></details>) : <p className="muted">{t('Nenhuma execução registrada.')}</p>}{visible.length > limit && <Button onClick={() => setLimit(value => value + 20)}>{t('Carregar mais')}</Button>}</Section>}
    {tab === 'relationship' && <Section title={t('Vínculo')}><p>{t(detail.relationship ? 'Profissional e aluno estão vinculados.' : 'Vínculo encerrado')}</p><p className="muted">{t('Encerrar o vínculo também encerra as atribuições e o acesso profissional às execuções. O histórico pessoal do aluno é preservado.')}</p>{confirmRevoke ? <div className="danger-confirm"><span>{t('Encerrar vínculo?')}</span><Button variant="danger" disabled={saving} onClick={revoke}>{t('Confirmar')}</Button><Button disabled={saving} onClick={() => setConfirmRevoke(false)}>{t('Cancelar')}</Button></div> : <Button variant="ghost" disabled={!detail.relationship || saving} onClick={() => setConfirmRevoke(true)}>{t('Encerrar vínculo')}</Button>}</Section>}
  </ManagementLayout>
}
