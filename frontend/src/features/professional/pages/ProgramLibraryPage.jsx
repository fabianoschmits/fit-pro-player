import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { useProfessionalSession } from '../hooks/useProfessionalSession.js'
import { useProfessionalLists } from '../hooks/useProfessionalLists.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import SearchBar from '../components/SearchBar.jsx'
import FilterChips from '../components/FilterChips.jsx'
import CompactList from '../components/CompactList.jsx'
import ProgramRow from '../components/ProgramRow.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'

export default function ProgramLibraryPage() {
  const session = useProfessionalSession()
  return <Library key={`${session.accountId}:${session.authInitializing}`} session={session} />
}
function Library({ session }) {
  const location = useLocation(), navigate = useNavigate(), [params, setParams] = useSearchParams()
  const list = useProfessionalLists({ accountId: session.accountId, resourceKey: 'programs',
    initialFilters: { search: params.get('q') || '', archived: params.get('archived') === 'true' },
    loadPage: filters => session.repo.programPage(filters) })
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || list.status !== 'success') return
    const saved = location.state?.programsAccount === session.accountId ? location.state : null
    if (list.items.length < (saved?.programsRows || 0) && list.hasMore) { list.loadMore(); return }
    restored.current = true
    if (saved?.programsScroll != null) window.scrollTo(0, saved.programsScroll)
  }, [list.status, list.items.length, list.hasMore, location.state])
  const filter = patch => {
    list.setFilters(patch)
    const next = new URLSearchParams(params)
    if (patch.search !== undefined) { if (patch.search) next.set('q', patch.search); else next.delete('q') }
    if (patch.archived !== undefined) { if (patch.archived) next.set('archived', 'true'); else next.delete('archived') }
    setParams(next, { replace: true, state: null })
  }
  const open = (event, to) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to, { state: { programsReturn: location.pathname + location.search, programsRows: list.items.length, programsScroll: window.scrollY, programsAccount: session.accountId } })
  }
  return <ProfessionalLayout title={t('Programas')} backTo="/professional" action={<Link className="management-button management-button-primary" to={preserveProfessionalIdentity(professionalPath({ kind: 'programNew' }), location.search)}>{t('Criar programa')}</Link>}>
    {session.authExpired ? <EmptyState title={t('Não foi possível confirmar sua sessão. Tente novamente.')} />
      : session.authInitializing ? <Skeleton /> : !session.accountId ? <EmptyState title={t('Entre na sua conta para continuar.')} /> : <>
        <SearchBar label={t('Buscar programa')} value={list.filters.search} onChange={search => filter({ search })} />
        <FilterChips value={list.filters.archived ? 'archived' : 'available'} options={[{ value: 'available', label: t('Disponíveis') }, { value: 'archived', label: t('Arquivados') }]} onChange={value => filter({ archived: value === 'archived' })} />
        <SectionHeader title={list.total === null ? t('Programas') : t('Programas ({0})', list.total)} />
        {list.error && <p role="alert" className="management-error">{t('Não foi possível carregar os programas.')} <button onClick={list.retry}>{t('Tentar novamente')}</button></p>}
        <CompactList status={list.status} hasMore={list.hasMore} onLoadMore={list.loadMore} empty={<EmptyState title={t('Sem programas')} description={t('Ajuste a busca ou troque o filtro.')} />}>
          {list.items.map(program => {
            const to = preserveProfessionalIdentity(professionalPath({ kind: 'program', id: program.id }), location.search)
            return <ProgramRow key={program.id} program={program} to={to} onOpen={event => open(event, to)} />
          })}
        </CompactList>
      </>}
  </ProfessionalLayout>
}
