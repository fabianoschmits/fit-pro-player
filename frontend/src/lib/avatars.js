const avatarModules = import.meta.glob('../assets/avatars/avatar-*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const AVATARS = Object.entries(avatarModules)
  .map(([path, src]) => ({
    id: path.match(/avatar-\d+/)?.[0] || '',
    src,
  }))
  .filter((avatar) => avatar.id)
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

export const DEFAULT_AVATAR_ID = AVATARS.some((avatar) => avatar.id === 'avatar-27')
  ? 'avatar-27'
  : (AVATARS[0]?.id || '')

const AVATAR_BY_ID = new Map(AVATARS.map((avatar) => [avatar.id, avatar]))

export const isAvatarId = avatarId => AVATAR_BY_ID.has(avatarId)

export const getAvatar = avatarId => (
  AVATAR_BY_ID.get(avatarId)
  || AVATAR_BY_ID.get(DEFAULT_AVATAR_ID)
  || null
)

export const avatarSrc = avatarId => getAvatar(avatarId)?.src || ''
