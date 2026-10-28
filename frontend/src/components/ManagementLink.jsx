import { Link, useLinkClickHandler } from 'react-router-dom'
import { useFppActivation } from './useFppActivation.js'

// Keep native link semantics (including opening a new tab), with the app's
// existing activation feedback for ordinary in-app navigation.
export default function ManagementLink({ to, replace, state, target, relative, onClick, className = '', children, ...rest }) {
  const navigate = useLinkClickHandler(to, { replace, state, target, relative })
  const trigger = useFppActivation({ onActivate: navigate })
  return <Link {...rest} to={to} replace={replace} state={state} target={target} relative={relative}
    className={`${className} fpp-action-trigger`.trim()} data-visual-state={trigger.pressed ? 'pressed' : undefined}
    onClick={event => {
      onClick?.(event)
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (target && target !== '_self')) return
      trigger.run(event)
    }}>{children}</Link>
}
