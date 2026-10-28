import { useEffect, useId, useState } from 'react'
import Icon from './Icon.jsx'
import AvatarImage from './AvatarImage.jsx'
import { isAvatarId } from '../lib/avatars.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'

export function ManagementPanel({ title, description, action, children, className = '' }) {
  const id = useId()
  return <section className={`management-panel ${className}`.trim()} aria-labelledby={title ? id : undefined}>
    {(title || description || action) && <div className="management-panel-heading">
      <div>{title && <h2 id={id}>{title}</h2>}{description && <p>{description}</p>}</div>
      {action && <div className="management-panel-action">{action}</div>}
    </div>}
    {children}
  </section>
}

export function ManagementEmpty({ icon, title, description, action }) {
  return <div className="management-empty">
    {icon && <span className="management-empty-icon" aria-hidden="true">{typeof icon === 'string' ? <Icon name={icon} /> : icon}</span>}
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {action && <div className="management-empty-action">{action}</div>}
  </div>
}

export function ManagementStatus({ children, tone = 'neutral' }) {
  return <span className="management-status" data-tone={tone}>{children}</span>
}

export function ManagementAvatar({ name, avatarRef, userId }) {
  const [identity, setIdentity] = useState(null)
  useEffect(() => {
    let alive = true
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId || '') || avatarRef) return undefined
    const load = async () => {
      try {
        const client = getBrowserSupabaseClient()
        if (!client) return
        const { data, error } = await client.from('profiles').select('avatar_ref').eq('id', userId).maybeSingle()
        if (alive && !error) setIdentity({ userId, avatarRef: data?.avatar_ref })
      } catch { /* The name remains visible when the public avatar is unavailable. */ }
    }
    load()
    return () => { alive = false }
  }, [userId, avatarRef])
  const selected = avatarRef || (identity?.userId === userId ? identity?.avatarRef : null)
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  const initials = words.length ? `${Array.from(words[0])[0]}${words.length > 1 ? Array.from(words.at(-1))[0] : ''}`.toLocaleUpperCase() : null
  return <span className="management-avatar" aria-hidden="true">{isAvatarId(selected) ? <AvatarImage avatarId={selected} loading="lazy" /> : initials || <Icon name="person" />}</span>
}
