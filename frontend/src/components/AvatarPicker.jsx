import { useEffect, useRef } from 'react'
import { AVATARS } from '../lib/avatars.js'
import Icon from './Icon.jsx'

const COLUMNS = 4

export default function AvatarPicker({ value, onChange, t }) {
  const gridRef = useRef(null)
  const selectedRef = useRef(null)

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

  return (
    <div ref={gridRef} className="avatar-picker-grid" role="radiogroup" aria-label={t('Available avatars')}>
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
            onClick={() => onChange(avatar.id)}
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
