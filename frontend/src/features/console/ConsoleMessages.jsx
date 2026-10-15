import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createSupportRepository } from '../../lib/support.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import { Alert, Avatar, SectionBody, Chip, Empty, Loading, fmtDateTime } from './ConsoleUI.jsx'
import { supportStatusLabel, supportPriorityLabel, ticketTone } from './support-model.js'

const PAGE_SIZE = 25
export default function ConsoleMessages() {
  const { userId, allowed } = useConsoleAccess()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const page = Math.max(0, Number.parseInt(params.get('page'), 10) || 0)
  const filters = { query: params.get('q') || '', status: params.get('status') || null, category: params.get('category') || null, priority: params.get('priority') || null, fromDate: params.get('from') ? `${params.get('from')}T00:00:00-03:00` : null, toDate: params.get('to') ? `${params.get('to')}T23:59:59.999-03:00` : null, limit: PAGE_SIZE, offset: page * PAGE_SIZE }
  const { data, busy, error, refresh } = useConsoleResource({ userId, allowed, resourceKey: 'messages:' + params.toString(), load: async () => {
    const [tickets, stats, categories] = await Promise.all([repo.listTickets(filters), repo.overview(), repo.listCategories()])
    return { tickets, stats, categories }
  } })
  const change = (key, value) => setParams(previous => { const next = new URLSearchParams(previous); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.delete('page'); return next })
  const returnQuery = params.toString() ? `?${params}` : ''
  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed}><div className="cx-page-body">
    <div className="cx-page-head console-page-heading"><div><h1 className="cx-page-title">Mensagens dos usuários</h1><p className="cx-page-sub">Dúvidas, sugestões e relatos enviados para a equipe.</p></div><button type="button" className="cx-pill-btn" onClick={refresh}>Atualizar</button></div>
    {data?.stats && <div className="console-inbox-counts" aria-label="Resumo das mensagens">{[['unread', 'unreadCount'], ['pending', 'pendingCount'], ['answered', 'answeredCount'], ['resolved', 'resolvedCount']].map(([status, key]) => <button key={status} type="button" aria-pressed={params.get('status') === status} onClick={() => change('status', params.get('status') === status ? '' : status)}><strong>{data.stats[key]}</strong><span>{({ unread: 'Não lidas', pending: 'Pendentes', answered: 'Respondidas', resolved: 'Resolvidas' })[status]}</span></button>)}</div>}
    <section className="console-filter-section" aria-label="Filtros das mensagens">
      <form className="console-search-form" onSubmit={e => { e.preventDefault(); change('q', query.trim()) }}><label className="cx-label">Buscar mensagens<input className="cx-field" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Assunto, e-mail ou conteúdo" /></label><button className="cx-pill-btn" type="submit">Buscar</button></form>
      <details className="console-inbox-filters"><summary>Filtros da caixa de entrada</summary><div className="console-filter-grid">
        <label className="cx-label">Status<select className="cx-field" value={params.get('status') || ''} onChange={e => change('status', e.target.value)}><option value="">Todos os status</option>{Object.entries(supportStatusLabel).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</select></label>
        <label className="cx-label">Categoria<select className="cx-field" value={params.get('category') || ''} onChange={e => change('category', e.target.value)}><option value="">Todas as categorias</option>{data?.categories.map(category => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
        <label className="cx-label">Prioridade<select className="cx-field" value={params.get('priority') || ''} onChange={e => change('priority', e.target.value)}><option value="">Todas</option>{Object.entries(supportPriorityLabel).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label className="cx-label">De<input className="cx-field" type="date" value={params.get('from') || ''} onChange={e => change('from', e.target.value)} /></label>
        <label className="cx-label">Até<input className="cx-field" type="date" value={params.get('to') || ''} min={params.get('from') || undefined} onChange={e => change('to', e.target.value)} /></label>
      </div></details>
      {params.size > 0 && <button className="console-text-button" onClick={() => { setParams({}); setQuery('') }} type="button">Limpar filtros</button>}
    </section>
    {error && <Alert onRetry={refresh}>{error}</Alert>}
    {busy ? <Loading label="Carregando mensagens…" /> : data && <section aria-label="Caixa de entrada">
      <div className="console-list-heading"><h2>Caixa de entrada</h2><span>Página {page + 1}</span></div>
      {!data.tickets.length ? <Empty title="Nenhuma mensagem encontrada" sub="Altere os filtros ou aguarde novos chamados." /> : <SectionBody>{data.tickets.map(ticket => <Link className="console-message-row" key={ticket.ticketId} to={`/console/support/${ticket.ticketId}${returnQuery}`}>
        <Avatar name={ticket.displayName || ticket.email || 'Usuário'} size={40} />
        <span className="console-message-copy"><strong>{ticket.subject}</strong><span>{ticket.displayName || ticket.email || 'Usuário'}{ticket.categoryLabel && ` · ${ticket.categoryLabel}`}</span><time>{fmtDateTime(ticket.lastMessageAt)}</time></span>
        <span className="console-message-badges"><Chip tone={ticketTone(ticket.status)}>{supportStatusLabel[ticket.status]}</Chip>{ticket.priority !== 'normal' && <Chip tone="warn">{supportPriorityLabel[ticket.priority]}</Chip>}</span>
      </Link>)}</SectionBody>}
      <div className="console-pagination"><button className="cx-pill-btn" type="button" disabled={page === 0} onClick={() => change('page', String(page - 1))}>Anterior</button><span>{data.tickets.length} nesta página</span><button className="cx-pill-btn" type="button" disabled={data.tickets.length < PAGE_SIZE} onClick={() => change('page', String(page + 1))}>Próxima</button></div>
    </section>}
  </div></ConsoleShell></AccessGate>
}
