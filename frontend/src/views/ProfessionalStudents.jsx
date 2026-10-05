import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { FILTERS, filterStudents, professionalDate, statusLabel, attentionReasons } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button, TextField } from '../components/ui.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel as Section, ManagementAvatar, ManagementStatus, ManagementEmpty } from '../components/ManagementUI.jsx'
const FILTER_LABELS = { [FILTERS.ALL]: 'Todos', [FILTERS.WITH_PROGRAM]: 'Com programa', [FILTERS.WITHOUT_PROGRAM]: 'Sem programa' }

export default function ProfessionalStudents() {
  const auth = useAuth()
  return <StudentsWorkspace key={auth.user?.id || 'anonymous'} userId={auth.user?.id} />
}
function StudentsWorkspace({ userId }) {
  const navigate = useNavigate(); const [params] = useSearchParams(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const owner = useRef(userId); owner.current = userId
  const [students, setStudents] = useState([]); const [query, setQuery] = useState(''); const [filter, setFilter] = useState(FILTERS.ALL); const [busy, setBusy] = useState(Boolean(userId)); const [error, setError] = useState(''); const [limit, setLimit] = useState(30)
  const refresh = async () => { const id = userId; setBusy(true); try { const next = await repo.clientSummaries(); if (owner.current === id) { setStudents(next); setError('') } } catch { if (owner.current === id) setError(t('Não foi possível carregar os alunos.')) } finally { if (owner.current === id) setBusy(false) } }
  useEffect(() => { owner.current = userId; if (userId) refresh(); return () => { owner.current = null } }, [userId])
  const visible = filterStudents(students, query, filter)
  const context = params.get('version') ? `?program=${encodeURIComponent(params.get('program') || '')}&version=${encodeURIComponent(params.get('version'))}` : ''
  return <ManagementLayout className="professional-page" title={t('Alunos')} subtitle={t('Pessoas com vínculo ativo')} backTo="/professional" action={<Link className="management-button management-button-primary" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>}>
    {error && <p role="alert" className="management-error">{error} <button className="link" onClick={refresh}>{t('Tentar novamente')}</button></p>}
    {!userId ? <ManagementEmpty title={t('Entre na sua conta para continuar.')} /> : busy ? <p role="status">{t('Carregando alunos…')}</p> : <>
      {context && <p role="status">{t('Selecione o aluno para revisar e enviar a versão escolhida.')}</p>}
      <div className="management-list-tools"><TextField aria-label={t('Buscar aluno')} placeholder={t('Buscar por nome')} value={query} onChange={event => { setQuery(event.target.value); setLimit(30) }} /><div className="management-filter" role="group" aria-label={t('Filtros de alunos')}>{Object.entries(FILTER_LABELS).map(([value, label]) => <button type="button" aria-pressed={filter === value} className={filter === value ? 'on' : ''} key={value} onClick={() => { setFilter(value); setLimit(30) }}>{t(label)}</button>)}</div></div>
      {!students.length ? <Section title={t('Nenhum aluno ainda')}><p className="muted">{t('Convide seu primeiro aluno para começar a acompanhar treinos.')}</p><Button variant="primary" onClick={() => navigate('/professional/invites?section=create')}>{t('Convidar aluno')}</Button></Section> : !visible.length ? <Section title={t('Nenhum resultado')}><p className="muted">{t('Ajuste a busca ou troque o filtro.')}</p></Section> : <Section title={t('{0} aluno(s)', visible.length)}><div className="management-record-list">{visible.slice(0, limit).map(student => <Link className="management-record management-student-record" to={`/professional/students/${student.studentUserId}${context}`} key={student.studentUserId}><ManagementAvatar name={student.displayName} /><div className="management-student-main"><strong>{student.displayName || t('Aluno')}</strong><p>{student.programTitle || t('Sem programa ativo')}</p><div className="management-student-flags">{attentionReasons(student).map(reason => <ManagementStatus tone="warning" key={reason}>{t(reason)}</ManagementStatus>)}</div></div><div className="management-student-activity"><span>{student.lastExecutionStatus ? statusLabel(student.lastExecutionStatus) : t('Nenhum treino registrado')}</span>{student.lastExecutionAt && <time>{professionalDate(student.lastExecutionAt)}</time>}</div><span aria-hidden="true">›</span></Link>)}</div>{visible.length > limit && <Button onClick={() => setLimit(value => value + 30)}>{t('Carregar mais')}</Button>}</Section>}
    </>}
  </ManagementLayout>
}
