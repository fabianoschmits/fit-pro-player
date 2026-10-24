import { isAvatarId } from './avatars.js'

// Keep public reads aligned with the columns granted to authenticated users.
export const COMMUNITY_PROFILE_FIELDS = 'id,display_name,avatar_ref'

const text = value => typeof value === 'string' ? value.trim() : ''

export function resolveCommunityIdentity({ userId, publicProfile, localProfile, authUser }) {
  const saved = publicProfile?.id === userId ? publicProfile : null
  const own = authUser?.id === userId
  // The blank bootstrap profile contains a default avatar, not a user choice.
  const local = own && (text(localProfile?.name) || localProfile?.completedAt) ? localProfile : null
  const metadata = own ? authUser?.user_metadata : null
  return {
    id: userId,
    display_name: (text(local?.name) || text(saved?.display_name) || text(metadata?.display_name) || text(metadata?.name) || text(metadata?.full_name) || 'Usuário').slice(0, 120),
    avatar_ref: (isAvatarId(local?.avatarId) ? local.avatarId : text(local?.avatarRef)) || text(saved?.avatar_ref) || null,
  }
}

export function hydrateCommunityPost(post, ownIdentity) {
  const identityFor = (userId, profile) => userId === ownIdentity?.id
    ? ownIdentity
    : resolveCommunityIdentity({ userId, publicProfile: profile })
  return {
    ...post,
    author: identityFor(post.author_id, post.author),
    likes: (post.likes || []).map(like => ({ ...like, user: identityFor(like.user_id, like.user) })),
    comments: (post.comments || []).map(comment => ({ ...comment, author: identityFor(comment.author_id, comment.author) })),
  }
}
