import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import Icon from '../components/Icon.jsx'
import AppHeader from '../components/AppHeader.jsx'
import './community.css'

const BUCKET = 'community-posts'
const fmtDate = value => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

function Avatar({ profile, size = 'md' }) {
  const initials = (profile?.display_name || '?').slice(0, 1).toUpperCase()
  return profile?.avatar_ref
    ? <img className={`community-avatar community-avatar--${size}`} src={profile.avatar_ref} alt="" />
    : <span className={`community-avatar community-avatar--${size}`}>{initials}</span>
}

export default function Community() {
  const auth = useAuth(); const navigate = useNavigate(); const client = getBrowserSupabaseClient()
  const userId = auth.user?.id
  const [posts, setPosts] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [commentsPost, setCommentsPost] = useState(null); const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([]); const [composerOpen, setComposerOpen] = useState(false)
  const [file, setFile] = useState(null); const [caption, setCaption] = useState(''); const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!client || !userId) return
    setLoading(true); setError('')
    const { data, error: queryError } = await client.from('community_posts').select('*, author:profiles!community_posts_author_id_fkey(id,display_name,avatar_ref), likes:community_likes(user_id), comments:community_comments(id,body,created_at,author:profiles!community_comments_author_id_fkey(id,display_name,avatar_ref))').order('created_at', { ascending: false }).limit(40)
    if (queryError) setError(queryError.message); else setPosts(data || [])
    setLoading(false)
  }, [client, userId])
  const loadNotifications = useCallback(async () => {
    if (!client || !userId) return
    const { data } = await client.from('community_notifications').select('*, actor:profiles!community_notifications_actor_id_fkey(display_name), post:community_posts(id)').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(30)
    setNotifications(data || [])
  }, [client, userId])
  useEffect(() => { load(); loadNotifications() }, [load, loadNotifications])

  const unread = useMemo(() => notifications.filter(n => !n.read_at).length, [notifications])
  const toggleLike = async post => {
    const liked = post.likes?.some(x => x.user_id === userId)
    setPosts(current => current.map(item => item.id === post.id ? { ...item, likes: liked ? item.likes.filter(x => x.user_id !== userId) : [...(item.likes || []), { user_id: userId }] } : item))
    const result = liked ? await client.from('community_likes').delete().match({ post_id: post.id, user_id: userId }) : await client.from('community_likes').insert({ post_id: post.id, user_id: userId })
    if (result.error) load()
    if (!liked && post.author_id !== userId) await client.from('community_notifications').insert({ recipient_id: post.author_id, actor_id: userId, type: 'like', post_id: post.id })
  }
  const submitComment = async (post, body) => {
    const text = body.trim(); if (!text) return
    const { error: insertError } = await client.from('community_comments').insert({ post_id: post.id, author_id: userId, body: text })
    if (insertError) setError(insertError.message); else { await load(); if (post.author_id !== userId) await client.from('community_notifications').insert({ recipient_id: post.author_id, actor_id: userId, type: 'comment', post_id: post.id }); setCommentsPost(null) }
  }
  const createPost = async event => {
    event.preventDefault(); if (!file || saving) return
    setSaving(true); setError('')
    const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.]/gi, '-').toLowerCase()}`
    const upload = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    if (upload.error) { setError(upload.error.message); setSaving(false); return }
    const { data: publicUrl } = client.storage.from(BUCKET).getPublicUrl(path)
    const inserted = await client.from('community_posts').insert({ author_id: userId, image_path: publicUrl.publicUrl, caption }).select().single()
    if (inserted.error) setError(inserted.error.message); else { setComposerOpen(false); setFile(null); setCaption(''); await load() }
    setSaving(false)
  }
  const markNotificationsRead = async () => { if (unread) await client.from('community_notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null); setNotifications(current => current.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))) }

  return <div className="community-view page-scenery">
    <AppHeader title="Comunidade" subtitle="Compartilhe sua evolução com a comunidade" backTo="/home" />
    <div className="community-toolbar">
      <button className="community-primary-action" onClick={() => setComposerOpen(true)}><Icon name="camera" /> Nova postagem</button>
      <button className="community-notifications" aria-label="Notificações" onClick={() => { setNotificationsOpen(true); markNotificationsRead() }}><Icon name="bell" />{unread > 0 && <b>{unread}</b>}</button>
    </div>
    {error && <div className="community-error">{error}</div>}
    {loading ? <div className="community-empty">Carregando comunidade…</div> : posts.length === 0 ? <div className="community-empty">Ainda não há postagens. Compartilhe seu primeiro treino!</div> : posts.map(post => <article className="community-post" key={post.id}>
      <header className="community-post-head"><Avatar profile={post.author} /><div><strong>{post.author?.display_name || 'Usuário'}</strong><small>{fmtDate(post.created_at)}</small></div><button className="community-more" aria-label="Mais opções">•••</button></header>
      <img className="community-post-image" src={post.image_path} alt={post.caption || 'Foto de treino'} loading="lazy" />
      <div className="community-post-body"><div className="community-actions"><button className={post.likes?.some(x => x.user_id === userId) ? 'is-liked' : ''} onClick={() => toggleLike(post)}><Icon name="heart" /> {post.likes?.length || 0}</button><button onClick={() => setCommentsPost(post)}><Icon name="message" /> {post.comments?.length || 0}</button></div>{post.caption && <p>{post.caption}</p>}{post.comments?.slice(0, 2).map(comment => <div className="community-comment-preview" key={comment.id}><strong>{comment.author?.display_name || 'Usuário'}</strong> {comment.body}</div>)}{post.comments?.length > 2 && <button className="community-see-comments" onClick={() => setCommentsPost(post)}>Ver todos os comentários <Icon name="chevronRight" /></button>}</div>
    </article>)}

    <AnimatePresence>{composerOpen && <div className="community-overlay" onMouseDown={e => e.target === e.currentTarget && setComposerOpen(false)}><motion.form className="community-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onSubmit={createPost}><div className="community-sheet-handle" /><h2>Nova postagem</h2><label className="community-upload">{file ? file.name : 'Escolha uma foto do treino'}<input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} /></label><textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} placeholder="Conte como foi o treino…" /><button className="community-primary-action" disabled={!file || saving}>{saving ? 'Publicando…' : 'Publicar foto'}</button></motion.form></div>}</AnimatePresence>
    <AnimatePresence>{commentsPost && <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} onSubmit={submitComment} />}</AnimatePresence>
    <AnimatePresence>{notificationsOpen && <div className="community-overlay community-overlay--top" onMouseDown={e => e.target === e.currentTarget && setNotificationsOpen(false)}><motion.div className="community-notification-sheet" initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}><div className="community-sheet-title"><h2>Notificações</h2><button onClick={() => setNotificationsOpen(false)}><Icon name="xmark" /></button></div>{notifications.length === 0 ? <div className="community-empty">Você está em dia.</div> : notifications.map(n => <button className="community-notification" key={n.id} onClick={() => { setNotificationsOpen(false); if (n.post_id) navigate(`/community?post=${n.post_id}`) }}><Icon name={n.type === 'like' ? 'heart' : 'message'} /><span><strong>{n.actor?.display_name || 'Alguém'}</strong> {n.type === 'like' ? 'curtiu sua postagem.' : 'comentou na sua postagem.'}</span></button>)}</motion.div></div>}</AnimatePresence>
  </div>
}

function CommentsSheet({ post, onClose, onSubmit }) {
  const [body, setBody] = useState('')
  return <div className="community-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><motion.div className="community-sheet community-comments-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}><div className="community-sheet-handle" /><div className="community-sheet-title"><h2>Comentários</h2><button onClick={onClose}><Icon name="xmark" /></button></div><div className="community-comments-scroll">{(post.comments || []).map(comment => <div className="community-comment-row" key={comment.id}><Avatar profile={comment.author} size="sm" /><div><strong>{comment.author?.display_name || 'Usuário'}</strong><small>{fmtDate(comment.created_at)}</small><p>{comment.body}</p></div></div>)}</div><form className="community-comment-form" onSubmit={e => { e.preventDefault(); onSubmit(post, body); setBody('') }}><input value={body} onChange={e => setBody(e.target.value)} placeholder="Escreva um comentário…" /><button aria-label="Enviar comentário"><Icon name="send" /></button></form></motion.div></div>
}
