import { pageScrollY } from '../lib/page-scroll-lock.js'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useStore } from '../store/useStore.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { avatarSrc, isAvatarId } from '../lib/avatars.js'
import { resolveCommunityIdentity, hydrateCommunityPost, COMMUNITY_PROFILE_FIELDS } from '../lib/community-identity.js'
import { communityFeedSession, COMMUNITY_POST_SELECT, COMMUNITY_COMMENT_SELECT } from '../lib/community-feed.js'
import { acquireUpdateBlocker } from '../lib/reload-safety.js'
import { communityNotificationDetail, communityNotificationTarget } from '../lib/community-notifications.js'
import { useDialogFocus } from '../lib/dialog-focus.js'
import Icon from '../components/Icon.jsx'
import CommunityComments from '../components/community/CommunityComments.jsx'
import CommunityReportDialog from '../components/community/CommunityReportDialog.jsx'
import CommunityPostMedia, { CommunityImage, CommunityPostSkeleton, communityStoragePath } from '../components/community/CommunityPostMedia.jsx'
import CommunityCropEditor, { cropCommunityImage, useFilePreview } from '../components/community/CommunityComposerMedia.jsx'
import MessageButton from '../components/community/MessageButton.jsx'
import './direct-messages.css'
import './community.css'

const BUCKET = 'community-posts'
const fmtDate = value => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
function Avatar({ profile, size = 'md' }) {
  const avatar = profile?.avatar_ref
  const src = isAvatarId(avatar) ? avatarSrc(avatar) : /^(https:\/\/|data:image\/|blob:)/.test(avatar || '') ? avatar : null
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return src && !failed ? <img className={`community-avatar community-avatar--${size}`} src={src} alt="" onError={() => setFailed(true)} /> : <span className={`community-avatar community-avatar--${size}`}>{(profile?.display_name || '?').slice(0, 1).toUpperCase()}</span>
}

export default function Community() {
  const { user } = useAuth()
  return <CommunitySession key={user?.id || 'guest'} />
}

