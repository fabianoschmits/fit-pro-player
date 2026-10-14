import { useEffect, useRef } from 'react'
import { AVATARS } from '../lib/avatars.js'
import Icon from './Icon.jsx'

const COLUMNS = 4

export default function AvatarPicker({ value, onChange, t, orientation = 'grid', disabled = false }) {
  const gridRef = useRef(null)
  const selectedRef = useRef(null)
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false })

  useEffect(() => {
    const grid = gridRef.current
    const selected = selectedRef.current
    if (!grid || !selected) return
    grid.scrollTop = Math.max(0, selected.offsetTop - (grid.clientHeight / 2) + (selected.clientHeight / 2))
  }, [])

  const selectAndFocus = index => {
    const normalizedIndex = (index + AVATARS.length) % AVATARS.length
    onChange(AVATARS[normalizedIndex].id)
    requestAnimationFrame(() => {
      gridRef.current?.querySelector(`[data-avatar-index="${normalizedIndex}"]`)?.focus()
    })
  }

  const onKeyDown = (event, index) => {
    const directions = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
      Home: -index,
      End: AVATARS.length - 1 - index,
    }
    const delta = directions[event.key]
    if (delta === undefined) return
    event.preventDefault()
    selectAndFocus(index + delta)
  }

  const onPointerDown = event => {
    if (disabled || orientation !== 'horizontal' || event.pointerType === 'mouse' && event.button !== 0) return
    drag.current = { active: true, startX: event.clientX, startScroll: gridRef.current.scrollLeft, moved: false }
    gridRef.current.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = event => {
    if (!drag.current.active || !gridRef.current) return
    const delta = event.clientX - drag.current.startX
    if (Math.abs(delta) > 4) drag.current.moved = true
    gridRef.current.scrollLeft = drag.current.startScroll - delta
  }
  const onPointerUp = event => {
    if (!drag.current.active) return
    gridRef.current?.releasePointerCapture?.(event.pointerId)
    drag.current.active = false
  }

  return (
    <div ref={gridRef} data-orientation={orientation} className={`avatar-picker-grid ${orientation === 'horizontal' ? 'avatar-picker-horizontal' : ''} ${disabled ? 'is-disabled' : ''}`} role="radiogroup" aria-label={t('Available avatars')} aria-disabled={disabled} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {AVATARS.map((avatar, index) => {
        const selected = avatar.id === value
        return (
          <button
            key={avatar.id}
            ref={selected ? selectedRef : null}
            type="button"
            className={`avatar-picker-option ${selected ? 'is-selected' : ''}`}
            role="radio"
            aria-checked={selected}
            aria-label={t('Avatar {0} of {1}', index + 1, AVATARS.length)}
            tabIndex={selected ? 0 : -1}
            data-avatar-index={index}
            onClick={() => { if (!disabled && !drag.current.moved) onChange(avatar.id); drag.current.moved = false }}
            onKeyDown={event => onKeyDown(event, index)}
          >
            <img src={avatar.src} alt="" loading={index < 12 ? 'eager' : 'lazy'} decoding="async" draggable="false" />
            {selected && <span className="avatar-picker-check" aria-hidden="true"><Icon name="check" /></span>}
          </button>
        )
      })}
    </div>
  )
}
