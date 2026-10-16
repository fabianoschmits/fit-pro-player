import { Children, forwardRef, isValidElement, useState } from 'react'
import Icon from './Icon.jsx'
import { FppStatusAnimation } from './FppFeedback.jsx'
import { useFppAction, isFppBusy } from './useFppAction.js'
import { useFppActivation } from './useFppActivation.js'
import { fppActionInput } from './fpp-action-timing.js'
import { t } from '../lib/i18n.js'

// Generated-content reserves keep natural width without adding hidden text to
// the accessible name, textContent, or duplicating the caller's React children.
function labelText(value) {
  return Children.toArray(value).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child)
    return isValidElement(child) && !child.props['aria-hidden'] ? labelText(child.props.children) : ''
  }).join('')
}

export const FppPerformanceButton = forwardRef(function FppPerformanceButton({
  variant = 'plain', appearance = 'default', size, icon, trailingIcon, children, className = '', type = 'button',
  onAction, onClick, onSuccess, onError, state, intent = 'primary', loadingLabel,
  successLabel, errorLabel, progress, disabled = false, activation = 'animated', onKeyDown, onPointerDown, ...rest
}, ref) {
  const [input, setInput] = useState('pointer')
  const action = useFppAction({ onAction, onSuccess, onError, state, disabled })
  const trigger = useFppActivation({ disabled: action.locked, intent, activation, onActivate: (event, deferred) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (onAction) void action.run(event)
    else if (deferred && event.currentTarget.type === 'submit' && event.currentTarget.form?.isConnected) {
      event.currentTarget.form.requestSubmit(event.currentTarget)
    }
  } })
  const enhanced = !!onAction || state != null
  const labels = { loading: loadingLabel ?? t('Loading…'), success: successLabel ?? t('Done'), error: errorLabel ?? t('Try again') }
  const visualState = trigger.pressed ? 'pressed' : action.visualState
  const result = ['success', 'error', 'offline', 'warning'].includes(visualState)
  const label = isFppBusy(visualState) ? labels.loading : visualState === 'success' ? labels.success : visualState === 'error' ? labels.error : children
  const inlineStatus = result && !icon
  const pct = Math.max(0, Math.min(100, Number(progress) || 0)) / 100
  const currentState = trigger.pressed ? 'pressed' : action.state
  const locked = action.locked || trigger.pressed

  const handleClick = event => {
    const modality = fppActionInput(event)
    setInput(modality)
    event.currentTarget.dataset.input = modality
    trigger.run(event)
  }

  const appearanceClass = appearance === 'custom' ? '' : `btn ${variant}${size ? ' ' + size : ''}`
  return <button {...rest} ref={ref} type={type} className={`${appearanceClass} fpp-button ${className}`.trim()}
    disabled={locked} aria-disabled={locked || rest['aria-disabled'] || undefined}
    aria-busy={trigger.pressed || action.busy || rest['aria-busy'] || undefined} data-state={currentState} data-visual-state={visualState} data-intent={intent} data-input={input}
    onClick={handleClick}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setInput('keyboard'); onKeyDown?.(event) }}
    onPointerDown={event => { setInput('pointer'); onPointerDown?.(event) }}>
    {icon && (result ? <FppStatusAnimation state={visualState} /> : <Icon name={icon} />)}
    {(label != null && label !== false) && <span className="fpp-button-labels">
      {enhanced && <>
        <span className="fpp-button-reserve" aria-hidden="true" data-symbol={!icon || undefined} data-label={labelText(children)} />
        <span className="fpp-button-reserve" aria-hidden="true" data-label={labelText(labels.loading)} />
        <span className="fpp-button-reserve" aria-hidden="true" data-symbol={!icon || undefined} data-label={labelText(labels.success)} />
        <span className="fpp-button-reserve" aria-hidden="true" data-symbol={!icon || undefined} data-label={labelText(labels.error)} />
      </>}
      <span className="fpp-button-label" data-current="true" aria-live={enhanced ? 'polite' : undefined} aria-atomic={enhanced || undefined}>{inlineStatus && <FppStatusAnimation state={visualState} />}{label}</span>
    </span>}
    {trailingIcon && <Icon name={trailingIcon} />}
    {isFppBusy(visualState) && <span className="fpp-energy-rail" aria-hidden="true" data-indeterminate={progress == null || undefined}><span style={progress == null ? undefined : { transform: `scaleX(${pct})` }} /></span>}
  </button>
})

export default FppPerformanceButton
