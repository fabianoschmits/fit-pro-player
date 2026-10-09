import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { useProfessionalSession } from '../features/professional/hooks/useProfessionalSession.js'
import { useProfessionalLists } from '../features/professional/hooks/useProfessionalLists.js'
import ProfessionalLayout from '../features/professional/components/ProfessionalLayout.jsx'
import SearchBar from '../features/professional/components/SearchBar.jsx'
import FilterChips from '../features/professional/components/FilterChips.jsx'
import CompactList from '../features/professional/components/CompactList.jsx'
import StudentRow from '../features/professional/components/StudentRow.jsx'
import EmptyState from '../features/professional/components/EmptyState.jsx'
import { preserveProfessionalIdentity } from '../features/professional/routes.js'

const OPTIONS = [{ value: 'all', label: t('Todos') }, { value: 'with_program', label: t('Com programa') }, { value: 'without_program', label: t('Sem programa') }, { value: 'attention', label: t('Atenção') }]
export default function ProfessionalStudents() {
  const session = useProfessionalSession(), location = useLocation(), [params, setParams] = useSearchParams()
  const list = useProfessionalLists({ accountId: session.accountId, resourceKey: 'students', initialFilters: { search: params.get('q') || '', status: params.get('status') || 'all' }, loadPage: page => session.repo.studentPage(page) })
  const update = patch => { list.setFilters(patch); const next = new URLSearchParams(params); if ('search' in patch) patch.search ? next.set('q', patch.search) : next.delete('q'); if ('status' in patch) patch.status === 'all' ? next.delete('status') : next.set('status', patch.status); setParams(next, { replace: true }) }
  return <ProfessionalLayout title={t('Alunos')} subtitle={list.total == null ? t('Pessoas com vínculo ativo') : t('{0} aluno(s)', list.total)} action={<Link className="management-button management-button-primary" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>}>
    <SearchBar label={t('Buscar aluno')} value={list.filters.search} onChange={search => update({ search })} /><FilterChips options={OPTIONS} value={list.filters.status} onChange={status => update({ status })} />
    {list.error && <p role="alert">{t('Não foi possível carregar os alunos.')} <button onClick={list.retry}>{t('Tentar novamente')}</button></p>}
    <CompactList status={list.status} hasMore={list.hasMore} onLoadMore={list.loadMore} empty={<EmptyState title={t('Nenhum resultado')} description={t('Ajuste a busca ou troque o filtro.')} />}>{list.items.map(student => <StudentRow key={student.studentUserId} student={student} to={preserveProfessionalIdentity(`/professional/students/${student.studentUserId}`, location.search)} />)}</CompactList>
  </ProfessionalLayout>
}
