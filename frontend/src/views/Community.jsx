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
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true; let objectUrl = ''
    const loadImage = async () => {
      if (!client || !path) return
      const downloaded = await client.storage.from(BUCKET).download(path)
      if (downloaded.data) {
        objectUrl = URL.createObjectURL(downloaded.data)
        if (alive) setSrc(objectUrl)
        return
      }
      const publicUrl = path.startsWith('http') ? path : client.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl
      if (alive && publicUrl) setSrc(publicUrl)
    }
    loadImage()
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [client, path])
  return src ? <img className="community-post-image" src={src} alt={post.caption || 'Foto de treino'} loading="lazy" /> : <div className="community-post-image community-post-image--loading" aria-label="Carregando foto" />
}

function Avatar({ profile, size = 'md' }) {
  const initials = (profile?.display_name || '?').slice(0, 1).toUpperCase()
  const avatar = profile?.avatar_ref || profile?.avatar_id
  return avatar
    ? <img className={`community-avatar community-avatar--${size}`} src={avatar.startsWith('http') || avatar.startsWith('data:') ? avatar : avatarSrc(avatar)} alt="" />
    : <span className={`community-avatar community-avatar--${size}`}>{initials}</span>
}

export default function Community() {
  const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); const client = getBrowserSupabaseClient()
  const profileMode = location.pathname === '/community/profile'
  const localProfile = useStore(state => state.S.profile)
  const userId = auth.user?.id
  const [posts, setPosts] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [commentsPost, setCommentsPost] = useState(null); const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([]); const [composerOpen, setComposerOpen] = useState(false); const [editingPost, setEditingPost] = useState(null)
  const [file, setFile] = useState(null); const [caption, setCaption] = useState(''); const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    if (!client || !userId) return
    setLoading(true); setError('')
    const { data, error: queryError } = await client.from('community_posts').select('*, author:profiles!community_posts_author_id_fkey(id,display_name,avatar_ref), likes:community_likes(user_id,user:profiles!community_likes_user_id_fkey(id,display_name,avatar_ref)), comments:community_comments(id,body,created_at,author:profiles!community_comments_author_id_fkey(id,display_name,avatar_ref))').order('created_at', { ascending: false }).limit(40)
    const enriched = (data || []).map(post => ({ ...post, author: post.author_id === userId ? { ...post.author, display_name: post.author?.display_name || localProfile?.name, avatar_id: localProfile?.avatarId } : post.author, likes: (post.likes || []).map(like => like.user_id === userId ? { ...like, user: { ...like.user, avatar_id: localProfile?.avatarId, display_name: like.user?.display_name || localProfile?.name } } : like) }))
    if (queryError) setError(queryError.code === 'PGRST205' ? 'A Comunidade ainda não foi ativada no banco. Aplique a migração community no Supabase.' : queryError.message); else setPosts(enriched)
    setLoading(false)
  }, [client, userId, localProfile])
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
    const compressed = await compressCommunityImage(file)
    const path = `${userId}/${crypto.randomUUID()}-${compressed.name.replace(/[^a-z0-9.]/gi, '-').toLowerCase()}`
    const upload = await client.storage.from(BUCKET).upload(path, compressed, { contentType: compressed.type, upsert: false })
    if (upload.error) { setError(upload.error.message); setSaving(false); return }
    const inserted = await client.from('community_posts').insert({ author_id: userId, image_path: path, caption }).select().single()
    if (inserted.error) setError(inserted.error.code === 'PGRST205' ? 'A Comunidade ainda não foi ativada no banco. Aplique a migração community no Supabase.' : inserted.error.message); else { setComposerOpen(false); setFile(null); setCaption(''); await load() }
    setSaving(false)
  }
  const updatePost = async event => {
    event.preventDefault(); if (!editingPost || saving) return
    setSaving(true)
    let imagePath = editingPost.image_path
    if (file) {
      const compressed = await compressCommunityImage(file)
      const path = `${userId}/${crypto.randomUUID()}-${compressed.name.replace(/[^a-z0-9.]/gi, '-').toLowerCase()}`
      const upload = await client.storage.from(BUCKET).upload(path, compressed, { contentType: compressed.type, upsert: false })
      if (upload.error) { setError(upload.error.message); setSaving(false); return }
      imagePath = path
    }
    const { error: updateError } = await client.from('community_posts').update({ caption: caption.trim(), image_path: imagePath }).eq('id', editingPost.id).eq('author_id', userId)
    if (updateError) setError(updateError.message); else { setPosts(current => current.map(post => post.id === editingPost.id ? { ...post, caption: caption.trim(), image_path: imagePath } : post)); setEditingPost(null); setComposerOpen(false); setCaption(''); setFile(null) }
    setSaving(false)
  }
  const deletePost = async post => {
    if (!window.confirm('Excluir esta postagem?')) return
    const { error: deleteError } = await client.from('community_posts').delete().eq('id', post.id).eq('author_id', userId)
    if (deleteError) setError(deleteError.message); else { const imagePath = storagePathFromValue(post.image_path); if (imagePath) await client.storage.from(BUCKET).remove([imagePath]); setPosts(current => current.filter(item => item.id !== post.id)) }
  }
  const chooseFile = event => { const nextFile = event.target.files?.[0] || null; if (!nextFile) return; setFile(nextFile); setComposerOpen(true); event.target.value = '' }
  const openNewPost = () => fileInputRef.current?.click()
  const openEdit = post => { setEditingPost(post); setCaption(post.caption || ''); setFile(null); setComposerOpen(true) }
  const markNotificationsRead = async () => { if (unread) await client.from('community_notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null); setNotifications(current => current.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))) }

  return <div className="community-view page-scenery">
    <div className="community-toolbar">
      <input ref={fileInputRef} className="community-file-input" type="file" accept="image/*" onChange={chooseFile} />
      <button className="community-primary-action" onClick={openNewPost}><Icon name="camera" /> Nova postagem</button>
      <button className="community-notifications" aria-label="Notificações" onClick={() => { setNotificationsOpen(true); markNotificationsRead() }}><Icon name="bell" />{unread > 0 && <b>{unread}</b>}</button>
      <button className="community-profile-button" aria-label="Meu perfil" onClick={() => navigate('/community/profile')}><Avatar profile={{ display_name: localProfile?.name, avatar_id: localProfile?.avatarId }} /></button>
    </div>
    {profileMode && <div className="community-profile-heading"><Avatar profile={{ display_name: localProfile?.name, avatar_id: localProfile?.avatarId }} size="sm" /><strong>{localProfile?.name || 'Meu perfil'}</strong></div>}
    {error && <div className="community-error">{error}</div>}
    {loading ? <div className="community-empty">Carregando comunidade…</div> : (profileMode ? posts.filter(post => post.author_id === userId) : posts).length === 0 ? <div className="community-empty">{profileMode ? 'Você ainda não publicou fotos.' : 'Ainda não há postagens. Compartilhe seu primeiro treino!'}</div> : (profileMode ? posts.filter(post => post.author_id === userId) : posts).map(post => <article className="community-post" key={post.id}>
      <header className="community-post-head"><Avatar profile={post.author} /><div><strong>{post.author?.display_name || 'Usuário'}</strong><small>{fmtDate(post.created_at)}</small></div>{post.author_id === userId && <div className="community-post-menu"><button className="community-more" aria-label="Mais opções">•••</button><div className="community-post-menu-actions"><button onClick={() => openEdit(post)}>Editar</button><button onClick={() => deletePost(post)}>Excluir</button></div></div>}</header>
      <CommunityImage post={post} client={client} />
      <div className="community-post-body"><div className="community-actions"><button className={post.likes?.some(x => x.user_id === userId) ? 'is-liked' : ''} onClick={() => toggleLike(post)}><Icon name="heart" /> {post.likes?.length || 0}</button><button onClick={() => setCommentsPost(post)}><Icon name="message" /> {post.comments?.length || 0}</button></div>{post.likes?.length > 0 && <div className="community-liker-summary"><span className="community-liker-stack" aria-hidden="true">{post.likes.slice(0, 3).map((like, index) => <Avatar key={`${like.user_id}-${index}`} profile={like.user || { display_name: 'Usuário' }} size="xs" />)}</span><span>{post.likes.slice(0, 2).map(like => like.user?.display_name || 'Usuário').join(', ')}{post.likes.length > 2 ? ` e outras ${post.likes.length - 2} pessoas curtiram` : post.likes.length === 1 ? ' curtiu' : ' curtiram'}</span></div>}{post.caption && <p>{post.caption}</p>}{post.comments?.slice(0, 2).map(comment => <div className="community-comment-preview" key={comment.id}><strong>{comment.author?.display_name || 'Usuário'}</strong> {comment.body}</div>)}{post.comments?.length > 2 && <button className="community-see-comments" onClick={() => setCommentsPost(post)}>Ver todos os comentários <Icon name="chevronRight" /></button>}</div>
    </article>)}

    <AnimatePresence>{composerOpen && <div className="community-overlay community-overlay--sheet" onMouseDown={e => e.target === e.currentTarget && setComposerOpen(false)}><motion.form className="community-sheet community-composer-sheet" drag="y" dragConstraints={{ top: 0, bottom: 500 }} dragElastic={0.2} onDragEnd={(_, info) => { if (info.offset.y > 120) setComposerOpen(false) }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onSubmit={editingPost ? updatePost : createPost}><div className="community-sheet-inner"><div className="community-sheet-handle" /><div className="community-sheet-title"><h2>{editingPost ? 'Editar postagem' : 'Nova postagem'}</h2><button type="button" onClick={() => setComposerOpen(false)}><Icon name="xmark" /></button></div></div>{file && <img className="community-composer-preview" src={URL.createObjectURL(file)} alt="Prévia da postagem" />}{!editingPost && <label className="community-upload community-upload-inline">{file ? 'Trocar foto' : 'Escolha uma foto do treino'}<input type="file" accept="image/*" onChange={chooseFile} /></label>}{editingPost && <label className="community-upload community-upload-inline">{file ? 'Trocar foto selecionada' : 'Trocar foto (opcional)'}<input type="file" accept="image/*" onChange={chooseFile} /></label>}<div className="community-sheet-inner"><textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} placeholder="Conte como foi o treino…" /><button className="community-primary-action" disabled={(!file && !editingPost) || saving}>{saving ? (editingPost ? 'Salvando…' : 'Publicando…') : editingPost ? 'Salvar alterações' : 'Publicar foto'}</button></div></motion.form></div>}</AnimatePresence>
    <AnimatePresence>{commentsPost && <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} onSubmit={submitComment} />}</AnimatePresence>
    <AnimatePresence>{notificationsOpen && <div className="community-overlay community-overlay--top" onMouseDown={e => e.target === e.currentTarget && setNotificationsOpen(false)}><motion.div className="community-notification-sheet" initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}><div className="community-sheet-title"><h2>Notificações</h2><button onClick={() => setNotificationsOpen(false)}><Icon name="xmark" /></button></div>{notifications.length === 0 ? <div className="community-empty">Você está em dia.</div> : notifications.map(n => <button className="community-notification" key={n.id} onClick={() => { setNotificationsOpen(false); if (n.post_id) navigate(`/community?post=${n.post_id}`) }}><Icon name={n.type === 'like' ? 'heart' : 'message'} /><span><strong>{n.actor?.display_name || 'Alguém'}</strong> {n.type === 'like' ? 'curtiu sua postagem.' : 'comentou na sua postagem.'}</span></button>)}</motion.div></div>}</AnimatePresence>
  </div>
}

function CommentsSheet({ post, onClose, onSubmit }) {
  const [body, setBody] = useState('')
  return <div className="community-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><motion.div className="community-sheet community-comments-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}><div className="community-sheet-handle" /><div className="community-sheet-title"><h2>Comentários</h2><button onClick={onClose}><Icon name="xmark" /></button></div><div className="community-comments-scroll">{(post.comments || []).map(comment => <div className="community-comment-row" key={comment.id}><Avatar profile={comment.author} size="sm" /><div><strong>{comment.author?.display_name || 'Usuário'}</strong><small>{fmtDate(comment.created_at)}</small><p>{comment.body}</p></div></div>)}</div><form className="community-comment-form" onSubmit={e => { e.preventDefault(); onSubmit(post, body); setBody('') }}><input value={body} onChange={e => setBody(e.target.value)} placeholder="Escreva um comentário…" /><button aria-label="Enviar comentário"><Icon name="send" /></button></form></motion.div></div>
}
