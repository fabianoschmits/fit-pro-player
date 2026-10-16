import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createSupportRepository } from '../../lib/support.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import { Alert, SectionBody, Chip, Loading, fmtDateTime, SectionTitle, CxButton } from './ConsoleUI.jsx'
import { useFppAction } from '../../components/useFppAction.js'
import { fppActionInput } from '../../components/fpp-action-timing.js'
import { supportStatusLabel, supportPriorityLabel, ticketTone } from './support-model.js'

export default function ConsoleConversation() {
  const { ticketId } = useParams()
  const [params] = useSearchParams()
  const { userId, repo: accounts, allowed } = useConsoleAccess()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [draft, setDraft] = useState(''), [acting, setActing] = useState(''), [actionError, setActionError] = useState(''), [success, setSuccess] = useState('')
  const identity = `${userId}:${ticketId}`
  const current = useRef(identity); current.current = identity
  const readTicket = useRef('')
  useEffect(() => { current.current = identity; setDraft(''); setActing(''); setActionError(''); setSuccess(''); return () => { current.current = null } }, [identity])
  const { data, busy, error, refresh } = useConsoleResource({ userId, allowed, resourceKey: 'ticket:' + ticketId, load: async () => {
    if (readTicket.current !== identity) { await repo.markRead(ticketId); readTicket.current = identity }
    const ticket = await repo.adminTicketDetail(ticketId)
    if (!ticket?.ticketId) throw new Error('ticket-not-found')
    const person = await accounts.userDetail(ticket.userId).catch(() => null)
    return { ticket, person }
  } })
  const ticket = data?.ticket
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
    if (result.key === 'reply') setDraft('')
    refresh()
  } })
  const run = (event, key, perform, text) => operation.run({ key, perform, text, fppInput: fppActionInput(event) })
  const actionState = key => acting === key ? operation.state : 'idle'
  const update = (event, key, changes) => run(event, key, () => repo.updateTicket(ticketId, { status: ticket.status, priority: ticket.priority, assignedAdminId: ticket.assignedAdminId, ...changes }), 'Chamado atualizado.')
  const back = '/console/support' + (params.size ? `?${params}` : '')
  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed} back={back} backLabel="Caixa de entrada"><div className="cx-page-body">
    {error && <Alert onRetry={refresh}>{error}</Alert>}
    {busy ? <Loading label="Carregando conversa…" /> : ticket && <>
      <div className="cx-page-head"><h1 className="cx-page-title">{ticket.subject}</h1><p className="cx-page-sub">{ticket.categoryLabel} · Aberto em {fmtDateTime(ticket.createdAt)}</p></div>
      {actionError && <Alert>{actionError}</Alert>}{success && <div className="cx-success" role="status">{success}</div>}
      <div className="console-conversation-layout"><div>
        <section aria-label="Conversa"><SectionTitle>Conversa <Chip tone={ticketTone(ticket.status)}>{supportStatusLabel[ticket.status]}</Chip></SectionTitle>
          <div className="console-thread">{ticket.messages.map(message => <article key={message.id} className={`console-bubble console-bubble--${message.author_kind}`}><header><strong>{message.author_kind === 'admin' ? 'Equipe Fit Pro Player' : data.person?.displayName || 'Usuário'}</strong><time>{fmtDateTime(message.created_at)}</time></header><p>{message.body}</p></article>)}</div>
        </section>
        <section aria-label="Responder ao usuário" className="console-composer">
          {ticket.status === 'archived' ? <SectionBody><div className="console-panel-content"><h2>Chamado arquivado</h2><p>Reabra o chamado para continuar esta conversa.</p><CxButton type="button" className="cx-pill-btn cx-pill-btn--accent" state={actionState('reopen')} disabled={operation.locked} onClick={event => update(event, 'reopen', { status: 'pending' })}>Reabrir chamado</CxButton></div></SectionBody> : <form onSubmit={e => { e.preventDefault(); if (draft.trim()) void run(e, 'reply', () => repo.reply(ticketId, draft.trim()), 'Resposta enviada ao usuário.') }}>
            <label className="cx-label">Sua resposta<textarea className="cx-field cx-field--ta" aria-label="Sua resposta" placeholder="Escreva uma resposta para o usuário…" rows={6} value={draft} maxLength={10000} onChange={e => setDraft(e.target.value)} disabled={operation.locked} /></label>
            <div className="console-composer-footer"><span>A resposta ficará disponível em Meus chamados.</span><CxButton type="submit" className="cx-pill-btn cx-pill-btn--accent" state={actionState('reply')} loadingLabel="Enviando…" disabled={operation.locked || !draft.trim()}>Enviar resposta</CxButton></div>
          </form>}
        </section>
        <details className="console-event-log"><summary>Histórico do atendimento</summary>{ticket.events.length ? <ol>{ticket.events.map(event => <li key={event.id}><span>{({ created: 'Chamado aberto', updated: 'Organização do chamado atualizada', read: 'Chamado lido', replied: 'Resposta enviada' })[event.event_type] || 'Atendimento atualizado'}</span><time>{fmtDateTime(event.created_at)}</time></li>)}</ol> : <p>Nenhuma alteração registrada.</p>}</details>
      </div><aside className="console-conversation-sidebar">
        <section><SectionTitle>Quem enviou</SectionTitle><SectionBody><div className="console-panel-content"><strong>{data.person?.displayName || 'Usuário'}</strong><p>{data.person?.email || ticket.email || 'Conta sem e-mail'}</p><Link className="console-text-link" to={`/console/users/${ticket.userId}`}>Ver perfil do usuário</Link></div></SectionBody></section>
        <section><SectionTitle>Organização</SectionTitle><SectionBody><div className="console-panel-content console-field-stack">
          <label className="cx-label">Status<select className="cx-field" value={ticket.status} disabled={operation.locked} aria-busy={acting === 'status' && operation.busy || undefined} onChange={e => update(e, 'status', { status: e.target.value })}>{Object.entries(supportStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="cx-label">Prioridade<select className="cx-field" value={ticket.priority} disabled={operation.locked} aria-busy={acting === 'priority' && operation.busy || undefined} onChange={e => update(e, 'priority', { priority: e.target.value })}>{Object.entries(supportPriorityLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <div><span className="console-muted">Responsável</span><p>{ticket.assignedAdminId === userId ? 'Você' : ticket.assignedAdminId ? 'Outro integrante da equipe' : 'Sem responsável'}</p><CxButton type="button" className="console-text-button" state={actionState('assign')} disabled={operation.locked} onClick={event => update(event, 'assign', { assignedAdminId: ticket.assignedAdminId === userId ? null : userId })}>{ticket.assignedAdminId === userId ? 'Remover atribuição' : 'Assumir atendimento'}</CxButton></div>
          {ticket.status !== 'archived' && <CxButton type="button" className="cx-pill-btn" state={actionState('archive')} disabled={operation.locked} onClick={event => update(event, 'archive', { status: 'archived' })}>Arquivar chamado</CxButton>}
        </div></SectionBody></section>
      </aside></div>
    </>}
  </div></ConsoleShell></AccessGate>
}
