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
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [actionError, setActionError] = useState('')
  const [manageMode, setManageMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleting, setDeleting] = useState(false)

  const identity = `${userId}:${allowed}:${page}`
  const current = useRef(identity)
  current.current = identity

  useEffect(() => {
    current.current = identity
    return () => { current.current = null }
  }, [identity])

  const { data, busy, error, refresh } = useConsoleResource({
    userId,
    allowed,
    resourceKey: 'notifications:' + page,
    load: () => repo.list({ limit: 25, offset: page * 25 }),
  })

  const close = () => {
    setOpen(false)
    setManageMode(false)
    setSelectedIds(new Set())
  }

  const dialog = useRef(null)
  const titleId = useId()
  useDialogFocus(dialog, { active: open && !!allowed, onClose: close, titleId })

  useEffect(() => {
    setOpen(false)
    setPage(0)
    setActionError('')
    setManageMode(false)
    setSelectedIds(new Set())
  }, [userId, allowed])

  useEffect(() => {
    if (!allowed) return
    const update = () => {
      if (document.visibilityState !== 'hidden') refresh()
    }
    const timer = setInterval(update, 60000)
    window.addEventListener('focus', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [allowed, refresh])

  const markAllAction = useFppAction({
    onAction: async () => {
      setActionError('')
      try {
        await repo.markRead(null)
        if (current.current !== identity) return false
        return { identity }
      } catch (failure) {
        if (current.current === identity) setActionError('Não foi possível marcar as notificações. Tente novamente.')
        throw failure
      }
    },
    onSuccess: result => {
      if (current.current === result.identity) refresh()
    },
  })

  const items = data?.items || []
  const allSelected = items.length > 0 && items.every(item => selectedIds.has(item.id))

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(item => item.id)))
    }
  }

  const toggleSelect = id => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.size || deleting) return
    const ids = Array.from(selectedIds)
    if (!window.confirm(`Excluir ${ids.length} notificação(ões) selecionada(s)?`)) return
    setDeleting(true)
    setActionError('')
    try {
      await repo.deleteNotifications(ids)
      setSelectedIds(new Set())
      refresh()
    } catch {
      setActionError('Erro ao excluir notificações selecionadas.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteSingle = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    setActionError('')
    try {
      await repo.deleteNotifications([id])
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      refresh()
    } catch {
      setActionError('Erro ao excluir notificação.')
    }
  }

  if (!allowed) return null

  return (
    <>
      <button
        type="button"
        className="console-notification-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notificações da plataforma${data?.unreadCount ? `, ${data.unreadCount} não lidas` : ''}`}
        onClick={() => {
          setOpen(true)
          refresh()
        }}
      >
        <Icon name="bell" />
        {data?.unreadCount > 0 && (
          <span className="console-notification-badge">
            {data.unreadCount > 99 ? '99+' : data.unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            className="console-notification-overlay"
            onClick={e => {
              if (e.target === e.currentTarget) close()
            }}
          >
            <div
              ref={dialog}
              className="console-notification-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
            >
              <header>
                <div>
                  <h2 id={titleId}>Notificações da plataforma</h2>
                  <p>Mensagens, cadastros e atividades do projeto.</p>
                </div>
                <button
                  type="button"
                  className="iconbtn"
                  onClick={close}
                  aria-label="Fechar notificações"
                >
                  <Icon name="xmark" />
                </button>
              </header>

              <div className="console-notification-tools">
                <span>{data?.unreadCount || 0} não lidas</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    className="console-text-button"
                    onClick={() => {
                      setManageMode(prev => !prev)
                      setSelectedIds(new Set())
                    }}
                    style={{ fontWeight: manageMode ? 600 : 'normal' }}
                  >
                    {manageMode ? 'Cancelar seleção' : 'Gerenciar / Excluir'}
                  </button>
                  <CxButton
                    type="button"
                    className="console-text-button"
                    state={markAllAction.state}
                    disabled={!data?.unreadCount || markAllAction.locked}
                    onClick={markAllAction.run}
                  >
                    Marcar todas como lidas
                  </CxButton>
                </div>
              </div>

              {/* Barra retrátil de seleção e exclusão */}
              {manageMode && items.length > 0 && (
                <div className="console-notification-manage-bar">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="console-notification-checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Selecionar todas as notificações da página"
                    />
                    <span>{selectedIds.size > 0 ? `${selectedIds.size} selecionada(s)` : 'Selecionar todas'}</span>
                  </label>
                  <div className="console-notification-manage-tools">
                    <button
                      type="button"
                      className="console-bulk-btn console-bulk-btn--danger"
                      disabled={!selectedIds.size || deleting}
                      onClick={handleDeleteSelected}
                      title="Excluir notificações selecionadas"
                    >
                      <Icon name="trash" size={14} /> Excluir selecionadas
                    </button>
                  </div>
                </div>
              )}

              <div className="console-notification-feed">
                {(error || actionError) && (
                  <div className="cx-alert" role="alert">
                    <span>{actionError || error}</span>
                    <button className="console-text-button" onClick={refresh}>
                      Tentar novamente
                    </button>
                  </div>
                )}

                {busy ? (
                  <Loading label="Carregando notificações…" />
                ) : !items.length && !error ? (
                  <p className="console-notification-empty">Nenhuma notificação por aqui.</p>
                ) : (
                  items.map(item => {
                    const isSelected = selectedIds.has(item.id)
                    return (
                      <div
                        key={item.id}
                        className={`console-notification-item-wrap ${isSelected ? 'is-selected' : ''}`}
                      >
                        {manageMode && (
                          <input
                            type="checkbox"
                            className="console-notification-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            aria-label={`Selecionar notificação ${item.title}`}
                          />
                        )}
                        <Link
                          to={item.targetPath}
                          className={`console-notification-item${item.readAt ? '' : ' is-unread'}`}
                          onClick={() => {
                            close()
                            repo.markRead(item.id).then(refresh).catch(() => {})
                          }}
                        >
                          <span
                            className="console-notification-dot"
                            aria-label={item.readAt ? 'Lida' : 'Não lida'}
                          />
                          <span>
                            <strong>{item.title}</strong>
                            <span>{item.body}</span>
                            <time>{fmtDateTime(item.createdAt)}</time>
                          </span>
                          <Icon name="chevronRight" />
                        </Link>
                        {manageMode && (
                          <button
                            type="button"
                            className="console-notification-quick-delete"
                            title="Excluir notificação"
                            onClick={e => handleDeleteSingle(e, item.id)}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <footer>
                <button
                  type="button"
                  className="cx-pill-btn"
                  disabled={busy || page === 0}
                  onClick={() => setPage(value => value - 1)}
                >
                  Anteriores
                </button>
                <span>Página {page + 1}</span>
                <button
                  type="button"
                  className="cx-pill-btn"
                  disabled={busy || !data?.hasMore}
                  onClick={() => setPage(value => value + 1)}
                >
                  Mais notificações
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
