import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

/**
 * Compact contextual header for secondary screens.
 * The shell owns primary navigation; this component only gives a screen a
 * predictable title, optional supporting text, and one contextual action.
 */
export function AppHeader({ title, subtitle, backTo, action, className = '' }) {
  const navigate = useNavigate()
  return (
    <header className={`app-header ${className}`.trim()}>
      <div className="app-header-main">
        {backTo && (
          <Button appearance="custom" className="iconbtn app-header-back" aria-label={t('Back')} onClick={() => navigate(backTo)}>
            <Icon name="chevronLeft" />
          </Button>
        )}
        <div className="app-header-copy">
          <h1>{title}</h1>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="app-header-action">{action}</div>}
    </header>
  )
}

export default AppHeader