function CommunitySession() {
  const auth = useAuth(), navigate = useNavigate(), location = useLocation(), client = getBrowserSupabaseClient()
  const userId = auth.user?.id
  const profileMode = location.pathname === '/community/profile'
  const viewedUserId = location.pathname.match(/^\/community\/user\/([^/]+)$/)?.[1] || (profileMode ? userId : null)
  const scope = viewedUserId || 'feed'
  const localProfile = useStore(state => state.S.profile)
  const localScope = useStore.getState().getActiveLocalScope()
  const store = useMemo(() => communityFeedSession(client, userId), [client, userId])
  const page = useSyncExternalStore(store.subscribe, useCallback(() => store.snapshot(scope), [store, scope]))
  const [publicOwn, setPublicOwn] = useState(null), [viewedProfile, setViewedProfile] = useState(null), [viewedProfileState, setViewedProfileState] = useState('idle')
  const ownIdentity = useMemo(() => resolveCommunityIdentity({ userId, publicProfile: publicOwn, localProfile: localScope?.userId === userId ? localProfile : null, authUser: auth.user }), [userId, publicOwn, localProfile, localScope, auth.user])
  const posts = useMemo(() => page.posts.map(post => hydrateCommunityPost(post, ownIdentity)), [page.posts, ownIdentity])
  const [error, setError] = useState(''), [commentsId, setCommentsId] = useState(null), [highlightedPostId, setHighlightedPostId] = useState(null), [highlightCommentId, setHighlightCommentId] = useState(null), [notificationsOpen, setNotificationsOpen] = useState(false), [reportTarget, setReportTarget] = useState(null)
  const commentsPost = posts.find(post => post.id === commentsId)
  const [notifications, setNotifications] = useState([]), [composerOpen, setComposerOpen] = useState(false), [editingPost, setEditingPost] = useState(null)
  const [file, setFile] = useState(null), [caption, setCaption] = useState(''), [commentsDisabled, setCommentsDisabled] = useState(false)
  const [saving, setSaving] = useState(false), [pendingPost, setPendingPost] = useState(false), [cropConfirmed, setCropConfirmed] = useState(false), [composerExpanded, setComposerExpanded] = useState(false)
  const [crop, setCrop] = useState({ aspect: 'landscape', x: 50, y: 50 }), [activeMenuId, setActiveMenuId] = useState(null), [blockedNoticeId, setBlockedNoticeId] = useState(null)
  const [showFeedTop, setShowFeedTop] = useState(false), [likeAnimations, setLikeAnimations] = useState([])
  const fileInput = useRef(null), sentinel = useRef(null), composerDialog = useRef(null), notificationsDialog = useRef(null), pendingLikes = useRef(new Set()), savingRef = useRef(false), currentUser = useRef(userId), noticeTimer = useRef(null)
  currentUser.current = userId
  const preview = useFilePreview(file)
  const blockUpdates = Boolean(composerOpen || commentsId || reportTarget || pendingPost || saving)
  const mutatePost = (id, updater) => store.updatePost(id, updater)
  const changeComments = (id, updater) => mutatePost(id, post => ({ ...post, comments: updater(post.comments || []) }))
  const closeComposer = () => { if (savingRef.current) return; setComposerOpen(false); setEditingPost(null); setFile(null); setCaption('') }

  useDialogFocus(composerDialog, { active: composerOpen, onClose: closeComposer, locked: saving, titleId: 'community-composer-title' })
  useDialogFocus(notificationsDialog, { active: notificationsOpen, onClose: () => setNotificationsOpen(false), titleId: 'community-notifications-title' })

  useEffect(() => () => { currentUser.current = null; clearTimeout(noticeTimer.current) }, [])

  useEffect(() => {
    if (!client || !userId) return
    let cancelled = false
    client.from('profiles').select(COMMUNITY_PROFILE_FIELDS).eq('id', userId).maybeSingle().then(({ data }) => { if (!cancelled) setPublicOwn(data) }).catch(() => {})
    return () => { cancelled = true }
  }, [client, userId])
  useEffect(() => {
    setCommentsId(null); setActiveMenuId(null); setViewedProfile(null); setViewedProfileState(viewedUserId ? 'loading' : 'idle'); setError('')
    if (!client || !userId) return
    let cancelled = false
    if (!store.snapshot(scope).initialized) void store.load(scope)
    if (viewedUserId) client.from('profiles').select(COMMUNITY_PROFILE_FIELDS).eq('id', viewedUserId).maybeSingle().then(({ data, error: failure }) => {
      if (!cancelled) {
        setViewedProfile(data)
        setViewedProfileState(data || viewedUserId === userId ? 'ready' : 'unavailable')
        if (failure) setError('Não foi possível carregar este perfil.')
      }
    }).catch(() => { if (!cancelled) { setViewedProfileState('unavailable'); setError('Não foi possível carregar este perfil.') } })
    const position = store.snapshot(scope).scrollY
    const frame = requestAnimationFrame(() => window.scrollTo(0, position))
    const onScroll = () => { store.saveScroll(scope, pageScrollY()); setShowFeedTop(pageScrollY() > 280) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelled = true; cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll) }
  }, [client, userId, scope, viewedUserId, store])
  useEffect(() => {
    if (!sentinel.current || !userId || typeof IntersectionObserver === 'undefined' || page.error || page.loading || !page.hasMore) return
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void store.load(scope) }, { rootMargin: '500px 0px' })
    observer.observe(sentinel.current); return () => observer.disconnect()
  }, [store, scope, userId, page.loading, page.hasMore, page.error])
  useEffect(() => {
    if (!activeMenuId) return
    const close = event => { if (!event.target.closest?.('.community-post-menu')) setActiveMenuId(null) }
    document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close)
  }, [activeMenuId])
  useEffect(() => {
    if (blockUpdates) return acquireUpdateBlocker()
  }, [blockUpdates])

  const loadNotifications = useCallback(async () => {
    if (!client || !userId || document.visibilityState === 'hidden') return
    try {
      const { data, error: failure } = await client.from('community_notifications').select('*,actor:profiles!community_notifications_actor_id_fkey(id,display_name,avatar_ref)').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(30)
      if (!failure && currentUser.current === userId) setNotifications(data || [])
    } catch { /* Preserve the last successful list while reconnecting. */ }
  }, [client, userId])
  useEffect(() => {
    setNotifications([]); void loadNotifications()
    if (!client || !userId) return
    const channel = client.channel?.(`community-notifications:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'community_notifications', filter: `recipient_id=eq.${userId}` }, loadNotifications).subscribe()
    const interval = setInterval(loadNotifications, 30000)
    window.addEventListener('online', loadNotifications); document.addEventListener('visibilitychange', loadNotifications)
    return () => { clearInterval(interval); if (channel) client.removeChannel(channel); window.removeEventListener('online', loadNotifications); document.removeEventListener('visibilitychange', loadNotifications) }
  }, [client, userId, loadNotifications])
  // Keep open comments current, without replacing pending interactions or reordering the feed.
  useEffect(() => {
    if (!commentsId || !client) return
    let cancelled = false, busy = false
    const refresh = async () => {
      if (cancelled || busy || document.visibilityState === 'hidden') return
      const before = store.snapshot(scope).posts.find(post => post.id === commentsId)
      if (!before || before.comments?.some(comment => comment.pending)) return
      busy = true
      try {
        const { data, error: failure } = await client.from('community_posts').select(COMMUNITY_POST_SELECT).eq('id', commentsId).maybeSingle()
        if (!cancelled && !failure && data) store.updatePost(commentsId, current => current === before ? data : current)
      } catch { /* A later refresh will retry. */ } finally { busy = false }
    }
    void refresh(); const interval = setInterval(refresh, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [client, commentsId, scope, store])
  useEffect(() => {
    const query = new URLSearchParams(location.search), postId = query.get('post'), commentId = query.get('comment')
    if (!postId || !client || !userId) return
    let cancelled = false
    client.from('community_posts').select(COMMUNITY_POST_SELECT).eq('id', postId).maybeSingle().then(({ data, error: failure }) => {
      if (cancelled) return
      if (failure || !data) { setError('Esta postagem não está mais disponível.'); return }
      store.addPost(data); setHighlightedPostId(data.id); setHighlightCommentId(commentId); setCommentsId(commentId ? data.id : null)
      requestAnimationFrame(() => window.scrollTo({ top: 0 }))
    }).catch(() => { if (!cancelled) setError('Não foi possível abrir esta postagem.') })
    return () => { cancelled = true }
  }, [location.search, client, userId, scope, store])

  const notify = async (recipient, type, postId, commentId = null) => {
    if (!recipient || recipient === userId) return
    try { await client.from('community_notifications').insert({ recipient_id: recipient, actor_id: userId, type, post_id: postId, comment_id: commentId }) } catch { /* Do not undo a saved interaction if notification delivery fails. */ }
  }
  const toggleLike = async (post, likeOnly = false) => {
    if (pendingLikes.current.has(post.id) || (likeOnly && post.likes?.some(like => like.user_id === userId))) return
    pendingLikes.current.add(post.id); setError('')
    const likes = post.likes || [], liked = likes.some(like => like.user_id === userId)
    mutatePost(post.id, current => ({ ...current, likes: [...(current.likes || []).filter(like => like.user_id !== userId), ...(!liked ? [{ user_id: userId, user: ownIdentity }] : [])] }))
    if (!liked) { const id = crypto.randomUUID(); setLikeAnimations(items => [...items, { id, postId: post.id }]); setTimeout(() => setLikeAnimations(items => items.filter(item => item.id !== id)), 1500) }
    try {
      const result = liked ? await client.from('community_likes').delete().match({ post_id: post.id, user_id: userId }) : await client.from('community_likes').insert({ post_id: post.id, user_id: userId })
      if (result.error) throw result.error
      if (!liked) void notify(post.author_id, 'like', post.id)
    } catch (failure) { mutatePost(post.id, current => ({ ...current, likes: [...(current.likes || []).filter(like => like.user_id !== userId), ...likes.filter(like => like.user_id === userId)] })); setError(failure.message) }
    finally { pendingLikes.current.delete(post.id) }
  }
  const submitComment = async (post, body, parentId) => {
    if (post.comments_disabled) return { error: Error('Os comentários estão bloqueados.') }
    try {
      const { data, error: failure } = await client.from('community_comments').insert({ post_id: post.id, author_id: userId, body: body.trim(), parent_comment_id: parentId }).select(COMMUNITY_COMMENT_SELECT).single()
      if (failure) throw failure
      const comment = { ...data, author: ownIdentity }
      const recipients = new Set([post.author_id, post.comments?.find(item => item.id === parentId)?.author_id])
      for (const recipient of recipients) void notify(recipient, 'comment', post.id, comment.id)
      return { comment }
    } catch (failure) { return { error: failure } }
  }
  const chooseFile = event => {
    const next = event.target.files?.[0]; event.target.value = ''
    if (!next || savingRef.current) return
    if (!next.type.startsWith('image/')) { setError('Escolha um arquivo de imagem.'); return }
    setEditingPost(null); setCaption(''); setCommentsDisabled(false); setError(''); setFile(next); setCrop({ aspect: 'landscape', x: 50, y: 50 }); setCropConfirmed(false); setComposerExpanded(false); setComposerOpen(true)
  }
  const confirmCrop = async () => {
    if (!file || savingRef.current) return
    savingRef.current = true; setSaving(true); setError('')
    try { setFile(await cropCommunityImage(file, crop)); setCropConfirmed(true) } catch (failure) { setError(failure.message) }
    finally { savingRef.current = false; setSaving(false) }
  }
  const publish = async event => {
    event.preventDefault()
    if (savingRef.current || (!editingPost && (!file || !cropConfirmed))) return
    savingRef.current = true; setSaving(true); setError('')
    let uploadedPath = null, inserted = false
    try {
      if (editingPost) {
        const patch = { caption: caption.trim(), comments_disabled: commentsDisabled }
        const result = await client.from('community_posts').update(patch).eq('id', editingPost.id).eq('author_id', userId)
        if (result.error) throw result.error
        mutatePost(editingPost.id, current => ({ ...current, ...patch }))
      } else {
        setPendingPost(true)
        uploadedPath = `${userId}/${crypto.randomUUID()}.jpg`
        const upload = await client.storage.from(BUCKET).upload(uploadedPath, file, { contentType: 'image/jpeg', upsert: false })
        if (upload.error) throw upload.error
        const result = await client.from('community_posts').insert({ author_id: userId, image_path: uploadedPath, caption: caption.trim(), comments_disabled: false }).select().single()
        if (result.error) throw result.error
        inserted = true
        store.addPost({ ...result.data, author: ownIdentity, comments: [], likes: [] })
        store.saveScroll('feed', 0)
        if (scope !== 'feed') navigate('/community')
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
      }
      setComposerOpen(false); setEditingPost(null); setFile(null); setCaption('')
    } catch (failure) {
      if (uploadedPath && !inserted) { try { await client.storage.from(BUCKET).remove([uploadedPath]) } catch { /* surfaced publication error remains retryable */ } }
      setError(failure.message || 'Não foi possível publicar. Tente novamente.')
    } finally { savingRef.current = false; setSaving(false); setPendingPost(false) }
  }
  const removePost = async post => {
    if (!window.confirm('Excluir esta postagem?')) return
    try {
      const result = await client.from('community_posts').delete().eq('id', post.id).eq('author_id', userId)
      if (result.error) throw result.error
      store.removePost(post.id); setActiveMenuId(null)
      const path = communityStoragePath(post.image_path)
      if (path?.startsWith(`${userId}/`)) {
        const removed = await client.storage.from(BUCKET).remove([path])
        if (removed.error) setError('Postagem excluída. Não foi possível remover o arquivo da foto agora.')
      }
    } catch (failure) { setError(failure.message) }
  }
  const openEdit = post => { setEditingPost(post); setFile(null); setCaption(post.caption || ''); setCommentsDisabled(post.comments_disabled); setCropConfirmed(true); setError(''); setComposerOpen(true); setActiveMenuId(null) }
  const openUser = id => { if (id) { store.saveScroll(scope, pageScrollY()); setCommentsId(null); navigate(id === userId ? '/community/profile' : `/community/user/${id}`) } }
  const markRead = async () => {
    setNotificationsOpen(true)
    const ids = notifications.filter(item => !item.read_at).map(item => item.id)
    if (!ids.length) return
    try {
      const read_at = new Date().toISOString(), result = await client.from('community_notifications').update({ read_at }).eq('recipient_id', userId).in('id', ids)
      if (result.error) throw result.error
      setNotifications(items => items.map(item => ids.includes(item.id) ? { ...item, read_at } : item))
    } catch { setError('Não foi possível marcar as notificações como lidas.') }
  }
  const ownLoadedPostCount = posts.filter(post => post.author_id === userId).length
  if (!userId || !client) return <div className="community-empty">Entre na sua conta para acessar a Comunidade.</div>
  return <div className="community-view page-scenery">
    {showFeedTop && <button className="community-feed-top" aria-label="Voltar ao topo e atualizar o feed" onClick={() => { store.saveScroll(scope, 0); window.scrollTo({ top: 0, behavior: 'smooth' }); void store.load(scope, true) }}>↑</button>}
    <header className="community-topbar"><div><p className="community-kicker">FIT PRO PLAYER</p><h1>Comunidade</h1><p className="community-intro">Treinos, conquistas e conversas que mantêm o ritmo.</p></div><div className="community-topbar-actions"><input ref={fileInput} className="community-file-input" type="file" accept="image/*" onChange={chooseFile} /><button className="community-primary-action community-topbar-publish" onClick={() => fileInput.current?.click()}><Icon name="camera" /><span>Nova postagem</span></button><MessageButton client={client} userId={userId} /><button className="community-notifications" aria-label="Notificações" onClick={markRead}><Icon name="bell" />{notifications.some(item => !item.read_at) && <b>Novas notificações</b>}</button><div className="community-profile-tools"><button className="community-profile-button" aria-label="Meu perfil" onClick={() => openUser(userId)}><Avatar profile={ownIdentity} /></button></div></div></header>
    <div className="community-layout"><main className="community-feed" aria-label="Feed da comunidade">
      {viewedUserId && <section className="community-profile-heading">{viewedProfileState === 'unavailable' ? <><strong>Este perfil não está disponível.</strong><button className="community-profile-back" onClick={() => navigate('/community')}>Voltar para a comunidade</button></> : <><Avatar profile={viewedUserId === userId ? ownIdentity : viewedProfile} size="sm" /><div><p>{viewedUserId === userId ? 'Seu perfil' : 'Perfil'}</p><strong>{viewedUserId === userId ? ownIdentity.display_name : viewedProfile?.display_name || 'Carregando perfil…'}</strong></div><span className="community-profile-actions"><button className="community-profile-back" onClick={() => navigate('/community')}><Icon name="chevronLeft" /> Voltar</button>{viewedUserId !== userId && <button className="dm-profile-message" aria-label="Enviar mensagem" onClick={() => navigate(`/community/messages/${viewedUserId}`)}><Icon name="message" /></button>}</span></>}</section>}
      {!viewedUserId && <button type="button" data-community-composer className="community-composer-invite" onClick={() => fileInput.current?.click()}><Avatar profile={ownIdentity} /><span><strong>Compartilhe seu treino</strong><small>Uma foto, conquista ou momento da sua jornada.</small></span><Icon name="camera" /></button>}
      <div className="community-feed-heading"><h2>{viewedUserId ? 'Postagens' : 'Feed'}</h2><span data-community-feed-context>Recentes</span></div>
      {(error || page.error) && <div className="community-error" role="alert">{error || page.error}{page.error && <button onClick={() => store.load(scope, true)}>Tentar novamente</button>}</div>}
      {pendingPost && <div className="community-post-uploading" role="status"><img src={preview || undefined} alt="" /><div><strong>Publicando sua foto…</strong><span /></div></div>}
      {!page.initialized && !page.error && !posts.length && <div className="community-skeleton-list"><CommunityPostSkeleton /><CommunityPostSkeleton /></div>}
      {page.initialized && !page.loading && !posts.length && !page.error && <div className="community-empty">{viewedUserId ? 'Este usuário ainda não publicou fotos.' : 'Ainda não há postagens. Compartilhe seu primeiro treino!'}</div>}
      {posts.map(post => <CommunityPostMedia key={post.id} post={post} client={client} onLike={() => toggleLike(post, true)}>{image => <article className={`community-post${highlightedPostId === post.id ? ' is-report-target' : ''}`} data-post-id={post.id}>
      <header className="community-post-head"><button className="community-author-link" onClick={() => openUser(post.author_id)} aria-label={`Abrir perfil de ${post.author.display_name}`}><Avatar profile={post.author} /><span><strong>{post.author.display_name}</strong><small>{fmtDate(post.created_at)}</small></span></button><div className={`community-post-menu${activeMenuId === post.id ? ' is-open' : ''}`}><button className="community-more" aria-label="Mais opções" aria-expanded={activeMenuId === post.id} onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}>•••</button><div className="community-post-menu-actions">{post.author_id === userId ? <><button onClick={() => openEdit(post)}>Editar</button><button onClick={() => removePost(post)}>Excluir</button></> : <button onClick={event => { const returnFocus = event.currentTarget.closest('.community-post-menu')?.querySelector('.community-more'); setActiveMenuId(null); setReportTarget({ targetKind: 'post', postId: post.id, commentId: null, authorId: post.author_id, authorName: post.author.display_name, avatarRef: post.author.avatar_ref, returnFocus }) }}>Denunciar</button>}</div></div></header>
      {image}
      <div className="community-post-body"><div className="community-actions"><span className="community-like-action"><button aria-label="Curtir postagem" aria-pressed={post.likes.some(like => like.user_id === userId)} className={post.likes.some(like => like.user_id === userId) ? 'is-liked' : ''} onClick={() => toggleLike(post)}><Icon name="heart" /> {post.likes.length}</button>{likeAnimations.filter(item => item.postId === post.id).map(item => <span className="community-like-float" key={item.id} aria-hidden="true"><Icon name="heart" /></span>)}</span><span className="community-comment-action">{blockedNoticeId === post.id && <span className="community-blocked-notice" role="status">Os comentários estão bloqueados.</span>}<button className={post.comments_disabled ? 'community-comment-button is-blocked' : ''} aria-label="Abrir comentários" onClick={() => { if (!post.comments_disabled) setCommentsId(post.id); else { clearTimeout(noticeTimer.current); setBlockedNoticeId(post.id); noticeTimer.current = setTimeout(() => setBlockedNoticeId(null), 2200) } }}><Icon name="message" /> {post.comments.length}</button></span></div>
        {post.likes.length > 0 && <div className="community-liker-summary"><span className="community-liker-stack" aria-hidden="true">{post.likes.slice(0, 3).map(like => <Avatar key={like.user_id} profile={like.user} size="xs" />)}</span><span>{post.likes.slice(0, 2).map(like => like.user.display_name).join(', ')}{post.likes.length > 2 ? ` e outras ${post.likes.length - 2} pessoas curtiram` : post.likes.length === 1 ? ' curtiu' : ' curtiram'}</span></div>}
        {post.caption && <p>{post.caption}</p>}{post.comments.filter(comment => !comment.parent_comment_id).slice(0, 2).map(comment => <div className="community-comment-preview" key={comment.id}><button className="community-comment-name-link" onClick={() => openUser(comment.author_id)}>{comment.author.display_name}</button> {comment.body}</div>)}{post.comments.length > 0 && !post.comments_disabled && <button className="community-see-comments" onClick={() => setCommentsId(post.id)}>Ver todos os comentários <Icon name="chevronRight" /></button>}
      </div>
      </article>}</CommunityPostMedia>)}
      {page.loading && posts.length > 0 && <CommunityPostSkeleton />}
      <div ref={sentinel} className={page.hasMore || !posts.length ? 'community-feed-sentinel-trigger' : 'community-feed-sentinel'}>{!page.hasMore && posts.length > 0 ? 'Sem mais postagens por aqui.' : ''}</div>
    </main>{!viewedUserId && <aside className="community-sidecard" data-community-profile-summary><Avatar profile={ownIdentity} size="lg" /><div><p>Seu espaço</p><strong>{ownIdentity.display_name}</strong><span>{ownLoadedPostCount} {ownLoadedPostCount === 1 ? 'postagem carregada' : 'postagens carregadas'}</span></div><button type="button" onClick={() => openUser(userId)}>Suas postagens</button><button type="button" onClick={() => navigate('/community/messages')}>Mensagens</button></aside>}</div>
    <AnimatePresence>{composerOpen && <div className="community-overlay community-overlay--sheet" onMouseDown={event => event.target === event.currentTarget && closeComposer()}><motion.form ref={composerDialog} role="dialog" aria-modal="true" aria-label={editingPost ? 'Editar postagem' : 'Nova postagem'} className={`community-sheet community-composer-sheet${composerExpanded ? ' is-expanded' : ''}`} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onSubmit={publish}><div className="community-sheet-inner"><div className="community-sheet-title"><h2 id="community-composer-title">{editingPost ? 'Editar postagem' : 'Nova postagem'}</h2><div className="community-sheet-title-actions">{!cropConfirmed && <button type="button" aria-label="Expandir editor" onClick={() => setComposerExpanded(value => !value)}><Icon name={composerExpanded ? 'chevronDown' : 'chevronUp'} /></button>}<button type="button" aria-label="Fechar postagem" disabled={saving} onClick={closeComposer}><Icon name="xmark" /></button></div></div></div>
      {error && <div className="community-error" role="alert">{error}</div>}
      {file && !cropConfirmed && <CommunityCropEditor file={file} crop={crop} setCrop={setCrop} onConfirm={confirmCrop} onChangeFile={chooseFile} saving={saving} />}
      {cropConfirmed && <div className="community-sheet-inner">{file ? <img className="community-cropped-preview" src={preview || undefined} alt="Foto recortada" /> : editingPost && <CommunityImage post={editingPost} client={client} />}<label className="sr-only" htmlFor="community-caption">Legenda da postagem</label><textarea id="community-caption" value={caption} onChange={event => setCaption(event.target.value)} maxLength={500} placeholder="Conte como foi o treino…" />{editingPost && <label className="community-comments-toggle"><input type="checkbox" checked={!commentsDisabled} onChange={event => setCommentsDisabled(!event.target.checked)} /> Permitir comentários nesta postagem</label>}<button className="community-primary-action" disabled={saving}>{saving ? editingPost ? 'Salvando…' : 'Publicando…' : editingPost ? 'Salvar alterações' : 'Publicar foto'}</button></div>}
    </motion.form></div>}</AnimatePresence>
    <AnimatePresence>{commentsPost && <CommunityComments key={commentsPost.id} post={commentsPost} client={client} userId={userId} ownIdentity={ownIdentity} AvatarComponent={Avatar} onClose={() => setCommentsId(null)} onSubmit={submitComment} onCommentsChange={changeComments} onOpenUser={openUser} highlightCommentId={highlightCommentId} onReport={(comment, returnFocus) => setReportTarget({ targetKind: 'comment', postId: commentsPost.id, commentId: comment.id, authorId: comment.author_id, authorName: comment.author?.display_name || 'Usuário', avatarRef: comment.author?.avatar_ref, returnFocus })} />}</AnimatePresence>
    <AnimatePresence>{reportTarget && <CommunityReportDialog client={client} target={reportTarget} onClose={() => { const returnFocus = reportTarget.returnFocus; setReportTarget(null); requestAnimationFrame(() => returnFocus?.focus()) }} />}</AnimatePresence>
    <AnimatePresence>{notificationsOpen && <div className="community-overlay community-overlay--top" onMouseDown={event => event.target === event.currentTarget && setNotificationsOpen(false)}><motion.div ref={notificationsDialog} role="dialog" aria-modal="true" aria-label="Notificações" className="community-notification-sheet" initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}><div className="community-sheet-title"><h2 id="community-notifications-title">Notificações</h2><button aria-label="Fechar notificações" onClick={() => setNotificationsOpen(false)}><Icon name="xmark" /></button></div>{!notifications.length && <div className="community-empty">Você está em dia.</div>}{notifications.map(item => <button className="community-notification" key={item.id} onClick={() => { setNotificationsOpen(false); navigate(communityNotificationTarget(item)) }}><Avatar profile={item.actor} size="sm" /><span><strong>{item.actor?.display_name || 'Usuário'}</strong> {communityNotificationDetail(item)}</span></button>)}</motion.div></div>}</AnimatePresence>
  </div>
}
