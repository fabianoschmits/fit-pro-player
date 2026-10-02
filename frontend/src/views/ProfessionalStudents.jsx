import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { FILTERS, filterStudents, professionalDate, statusLabel, attentionReasons } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button, Section, TextField } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'
const FILTER_LABELS = { [FILTERS.ALL]: 'Todos', [FILTERS.WITH_PROGRAM]: 'Com programa', [FILTERS.WITHOUT_PROGRAM]: 'Sem programa' }

export default function ProfessionalStudents() {
  const auth = useAuth(); const navigate = useNavigate(); const [params] = useSearchParams(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const owner = useRef(auth.user?.id); owner.current = auth.user?.id
  const [students, setStudents] = useState([]); const [query, setQuery] = useState(''); const [filter, setFilter] = useState(FILTERS.ALL); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [limit, setLimit] = useState(30)
  const refresh = async () => { const id = auth.user?.id; setBusy(true); try { const next = await repo.clientSummaries(); if (owner.current === id) { setStudents(next); setError('') } } catch { if (owner.current === id) setError(t('Não foi possível carregar os alunos.')) } finally { if (owner.current === id) setBusy(false) } }
  useEffect(() => { owner.current = auth.user?.id; if (auth.user?.id) refresh(); return () => { owner.current = null } }, [auth.user?.id])
  const visible = filterStudents(students, query, filter)
  const context = params.get('version') ? `?program=${encodeURIComponent(params.get('program') || '')}&version=${encodeURIComponent(params.get('version'))}` : ''
  return <div className="narrow professional-page"><AppHeader title={t('Alunos')} subtitle={t('Pessoas com vínculo ativo')} backTo="/professional" /><ProfessionalWorkspaceNav />
    {error && <p role="alert" className="error">{error} <button className="link" onClick={refresh}>{t('Tentar novamente')}</button></p>}
    {busy ? <p role="status">{t('Carregando alunos…')}</p> : <>
      {context && <p role="status">{t('Selecione o aluno para revisar e enviar a versão escolhida.')}</p>}
      <div className="professional-page-toolbar"><TextField aria-label={t('Buscar aluno')} placeholder={t('Buscar por nome')} value={query} onChange={event => { setQuery(event.target.value); setLimit(30) }} /><div className="seg compact" role="tablist" aria-label={t('Filtros de alunos')}>{Object.entries(FILTER_LABELS).map(([value, label]) => <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'on' : ''} key={value} onClick={() => { setFilter(value); setLimit(30) }}>{t(label)}</button>)}</div></div>
      {!students.length ? <Section title={t('Nenhum aluno ainda')}><p className="muted">{t('Convide seu primeiro aluno para começar a acompanhar treinos.')}</p><Button variant="primary" onClick={() => navigate('/professional/invites')}>{t('Convidar aluno')}</Button></Section> : !visible.length ? <Section title={t('Nenhum resultado')}><p className="muted">{t('Ajuste a busca ou troque o filtro.')}</p></Section> : <Section title={t('{0} aluno(s)', visible.length)}><div className="professional-student-list">{visible.slice(0, limit).map(student => <Link className="card professional-student-card" to={`/professional/students/${student.studentUserId}${context}`} key={student.studentUserId}><div><strong>{student.displayName || t('Aluno')}</strong><span className="muted">{student.programTitle || t('Sem programa ativo')}</span></div><div className="row between"><span className="muted">{student.lastExecutionStatus ? `${statusLabel(student.lastExecutionStatus)} · ${professionalDate(student.lastExecutionAt)}` : t('Nenhum treino registrado')}</span><span className="chev">›</span></div>{attentionReasons(student).map(reason => <small key={reason}>{t(reason)}</small>)}</Link>)}</div>{visible.length > limit && <Button onClick={() => setLimit(value => value + 30)}>{t('Carregar mais')}</Button>}</Section>}
    </>}
  </div>
}
