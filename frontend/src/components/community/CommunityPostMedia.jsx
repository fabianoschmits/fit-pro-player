import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './community-media.css'

const BUCKET = 'community-posts'
const decodedImages = new Map()
export function communityStoragePath(value) {
  if (typeof value !== 'string') return ''
  for (const marker of [`/object/public/${BUCKET}/`, `/object/sign/${BUCKET}/`]) {
    if (value.includes(marker)) {
      try { return decodeURIComponent(value.split(marker)[1].split('?')[0]) } catch { return '' }
    }
  }
  return value
}
const sourceOf = (post, client) => {
  const path = communityStoragePath(post.image_path)
  if (/^(https?:|blob:|data:)/.test(path)) return { path, url: path }
  return { path, url: path && client ? client.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl || '' : '' }
}

function ImageRequest({ path, url, client, caption, onStatus, attempt }) {
  const [src, setSrc] = useState(url)
  const [orientation, setOrientation] = useState(decodedImages.get(url) || '')
  const imageRef = useRef(null)
  const fallbackRef = useRef(false)
  const activeRef = useRef(true)
  const objectUrlRef = useRef(null)
  const statusRef = useRef(onStatus)
  statusRef.current = onStatus
  const publish = status => { if (activeRef.current) statusRef.current?.(status) }
  useEffect(() => {
    activeRef.current = true
    return () => { activeRef.current = false; if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }
  }, [])
  const loaded = async event => {
    const image = event.currentTarget
    const loadedSrc = image.src
    try { await image.decode?.() } catch { /* Safari can reject decode after a successful load. */ }
    if (!activeRef.current || imageRef.current !== image || image.src !== loadedSrc || !image.naturalWidth) return
    const nextOrientation = image.naturalWidth >= image.naturalHeight ? 'landscape' : 'portrait'
    setOrientation(nextOrientation)
    if (!loadedSrc.startsWith('blob:')) {
      decodedImages.set(url, nextOrientation)
      if (decodedImages.size > 200) decodedImages.delete(decodedImages.keys().next().value)
    }
    publish('ready')
  }
  useLayoutEffect(() => {
    if (!url) { publish('error'); return }
    const image = imageRef.current
    if (image?.complete && image.naturalWidth) {
      if (!attempt && decodedImages.has(url)) publish('ready')
      else void loaded({ currentTarget: image })
    } else publish('loading')
  }, [url, attempt])
  const failed = async () => {
    decodedImages.delete(url)
    publish('loading')
    if (fallbackRef.current || !client || !path || /^(https?:|blob:|data:)/.test(path)) { publish('error'); return }
    fallbackRef.current = true
    try {
      const result = await client.storage.from(BUCKET).download(path)
      if (!activeRef.current) return
      if (result.error || !result.data) { publish('error'); return }
      const nextUrl = URL.createObjectURL(result.data)
      objectUrlRef.current = nextUrl
      setSrc(nextUrl)
    } catch { publish('error') }
  }
  return src ? <img ref={imageRef} className="community-post-image" src={src} alt={caption || 'Foto de treino'} decoding="async" data-orientation={orientation || undefined} onLoad={loaded} onError={failed} /> : <div className="community-post-image" />
}

export function CommunityImage({ post, client, onStatus, attempt = 0 }) {
  const { path, url } = sourceOf(post, client)
  return <ImageRequest key={`${url}:${attempt}`} path={path} url={url} client={client} caption={post.caption} onStatus={onStatus} attempt={attempt} />
}

export function CommunityPostSkeleton() {
  return <article className="community-post community-post-skeleton" aria-hidden="true">
    <div className="community-post-head"><span className="community-skeleton-block community-skeleton-avatar" /><div className="community-skeleton-copy"><span className="community-skeleton-block community-skeleton-name" /><span className="community-skeleton-block community-skeleton-date" /></div><span className="community-skeleton-block community-skeleton-menu" /></div>
    <div className="community-post-image community-skeleton-block community-skeleton-image" />
    <div className="community-post-body"><div className="community-skeleton-actions"><span className="community-skeleton-block community-skeleton-action" /><span className="community-skeleton-block community-skeleton-action community-skeleton-action--short" /></div><div className="community-skeleton-likers"><span className="community-skeleton-block community-skeleton-mini-avatar" /><span className="community-skeleton-block community-skeleton-mini-avatar" /><span className="community-skeleton-block community-skeleton-mini-avatar" /><span className="community-skeleton-block community-skeleton-liker-copy" /></div><span className="community-skeleton-block community-skeleton-line community-skeleton-line--wide" /><span className="community-skeleton-block community-skeleton-line" /><span className="community-skeleton-block community-skeleton-line community-skeleton-line--comment" /></div>
  </article>
}

export default function CommunityPostMedia({ post, client, children }) {
  const { url } = sourceOf(post, client)
  const [state, setState] = useState({ url, status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const status = state.url === url ? state.status : 'loading'
  const ready = status === 'ready'
  return <div className={`community-post-gate${ready ? ' is-ready' : ''}`} aria-busy={status === 'loading'}>
    <div data-media-content aria-hidden={!ready || undefined} inert={!ready || undefined}>{children(<CommunityImage post={post} client={client} attempt={attempt} onStatus={value => setState({ url, status: value })} />)}</div>
    {!ready && <div className="community-media-placeholder"><CommunityPostSkeleton />{status === 'error' ? <div className="community-media-error" role="status"><p>Não foi possível carregar esta foto.</p><button type="button" onClick={() => { setState({ url, status: 'loading' }); setAttempt(value => value + 1) }}>Tentar novamente</button></div> : <span className="community-media-loading-label" role="status">Carregando postagem…</span>}</div>}
  </div>
}
