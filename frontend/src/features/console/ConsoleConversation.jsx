import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createSupportRepository } from '../../lib/support.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import { Alert, SectionBody, Chip, Loading, fmtDateTime, SectionTitle, CxButton } from './ConsoleUI.jsx'
import Icon from '../../components/Icon.jsx'
import { useFppAction } from '../../components/useFppAction.js'
import { fppActionInput } from '../../components/fpp-action-timing.js'
import { supportStatusLabel, supportPriorityLabel, ticketTone } from './support-model.js'

const MAX_CHARS = 3000

export default function ConsoleConversation() {
  const { ticketId } = useParams()
  const [params] = useSearchParams()
  const { userId, repo: accounts, allowed } = useConsoleAccess()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [draft, setDraft] = useState(''), [acting, setActing] = useState(''), [actionError, setActionError] = useState(''), [success, setSuccess] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const threadRef = useRef(null)
  const identity = `${userId}:${ticketId}`
  const current = useRef(identity); current.current = identity
  const readTicket = useRef('')
  useEffect(() => { current.current = identity; setDraft(''); setActing(''); setActionError(''); setSuccess(''); setVisibleCount(10); return () => { current.current = null } }, [identity])
  const { data, busy, error, refresh } = useConsoleResource({ userId, allowed, resourceKey: 'ticket:' + ticketId, load: async () => {
    if (readTicket.current !== identity) { await repo.markRead(ticketId); readTicket.current = identity }
    const ticket = await repo.adminTicketDetail(ticketId)
    if (!ticket?.ticketId) throw new Error('ticket-not-found')
    const person = await accounts.userDetail(ticket.userId).catch(() => null)
    return { ticket, person }
  } })
  const ticket = data?.ticket

  useEffect(() => {
    if (threadRef.current && !loadingOlder) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [ticket?.messages?.length, busy, loadingOlder])

  const totalMessages = ticket?.messages?.length || 0
  const hasOlder = totalMessages > visibleCount

  const loadMoreOlder = () => {
    if (!hasOlder || loadingOlder) return
    setLoadingOlder(true)
    const thread = threadRef.current
    const prevScrollHeight = thread ? thread.scrollHeight : 0
    const prevScrollTop = thread ? thread.scrollTop : 0

    setVisibleCount(prev => Math.min(prev + 10, totalMessages))

    requestAnimationFrame(() => {
      if (thread) {
        const heightDiff = thread.scrollHeight - prevScrollHeight
        thread.scrollTop = prevScrollTop + heightDiff
      }
      setLoadingOlder(false)
    })
  }

  const handleScroll = () => {
    if (!threadRef.current || !hasOlder || loadingOlder) return
    if (threadRef.current.scrollTop <= 15) {
      loadMoreOlder()
    }
  }

  const visibleMessages = useMemo(() => {
    if (!ticket?.messages) return []
    const start = Math.max(0, ticket.messages.length - visibleCount)
    return ticket.messages.slice(start)
  }, [ticket?.messages, visibleCount])

  const operation = useFppAction({ onAction: async ({ key, perform, text }) => {
    setActing(key); setActionError(''); setSuccess('')
    try {
      await perform()
      if (current.current !== identity) return false
      setSuccess(text)
      return { key, identity }
    } catch (err) {
      if (current.current === identity) setActionError(key === 'reply' ? 'Não foi possível enviar a resposta. Seu texto foi mantido; tente novamente.' : 'Não foi possível atualizar o chamado. Tente novamente.')
      throw err
    }
  }, onSuccess: result => {
    if (current.current !== result.identity) return
    if (result.key === 'reply') {
      setDraft('')
      setVisibleCount(c => c + 1)
    }
    refresh()
  } })
  const run = (event, key, perform, text) => operation.run({ key, perform, text, fppInput: fppActionInput(event) })
  const actionState = key => acting === key ? operation.state : 'idle'
  const update = (event, key, changes) => run(event, key, () => repo.updateTicket(ticketId, { status: ticket.status, priority: ticket.priority, assignedAdminId: ticket.assignedAdminId, ...changes }), 'Chamado atualizado.')
  const back = '/console/support' + (params.size ? `?${params}` : '')

  const charCount = draft.length
  const charOver = charCount > MAX_CHARS
  const charWarn = charCount > MAX_CHARS * 0.85

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (draft.trim() && !charOver && !operation.locked) {
        void run(e, 'reply', () => repo.reply(ticketId, draft.trim()), 'Resposta enviada ao usuário.')
      }
    }
  }

  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed} back={back} backLabel="Caixa de entrada"><div className="cx-page-body console-conversation-page">
    {error && <Alert onRetry={refresh}>{error}</Alert>}
    {busy ? <Loading label="Carregando conversa…" /> : ticket && <>
      {actionError && <Alert>{actionError}</Alert>}{success && <div className="cx-success" role="status">{success}</div>}
      <div className="console-conversation-layout">
        <div className="console-chat-column">
          {/* WhatsApp-style Sticky Chat Header */}
          <header className="console-chat-header">
            <div className="console-chat-header-main">
              <div className="console-chat-header-avatar" aria-hidden="true">
                {(data.person?.displayName || ticket.email || 'U')[0].toUpperCase()}
              </div>
              <div className="console-chat-header-info">
                <h1 className="console-chat-header-title">{ticket.subject}</h1>
                <p className="console-chat-header-sub">
                  <span>{data.person?.displayName || ticket.email || 'Usuário'}</span>
                  {ticket.categoryLabel && <span> · {ticket.categoryLabel}</span>}
                  <span> · {fmtDateTime(ticket.createdAt)}</span>
                </p>
              </div>
            </div>
            <div className="console-chat-header-actions">
              <Chip tone={ticketTone(ticket.status)}>{supportStatusLabel[ticket.status]}</Chip>
              {ticket.priority !== 'normal' && <Chip tone="warn">{supportPriorityLabel[ticket.priority]}</Chip>}
            </div>
          </header>

          {/* WhatsApp-style Thread */}
          <div className="console-chat-thread" ref={threadRef} onScroll={handleScroll} aria-live="polite" aria-label="Histórico de mensagens">
            {hasOlder && (
              <div className="chat-load-older-row">
                <button
                  type="button"
                  className="chat-load-older-btn"
                  onClick={loadMoreOlder}
                  disabled={loadingOlder}
                >
                  <Icon name="history" />
                  <span>{loadingOlder ? 'Carregando…' : `Carregar mais antigas (${totalMessages - visibleCount} restantes)`}</span>
                </button>
              </div>
            )}
            {visibleMessages.map((message, i) => {
              const isAdmin = message.author_kind === 'admin'
              const prevKind = i > 0 ? visibleMessages[i - 1].author_kind : null
              const isFirst = prevKind !== message.author_kind
              return (
                <div key={message.id} className={`console-chat-row console-chat-row--${message.author_kind}${isFirst ? ' is-first' : ''}`}>
                  {!isAdmin && isFirst && (
                    <div className="console-chat-avatar-mini" aria-hidden="true">
                      {(data.person?.displayName || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <article className={`console-chat-bubble console-chat-bubble--${message.author_kind}`}>
                    <header className="console-chat-bubble-head">
                      <strong>{isAdmin ? 'Equipe Fit Pro Player' : data.person?.displayName || 'Usuário'}</strong>
                    </header>
                    <p>{message.body}</p>
                    <footer className="console-chat-bubble-foot">
                      <time>{fmtDateTime(message.created_at)}</time>
                      {isAdmin && <span className="console-chat-tick" aria-hidden="true"><Icon name="check" /></span>}
                    </footer>
                  </article>
                </div>
              )
            })}
          </div>

          {/* WhatsApp-style Sticky Bottom Composer */}
          <section aria-label="Responder ao usuário" className="console-chat-composer-wrap">
            {ticket.status === 'archived' ? (
              <div className="console-chat-archived">
                <Icon name="lock" />
                <span>Chamado arquivado. Reabra para responder.</span>
                <CxButton type="button" className="cx-pill-btn cx-pill-btn--accent" state={actionState('reopen')} disabled={operation.locked} onClick={event => update(event, 'reopen', { status: 'pending' })}>Reabrir chamado</CxButton>
              </div>
            ) : (
              <form className="console-chat-bar" onSubmit={e => { e.preventDefault(); if (draft.trim() && !charOver) void run(e, 'reply', () => repo.reply(ticketId, draft.trim()), 'Resposta enviada ao usuário.') }}>
                <div className="console-chat-input-col">
                  <textarea
                    className={`console-chat-textarea${charOver ? ' is-over' : ''}`}
                    aria-label="Sua resposta"
                    placeholder="Escreva uma resposta para o usuário… (Enter para enviar, Shift+Enter para quebra)"
                    value={draft}
                    rows={1}
                    maxLength={MAX_CHARS + 200}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={operation.locked}
                  />
                  <div className="console-chat-input-meta">
                    <span className="console-chat-meta-hint">Resposta visível imediatamente em Meus chamados</span>
                    <span className={`console-chat-counter${charOver ? ' is-over' : charWarn ? ' is-warn' : ''}`}>
                      {charCount}/{MAX_CHARS}
                    </span>
                  </div>
                </div>
                <button
                  type="submit"
                  className="console-chat-send-btn"
                  disabled={operation.locked || !draft.trim() || charOver}
                  aria-label="Enviar resposta"
                  aria-busy={actionState('reply') === 'loading' || acting === 'reply' && operation.busy ? 'true' : undefined}
                  data-state={actionState('reply') !== 'idle' ? actionState('reply') : undefined}
                >
                  <Icon name="arrowUp" />
                </button>
              </form>
            )}
          </section>

          <details className="console-event-log">
            <summary>Histórico do atendimento ({ticket.events.length})</summary>
            {ticket.events.length ? <ol>{ticket.events.map(event => <li key={event.id}><span>{({ created: 'Chamado aberto', updated: 'Organização do chamado atualizada', read: 'Chamado lido', replied: 'Resposta enviada' })[event.event_type] || 'Atendimento atualizado'}</span><time>{fmtDateTime(event.created_at)}</time></li>)}</ol> : <p>Nenhuma alteração registrada.</p>}
          </details>
        </div>

        <aside className="console-conversation-sidebar">
          <section><SectionTitle>Quem enviou</SectionTitle><SectionBody><div className="console-panel-content"><strong>{data.person?.displayName || 'Usuário'}</strong><p>{data.person?.email || ticket.email || 'Conta sem e-mail'}</p><Link className="console-text-link" to={`/console/users/${ticket.userId}`}>Ver perfil do usuário</Link></div></SectionBody></section>
          <section><SectionTitle>Organização</SectionTitle><SectionBody><div className="console-panel-content console-field-stack">
            <label className="cx-label">Status<select className="cx-field" value={ticket.status} disabled={operation.locked} aria-busy={acting === 'status' && operation.busy || undefined} onChange={e => update(e, 'status', { status: e.target.value })}>{Object.entries(supportStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="cx-label">Prioridade<select className="cx-field" value={ticket.priority} disabled={operation.locked} aria-busy={acting === 'priority' && operation.busy || undefined} onChange={e => update(e, 'priority', { priority: e.target.value })}>{Object.entries(supportPriorityLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <div><span className="console-muted">Responsável</span><p>{ticket.assignedAdminId === userId ? 'Você' : ticket.assignedAdminId ? 'Outro integrante da equipe' : 'Sem responsável'}</p><CxButton type="button" className="console-text-button" state={actionState('assign')} disabled={operation.locked} onClick={event => update(event, 'assign', { assignedAdminId: ticket.assignedAdminId === userId ? null : userId })}>{ticket.assignedAdminId === userId ? 'Remover atribuição' : 'Assumir atendimento'}</CxButton></div>
            {ticket.status !== 'archived' && <CxButton type="button" className="cx-pill-btn" state={actionState('archive')} disabled={operation.locked} onClick={event => update(event, 'archive', { status: 'archived' })}>Arquivar chamado</CxButton>}
          </div></SectionBody></section>
        </aside>
      </div>
    </>}
  </div></ConsoleShell></AccessGate>
}
