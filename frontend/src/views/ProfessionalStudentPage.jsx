import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { professionalDate, statusLabel } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button, Section, TextField } from '../components/ui.jsx'
import { ProfessionalPrescription, ProfessionalSessionDetail, professionalDayLabel } from '../components/ProfessionalPrescription.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'

const TABS = [['summary', 'Resumo'], ['training', 'Treino'], ['history', 'Histórico'], ['relationship', 'Vínculo']]

export default function ProfessionalStudentPage() {
  const auth = useAuth(); const navigate = useNavigate(); const { studentId } = useParams(); const [params] = useSearchParams()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const identity = `${auth.user?.id}:${studentId}`; const owner = useRef(identity); owner.current = identity
  const [client, setClient] = useState(null); const [detail, setDetail] = useState(null); const [versions, setVersions] = useState([])
  const [tab, setTab] = useState(params.get('version') ? 'training' : 'summary'); const [versionId, setVersionId] = useState(params.get('version') || '')
  const [busy, setBusy] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [query, setQuery] = useState(''); const [limit, setLimit] = useState(20)
  const refresh = async () => {
    const requestOwner = identity; setBusy(true); setError('')
    try {
      const [summaries, nextDetail, relationships, programs] = await Promise.all([repo.clientSummaries(), repo.clientDetail(studentId), repo.relationships(auth.user.id), repo.programs()])
      if (owner.current !== requestOwner) return
      const pairs = await Promise.all(programs.filter(program => !program.archived).map(async program => (await repo.versions(program.id)).map(version => ({ ...version, programTitle: program.title }))))
      if (owner.current !== requestOwner) return
      setClient(summaries.find(item => item.studentUserId === studentId) || { studentUserId: studentId, displayName: nextDetail?.displayName || t('Aluno') })
      setDetail({ ...nextDetail, relationship: relationships.find(item => item.student_user_id === studentId && item.status === 'active') || null }); setVersions(pairs.flat())
    } catch { if (owner.current === requestOwner) setError(t('Não foi possível carregar este aluno.')) }
    finally { if (owner.current === requestOwner) setBusy(false) }
  }
  useEffect(() => { owner.current = identity; if (auth.user?.id && studentId) refresh(); return () => { owner.current = null } }, [identity])
  const assign = async () => {
    const version = versions.find(item => item.id === versionId); if (!version || saving) return
    const requestOwner = identity; setSaving(true)
    try { await repo.assignProgramVersion({ programId: version.program_id, versionId: version.id, studentUserId: studentId }); if (owner.current !== requestOwner) return; setVersionId(''); await refresh() }
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
    try { await repo.revokeAssignment(id); if (owner.current === requestOwner) await refresh() }
    catch { if (owner.current === requestOwner) setError(t('Não foi possível encerrar o programa.')) }
    finally { if (owner.current === requestOwner) setSaving(false) }
  }
  if (busy) return <div className="narrow professional-page"><AppHeader title={t('Aluno')} backTo="/professional/students" /><p role="status">{t('Carregando aluno…')}</p></div>
  if (!client || !detail) return <div className="narrow professional-page"><AppHeader title={t('Aluno')} backTo="/professional/students" /><p role="alert" className="error">{error || t('Aluno não encontrado.')}</p><Button onClick={() => navigate('/professional/students')}>{t('Voltar para alunos')}</Button></div>
  const executions = detail.executions || []; const latestExecution = executions[0]
  const active = detail.assignments?.find(assignment => assignment.status === 'active')
  const assignedVersion = versions.find(version => version.id === active?.version_id)
  const selectedVersion = versions.find(version => version.id === versionId)
  const visible = executions.filter(item => `${professionalDayLabel(item.day_key)} ${statusLabel(item.status)} ${professionalDate(item.started_at, true)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))
  return <div className="narrow professional-page professional-student-page"><AppHeader title={client.displayName} subtitle={t('{0} · vínculo ativo', client.programTitle || t('Sem programa ativo'))} backTo="/professional/students" /><ProfessionalWorkspaceNav />{error && <p role="alert" className="error">{error}</p>}
    <div className="seg" role="tablist" aria-label={t('Detalhe do aluno')}>{TABS.map(([value, label]) => <button type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'on' : ''} key={value} onClick={() => setTab(value)}>{t(label)}</button>)}</div>
    {tab === 'summary' && <Section title={t('Resumo')}><div className="dashboard-stats"><div className="card"><strong>{client.programTitle || '—'}</strong><span>{t('programa atual')}</span></div><div className="card"><strong>{latestExecution ? statusLabel(latestExecution.status) : '—'}</strong><span>{t('último treino')}</span></div><div className="card"><strong>{executions.length}</strong><span>{t('execuções')}</span></div></div><p className="muted">{t('Vínculo criado em {0}.', professionalDate(client.relationshipCreatedAt))}</p></Section>}
    {tab === 'training' && <Section title={t('Gerenciar treino')}><p>{client.programTitle || t('Nenhum programa enviado')}</p>{assignedVersion && <ProfessionalPrescription plan={assignedVersion.weekly_plan} />}
      <label>{t('Enviar nova versão')}<select aria-label={t('Versão do programa')} value={versionId} disabled={saving} onChange={event => setVersionId(event.target.value)}><option value="">{t('Selecione uma versão')}</option>{versions.map(version => <option key={version.id} value={version.id}>{version.programTitle} / {t('Versão {0}', version.version_number)}</option>)}</select></label>
      {selectedVersion && <div className="card"><strong>{selectedVersion.programTitle} / {t('Versão {0}', selectedVersion.version_number)}</strong><ProfessionalPrescription plan={selectedVersion.weekly_plan} /><p className="muted">{t('Ao enviar, o programa ativo anterior será encerrado.')}</p></div>}
      <div className="row-actions"><Button variant="primary" disabled={!versionId || saving} onClick={assign}>{t(saving ? 'Enviando…' : 'Enviar versão')}</Button><Button onClick={() => navigate('/professional/programs')}>{t('Abrir programas')}</Button>{active && <Button variant="ghost" disabled={saving} onClick={() => endAssignment(active.id)}>{t('Encerrar programa ativo')}</Button>}</div>
    </Section>}
    {tab === 'history' && <Section title={t('Histórico de treinos')}><TextField aria-label={t('Buscar execução')} placeholder={t('Buscar por dia ou status')} value={query} onChange={event => { setQuery(event.target.value); setLimit(20) }} />{visible.length ? visible.slice(0, limit).map(item => <details className="card" key={item.id}><summary><strong>{professionalDayLabel(item.day_key)}</strong><span className="muted"> {statusLabel(item.status)} · {professionalDate(item.started_at, true)}</span></summary><ProfessionalSessionDetail execution={item} /></details>) : <p className="muted">{t('Nenhuma execução registrada.')}</p>}{visible.length > limit && <Button onClick={() => setLimit(value => value + 20)}>{t('Carregar mais')}</Button>}</Section>}
    {tab === 'relationship' && <Section title={t('Vínculo')}><p>{t('Profissional e aluno estão vinculados.')}</p><p className="muted">{t('Encerrar o vínculo também encerra as atribuições e o acesso profissional às execuções. O histórico pessoal do aluno é preservado.')}</p>{confirmRevoke ? <div className="danger-confirm"><span>{t('Encerrar vínculo?')}</span><Button variant="danger" disabled={saving} onClick={revoke}>{t('Confirmar')}</Button><Button disabled={saving} onClick={() => setConfirmRevoke(false)}>{t('Cancelar')}</Button></div> : <Button variant="ghost" onClick={() => setConfirmRevoke(true)}>{t('Encerrar vínculo')}</Button>}</Section>}
  </div>
}
