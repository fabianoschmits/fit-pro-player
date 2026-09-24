import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { FILTERS, filterStudents, statusLabel } from '../lib/professional-ux.js'
import { Button, Section, TextField } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'

const FILTER_LABELS = { [FILTERS.ALL]: 'Todos', [FILTERS.WITH_PROGRAM]: 'Com programa', [FILTERS.WITHOUT_PROGRAM]: 'Sem programa' }

export default function ProfessionalStudents() {
  const auth = useAuth(); const navigate = useNavigate(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [students, setStudents] = useState([]); const [query, setQuery] = useState(''); const [filter, setFilter] = useState(FILTERS.ALL); const [busy, setBusy] = useState(true); const [error, setError] = useState('')
  const refresh = () => { setBusy(true); return repo.clientSummaries().then(setStudents).catch(() => setError('Não foi possível carregar os alunos.')).finally(() => setBusy(false)) }
  useEffect(() => { if (auth.user?.id) refresh() }, [auth.user?.id])
  const visible = filterStudents(students, query, filter)
  return <div className="narrow professional-page"><AppHeader title="Alunos" subtitle="Pessoas com vínculo ativo" backTo="/professional" /><ProfessionalWorkspaceNav />{error && <p role="alert" className="error">{error} <button className="link" onClick={refresh}>Tentar novamente</button></p>}{busy ? <p role="status">Carregando alunos…</p> : <>
    <div className="professional-page-toolbar"><TextField aria-label="Buscar aluno" placeholder="Buscar por nome" value={query} onChange={event => setQuery(event.target.value)} /><div className="seg compact" role="tablist" aria-label="Filtros de alunos">{Object.entries(FILTER_LABELS).map(([value, label]) => <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'on' : ''} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
    {!students.length ? <Section title="Nenhum aluno ainda"><p className="muted">Convide seu primeiro aluno para começar a acompanhar treinos.</p><Button variant="primary" onClick={() => navigate('/professional/invites')}>Convidar aluno</Button></Section> : !visible.length ? <Section title="Nenhum resultado"><p className="muted">Ajuste a busca ou troque o filtro.</p></Section> : <Section title={`${visible.length} aluno${visible.length === 1 ? '' : 's'}`}><div className="professional-student-list">{visible.map(student => <Link className="card professional-student-card" to={`/professional/students/${student.studentUserId}`} key={student.studentUserId}><div><strong>{student.displayName || 'Aluno'}</strong><span className="muted small">{student.programTitle || 'Sem programa ativo'}</span></div><div className="row between"><span className="muted small">{student.lastExecutionStatus ? `${statusLabel(student.lastExecutionStatus)} · ${String(student.lastExecutionAt || '').slice(0, 10)}` : 'Nenhum treino registrado'}</span><span className="chev">›</span></div></Link>)}</div></Section>}
  </>}</div>
}
