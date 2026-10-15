import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { useDialogFocus } from '../../lib/dialog-focus.js'
import { createConsoleNotificationRepository } from './notifications.js'
import useConsoleResource from './useConsoleResource.js'
import { fmtDateTime, CxButton, Loading } from './ConsoleUI.jsx'
import { useFppAction } from '../../components/useFppAction.js'

export default function ConsoleNotifications({ userId, allowed }) {
  const repo = useMemo(() => createConsoleNotificationRepository({ client: getBrowserSupabaseClient() }), [])
  const [open, setOpen] = useState(false), [page, setPage] = useState(0), [actionError, setActionError] = useState('')
  const { data, busy, error, refresh } = useConsoleResource({ userId, allowed, resourceKey: 'notifications:' + page, load: () => repo.list({ limit: 25, offset: page * 25 }) })
  const close = () => setOpen(false)
  const dialog = useRef(null), titleId = useId()
  useDialogFocus(dialog, { active: open && !!allowed, onClose: close, titleId })
  useEffect(() => { setOpen(false); setPage(0); setActionError('') }, [userId, allowed])
  useEffect(() => {
    if (!allowed) return
    const update = () => { if (document.visibilityState !== 'hidden') refresh() }
    const timer = setInterval(update, 60000)
    window.addEventListener('focus', update)
    return () => { clearInterval(timer); window.removeEventListener('focus', update) }
  }, [allowed, refresh])
  const markAllAction = useFppAction({ onAction: async () => {
    setActionError('')
    try {
      await repo.markRead(null)
      refresh()
      return true
    } catch (failure) {
      setActionError('Não foi possível marcar as notificações. Tente novamente.')
      throw failure
    }
  } })
  if (!allowed) return null
  return <>
    <button type="button" className="console-notification-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={`Notificações da plataforma${data?.unreadCount ? `, ${data.unreadCount} não lidas` : ''}`} onClick={() => { setOpen(true); refresh() }}><Icon name="bell" />{data?.unreadCount > 0 && <span className="console-notification-badge">{data.unreadCount > 99 ? '99+' : data.unreadCount}</span>}</button>
    {open && createPortal(<div className="console-notification-overlay" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div ref={dialog} className="console-notification-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header><div><h2 id={titleId}>Notificações da plataforma</h2><p>Mensagens, cadastros e atividades do projeto.</p></div><button type="button" className="iconbtn" onClick={close} aria-label="Fechar notificações"><Icon name="xmark" /></button></header>
        <div className="console-notification-tools"><span>{data?.unreadCount || 0} não lidas</span><CxButton type="button" className="console-text-button" state={markAllAction.state} disabled={!data?.unreadCount || markAllAction.locked} onAction={markAllAction.run}>Marcar todas como lidas</CxButton></div>
        <div className="console-notification-feed">
          {(error || actionError) && <div className="cx-alert" role="alert"><span>{actionError || error}</span><button className="console-text-button" onClick={refresh}>Tentar novamente</button></div>}
          {busy ? <Loading label="Carregando notificações…" /> : !data?.items.length && !error ? <p className="console-notification-empty">Nenhuma notificação por aqui.</p> : data?.items.map(item => <Link key={item.id} to={item.targetPath} className={`console-notification-item${item.readAt ? '' : ' is-unread'}`} onClick={() => { close(); repo.markRead(item.id).then(refresh).catch(() => {}) }}>
            <span className="console-notification-dot" aria-label={item.readAt ? 'Lida' : 'Não lida'} /><span><strong>{item.title}</strong><span>{item.body}</span><time>{fmtDateTime(item.createdAt)}</time></span><Icon name="chevronRight" />
          </Link>)}
        </div>
        <footer><button type="button" className="cx-pill-btn" disabled={busy || page === 0} onClick={() => setPage(value => value - 1)}>Anteriores</button><span>Página {page + 1}</span><button type="button" className="cx-pill-btn" disabled={busy || !data?.hasMore} onClick={() => setPage(value => value + 1)}>Mais notificações</button></footer>
      </div>
    </div>, document.body)}
  </>
}
