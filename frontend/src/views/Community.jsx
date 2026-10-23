import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useStore } from '../store/useStore.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import Icon from '../components/Icon.jsx'
import './community.css'
import { avatarSrc } from '../lib/avatars.js'

const BUCKET = 'community-posts'
const randomId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const FEED_PAGE_SIZE = 20
const feedHash = (id, seed) => {
  let hash = 2166136261
  for (const char of `${seed}:${id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) / 4294967295
}
const rankPosts = (items, seed) => {
  const now = Date.now()
  return [...items].sort((a, b) => {
    const score = post => {
      const ageHours = Math.max(0, (now - new Date(post.created_at).getTime()) / 3600000)
      const engagement = (post.likes?.length || 0) * 3 + (post.comments?.length || 0) * 2
      const freshness = 12 / Math.pow(1 + ageHours / 24, 0.72)
      return engagement + freshness + feedHash(post.id, seed) * 2.5
    }
    return score(b) - score(a)
  })
}
const fmtDate = value => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const storagePathFromValue = value => {
  if (!value) return ''
  const marker = `/object/public/${BUCKET}/`
  const signedMarker = `/object/sign/${BUCKET}/`
  if (value.includes(marker)) return decodeURIComponent(value.split(marker)[1].split('?')[0])
  if (value.includes(signedMarker)) return decodeURIComponent(value.split(signedMarker)[1].split('?')[0])
  return value
}

async function compressCommunityImage(file) {
  if (!file?.type?.startsWith('image/')) return file
  try {
  const bitmap = await createImageBitmap(file)
  const maxEdge = 1600
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }) : file
  } catch { return file }
}

function CommunityImage({ post, client }) {
  const path = storagePathFromValue(post.image_path)
  const publicUrl = path?.startsWith('http') ? path : path && client ? client.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl : ''
  const [src, setSrc] = useState(publicUrl || '')
  const [fallbackTried, setFallbackTried] = useState(false)
  useEffect(() => {
    setSrc(publicUrl || '')
    setFallbackTried(false)
  }, [publicUrl])
  const useAuthenticatedFallback = async () => {
    if (fallbackTried || !client || !path || path.startsWith('http')) return
    setFallbackTried(true)
    const downloaded = await client.storage.from(BUCKET).download(path)
    if (downloaded.data) setSrc(URL.createObjectURL(downloaded.data))
  }
  return src ? <img className="community-post-image" src={src} alt={post.caption || 'Foto de treino'} loading="lazy" onError={useAuthenticatedFallback} /> : <div className="community-post-image community-post-image--loading" aria-label="Carregando foto" />
}

function Avatar({ profile, size = 'md' }) {
  const initials = (profile?.display_name || '?').slice(0, 1).toUpperCase()
  const avatar = profile?.avatar_ref || profile?.avatar_id || 'avatar-27'
  return avatar
    ? <img className={`community-avatar community-avatar--${size}`} src={avatar.startsWith('http') || avatar.startsWith('data:') ? avatar : avatarSrc(avatar)} alt="" />
    : <span className={`community-avatar community-avatar--${size}`}>{initials}</span>
}

function CommunityPostSkeleton() {
  return <article className="community-post community-post-skeleton" aria-hidden="true">
    <div className="community-post-head"><span className="community-skeleton-block community-skeleton-avatar" /><div className="community-skeleton-copy"><span className="community-skeleton-block community-skeleton-name" /><span className="community-skeleton-block community-skeleton-date" /></div><span className="community-skeleton-block community-skeleton-menu" /></div>
    <div className="community-post-image community-skeleton-block community-skeleton-image" />
    <div className="community-post-body"><div className="community-skeleton-actions"><span className="community-skeleton-block community-skeleton-action" /><span className="community-skeleton-block community-skeleton-action community-skeleton-action--short" /></div><div className="community-skeleton-likers"><span className="community-skeleton-block community-skeleton-mini-avatar" /><span className="community-skeleton-block community-skeleton-mini-avatar" /><span className="community-skeleton-block community-skeleton-mini-avatar" /><span className="community-skeleton-block community-skeleton-liker-copy" /></div><span className="community-skeleton-block community-skeleton-line community-skeleton-line--wide" /><span className="community-skeleton-block community-skeleton-line" /><span className="community-skeleton-block community-skeleton-line community-skeleton-line--comment" /></div>
  </article>
}

export default function Community() {
  const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); const client = getBrowserSupabaseClient()
  const userId = auth.user?.id
  const profileMode = location.pathname === '/community/profile'
  const publicUserId = location.pathname.match(/^\/community\/user\/([^/]+)$/)?.[1] || null
  const viewedUserId = publicUserId || (profileMode ? userId : null)
  const localProfile = useStore(state => state.S.profile)
  const [posts, setPosts] = useState([]); const [loading, setLoading] = useState(true); const [showSkeleton, setShowSkeleton] = useState(false); const [loadingMore, setLoadingMore] = useState(false); const [hasMore, setHasMore] = useState(true); const [error, setError] = useState('')
  const [ownIdentity, setOwnIdentity] = useState(null)
  const [viewedProfile, setViewedProfile] = useState(null)
  const [showFeedTop, setShowFeedTop] = useState(false)
  const [commentsPost, setCommentsPost] = useState(null); const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([]); const [composerOpen, setComposerOpen] = useState(false); const [editingPost, setEditingPost] = useState(null)
  const [activeMenuId, setActiveMenuId] = useState(null); const [blockedNoticeId, setBlockedNoticeId] = useState(null); const [likeAnimations, setLikeAnimations] = useState([])
  const [file, setFile] = useState(null); const [caption, setCaption] = useState(''); const [commentsDisabled, setCommentsDisabled] = useState(false); const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null); const feedOffsetRef = useRef(0); const feedLoadingRef = useRef(false); const feedSeedRef = useRef(randomId()); const feedSentinelRef = useRef(null)
  useEffect(() => {
    if (!activeMenuId) return undefined
    const closeMenu = event => { if (!event.target.closest?.('.community-post-menu')) setActiveMenuId(null) }
    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [activeMenuId])

  const load = useCallback(async (reset = false) => {
    if (!client || !userId || feedLoadingRef.current || (!reset && !hasMore)) return
    feedLoadingRef.current = true; reset ? setLoading(true) : setLoadingMore(true); setError('')
    if (reset) { feedOffsetRef.current = 0; setHasMore(true) }
    const from = reset ? 0 : feedOffsetRef.current
    const postsQuery = client.from('community_posts').select('*, author:profiles!community_posts_author_id_fkey(id,display_name,avatar_ref), likes:community_likes(user_id,user:profiles!community_likes_user_id_fkey(id,display_name,avatar_ref)), comments:community_comments(id,post_id,author_id,body,parent_comment_id,created_at,author:profiles!community_comments_author_id_fkey(id,display_name,avatar_ref),likes:community_comment_likes(user_id))')
    if (viewedUserId) postsQuery.eq('author_id', viewedUserId)
    const [{ data, error: queryError }, { data: identity }] = await Promise.all([
      postsQuery.order('created_at', { ascending: false }).range(from, from + FEED_PAGE_SIZE - 1),
      client.from('profiles').select('id,display_name,avatar_ref').eq('id', viewedUserId || userId).maybeSingle(),
    ])
    const scopedData = viewedUserId ? (data || []).filter(post => post.author_id === viewedUserId) : (data || [])
    const resolvedIdentity = identity || ownIdentity || { id: userId, display_name: localProfile?.name, avatar_ref: localProfile?.avatarRef, avatar_id: localProfile?.avatarId }
    if (viewedUserId && viewedUserId !== userId) setViewedProfile(identity || scopedData[0]?.author || null)
    else setOwnIdentity(resolvedIdentity)
    const enriched = scopedData.map(post => ({ ...post, author: post.author_id === userId ? { ...post.author, ...resolvedIdentity } : post.author, likes: (post.likes || []).map(like => like.user_id === userId ? { ...like, user: { ...like.user, ...resolvedIdentity } } : like) }))
    if (queryError) setError(queryError.code === 'PGRST205' ? 'A Comunidade ainda não foi ativada no banco. Aplique a migração community no Supabase.' : queryError.message)
    else {
      const merged = reset ? enriched : [...posts, ...enriched.filter(item => !posts.some(existing => existing.id === item.id))]
      feedOffsetRef.current = from + enriched.length
      setHasMore(enriched.length === FEED_PAGE_SIZE)
      setPosts(rankPosts(merged, feedSeedRef.current))
    }
    setLoading(false); setLoadingMore(false); feedLoadingRef.current = false
  }, [client, userId, localProfile, hasMore, posts, viewedUserId])
  const loadNotifications = useCallback(async () => {
    if (!client || !userId) return
    const { data } = await client.from('community_notifications').select('*, actor:profiles!community_notifications_actor_id_fkey(display_name), post:community_posts(id)').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(30)
    setNotifications(data || [])
  }, [client, userId])
  useEffect(() => {
    setPosts([])
    feedOffsetRef.current = 0
    feedLoadingRef.current = false
    load(true)
    loadNotifications()
  }, [loadNotifications, userId, viewedUserId])
  useEffect(() => {
    if (!loading || posts.length > 0) { setShowSkeleton(false); return undefined }
    const timer = window.setTimeout(() => setShowSkeleton(true), 220)
    return () => window.clearTimeout(timer)
  }, [loading, posts.length])
  useEffect(() => {
    if (!client || !userId || typeof client.channel !== 'function') return undefined
    const channel = client.channel(`community-notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_notifications', filter: `recipient_id=eq.${userId}` }, () => {
        loadNotifications()
      })
      .subscribe()
    // Realtime is immediate when available; the fallback also covers a
    // temporarily disconnected mobile background session.
    const fallback = window.setInterval(loadNotifications, 30000)
    return () => { window.clearInterval(fallback); client.removeChannel?.(channel) }
  }, [client, userId, loadNotifications])
  useEffect(() => {
    const onScroll = () => setShowFeedTop(window.scrollY > 280)
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (profileMode || !feedSentinelRef.current) return undefined
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) load(false) }, { rootMargin: '700px 0px' })
    observer.observe(feedSentinelRef.current)
    return () => observer.disconnect()
  }, [load, profileMode])

  const unread = useMemo(() => notifications.filter(n => !n.read_at).length, [notifications])
  const toggleLike = async post => {
    const liked = post.likes?.some(x => x.user_id === userId)
    if (!liked) {
      const animationId = randomId()
      setLikeAnimations(current => [...current, { id: animationId, postId: post.id }])
      window.setTimeout(() => setLikeAnimations(current => current.filter(item => item.id !== animationId)), 700)
    }
    const ownLike = { user_id: userId, user: ownIdentity || { id: userId, display_name: localProfile?.name || auth.user?.user_metadata?.name || auth.user?.user_metadata?.full_name || 'Usuário', avatar_id: localProfile?.avatarId || 'avatar-27', avatar_ref: localProfile?.avatarRef } }
    setPosts(current => current.map(item => item.id === post.id ? { ...item, likes: liked ? item.likes.filter(x => x.user_id !== userId) : [...(item.likes || []), ownLike] } : item))
    const result = liked ? await client.from('community_likes').delete().match({ post_id: post.id, user_id: userId }) : await client.from('community_likes').insert({ post_id: post.id, user_id: userId })
    if (result.error) load()
    if (!liked && post.author_id !== userId) await client.from('community_notifications').insert({ recipient_id: post.author_id, actor_id: userId, type: 'like', post_id: post.id })
  }
  const submitComment = async (post, body, parentCommentId = null) => {
    if (post.comments_disabled) return
    const text = body.trim(); if (!text) return
    const { data: inserted, error: insertError } = await client.from('community_comments').insert({ post_id: post.id, author_id: userId, body: text, parent_comment_id: parentCommentId }).select('id,post_id,author_id,body,parent_comment_id,created_at,author:profiles!community_comments_author_id_fkey(id,display_name,avatar_ref),likes:community_comment_likes(user_id)').single()
    if (insertError) { setError(insertError.message); return { error: insertError } }
    const comment = { ...inserted, author: inserted.author || ownIdentity }
    setPosts(current => current.map(item => item.id === post.id ? { ...item, comments: [...(item.comments || []), comment] } : item))
    setCommentsPost(current => current?.id === post.id ? { ...current, comments: [...(current.comments || []), comment] } : current)
    if (post.author_id !== userId) await client.from('community_notifications').insert({ recipient_id: post.author_id, actor_id: userId, type: 'comment', post_id: post.id })
    return { comment }
  }
  const updateCommentCount = comment => setPosts(current => current.map(item => item.id === comment.post_id ? { ...item, comments: (item.comments || []).filter(itemComment => itemComment.id !== comment.id) } : item))
  const createPost = async event => {
    event.preventDefault(); if (!file || saving) return
    setSaving(true); setError('')
    const compressed = await compressCommunityImage(file)
    const path = `${userId}/${randomId()}-${compressed.name.replace(/[^a-z0-9.]/gi, '-').toLowerCase()}`
    const upload = await client.storage.from(BUCKET).upload(path, compressed, { contentType: compressed.type, upsert: false })
    if (upload.error) { setError(upload.error.message); setSaving(false); return }
    const inserted = await client.from('community_posts').insert({ author_id: userId, image_path: path, caption, comments_disabled: false }).select().single()
    if (inserted.error) setError(inserted.error.code === 'PGRST205' ? 'A Comunidade ainda não foi ativada no banco. Aplique a migração community no Supabase.' : inserted.error.message); else { setComposerOpen(false); setFile(null); setCaption(''); await load() }
    setSaving(false)
  }
  const updatePost = async event => {
    event.preventDefault(); if (!editingPost || saving) return
    setSaving(true)
    let imagePath = editingPost.image_path
    if (file) {
      const compressed = await compressCommunityImage(file)
      const path = `${userId}/${randomId()}-${compressed.name.replace(/[^a-z0-9.]/gi, '-').toLowerCase()}`
      const upload = await client.storage.from(BUCKET).upload(path, compressed, { contentType: compressed.type, upsert: false })
      if (upload.error) { setError(upload.error.message); setSaving(false); return }
      imagePath = path
    }
    const { error: updateError } = await client.from('community_posts').update({ caption: caption.trim(), image_path: imagePath, comments_disabled: commentsDisabled }).eq('id', editingPost.id).eq('author_id', userId)
    if (updateError) setError(updateError.message); else { setPosts(current => current.map(post => post.id === editingPost.id ? { ...post, caption: caption.trim(), image_path: imagePath, comments_disabled: commentsDisabled } : post)); setEditingPost(null); setComposerOpen(false); setCaption(''); setFile(null) }
    setSaving(false)
  }
  const deletePost = async post => {
    if (!window.confirm('Excluir esta postagem?')) return
    const { error: deleteError } = await client.from('community_posts').delete().eq('id', post.id).eq('author_id', userId)
    if (deleteError) setError(deleteError.message); else { const imagePath = storagePathFromValue(post.image_path); if (imagePath) await client.storage.from(BUCKET).remove([imagePath]); setPosts(current => current.filter(item => item.id !== post.id)) }
  }
  const chooseFile = event => { const nextFile = event.target.files?.[0] || null; if (!nextFile) return; setFile(nextFile); setComposerOpen(true); event.target.value = '' }
  const openNewPost = () => fileInputRef.current?.click()
  const openEdit = post => { setEditingPost(post); setCaption(post.caption || ''); setCommentsDisabled(Boolean(post.comments_disabled)); setFile(null); setComposerOpen(true) }
  const markNotificationsRead = async () => { if (unread) await client.from('community_notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null); setNotifications(current => current.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))) }
  const showBlockedNotice = postId => { setBlockedNoticeId(postId); window.setTimeout(() => setBlockedNoticeId(current => current === postId ? null : current), 2200) }
  const openUser = id => { if (id) navigate(id === userId ? '/community/profile' : `/community/user/${id}`, { state: { fromFeed: true } }) }
  const returnToFeedTop = async () => { window.scrollTo({ top: 0, behavior: 'smooth' }); await load(true) }

  return <div className="community-view page-scenery">
    {showFeedTop && <button type="button" className="community-feed-top" aria-label="Voltar ao topo e atualizar o feed" onClick={returnToFeedTop}>↑</button>}
    <div className="community-toolbar">
      <input ref={fileInputRef} className="community-file-input" type="file" accept="image/*" onChange={chooseFile} />
      <button className="community-primary-action" onClick={openNewPost}><Icon name="camera" /> Nova postagem</button>
      <button className="community-notifications" aria-label="Notificações" onClick={() => { setNotificationsOpen(true); markNotificationsRead() }}><Icon name="bell" />{unread > 0 && <b>{unread}</b>}</button>
      <button className="community-profile-button" aria-label="Meu perfil" onClick={() => navigate('/community/profile')}><Avatar profile={{ display_name: localProfile?.name, avatar_id: localProfile?.avatarId }} /></button>
    </div>
    {(profileMode || publicUserId) && <div className="community-profile-heading-wrap"><div className="community-profile-heading"><Avatar profile={profileMode ? { display_name: localProfile?.name, avatar_ref: localProfile?.avatarRef, avatar_id: localProfile?.avatarId } : viewedProfile} size="sm" /><strong>{profileMode ? (localProfile?.name || 'Meu perfil') : (viewedProfile?.display_name || 'Perfil')}</strong></div><button type="button" className="community-profile-back" onClick={() => location.state?.fromFeed ? navigate(-1) : navigate('/community')} aria-label="Voltar ao feed"><Icon name="chevronLeft" /> Voltar</button></div>}
    {error && <div className="community-error">{error}</div>}
    {loading && posts.length === 0 && showSkeleton ? <div className="community-skeleton-list"><CommunityPostSkeleton /><CommunityPostSkeleton /></div> : posts.length === 0 && !loading ? <div className="community-empty">{profileMode ? 'Você ainda não publicou fotos.' : publicUserId ? 'Este usuário ainda não publicou fotos.' : 'Ainda não há postagens. Compartilhe seu primeiro treino!'}</div> : posts.map(post => <article className="community-post" key={post.id}>
      <header className="community-post-head"><button type="button" className="community-author-link" onClick={() => openUser(post.author_id)} aria-label={`Abrir perfil de ${post.author?.display_name || 'Usuário'}`}><Avatar profile={post.author} /><span><strong>{post.author?.display_name || 'Usuário'}</strong><small>{fmtDate(post.created_at)}</small></span></button>{post.author_id === userId && <div className={`community-post-menu${activeMenuId === post.id ? ' is-open' : ''}`}><button type="button" className="community-more" aria-label="Mais opções" onClick={() => setActiveMenuId(current => current === post.id ? null : post.id)}>•••</button><div className="community-post-menu-actions"><button onClick={() => { setActiveMenuId(null); openEdit(post) }}>Editar</button><button onClick={() => { setActiveMenuId(null); deletePost(post) }}>Excluir</button></div></div>}</header>
      <CommunityImage post={post} client={client} />
      <div className="community-post-body"><div className="community-actions"><span className="community-like-action"><button className={post.likes?.some(x => x.user_id === userId) ? 'is-liked' : ''} onClick={() => toggleLike(post)}><Icon name="heart" /> {post.likes?.length || 0}</button>{likeAnimations.filter(item => item.postId === post.id).map(item => <span key={item.id} className="community-like-float" aria-hidden="true"><Icon name="heart" /></span>)}</span><span className="community-comment-action">{post.comments_disabled && blockedNoticeId === post.id && <span className="community-blocked-notice" role="status">Os comentários estão bloqueados.</span>}<button className={post.comments_disabled ? 'community-comment-button is-blocked' : ''} aria-label={post.comments_disabled ? 'Comentários bloqueados' : 'Abrir comentários'} onClick={() => post.comments_disabled ? showBlockedNotice(post.id) : setCommentsPost(post)}><Icon name="message" /> {post.comments?.length || 0}</button></span></div>{post.likes?.length > 0 && <div className="community-liker-summary"><span className="community-liker-stack" aria-hidden="true">{post.likes.slice(0, 3).map((like, index) => <Avatar key={`${like.user_id}-${index}`} profile={like.user || { display_name: 'Usuário' }} size="xs" />)}</span><span>{post.likes.slice(0, 2).map(like => like.user?.display_name || 'Usuário').join(', ')}{post.likes.length > 2 ? ` e outras ${post.likes.length - 2} pessoas curtiram` : post.likes.length === 1 ? ' curtiu' : ' curtiram'}</span></div>}{post.caption && <p>{post.caption}</p>}{post.comments?.slice(0, 2).map(comment => <div className="community-comment-preview" key={comment.id}><strong>{comment.author?.display_name || 'Usuário'}</strong> {comment.body}</div>)}{post.comments?.length > 2 && !post.comments_disabled && <button className="community-see-comments" onClick={() => setCommentsPost(post)}>Ver todos os comentários <Icon name="chevronRight" /></button>}</div>
    </article>)}
    {loadingMore && <div className="community-skeleton-list community-skeleton-list--more"><CommunityPostSkeleton /></div>}
    {!profileMode && <div ref={feedSentinelRef} className="community-feed-sentinel" aria-live="polite">{loadingMore ? 'Carregando mais postagens…' : hasMore ? '' : 'Sem mais postagens por aqui.'}</div>}

    <AnimatePresence>{composerOpen && <div className="community-overlay community-overlay--sheet" onMouseDown={e => e.target === e.currentTarget && setComposerOpen(false)}><motion.form className="community-sheet community-composer-sheet" drag="y" dragConstraints={{ top: 0, bottom: 500 }} dragElastic={0.2} onDragEnd={(_, info) => { if (info.offset.y > 120) setComposerOpen(false) }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onSubmit={editingPost ? updatePost : createPost}><div className="community-sheet-inner"><div className="community-sheet-handle" /><div className="community-sheet-title"><h2>{editingPost ? 'Editar postagem' : 'Nova postagem'}</h2><button type="button" onClick={() => setComposerOpen(false)}><Icon name="xmark" /></button></div></div>{editingPost && !file && <CommunityImage post={editingPost} client={client} />}{file && <img className="community-composer-preview" src={URL.createObjectURL(file)} alt="Prévia da postagem" />}{!editingPost && <label className="community-upload community-upload-inline">{file ? 'Trocar foto' : 'Escolha uma foto do treino'}<input type="file" accept="image/*" onChange={chooseFile} /></label>}<div className="community-sheet-inner"><textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} placeholder="Conte como foi o treino…" />{editingPost && <label className="community-comments-toggle"><input type="checkbox" checked={!commentsDisabled} onChange={e => setCommentsDisabled(!e.target.checked)} /> Permitir comentários nesta postagem</label>}<button className="community-primary-action" disabled={(!file && !editingPost) || saving}>{saving ? (editingPost ? 'Salvando…' : 'Publicando…') : editingPost ? 'Salvar alterações' : 'Publicar foto'}</button></div></motion.form></div>}</AnimatePresence>
    <AnimatePresence>{commentsPost && <CommentsSheet key={commentsPost.id} post={commentsPost} client={client} userId={userId} ownIdentity={ownIdentity} ownProfile={localProfile} authUser={auth.user} onClose={() => setCommentsPost(null)} onSubmit={submitComment} onCommentDeleted={updateCommentCount} onOpenUser={openUser} />}</AnimatePresence>
    <AnimatePresence>{notificationsOpen && <div className="community-overlay community-overlay--top" onMouseDown={e => e.target === e.currentTarget && setNotificationsOpen(false)}><motion.div className="community-notification-sheet" initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}><div className="community-sheet-title"><h2>Notificações</h2><button onClick={() => setNotificationsOpen(false)}><Icon name="xmark" /></button></div>{notifications.length === 0 ? <div className="community-empty">Você está em dia.</div> : notifications.map(n => <button className="community-notification" key={n.id} onClick={() => { setNotificationsOpen(false); if (n.post_id) navigate(`/community?post=${n.post_id}`) }}><Icon name={n.type === 'like' ? 'heart' : 'message'} /><span><strong>{n.actor?.display_name || 'Alguém'}</strong> {n.type === 'like' ? 'curtiu sua postagem.' : 'comentou na sua postagem.'}</span></button>)}</motion.div></div>}</AnimatePresence>
  </div>
}

