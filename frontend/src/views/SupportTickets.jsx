import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createSupportRepository } from '../lib/support.js'
import { FppSkeleton } from '../components/FppFeedback.jsx'
import AppHeader from '../components/AppHeader.jsx'
import Icon from '../components/Icon.jsx'
import '../support.css'

const STATUS_LABELS = {
  unread: 'Não lida', read: 'Lida', pending: 'Pendente',
  answered: 'Respondida', resolved: 'Resolvida', archived: 'Arquivada',
}

const STATUS_DOT = { unread: 'orange', pending: 'orange', answered: 'blue', resolved: 'teal', archived: 'muted' }

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function SupportTickets() {
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [tickets, setTickets] = useState([]), [busy, setBusy] = useState(true), [error, setError] = useState('')
  useEffect(() => {
    let live = true
    repo.listMyTickets()
      .then(rows => { if (live) setTickets(rows) })
      .catch(err => { if (live) setError(err.message || 'Não foi possível carregar seus chamados.') })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [repo])

  return (
    <div className="narrow support-page">
      <AppHeader title="Meus chamados" subtitle="Acompanhe suas conversas com a equipe." backTo="/support" />
      <div className="support-list-actions">
        <Link className="management-button management-button-primary" to="/support/tickets/new">
          <Icon name="plus" /> Novo chamado
        </Link>
      </div>

      {busy && <FppSkeleton label="Carregando chamados…" />}
      {error && <p role="alert" className="support-error">{error}</p>}

      {!busy && !error && !tickets.length && (
        <div className="support-empty">
          <strong>Você ainda não abriu nenhum chamado.</strong>
          <Link to="/support/tickets/new">Enviar uma mensagem</Link>
        </div>
      )}

      <div className="support-ticket-list">
        {tickets.map(ticket => {
          const dot = STATUS_DOT[ticket.status] || 'muted'
          const isUnread = ticket.status === 'unread' || ticket.status === 'answered'
          return (
            <Link
              className={`ticket-chat-row${isUnread ? ' ticket-chat-row--unread' : ''}`}
              key={ticket.ticketId}
              to={`/support/tickets/${ticket.ticketId}`}
            >
              <div className="ticket-chat-avatar">
                <span>{(ticket.subject || 'S')[0].toUpperCase()}</span>
              </div>
              <div className="ticket-chat-body">
                <div className="ticket-chat-top">
                  <strong className="ticket-chat-subject">{ticket.subject}</strong>
                  <time className="ticket-chat-time">{formatDate(ticket.updatedAt || ticket.createdAt)}</time>
                </div>
                <div className="ticket-chat-bottom">
                  <span className="ticket-chat-category">{ticket.categoryLabel}</span>
                  <em className={`support-status support-status--${ticket.status}`}>
                    <span className={`status-dot status-dot--${dot}`} aria-hidden="true" />
                    {STATUS_LABELS[ticket.status] || ticket.status}
                  </em>
                </div>
              </div>
              <Icon name="chevronRight" className="ticket-chat-arrow" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
