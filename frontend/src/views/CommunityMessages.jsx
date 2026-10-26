import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createMessageRepository, mergeMessages } from '../lib/direct-messages.js'
import { avatarSrc, isAvatarId } from '../lib/avatars.js'
import { acquireUpdateBlocker } from '../lib/reload-safety.js'
import AppHeader from '../components/AppHeader.jsx'
import Icon from '../components/Icon.jsx'
import '../support.css'
import './direct-messages.css'

function Avatar({ profile, className = '' }) {
  const ref = profile?.avatar_ref
  const src = isAvatarId(ref) ? avatarSrc(ref) : /^https:\/\//.test(ref || '') ? ref : null
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  const classes = `dm-avatar ${className}`.trim()
  return src && !failed ? <img className={classes} src={src} alt="" onError={() => setFailed(true)} /> : <span className={classes}>{(profile?.display_name || '?')[0].toUpperCase()}</span>
}
const formatTime = value => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function ActionMenu({ label, open, onToggle, children, className = '' }) {
  const root = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = event => { if (!root.current?.contains(event.target)) onToggle() }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open, onToggle])
  return <div ref={root} className={`dm-action-menu ${className}${open ? ' is-open' : ''}`.trim()}>
    <button type="button" className="dm-menu-trigger" aria-label={label} aria-expanded={open} onClick={event => { event.stopPropagation(); onToggle() }}><Icon name="more" /></button>
    {open && <div className="dm-menu-popover" role="menu">{children}</div>}
  </div>
}

function useRefresh(refresh) {
  useEffect(() => {
    const run = () => { if (document.visibilityState !== 'hidden') void refresh() }
    run()
    const interval = setInterval(run, 5000)
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', run)
    return () => { clearInterval(interval); window.removeEventListener('online', run); document.removeEventListener('visibilitychange', run) }
  }, [refresh])
}

export default function CommunityMessages() {
  const { user } = useAuth(), { peerId } = useParams()
  const client = getBrowserSupabaseClient()
  const repo = useMemo(() => createMessageRepository(client), [client])
  if (!user?.id || !client) return <p>Entre na sua conta para acessar as mensagens.</p>
  return peerId ? <Conversation key={`${user.id}:${peerId}`} peerId={peerId} userId={user.id} client={client} repo={repo} /> : <Inbox key={user.id} userId={user.id} repo={repo} />
}

function Inbox({ repo, userId }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([]), [query, setQuery] = useState(''), [search, setSearch] = useState('')
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [pages, setPages] = useState(1), [more, setMore] = useState(false), [menuPeer, setMenuPeer] = useState(null)
  const version = useRef(0), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; version.current++ } }, [])
  useEffect(() => { const timer = setTimeout(() => { setSearch(query); setPages(1) }, 250); return () => clearTimeout(timer) }, [query])
  const refresh = useCallback(async () => {
    const request = ++version.current
    try {
      const result = await Promise.all(Array.from({ length: pages }, (_, index) => repo.inbox(index * 50, search)))
      if (!mounted.current || request !== version.current) return
      setRows([...new Map(result.flat().map(row => [row.peer_id, row])).values()]); setMore(result.at(-1).length === 50); setError('')
    } catch { if (mounted.current && request === version.current) setError('Não foi possível carregar as conversas. Tente novamente.') }
    finally { if (mounted.current && request === version.current) setLoading(false) }
  }, [repo, pages, search])
  useRefresh(refresh)
  const actOnConversation = async (row, action) => {
    setMenuPeer(null)
    try {
      if (action === 'unread') await repo.markUnread(row.peer_id)
      else await repo.hideConversation(row.peer_id)
      await refresh()
    } catch { setError('Não foi possível atualizar a conversa. Tente novamente.') }
  }
  return <div className="dm-inbox page-scenery"><AppHeader title="Conversas" backTo="/community" />
    <label className="dm-search"><Icon name="search" /><input aria-label="Pesquisar conversas" placeholder="Pesquisar conversas" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {error && <p className="support-error" role="alert">{error} <button onClick={refresh}>Tentar novamente</button></p>}
    {loading && <p role="status">Carregando conversas…</p>}
    {!loading && !error && !rows.length && <div className="dm-empty"><Icon name="message" /><h2>{search ? 'Nenhuma conversa encontrada' : 'Suas conversas começam aqui'}</h2><p>Abra o perfil de alguém na comunidade e toque no ícone de mensagem.</p><button onClick={() => navigate('/community')}>Ir para a comunidade</button></div>}
    {rows.map(row => <div className={`dm-inbox-row${Number(row.unread_count) ? ' is-unread' : ''}`} key={row.peer_id}><button className="dm-inbox-open" onClick={() => navigate(`/community/messages/${row.peer_id}`)}><Avatar profile={row} /><span className="dm-preview"><strong>{row.display_name || 'Usuário'}</strong><span>{row.sender_id === userId ? 'Você: ' : ''}{row.body}</span></span><span className="dm-meta"><time>{formatTime(row.created_at)}</time>{Number(row.unread_count) > 0 && <b className="dm-badge" aria-label={`${row.unread_count} mensagens não lidas`}>{Number(row.unread_count) > 99 ? '99+' : row.unread_count}</b>}</span></button><ActionMenu label={`Ações da conversa com ${row.display_name || 'usuário'}`} open={menuPeer === row.peer_id} onToggle={() => setMenuPeer(menuPeer === row.peer_id ? null : row.peer_id)}><button role="menuitem" onClick={() => void actOnConversation(row, 'unread')}>Marcar como não lida</button><button role="menuitem" className="dm-danger" onClick={() => void actOnConversation(row, 'hide')}>Apagar conversa</button></ActionMenu></div>)}
    {more && <button className="chat-load-older-btn" onClick={() => setPages(value => value + 1)}>Carregar mais conversas</button>}
  </div>
}

