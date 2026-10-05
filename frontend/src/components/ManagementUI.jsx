import { useId } from 'react'
import Icon from './Icon.jsx'

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

export function ManagementAvatar({ name }) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  const initials = words.length ? `${Array.from(words[0])[0]}${words.length > 1 ? Array.from(words.at(-1))[0] : ''}`.toLocaleUpperCase() : null
  return <span className="management-avatar" aria-hidden="true">{initials || <Icon name="person" />}</span>
}
