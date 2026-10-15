import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createSupportRepository } from '../lib/support.js'
import { FppSkeleton } from '../components/FppFeedback.jsx'
import AppHeader from '../components/AppHeader.jsx'
import '../support.css'

const labels = { unread: 'Não lida', read: 'Lida', pending: 'Pendente', answered: 'Respondida', resolved: 'Resolvida', archived: 'Arquivada' }
export default function SupportTickets() {
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [tickets, setTickets] = useState([]), [busy, setBusy] = useState(true), [error, setError] = useState('')
  useEffect(() => {
    let live = true
    repo.listMyTickets().then(rows => { if (live) setTickets(rows) }).catch(err => { if (live) setError(err.message || 'Não foi possível carregar seus chamados.') }).finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [repo])
  return <div className="narrow support-page"><AppHeader title="Meus chamados" subtitle="Acompanhe suas conversas com o administrador." backTo="/support" />
    <div className="support-list-actions"><Link className="management-button management-button-primary" to="/support/tickets/new">Novo chamado</Link></div>
    {busy && <FppSkeleton label="Carregando chamados…" />}{error && <p role="alert" className="support-error">{error}</p>}
    {!busy && !error && !tickets.length && <div className="support-empty"><strong>Você ainda não abriu nenhum chamado.</strong><Link to="/support/tickets/new">Enviar uma mensagem</Link></div>}
    <div className="support-ticket-list">{tickets.map(ticket => <Link className="support-ticket-row" key={ticket.ticketId} to={`/support/tickets/${ticket.ticketId}`}><span><strong>{ticket.subject}</strong><small>{ticket.categoryLabel}</small></span><em className={`support-status support-status--${ticket.status}`}>{labels[ticket.status] || ticket.status}</em></Link>)}</div>
  </div>
}