function Conversation({ repo, client, userId, peerId }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null), [profileError, setProfileError] = useState(''), [messages, setMessages] = useState([]), [body, setBody] = useState(''), [editing, setEditing] = useState(null)
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [older, setOlder] = useState(false), [loadingOlder, setLoadingOlder] = useState(false), [menu, setMenu] = useState(null), [removing, setRemoving] = useState(() => new Set())
  const thread = useRef(null), active = useRef(true), inFlight = useRef(false), sendLock = useRef(false), nonce = useRef(null), initialized = useRef(false), atBottom = useRef(true), oldestDisplayed = useRef(null), removedMessageIds = useRef(new Set())
  const validPeer = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(peerId) && peerId !== userId
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { if (body || sending) return acquireUpdateBlocker() }, [body, sending])
  const loadProfile = useCallback(async () => {
    if (!validPeer) return
    try {
      const { data, error: failure } = await client.from('profiles').select('id,display_name,avatar_ref').eq('id', peerId).maybeSingle()
      if (!active.current) return
      if (failure || !data) throw new Error('Perfil indisponível.')
      setProfile(data); setProfileError('')
    } catch { if (active.current) setProfileError('Não foi possível carregar o perfil.') }
  }, [client, peerId, validPeer])
  useEffect(() => { void loadProfile() }, [loadProfile])
  const refresh = useCallback(async () => {
    if (!validPeer || inFlight.current) { if (!validPeer) setLoading(false); return }
    inFlight.current = true
    try {
      let rows = await repo.history(peerId)
      // Fill offline gaps and refresh receipts for the entire displayed history.
      let page = rows
      while (active.current && oldestDisplayed.current && page.length === 50 && BigInt(page[0].id) > BigInt(oldestDisplayed.current)) {
        page = await repo.history(peerId, page[0].id)
        rows = mergeMessages(page, rows)
      }
      if (!active.current) return
      if (!initialized.current) { setOlder(rows.length === 50); initialized.current = true }
      if (rows.length && !oldestDisplayed.current) oldestDisplayed.current = rows[0].id
      setMessages(previous => mergeMessages(previous, rows).filter(message => !removedMessageIds.current.has(message.id)))
      if (rows.length && document.visibilityState !== 'hidden') await repo.read(peerId, rows.at(-1).id)
      if (active.current) setError('')
    } catch { if (active.current) setError('Não foi possível atualizar a conversa. Tente novamente.') }
    finally { inFlight.current = false; if (active.current) setLoading(false) }
  }, [repo, peerId, validPeer])
  useRefresh(refresh)
  useEffect(() => { if (atBottom.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight }, [messages])
  const loadOlder = async () => {
    if (loadingOlder || !messages.length) return
    setLoadingOlder(true)
    const height = thread.current?.scrollHeight || 0
    try {
      const rows = await repo.history(peerId, messages[0].id)
      if (!active.current) return
      if (rows.length) oldestDisplayed.current = rows[0].id
      atBottom.current = false; setMessages(previous => mergeMessages(previous, rows)); setOlder(rows.length === 50)
      requestAnimationFrame(() => { if (active.current && thread.current) thread.current.scrollTop += thread.current.scrollHeight - height })
    } catch { if (active.current) setError('Não foi possível carregar as mensagens antigas.') }
    finally { if (active.current) setLoadingOlder(false) }
  }
  const send = async event => {
    event?.preventDefault()
    if (sendLock.current || !body.trim() || !profile || !validPeer) return
    sendLock.current = true; setSending(true); setError('')
    const draft = body
    try {
      if (editing) {
        const updated = await repo.editMessage(editing.id, draft)
        if (!active.current) return
        setMessages(previous => previous.map(message => message.id === editing.id ? { ...message, ...(updated || {}), body: draft.trim() } : message))
        setEditing(null); setBody('')
        return
      }
      if (!nonce.current || nonce.current.body !== draft) nonce.current = { body: draft, id: crypto.randomUUID() }
      await repo.send(peerId, draft, nonce.current.id)
      if (!active.current) return
      setBody(''); nonce.current = null; atBottom.current = true
      await refresh()
    } catch (failure) { if (active.current) setError(failure.message || 'Não foi possível enviar. Sua mensagem foi preservada.') }
    finally { sendLock.current = false; if (active.current) setSending(false) }
  }
  const actOnConversation = async action => {
    setMenu(null)
    try {
      if (action === 'unread') { await repo.markUnread(peerId); navigate('/community/messages'); return }
      if (action === 'hide') { await repo.hideConversation(peerId); navigate('/community/messages'); return }
      navigate(`/community/user/${peerId}`)
    } catch { if (active.current) setError('Não foi possível atualizar a conversa. Tente novamente.') }
  }
  const deleteMessage = async message => {
    if (removing.has(message.id)) return
    setMenu(null)
    if (!window.confirm('Apagar esta mensagem para todos?')) return
    removedMessageIds.current.add(message.id)
    setRemoving(previous => new Set(previous).add(message.id))
    try {
      await repo.deleteMessage(message.id)
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      await new Promise(resolve => setTimeout(resolve, reduceMotion ? 0 : 180))
      if (active.current) setMessages(previous => previous.filter(row => row.id !== message.id))
    } catch {
      removedMessageIds.current.delete(message.id)
      if (active.current) { setRemoving(previous => { const next = new Set(previous); next.delete(message.id); return next }); setError('Não foi possível apagar a mensagem. Tente novamente.') }
    }
  }
  const beginEdit = message => { setMenu(null); nonce.current = null; setEditing(message); setBody(message.body) }
  const cancelEdit = () => { setEditing(null); setBody(''); nonce.current = null }
  return <div className="chat-page dm-conversation"><div className="chat-header"><AppHeader title={profile?.display_name || 'Conversa'} subtitle="Mensagem privada" backTo="/community/messages" identity={<Avatar profile={profile} className="dm-header-avatar" />} action={<ActionMenu label="Ações da conversa" open={menu === 'conversation'} onToggle={() => setMenu(menu === 'conversation' ? null : 'conversation')} className="dm-conversation-menu"><button role="menuitem" onClick={() => void actOnConversation('profile')}>Ver perfil</button><button role="menuitem" onClick={() => void actOnConversation('unread')}>Marcar como não lida</button><button role="menuitem" className="dm-danger" onClick={() => void actOnConversation('hide')}>Apagar conversa</button></ActionMenu>} /></div>
    <div className="chat-thread" ref={thread} aria-label="Conversa" aria-live="polite" onScroll={() => { const el = thread.current; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
      {!validPeer && <p role="alert">Este destinatário não está disponível.</p>}
      {loading && <p role="status">Carregando conversa…</p>}
      {older && <div className="chat-load-older-row"><button className="chat-load-older-btn" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? 'Carregando…' : 'Carregar mensagens anteriores'}</button></div>}
      {!loading && validPeer && !messages.length && <p className="dm-empty">Envie a primeira mensagem para começar a conversa.</p>}
      {messages.map(message => { const own = message.sender_id === userId, kind = own ? 'user' : 'admin'; return <div key={message.id} className={`chat-bubble-row chat-bubble-row--${kind} is-first${removing.has(message.id) ? ' dm-message-removing' : ''}`}><div className={`chat-bubble chat-bubble--${kind}`}><p>{message.body}</p><time className="chat-time">{formatTime(message.created_at)}</time>{own && <span className={`chat-tick${message.read_at ? ' dm-read' : ''}`} aria-label={message.read_at ? 'Lida' : 'Enviada'}><Icon name="check" />{message.read_at && <Icon name="check" />}</span>}{own && <ActionMenu label="Ações da mensagem" open={menu === `message:${message.id}`} onToggle={() => setMenu(menu === `message:${message.id}` ? null : `message:${message.id}`)} className="dm-message-menu"><button role="menuitem" onClick={() => beginEdit(message)}>Editar mensagem</button><button role="menuitem" className="dm-danger" onClick={() => void deleteMessage(message)}>Apagar mensagem</button></ActionMenu>}</div></div> })}
    </div>
    {(error || profileError) && <div className="support-error dm-error" role="alert">{profileError || error} <button onClick={() => { void loadProfile(); void refresh() }}>Tentar novamente</button></div>}
    <form className="chat-input-bar" onSubmit={send}><div className="chat-input-col">{editing && <div className="dm-editing"><span>Editando mensagem</span><button type="button" onClick={cancelEdit}>Cancelar</button></div>}<textarea className="chat-textarea" rows={1} aria-label="Nova mensagem" placeholder="Escreva uma mensagem…" maxLength={3000} value={body} disabled={sending || !profile || !validPeer} onChange={event => setBody(event.target.value)} /></div><button className="chat-send-btn" aria-label={editing ? 'Salvar mensagem' : 'Enviar mensagem'} disabled={sending || !body.trim() || !profile || !validPeer}><Icon name={editing ? 'check' : 'send'} /></button></form>
  </div>
}
