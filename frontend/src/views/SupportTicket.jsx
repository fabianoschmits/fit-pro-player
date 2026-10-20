import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createSupportRepository } from '../lib/support.js'
import { FppSkeleton } from '../components/FppFeedback.jsx'
import { useFppAction } from '../components/useFppAction.js'
import AppHeader from '../components/AppHeader.jsx'
import Icon from '../components/Icon.jsx'
import '../support.css'

const STATUS_LABELS = {
  unread: 'Não lida', read: 'Lida', pending: 'Pendente',
  answered: 'Respondida', resolved: 'Resolvida', archived: 'Arquivada',
}

function formatTime(iso) {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function SupportTicket() {
  const { ticketId } = useParams()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [ticket, setTicket] = useState(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const current = useRef(ticketId)
  const request = useRef(0)
  const threadRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = useCallback((smooth = false) => {
    if (!threadRef.current) return
    threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  const load = useCallback(async () => {
    const version = ++request.current
    setBusy(true)
    try {
      const next = await repo.ticketDetail(ticketId)
      if (current.current === ticketId && request.current === version) {
        setTicket(next)
        setError('')
      }
    } catch (err) {
      if (current.current === ticketId && request.current === version)
        setError(err.message || 'Chamado não encontrado.')
    } finally {
      if (current.current === ticketId && request.current === version) setBusy(false)
    }
  }, [repo, ticketId])

  useEffect(() => {
    current.current = ticketId
    setTicket(null)
    setBody('')
    void load()
    return () => { current.current = null; request.current++ }
  }, [load, ticketId])

  // scroll to bottom after messages load
  useEffect(() => { if (!busy && ticket) scrollToBottom(false) }, [busy, ticket, scrollToBottom])

  const action = useFppAction({
    onAction: async () => {
      if (!body.trim() || ticket?.status === 'archived') return false
      setError('')
      await repo.addUserMessage(ticketId, body)
      if (current.current !== ticketId) return false
      setBody('')
      void load()
      return true
    },
    onError: err => { if (current.current === ticketId) setError(err.message || 'Não foi possível enviar.') },
  })

  const send = e => {
    e.preventDefault()
    void action.run(e)
  }

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void action.run(e) }
  }

  const isArchived = ticket?.status === 'archived'

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <AppHeader
          title={ticket?.subject || 'Chamado'}
          subtitle={ticket?.categoryLabel}
          backTo="/support/tickets"
        />
        {ticket && (
          <span className={`support-status support-status--${ticket.status} chat-status-badge`}>
            {STATUS_LABELS[ticket.status]}
          </span>
        )}
      </div>

      {/* Thread */}
      <div className="chat-thread" ref={threadRef} aria-live="polite" aria-label="Conversa">
        {busy && <FppSkeleton label="Carregando conversa…" />}
        {error && <p role="alert" className="support-error chat-error">{error}</p>}

        {ticket && ticket.messages.map((msg, i) => {
          const isUser = msg.author_kind === 'user'
          const prevKind = i > 0 ? ticket.messages[i - 1].author_kind : null
          const isFirst = prevKind !== msg.author_kind
          return (
            <div
              key={msg.id}
              className={`chat-bubble-row chat-bubble-row--${msg.author_kind}${isFirst ? ' is-first' : ''}`}
            >
              {!isUser && isFirst && (
                <div className="chat-avatar chat-avatar--admin" aria-hidden="true">A</div>
              )}
              <div className={`chat-bubble chat-bubble--${msg.author_kind}`}>
                <p>{msg.body}</p>
                <time className="chat-time">{formatTime(msg.created_at)}</time>
                {isUser && (
                  <span className="chat-tick" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input bar */}
      {isArchived ? (
        <div className="chat-archived">
          <Icon name="lock" />
          <span>Este chamado está arquivado.</span>
        </div>
      ) : (
        <form className="chat-input-bar" onSubmit={send} noValidate>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={body}
            rows={1}
            placeholder="Escreva uma mensagem…"
            aria-label="Nova mensagem"
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKey}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!body.trim() || action.busy}
            aria-label="Enviar"
          >
            <Icon name="arrowUp" />
          </button>
        </form>
      )}
    </div>
  )
}
