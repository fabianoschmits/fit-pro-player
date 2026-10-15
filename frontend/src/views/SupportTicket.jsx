import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createSupportRepository } from '../lib/support.js'
import { Button, TextArea } from '../components/ui.jsx'
import { FppSkeleton } from '../components/FppFeedback.jsx'
import { useFppAction } from '../components/useFppAction.js'
import AppHeader from '../components/AppHeader.jsx'
import '../support.css'

const labels = { unread: 'Não lida', read: 'Lida', pending: 'Pendente', answered: 'Respondida', resolved: 'Resolvida', archived: 'Arquivada' }
export default function SupportTicket() {
  const { ticketId } = useParams()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [ticket, setTicket] = useState(null), [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(true)
  const current = useRef(ticketId); current.current = ticketId
  const request = useRef(0)
  const load = useCallback(async () => {
    const version = ++request.current
    setBusy(true)
    try { const next = await repo.ticketDetail(ticketId); if (current.current === ticketId && request.current === version) { setTicket(next); setError('') } }
    catch (err) { if (current.current === ticketId && request.current === version) setError(err.message || 'Chamado não encontrado.') }
    finally { if (current.current === ticketId && request.current === version) setBusy(false) }
  }, [repo, ticketId])
  useEffect(() => { current.current = ticketId; setTicket(null); setBody(''); void load(); return () => { current.current = null; request.current++ } }, [load, ticketId])
  const action = useFppAction({
    onAction: async () => {
      if (!body.trim() || ticket?.status === 'archived') return false
      setError('')
      await repo.addUserMessage(ticketId, body)
      if (current.current !== ticketId) return false
      setBody(''); void load()
      return true
    },
    onError: err => { if (current.current === ticketId) setError(err.message || 'Não foi possível enviar.') },
  })
  const send = event => { event.preventDefault(); void action.run(event) }
  return <div className="narrow support-page"><AppHeader title={ticket?.subject || 'Chamado'} subtitle={ticket?.categoryLabel} backTo="/support/tickets" />
    {busy && <FppSkeleton label="Carregando conversa…" />}{error && <p role="alert" className="support-error">{error}</p>}
    {ticket && <><div className="support-ticket-meta"><span className={`support-status support-status--${ticket.status}`}>{labels[ticket.status]}</span><span>{ticket.priority}</span></div>
      <div className="support-thread">{ticket.messages.map(message => <div key={message.id} className={`support-message support-message--${message.author_kind}`}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString('pt-BR')}</small></div>)}</div>
      {ticket.status === 'archived' ? <p className="muted">Este chamado está arquivado.</p> : <form className="support-reply" onSubmit={send}>
        <TextArea value={body} onChange={event => setBody(event.target.value)} rows={4} placeholder="Escreva uma nova mensagem…" aria-label="Nova mensagem" />
        <Button type="submit" variant="primary" state={action.state} loadingLabel="Enviando…" disabled={!body.trim() && !action.busy}>Enviar resposta</Button>
      </form>}
    </>}
  </div>
}
