import { avatarSrc } from '../lib/avatars.js'

export default function AvatarImage({ avatarId, alt = '', loading = 'eager', className = '' }) {
  return (
    <img
      className={`profile-avatar-image ${className}`.trim()}
      src={avatarSrc(avatarId)}
      alt={alt}
      loading={loading === 'eager' ? 'eager' : 'lazy'}
      decoding="async"
      draggable="false"
    />
  )
}
