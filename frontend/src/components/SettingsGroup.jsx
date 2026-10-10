import Icon from './Icon.jsx'

export default function SettingsGroup({ title, description, icon, children, footer, open = false, className = '' }) {
  return <details className={`settings-group ${className}`} open={open || undefined}>
    <summary><span className="settings-group-icon" aria-hidden="true"><Icon name={icon} /></span><span className="settings-group-copy"><strong>{title}</strong>{description && <small>{description}</small>}</span><Icon name="chevronDown" className="settings-group-chevron" /></summary>
    <div className="settings-group-content">{children}{footer && <p className="sect-f">{footer}</p>}</div>
  </details>
}
