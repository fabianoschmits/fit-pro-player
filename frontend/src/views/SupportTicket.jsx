import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createSupportRepository } from '../lib/support.js'
import { FppSkeleton } from '../components/FppFeedback.jsx'
import { useFppAction } from '../components/useFppAction.js'
import AppHeader from '../components/AppHeader.jsx'
import Icon from '../components/Icon.jsx'
import '../support.css'

// ── Limits ────────────────────────────────────────────────────────
const MAX_CHARS        = 3000   // max chars per message
const COOLDOWN_MS      = 8000   // min ms between sends
const RATE_WINDOW_MS   = 60000  // sliding window duration
const RATE_MAX_SENDS   = 5      // max sends in that window

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

/** Returns seconds remaining until next send is allowed, or 0 if allowed. */
function getCooldownSeconds(sendTimestamps) {
  const now = Date.now()
  // cooldown between consecutive sends
  const lastSent = sendTimestamps.at(-1) ?? 0
  const cooldownLeft = Math.ceil(Math.max(0, COOLDOWN_MS - (now - lastSent)) / 1000)
  if (cooldownLeft > 0) return cooldownLeft
  // rate window check: prune old entries, check count
  const recent = sendTimestamps.filter(t => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX_SENDS) {
    const oldest = recent[0]
    return Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000)
  }
  return 0
}

export default function SupportTicket() {
  const { ticketId } = useParams()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [ticket, setTicket]   = useState(null)
  const [body, setBody]       = useState('')
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(true)
  // rate limiting state
  const [sendTimestamps, setSendTimestamps] = useState([])  // array of epoch ms
  const [cooldownSec, setCooldownSec]       = useState(0)
  const cooldownTimer = useRef(null)

  const current    = useRef(ticketId)
  const request    = useRef(0)
  const threadRef  = useRef(null)
  const textareaRef = useRef(null)

  // ── Cooldown ticker ──────────────────────────────────────────
  const startCooldownTick = useCallback((timestamps) => {
    clearInterval(cooldownTimer.current)
    cooldownTimer.current = setInterval(() => {
      const sec = getCooldownSeconds(timestamps)
      setCooldownSec(sec)
      if (sec <= 0) clearInterval(cooldownTimer.current)
    }, 500)
  }, [])

  useEffect(() => () => clearInterval(cooldownTimer.current), [])

  // ── Scroll helpers ───────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = false) => {
    if (!threadRef.current) return
    threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  // ── Load ticket ──────────────────────────────────────────────
  const load = useCallback(async () => {
    const version = ++request.current
    setBusy(true)
    try {
      const next = await repo.ticketDetail(ticketId)
      if (current.current === ticketId && request.current === version) {
        setTicket(next); setError('')
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
    setTicket(null); setBody('')
    void load()
    return () => { current.current = null; request.current++ }
  }, [load, ticketId])

  useEffect(() => { if (!busy && ticket) scrollToBottom(false) }, [busy, ticket, scrollToBottom])

  // ── Send action ──────────────────────────────────────────────
  const action = useFppAction({
    onAction: async () => {
      const trimmed = body.trim()
      if (!trimmed || ticket?.status === 'archived') return false

      // char limit
      if (trimmed.length > MAX_CHARS) {
        setError(`Mensagem muito longa. Máximo ${MAX_CHARS} caracteres.`)
        return false
      }

      // rate limit
      const wait = getCooldownSeconds(sendTimestamps)
      if (wait > 0) {
        setError(`Aguarde ${wait}s antes de enviar outra mensagem.`)
        return false
      }

      setError('')
      await repo.addUserMessage(ticketId, trimmed)
      if (current.current !== ticketId) return false

      // register this send
      const next = [...sendTimestamps.filter(t => Date.now() - t < RATE_WINDOW_MS), Date.now()]
      setSendTimestamps(next)
      setCooldownSec(getCooldownSeconds(next))
      startCooldownTick(next)

      setBody('')
      void load()
      return true
    },
    onError: err => { if (current.current === ticketId) setError(err.message || 'Não foi possível enviar.') },
  })

  const send = e => { e.preventDefault(); void action.run(e) }
  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void action.run(e) }
  }

  const charCount   = body.length
  const charOver    = charCount > MAX_CHARS
  const charWarning = charCount > MAX_CHARS * 0.85  // warn at 85%
  const isArchived  = ticket?.status === 'archived'
  const canSend     = body.trim().length > 0 && !charOver && cooldownSec <= 0 && !action.busy

  // remaining sends in current window
  const now = Date.now()
  const recentSends = sendTimestamps.filter(t => now - t < RATE_WINDOW_MS).length
  const sendsLeft = RATE_MAX_SENDS - recentSends

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <AppHeader title={ticket?.subject || 'Chamado'} subtitle={ticket?.categoryLabel} backTo="/support/tickets" />
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
          const isUser  = msg.author_kind === 'user'
          const prevKind = i > 0 ? ticket.messages[i - 1].author_kind : null
          const isFirst  = prevKind !== msg.author_kind
          return (
            <div key={msg.id} className={`chat-bubble-row chat-bubble-row--${msg.author_kind}${isFirst ? ' is-first' : ''}`}>
              {!isUser && isFirst && <div className="chat-avatar chat-avatar--admin" aria-hidden="true">A</div>}
              <div className={`chat-bubble chat-bubble--${msg.author_kind}`}>
                <p>{msg.body}</p>
                <time className="chat-time">{formatTime(msg.created_at)}</time>
                {isUser && <span className="chat-tick" aria-hidden="true"><Icon name="check" /></span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input bar */}
      {isArchived ? (
        <div className="chat-archived"><Icon name="lock" /><span>Este chamado está arquivado.</span></div>
      ) : (
        <form className="chat-input-bar" onSubmit={send} noValidate>
          <div className="chat-input-col">
            <textarea
              ref={textareaRef}
              className={`chat-textarea${charOver ? ' chat-textarea--over' : ''}`}
              value={body}
              rows={1}
              placeholder="Escreva uma mensagem…"
              aria-label="Nova mensagem"
              maxLength={MAX_CHARS + 200}  /* allow typing slightly over to see counter */
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKey}
            />
            <div className="chat-input-meta">
              {cooldownSec > 0 && (
                <span className="chat-rate-warn" role="status">
                  <Icon name="timer" />
                  Aguarde {cooldownSec}s
                </span>
              )}
              {cooldownSec <= 0 && sendsLeft < RATE_MAX_SENDS && sendsLeft > 0 && (
                <span className="chat-sends-left">
                  {sendsLeft} envio{sendsLeft !== 1 ? 's' : ''} restante{sendsLeft !== 1 ? 's' : ''}
                </span>
              )}
              <span className={`chat-char-count${charOver ? ' chat-char-count--over' : charWarning ? ' chat-char-count--warn' : ''}`}
                aria-live="polite">
                {charCount}/{MAX_CHARS}
              </span>
            </div>
          </div>
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!canSend}
            aria-label="Enviar"
            aria-busy={action.busy ? 'true' : undefined}
            data-state={action.state !== 'idle' ? action.state : undefined}
          >
            <Icon name="arrowUp" />
          </button>
        </form>
      )}
    </div>
  )
}
