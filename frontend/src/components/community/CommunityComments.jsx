import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Icon from '../Icon.jsx'
import { useDialogFocus } from '../../lib/dialog-focus.js'
import { usePageScrollLock } from '../../lib/page-scroll-lock.js'

const PAGE_SIZE = 10

// Requests outlive an open sheet. Keep the guard for the authenticated client
// so reopening cannot send an opposite operation before the first one settles.
const pendingByClient = new WeakMap()
function pendingComments(client, userId) {
  if (!pendingByClient.has(client)) pendingByClient.set(client, new Map())
  const users = pendingByClient.get(client)
  if (!users.has(userId)) users.set(userId, new Set())
  return users.get(userId)
}

const fmtDate = value => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
export function commentDescendants(comments, id) {
  const ids = new Set([id]); let changed = true
  while (changed) { changed = false; for (const comment of comments) if (ids.has(comment.parent_comment_id) && !ids.has(comment.id)) { ids.add(comment.id); changed = true } }
  return ids
}

export default function CommunityComments({ post, client, userId, ownIdentity, onClose, onSubmit, onCommentsChange, onOpenUser, onReport, highlightCommentId = null, AvatarComponent: Avatar }) {
  const comments = post.comments || []
  const [body, setBody] = useState(''), [replyTo, setReplyTo] = useState(null), [editing, setEditing] = useState(null)
  const [menu, setMenu] = useState(null), [highlight, setHighlight] = useState(null), [expanded, setExpanded] = useState(() => new Set())
  const [error, setError] = useState(''), [sending, setSending] = useState(false)
  const [visibleCount,setVisibleCount] = useState(PAGE_SIZE), [replyCounts,setReplyCounts] = useState({})
  const [submittedIds,setSubmittedIds] = useState(() => new Set())
  const roots = comments.filter(item => !item.parent_comment_id)
  const input = useRef(null), dialog = useRef(null), pending = useRef(pendingComments(client, userId)), sendingRef = useRef(false), timer = useRef(null)
  useDialogFocus(dialog, { onClose, locked: sending, titleId: 'community-comments-title' })
  usePageScrollLock()
  const change = updater => onCommentsChange(post.id, updater)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const removedReply = replyTo && !comments.some(comment => comment.id === replyTo.id)
    const removedEdit = editing && !comments.some(comment => comment.id === editing.id)
    if (removedReply) setReplyTo(null)
    if (removedEdit) setEditing(null)
    if (removedReply || removedEdit) setError('Este comentário foi excluído. Seu texto foi mantido para você escolher onde enviá-lo.')
  }, [comments, replyTo, editing])
  useEffect(() => {
    if (!highlightCommentId) return
    const target = comments.find(comment => comment.id === highlightCommentId)
    if (!target) return
    setHighlight(target.id)
    // A direct link must reveal the target even when it belongs to a later page.
    let ancestor=target
    const visited=new Set(), counts={}
    while (ancestor?.parent_comment_id && !visited.has(ancestor.id)) {
      visited.add(ancestor.id)
      const siblings=comments.filter(item=>item.parent_comment_id===ancestor.parent_comment_id)
      counts[ancestor.parent_comment_id]=Math.ceil((siblings.findIndex(item=>item.id===ancestor.id)+1)/PAGE_SIZE)*PAGE_SIZE
      ancestor=comments.find(item=>item.id===ancestor.parent_comment_id)
    }
    if (ancestor) setVisibleCount(count=>Math.max(count,Math.ceil((roots.findIndex(item=>item.id===ancestor.id)+1)/PAGE_SIZE)*PAGE_SIZE))
    setReplyCounts(previous=>({...previous,...counts}))
    setExpanded(previous => {
      const next = new Set(previous); let parent = target.parent_comment_id
      while (parent && !next.has(parent)) { next.add(parent); parent = comments.find(comment => comment.id === parent)?.parent_comment_id }
      return next
    })
    requestAnimationFrame(() => document.querySelector(`[data-community-comment-id="${target.id}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }))
  }, [comments, highlightCommentId])
  useEffect(() => {
    if (!menu) return
    const close = event => { if (!event.target.closest?.('.community-comment-menu')) setMenu(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menu])
  const selectReply = comment => {
    if (sendingRef.current) return
    input.current?.focus({ preventScroll: true })
    setEditing(null); setReplyTo(comment); setHighlight(comment.id)
    setExpanded(previous => new Set(previous).add(comment.id))
    clearTimeout(timer.current); timer.current = setTimeout(() => setHighlight(null), 4400)
    requestAnimationFrame(() => document.querySelector(`[data-community-comment-id="${comment.id}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }))
  }
  const toggleLike = async comment => {
    if (pending.current.has(comment.id) || comment.pending) return
    pending.current.add(comment.id); setError('')
    const previousLike = comment.likes?.find(item => item.user_id === userId), liked = Boolean(previousLike)
    change(items => items.map(item => item.id === comment.id ? { ...item, likes: [...(item.likes || []).filter(like => like.user_id !== userId), ...(liked ? [] : [{ user_id: userId }])] } : item))
    try {
      const result = liked ? await client.from('community_comment_likes').delete().match({ comment_id: comment.id, user_id: userId }) : await client.from('community_comment_likes').insert({ comment_id: comment.id, user_id: userId })
      if (result.error) throw result.error
    } catch (failure) { change(items => items.map(item => item.id === comment.id ? { ...item, likes: [...(item.likes || []).filter(like => like.user_id !== userId), ...(previousLike ? [previousLike] : [])] } : item)); setError(failure.message) }
    finally { pending.current.delete(comment.id) }
  }
  const remove = async comment => {
    if (sendingRef.current || pending.current.has(comment.id)) return
    pending.current.add(comment.id); setMenu(null); setError('')
    try {
      const result = await client.from('community_comments').delete().eq('id', comment.id).eq('author_id', userId)
      if (result.error) throw result.error
      change(items => { const ids = commentDescendants(items, comment.id); return items.filter(item => !ids.has(item.id)) })
      const removedIds = commentDescendants(comments, comment.id)
      if (replyTo && removedIds.has(replyTo.id)) setReplyTo(null)
      if (editing && removedIds.has(editing.id)) { setEditing(null); setBody('') }
    } catch (failure) { setError(failure.message) }
    finally { pending.current.delete(comment.id) }
  }
  const submit = async event => {
    event.preventDefault(); const text = body.trim()
    if (!text || text.length > 500 || sendingRef.current || post.comments_disabled) return
    if ((editing && !comments.some(comment => comment.id === editing.id)) || (replyTo && !comments.some(comment => comment.id === replyTo.id))) {
      setEditing(null); setReplyTo(null); setError('Este comentário foi excluído. Seu texto foi mantido para você escolher onde enviá-lo.'); return
    }
    sendingRef.current = true; setSending(true); setError(''); input.current?.blur()
    let optimisticId
    try {
      if (editing) {
        const result = await client.from('community_comments').update({ body: text }).eq('id', editing.id).eq('author_id', userId)
        if (result.error) throw result.error
        change(items => items.map(item => item.id === editing.id ? { ...item, body: text } : item))
        setEditing(null)
      } else {
        optimisticId = `local-${crypto.randomUUID()}`
        setSubmittedIds(ids=>new Set(ids).add(optimisticId))
        const optimistic = { id: optimisticId, post_id: post.id, author_id: userId, author: ownIdentity, body: text, parent_comment_id: replyTo?.id || null, created_at: new Date().toISOString(), likes: [], pending: true }
        change(items => [...items, optimistic])
        const result = await onSubmit(post, text, replyTo?.id || null)
        if (result?.error || !result?.comment) throw result?.error || Error('Não foi possível enviar o comentário.')
        setSubmittedIds(ids=>new Set(ids).add(result.comment.id))
        change(items => [...items.filter(item => item.id !== optimisticId && item.id !== result.comment.id), result.comment])
      }
      setBody(''); setReplyTo(null)
    } catch (failure) {
      if (optimisticId) change(items => items.filter(item => item.id !== optimisticId))
      setError(failure.message || 'Não foi possível salvar. Tente novamente.')
    } finally { sendingRef.current = false; setSending(false) }
  }
  const renderThread = (comment, ancestors = new Set()) => {
    if (ancestors.has(comment.id)) return null
    const next = new Set(ancestors).add(comment.id)
    const replies = comments.filter(item => item.parent_comment_id === comment.id)
    const liked = comment.likes?.some(like => like.user_id === userId)
    return <div className={`community-comment-thread${comment.parent_comment_id ? ' community-comment-thread--nested' : ''}`} key={comment.id}>
      <div data-community-comment-id={comment.id} className={`community-comment-row${highlight === comment.id ? ' is-reply-target' : ''}`}>
        <button className="community-comment-author-link" onClick={() => onOpenUser(comment.author_id)} aria-label={`Abrir perfil de ${comment.author?.display_name}`}><Avatar profile={comment.author} size="sm" /></button>
        <div className="community-comment-content"><div className="community-comment-heading"><button className="community-comment-name-link" onClick={() => onOpenUser(comment.author_id)}>{comment.author?.display_name || 'Usuário'}</button>
          {!comment.pending && <div className="community-comment-menu"><button disabled={sending} className="community-comment-more" aria-label="Opções do comentário" aria-expanded={menu === comment.id} onClick={() => setMenu(menu === comment.id ? null : comment.id)}>•••</button>{menu === comment.id && <div className="community-comment-menu-actions">{comment.author_id === userId ? <><button disabled={sending} onClick={() => { if (sendingRef.current) return; input.current?.focus(); setEditing(comment); setReplyTo(null); setBody(comment.body); setMenu(null) }}>Editar</button><button disabled={sending} onClick={() => remove(comment)}>Excluir</button></> : <button disabled={sending} onClick={event => { const returnFocus = event.currentTarget.closest('.community-comment-menu')?.querySelector('.community-comment-more'); setMenu(null); onReport?.(comment, returnFocus) }}>Denunciar</button>}</div>}</div>}
        </div><small>{comment.pending ? 'Enviando…' : fmtDate(comment.created_at)}</small><p>{comment.body}</p><div className="community-comment-actions"><button disabled={comment.pending} aria-label={liked ? 'Remover curtida do comentário' : 'Curtir comentário'} aria-pressed={liked} className={liked ? 'is-liked' : ''} onClick={() => toggleLike(comment)}><Icon name="heart" /> {comment.likes?.length || 0}</button><button disabled={sending || comment.pending || post.comments_disabled} onClick={() => selectReply(comment)}>Responder</button></div></div>
      </div>
      {replies.length > 0 && <button className="community-reply-toggle" onClick={() => setExpanded(previous => { const result = new Set(previous); result.has(comment.id) ? result.delete(comment.id) : result.add(comment.id); return result })}>{expanded.has(comment.id) ? 'Ocultar' : 'Ver'} {replies.length} resposta{replies.length === 1 ? '' : 's'}</button>}
      {expanded.has(comment.id) && <>{replies.filter((reply,index)=>index<(replyCounts[comment.id] || PAGE_SIZE) || submittedIds.has(reply.id)).map(reply => renderThread(reply, next))}
      {replies.length>(replyCounts[comment.id] || PAGE_SIZE) && <button className="community-comments-more" onClick={()=>setReplyCounts(counts=>({...counts,[comment.id]:(counts[comment.id] || PAGE_SIZE)+PAGE_SIZE}))}>Carregar mais respostas</button>}</>}
    </div>
  }
  return <div className="community-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}><motion.div ref={dialog} role="dialog" aria-modal="true" aria-label="Comentários" className="community-sheet community-comments-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}>
    <div className="community-sheet-handle" /><div className="community-sheet-title"><h2 id="community-comments-title">Comentários</h2><button aria-label="Fechar comentários" onClick={onClose}><Icon name="xmark" /></button></div>
    <div className="community-comments-scroll">{roots.filter((item,index)=>index<visibleCount || submittedIds.has(item.id)).map(item => renderThread(item))}
      {roots.length>visibleCount && <button className="community-comments-more" onClick={()=>setVisibleCount(count=>count+PAGE_SIZE)}>Carregar mais comentários</button>}
      {!comments.length && <p className="community-comments-empty">Ainda não há comentários.</p>}
    </div>
    {replyTo && <div className="community-replying">Respondendo a <strong>{replyTo.author?.display_name}</strong><button disabled={sending} onClick={() => { if (!sendingRef.current) setReplyTo(null) }}>Cancelar</button></div>}
    {editing && <div className="community-replying">Editando seu comentário<button disabled={sending} onClick={() => { if (sendingRef.current) return; setEditing(null); setBody('') }}>Cancelar</button></div>}
    {error && <div className="community-error" role="alert">{error}</div>}
    <form className="community-comment-form" onSubmit={submit}><label className="sr-only" htmlFor="community-comment-body">Comentário</label><textarea id="community-comment-body" ref={input} value={body} rows={1} onChange={event => { setBody(event.target.value); event.target.style.height = 'auto'; event.target.style.height = event.target.scrollHeight + 'px' }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); event.stopPropagation() } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (!sending && body.trim() && !post.comments_disabled) submit(event) } }} maxLength={500} disabled={sending || post.comments_disabled} placeholder={post.comments_disabled ? 'Comentários bloqueados' : replyTo ? `Respondendo a ${replyTo.author?.display_name}…` : 'Escreva um comentário…'} /><button disabled={sending || !body.trim() || post.comments_disabled} aria-label={editing ? 'Salvar comentário' : 'Enviar comentário'}><Icon name="send" /></button></form>
  </motion.div></div>
}
