import { COMMUNITY_PROFILE_FIELDS } from './community-identity.js'

export const COMMUNITY_COMMENT_SELECT = `id,post_id,author_id,body,parent_comment_id,created_at,author:profiles!community_comments_author_id_fkey(${COMMUNITY_PROFILE_FIELDS}),likes:community_comment_likes(user_id)`
export const COMMUNITY_POST_SELECT = `*,author:profiles!community_posts_author_id_fkey(${COMMUNITY_PROFILE_FIELDS}),likes:community_likes(user_id,user:profiles!community_likes_user_id_fkey(${COMMUNITY_PROFILE_FIELDS})),comments:community_comments(${COMMUNITY_COMMENT_SELECT})`
const PAGE_SIZE = 20
const hash = value => { let result = 2166136261; for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619); return (result >>> 0) / 4294967295 }
const rank = (posts, seed) => {
  const now = Date.now()
  const score = post => (post.likes?.length || 0) * 3 + (post.comments?.length || 0) * 2 + 12 / Math.pow(1 + Math.max(0, now - Date.parse(post.created_at)) / 86400000, .72) + hash(`${seed}:${post.id}`) * 2.5
  return [...posts].sort((a, b) => score(b) - score(a))
}

// Memory only, scoped to the authenticated account. A profile has its own query,
// cursor and scroll position, while mutations update every cached appearance.
export function createCommunityFeedStore(client) {
  const pages = new Map(), listeners = new Set(), versions = new Map(), deleted = new Set()
  let revision = 0
  const snapshot = scope => {
    if (!pages.has(scope)) pages.set(scope, { posts: [], initialized: false, loading: false, hasMore: true, error: '', cursor: null, scrollY: 0, request: 0, seed: Math.random() })
    return pages.get(scope)
  }
  const write = (scope, patch) => { pages.set(scope, { ...snapshot(scope), ...patch }); listeners.forEach(fn => fn()) }
  const updatePost = (id, updater) => {
    versions.set(id, ++revision)
    for (const [scope, page] of pages) if (page.posts.some(post => post.id === id)) write(scope, { posts: page.posts.map(post => post.id === id ? updater(post) : post) })
  }
  const removePost = id => {
    deleted.add(id); versions.set(id, ++revision)
    for (const [scope, page] of pages) write(scope, { posts: page.posts.filter(post => post.id !== id) })
  }
  const addPost = post => {
    versions.set(post.id, ++revision)
    for (const scope of new Set(['feed', post.author_id, ...pages.keys()])) {
      if (scope !== 'feed' && scope !== post.author_id) continue
      write(scope, { posts: [post, ...snapshot(scope).posts.filter(p => p.id !== post.id)] })
    }
  }
  async function load(scope, reset = false) {
    const page = snapshot(scope)
    if (!client || (page.loading && !reset) || (!reset && !page.hasMore)) return
    const request = page.request + 1, startedAt = revision
    write(scope, { loading: true, error: '', request })
    try {
      let query = client.from('community_posts').select(COMMUNITY_POST_SELECT)
      if (scope !== 'feed') query = query.eq('author_id', scope)
      const cursor = reset ? null : page.cursor
      if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
      const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE)
      if (error) throw error
      if (snapshot(scope).request !== request) return
      const rows = (data || []).filter(post => scope === 'feed' || post.author_id === scope)
      const current = snapshot(scope)
      const fetched = rows.filter(p => !deleted.has(p.id)).map(post => (versions.get(post.id) || 0) > startedAt ? current.posts.find(p => p.id === post.id) || post : post)
      const additions = fetched.filter(post => !current.posts.some(p => p.id === post.id))
      const posts = reset || !current.initialized
        ? [...current.posts.filter(post => (versions.get(post.id) || 0) > startedAt && !fetched.some(p => p.id === post.id)), ...(scope === 'feed' ? rank(fetched, page.seed) : fetched)]
        : [...current.posts, ...additions]
      write(scope, { posts, initialized: true, hasMore: rows.length === PAGE_SIZE, cursor: rows.at(-1) || null })
    } catch (error) {
      if (snapshot(scope).request === request) write(scope, { error: error.message || 'Não foi possível carregar as postagens. Tente novamente.' })
    } finally {
      if (snapshot(scope).request === request) write(scope, { loading: false })
    }
  }
  return { snapshot, load, updatePost, removePost, addPost,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    saveScroll: (scope, scrollY) => { pages.set(scope, { ...snapshot(scope), scrollY }) },
  }
}

let activeSession
export function communityFeedSession(client, userId) {
  if (!activeSession || activeSession.client !== client || activeSession.userId !== userId) activeSession = { client, userId, store: createCommunityFeedStore(client) }
  return activeSession.store
}