function CommentsSheet({ post, client, userId, ownIdentity, ownProfile, authUser, onClose, onSubmit, onCommentDeleted, onOpenUser }) {
  const [body, setBody] = useState(''); const [replyTo, setReplyTo] = useState(null); const [editingComment, setEditingComment] = useState(null); const [activeMenuId, setActiveMenuId] = useState(null); const [highlightedId, setHighlightedId] = useState(null); const [expanded, setExpanded] = useState(() => new Set((post.comments || []).filter(comment => comment.parent_comment_id).map(comment => comment.parent_comment_id))); const [comments, setComments] = useState(post.comments || []); const inputRef = useRef(null)
  useEffect(() => { if (!activeMenuId) return undefined; const close = event => { if (!event.target.closest?.('.community-comment-menu')) setActiveMenuId(null) }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close) }, [activeMenuId])
  const selectReply = comment => { inputRef.current?.focus({ preventScroll: true }); setReplyTo(comment); window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60) }
  useEffect(() => { if (replyTo) { setExpanded(previous => new Set(previous).add(replyTo.id)); requestAnimationFrame(() => { document.querySelector(`[data-community-comment-id="${replyTo.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); inputRef.current?.focus() }); setHighlightedId(replyTo.id); const timer = window.setTimeout(() => setHighlightedId(null), 2200); return () => window.clearTimeout(timer) } }, [replyTo])
  const toggleCommentLike = async comment => { const liked = comment.likes?.some(item => item.user_id === userId); setComments(items => items.map(item => item.id === comment.id ? { ...item, likes: liked ? item.likes.filter(x => x.user_id !== userId) : [...(item.likes || []), { user_id: userId }] } : item)); const result = liked ? await client.from('community_comment_likes').delete().match({ comment_id: comment.id, user_id: userId }) : await client.from('community_comment_likes').insert({ comment_id: comment.id, user_id: userId }); if (result.error) setComments(post.comments || []) }
  const roots = comments.filter(comment => !comment.parent_comment_id); const repliesFor = id => comments.filter(comment => comment.parent_comment_id === id)
  const editComment = comment => { setEditingComment(comment); setReplyTo(null); setActiveMenuId(null); setBody(comment.body); requestAnimationFrame(() => inputRef.current?.focus()) }
  const deleteComment = async comment => { setActiveMenuId(null); const result = await client.from('community_comments').delete().eq('id', comment.id).eq('author_id', userId); if (result.error) return; setComments(items => items.filter(item => item.id !== comment.id)); onCommentDeleted?.(comment) }
  const renderComment = comment => <CommentRow comment={comment} highlighted={highlightedId === comment.id} userId={userId} onLike={toggleCommentLike} onReply={() => selectReply(comment)} onOpenUser={onOpenUser} canManage={comment.author_id === userId} menuOpen={activeMenuId === comment.id} onMenu={() => setActiveMenuId(activeMenuId === comment.id ? null : comment.id)} onEdit={() => editComment(comment)} onDelete={() => deleteComment(comment)} />
  const renderThread = comment => { const replies = repliesFor(comment.id); return <div className={`community-comment-thread${comment.parent_comment_id ? ' community-comment-thread--nested' : ''}`} key={comment.id}>{renderComment(comment)}{replies.length > 0 && <button className="community-reply-toggle" onClick={() => setExpanded(previous => { const next = new Set(previous); next.has(comment.id) ? next.delete(comment.id) : next.add(comment.id); return next })}>{expanded.has(comment.id) ? 'Ocultar' : 'Ver'} {replies.length} resposta{replies.length > 1 ? 's' : ''}</button>}{expanded.has(comment.id) && replies.map(renderThread)}</div> }
  const submit = async event => { event.preventDefault(); const text = body.trim(); if (!text) return; if (editingComment) { const result = await client.from('community_comments').update({ body: text }).eq('id', editingComment.id).eq('author_id', userId); if (!result.error) setComments(items => items.map(item => item.id === editingComment.id ? { ...item, body: text } : item)); setEditingComment(null); setBody(''); return } const identity = ownIdentity || { id: userId, display_name: ownProfile?.name || authUser?.user_metadata?.name || authUser?.user_metadata?.full_name || 'Usuário', avatar_id: ownProfile?.avatarId || 'avatar-27', avatar_ref: ownProfile?.avatarRef }; const optimisticId = `local-${Date.now()}`; const optimistic = { id: optimisticId, post_id: post.id, body: text, parent_comment_id: replyTo?.id || null, created_at: new Date().toISOString(), author_id: userId, author: identity, likes: [] }; setComments(previous => [...previous, optimistic]); const result = await onSubmit(post, text, replyTo?.id); if (result?.comment) setComments(items => items.map(item => item.id === optimisticId ? result.comment : item)); else if (result?.error) setComments(items => items.filter(item => item.id !== optimisticId)); setBody(''); setReplyTo(null) }
  return <div className="community-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><motion.div className="community-sheet community-comments-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}><div className="community-sheet-handle" /><div className="community-sheet-title"><h2>Comentários</h2><button onClick={onClose}><Icon name="xmark" /></button></div>{replyTo && <div className="community-replying">Respondendo a <strong>{replyTo.author?.display_name || 'usuário'}</strong><button type="button" onClick={() => setReplyTo(null)}>Cancelar</button></div>}{editingComment && <div className="community-replying">Editando seu comentário<button type="button" onClick={() => { setEditingComment(null); setBody('') }}>Cancelar</button></div>}<div className="community-comments-scroll">{roots.map(renderThread)}</div><form className="community-comment-form" onSubmit={submit}><input ref={inputRef} value={body} onChange={e => setBody(e.target.value)} placeholder={editingComment ? 'Edite seu comentário…' : replyTo ? `Respondendo a ${replyTo.author?.display_name || 'usuário'}…` : 'Escreva um comentário…'} /><button aria-label={editingComment ? 'Salvar comentário' : 'Enviar comentário'}><Icon name="send" /></button></form></motion.div></div>
}

function CommentRow({ comment, highlighted, userId, onLike, onReply, onOpenUser, canManage, menuOpen, onMenu, onEdit, onDelete }) { const liked = comment.likes?.some(item => item.user_id === userId); return <div data-community-comment-id={comment.id} className={`community-comment-row${highlighted ? ' is-reply-target' : ''}`}><button type="button" className="community-comment-author-link" onClick={() => onOpenUser?.(comment.author_id)} aria-label={`Abrir perfil de ${comment.author?.display_name || 'Usuário'}`}><Avatar profile={comment.author} size="sm" /></button><div className="community-comment-content"><div className="community-comment-heading"><button type="button" className="community-comment-name-link" onClick={() => onOpenUser?.(comment.author_id)}>{comment.author?.display_name || 'Usuário'}</button>{canManage && <div className={`community-comment-menu${menuOpen ? ' is-open' : ''}`}><button type="button" className="community-comment-more" aria-label="Opções do comentário" onClick={onMenu}>•••</button>{menuOpen && <div className="community-comment-menu-actions"><button type="button" onClick={onEdit}>Editar</button><button type="button" onClick={onDelete}>Excluir</button></div>}</div>}</div><small>{fmtDate(comment.created_at)}</small><p>{comment.body}</p><div className="community-comment-actions"><button className={liked ? 'is-liked' : ''} onClick={() => onLike(comment)}><Icon name="heart" /> {comment.likes?.length || 0}</button><button type="button" onPointerDown={event => { event.preventDefault(); onReply() }}>Responder</button></div></div></div> }
