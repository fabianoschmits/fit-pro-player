import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createSupportRepository } from '../../lib/support.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import { Alert, Avatar, SectionBody, Chip, Empty, Loading, fmtDateTime } from './ConsoleUI.jsx'
import Icon from '../../components/Icon.jsx'
import { supportStatusLabel, supportPriorityLabel, ticketTone } from './support-model.js'

const PAGE_SIZE = 25

export default function ConsoleMessages() {
  const { userId, allowed } = useConsoleAccess()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [actionNotice, setActionNotice] = useState('')

  const activeTab = params.get('tab') || 'all'
  const page = Math.max(0, Number.parseInt(params.get('page'), 10) || 0)

  // Map tab to specific status filters
  const tabStatus = useMemo(() => {
    if (activeTab === 'unread') return 'unread'
    if (activeTab === 'read') return 'read'
    if (activeTab === 'pending') return 'pending'
    if (activeTab === 'answered') return 'answered'
    if (activeTab === 'resolved') return 'resolved'
    if (activeTab === 'archived') return 'archived'
    return params.get('status') || null
  }, [activeTab, params])

  const filters = {
    query: params.get('q') || '',
    status: tabStatus,
    category: params.get('category') || null,
    priority: params.get('priority') || null,
    fromDate: params.get('from') ? `${params.get('from')}T00:00:00-03:00` : null,
    toDate: params.get('to') ? `${params.get('to')}T23:59:59.999-03:00` : null,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }

  const { data, busy, error, refresh } = useConsoleResource({
    userId,
    allowed,
    resourceKey: 'messages:' + params.toString(),
    load: async () => {
      const [tickets, stats, categories] = await Promise.all([
        repo.listTickets(filters),
        repo.overview(),
        repo.listCategories(),
      ])
      return { tickets, stats, categories }
    },
  })

  const change = (key, value) => setParams(previous => {
    const next = new URLSearchParams(previous)
    value ? next.set(key, value) : next.delete(key)
    if (key !== 'page') next.delete('page')
    return next
  })

  const handleTabChange = tabKey => {
    setSelectedIds(new Set())
    setParams(previous => {
      const next = new URLSearchParams(previous)
      if (tabKey === 'all') {
        next.delete('tab')
        next.delete('status')
      } else {
        next.set('tab', tabKey)
        next.delete('status')
      }
      next.delete('page')
      return next
    })
  }

  const returnQuery = params.toString() ? `?${params}` : ''
  const tickets = data?.tickets || []

  // Selection handlers
  const allSelected = tickets.length > 0 && tickets.every(t => selectedIds.has(t.ticketId))
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tickets.map(t => t.ticketId)))
    }
  }

  const toggleSelect = ticketId => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(ticketId)) next.delete(ticketId)
      else next.add(ticketId)
      return next
    })
  }

  // Bulk actions
  const performBulkStatus = async (status, label) => {
    if (!selectedIds.size || bulkBusy) return
    setBulkBusy(true)
    setActionNotice('')
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(ids.map(id => repo.updateTicket(id, { status })))
      setSelectedIds(new Set())
      setActionNotice(`${ids.length} chamado(s) marcado(s) como ${label}.`)
      refresh()
    } catch {
      setActionNotice('Falha ao atualizar chamados selecionados.')
    } finally {
      setBulkBusy(false)
    }
  }

  const performBulkDelete = async () => {
    if (!selectedIds.size || bulkBusy) return
    const ids = Array.from(selectedIds)
    if (!window.confirm(`Excluir permanentemente ${ids.length} chamado(s) selecionado(s)?`)) return
    setBulkBusy(true)
    setActionNotice('')
    try {
      await Promise.all(ids.map(id => repo.deleteTicket(id)))
      setSelectedIds(new Set())
      setActionNotice(`${ids.length} chamado(s) excluído(s) com sucesso.`)
      refresh()
    } catch {
      setActionNotice('Falha ao excluir chamados selecionados.')
    } finally {
      setBulkBusy(false)
    }
  }

  // Single ticket quick actions
  const handleQuickStatus = async (e, ticketId, status) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await repo.updateTicket(ticketId, { status })
      refresh()
    } catch {
      setActionNotice('Erro ao atualizar status do chamado.')
    }
  }

  const handleQuickDelete = async (e, ticketId) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Excluir este chamado de suporte permanentemente?')) return
    try {
      await repo.deleteTicket(ticketId)
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(ticketId)
        return next
      })
      setActionNotice('Chamado excluído com sucesso.')
      refresh()
    } catch {
      setActionNotice('Erro ao excluir chamado.')
    }
  }

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell userId={userId} allowed={allowed}>
        <div className="cx-page-body">
          <div className="cx-page-head console-page-heading">
            <div>
              <h1 className="cx-page-title">Gestão de Mensagens do Suporte</h1>
              <p className="cx-page-sub">Caixa de entrada inteligente, filtragem por status e ações em lote.</p>
            </div>
            <button type="button" className="cx-pill-btn" onClick={refresh}>
              Atualizar
            </button>
          </div>

          {/* Abas inteligentes de status */}
          <nav className="console-messages-tabs" aria-label="Abas de status de mensagens">
            <button
              type="button"
              className={`console-messages-tab ${activeTab === 'all' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              <span>Todas</span>
            </button>
            <button
              type="button"
              className={`console-messages-tab ${activeTab === 'unread' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('unread')}
            >
              <span>Não lidas</span>
              {Boolean(data?.stats?.unreadCount) && (
                <span className="console-messages-tab-badge">{data.stats.unreadCount}</span>
              )}
            </button>
            <button
              type="button"
              className={`console-messages-tab ${activeTab === 'read' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('read')}
            >
              <span>Lidas</span>
            </button>
            <button
              type="button"
              className={`console-messages-tab ${activeTab === 'pending' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('pending')}
            >
              <span>Pendentes</span>
              {Boolean(data?.stats?.pendingCount) && (
                <span className="console-messages-tab-badge">{data.stats.pendingCount}</span>
              )}
            </button>
            <button
              type="button"
              className={`console-messages-tab ${activeTab === 'answered' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('answered')}
            >
              <span>Respondidas</span>
              {Boolean(data?.stats?.answeredCount) && (
                <span className="console-messages-tab-badge">{data.stats.answeredCount}</span>
              )}
            </button>
            <button
              type="button"
              className={`console-messages-tab ${activeTab === 'resolved' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('resolved')}
            >
              <span>Resolvidas</span>
            </button>
            <button
              type="button"
              className={`console-messages-tab ${activeTab === 'archived' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('archived')}
            >
              <span>Arquivadas</span>
              {Boolean(data?.stats?.archivedCount) && (
                <span className="console-messages-tab-badge">{data.stats.archivedCount}</span>
              )}
            </button>
          </nav>

          {/* Busca e Filtros refinados */}
          <section className="console-filter-section" aria-label="Filtros das mensagens">
            <form className="console-search-form" onSubmit={e => { e.preventDefault(); change('q', query.trim()) }}>
              <label className="cx-label">
                Buscar mensagens
                <input
                  className="cx-field"
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por assunto, e-mail ou mensagem..."
                />
              </label>
              <button className="cx-pill-btn" type="submit">Buscar</button>
            </form>

            <details className="console-inbox-filters">
              <summary>Mais filtros (categoria, prioridade e período)</summary>
              <div className="console-filter-grid">
                {activeTab === 'all' && (
                  <label className="cx-label">
                    Status específico
                    <select className="cx-field" value={params.get('status') || ''} onChange={e => change('status', e.target.value)}>
                      <option value="">Todos os status</option>
                      {Object.entries(supportStatusLabel).map(([key, value]) => (
                        <option value={key} key={key}>{value}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="cx-label">
                  Categoria
                  <select className="cx-field" value={params.get('category') || ''} onChange={e => change('category', e.target.value)}>
                    <option value="">Todas as categorias</option>
                    {data?.categories?.map(cat => (
                      <option key={cat.slug} value={cat.slug}>{cat.label}</option>
                    ))}
                  </select>
                </label>
                <label className="cx-label">
                  Prioridade
                  <select className="cx-field" value={params.get('priority') || ''} onChange={e => change('priority', e.target.value)}>
                    <option value="">Todas</option>
                    {Object.entries(supportPriorityLabel).map(([key, value]) => (
                      <option key={key} value={key}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="cx-label">
                  De
                  <input className="cx-field" type="date" value={params.get('from') || ''} onChange={e => change('from', e.target.value)} />
                </label>
                <label className="cx-label">
                  Até
                  <input className="cx-field" type="date" value={params.get('to') || ''} min={params.get('from') || undefined} onChange={e => change('to', e.target.value)} />
                </label>
              </div>
            </details>
            {(params.size > 0 || query) && (
              <button
                className="console-text-button"
                onClick={() => { setParams({}); setQuery(''); setSelectedIds(new Set()) }}
                type="button"
              >
                Limpar todos os filtros
              </button>
            )}
          </section>

          {actionNotice && <div className="cx-success" role="status" style={{ margin: '12px 0' }}>{actionNotice}</div>}
          {error && <Alert onRetry={refresh}>{error}</Alert>}

          {busy ? (
            <Loading label="Carregando mensagens…" />
          ) : data && (
            <section aria-label="Caixa de entrada">
              <div className="console-list-heading">
                <h2>Mensagens ({tickets.length})</h2>
                <span>Página {page + 1}</span>
              </div>

              {/* Barra de Ações em Lote */}
              {tickets.length > 0 && (
                <div className="console-bulk-bar">
                  <label className="console-bulk-select-all">
                    <input
                      type="checkbox"
                      className="console-message-checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Selecionar todas as mensagens da página"
                    />
                    <span>{selectedIds.size > 0 ? `${selectedIds.size} selecionada(s)` : 'Selecionar todas'}</span>
                  </label>

                  {selectedIds.size > 0 && (
                    <div className="console-bulk-actions">
                      <button
                        type="button"
                        className="console-bulk-btn"
                        disabled={bulkBusy}
                        onClick={() => performBulkStatus('read', 'lidas')}
                        title="Marcar selecionadas como lidas"
                      >
                        <Icon name="checkCircle" size={16} /> Marcar lida
                      </button>
                      <button
                        type="button"
                        className="console-bulk-btn"
                        disabled={bulkBusy}
                        onClick={() => performBulkStatus('archived', 'arquivadas')}
                        title="Arquivar mensagens selecionadas"
                      >
                        <Icon name="folder" size={16} /> Arquivar
                      </button>
                      <button
                        type="button"
                        className="console-bulk-btn"
                        disabled={bulkBusy}
                        onClick={() => performBulkStatus('resolved', 'resolvidas')}
                        title="Marcar como resolvidas"
                      >
                        <Icon name="check" size={16} /> Resolver
                      </button>
                      <button
                        type="button"
                        className="console-bulk-btn console-bulk-btn--danger"
                        disabled={bulkBusy}
                        onClick={performBulkDelete}
                        title="Excluir selecionadas"
                      >
                        <Icon name="trash" size={16} /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!tickets.length ? (
                <Empty title="Nenhuma mensagem encontrada" sub="Altere os filtros ou aguarde novos chamados de suporte." />
              ) : (
                <SectionBody>
                  {tickets.map(ticket => {
                    const isSelected = selectedIds.has(ticket.ticketId)
                    const isUnread = ticket.status === 'unread'
                    return (
                      <div
                        key={ticket.ticketId}
                        className={`console-message-item ${isSelected ? 'is-selected' : ''} ${isUnread ? 'is-unread' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="console-message-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(ticket.ticketId)}
                          aria-label={`Selecionar chamado ${ticket.subject}`}
                        />

                        <Link
                          className="console-message-link"
                          to={`/console/support/${ticket.ticketId}${returnQuery}`}
                        >
                          <Avatar name={ticket.displayName || ticket.email || 'Usuário'} size={38} />
                          <span className="console-message-copy">
                            <strong>{ticket.subject}</strong>
                            <span>
                              {ticket.displayName || ticket.email || 'Usuário'}
                              {ticket.categoryLabel && ` · ${ticket.categoryLabel}`}
                            </span>
                            <time>{fmtDateTime(ticket.lastMessageAt)}</time>
                          </span>
                          <span className="console-message-badges">
                            <Chip tone={ticketTone(ticket.status)}>{supportStatusLabel[ticket.status]}</Chip>
                            {ticket.priority !== 'normal' && (
                              <Chip tone="warn">{supportPriorityLabel[ticket.priority]}</Chip>
                            )}
                          </span>
                        </Link>

                        {/* Ações rápidas contextuais */}
                        <div className="console-message-actions">
                          {isUnread && (
                            <button
                              type="button"
                              className="console-quick-action-btn"
                              title="Marcar como lida"
                              onClick={e => handleQuickStatus(e, ticket.ticketId, 'read')}
                            >
                              <Icon name="checkCircle" size={16} />
                            </button>
                          )}
                          {ticket.status !== 'archived' && (
                            <button
                              type="button"
                              className="console-quick-action-btn"
                              title="Arquivar chamado"
                              onClick={e => handleQuickStatus(e, ticket.ticketId, 'archived')}
                            >
                              <Icon name="folder" size={16} />
                            </button>
                          )}
                          {ticket.status === 'archived' && (
                            <button
                              type="button"
                              className="console-quick-action-btn"
                              title="Reabrir chamado"
                              onClick={e => handleQuickStatus(e, ticket.ticketId, 'pending')}
                            >
                              <Icon name="reset" size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="console-quick-action-btn console-quick-action-btn--danger"
                            title="Excluir chamado"
                            onClick={e => handleQuickDelete(e, ticket.ticketId)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </SectionBody>
              )}

              <div className="console-pagination">
                <button
                  className="cx-pill-btn"
                  type="button"
                  disabled={page === 0}
                  onClick={() => change('page', String(page - 1))}
                >
                  Anterior
                </button>
                <span>{tickets.length} nesta página</span>
                <button
                  className="cx-pill-btn"
                  type="button"
                  disabled={tickets.length < PAGE_SIZE}
                  onClick={() => change('page', String(page + 1))}
                >
                  Próxima
                </button>
              </div>
            </section>
          )}
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}
