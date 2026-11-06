import { useRef, useState } from 'react'
import { Button } from './ui.jsx'
import { clampTransform, defaultTransform } from '../lib/progress-photo-alignment.js'
import { fmtDate } from '../lib/format.js'
import { FppActionFeedback } from './FppFeedback.jsx'
import Icon from './Icon.jsx'

const baseTransform = photo => photo.manual_transform || photo.auto_transform || defaultTransform(photo.width, photo.height)

export function PhotoLayer({ photo, url, transform = baseTransform(photo), onLoad, onError }) {
  return <img className="bp-photo-image" src={url} alt={photo.alt || `Registro corporal de ${fmtDate(photo.photo_date)}`} draggable={false} referrerPolicy="no-referrer" onLoad={onLoad} onError={onError}
    style={{ width: `${photo.width / photo.height * transform.scale / .75 * 100}%`, height: `${transform.scale * 100}%`, left: `${transform.x / .75 * 100}%`, top: `${transform.y * 100}%` }} />
}

export default function ProgressPhotoCompare({ before, after, beforeURL, afterURL, onSave = undefined, controls = true, collapsibleControls = false, children = undefined }) {
  const stage = useRef(null)
  const drag = useRef(null)
  const [divider, setDivider] = useState(50)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState({ before: false, after: false })
  const moveDivider = event => {
    const rect = stage.current.getBoundingClientRect()
    setDivider(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)))
  }
  const imageTransform = photo => editing === photo.id ? draft : baseTransform(photo)
  const editedPhoto = editing === before.id ? before : after
  const beginEdit = photo => { setEditing(photo.id); setDraft(baseTransform(photo)); setError('') }
  const confirm = async () => {
    setSaving(true)
    setError('')
    try { await onSave(editedPhoto, draft); setEditing(null) } catch { setError('Não foi possível salvar o alinhamento. Tente novamente.') } finally { setSaving(false) }
  }
  const alignmentControls = editing ? <div className="card bp-photo-adjust">
    <strong>Ajustar alinhamento · {editing === before.id ? 'Antes' : 'Depois'}</strong>
    <p>Arraste a foto ou use os controles. A escala preserva as proporções do corpo.</p>
    {[
      { name: 'scale', label: 'Zoom', min: .1, max: 4, step: .01 },
      { name: 'x', label: 'Posição horizontal', min: -2, max: 2, step: .005 },
      { name: 'y', label: 'Posição vertical', min: -2, max: 2, step: .005 },
    ].map(field => <label key={field.name}>{field.label}<input type="range" min={field.min} max={field.max} step={field.step} value={draft[field.name]} disabled={saving} onChange={event => setDraft(clampTransform({ ...draft, [field.name]: Number(event.target.value) }))} /></label>)}
    <div className="bp-photo-actions"><Button disabled={saving} variant="plain" onClick={() => setDraft(editedPhoto.auto_transform || defaultTransform(editedPhoto.width, editedPhoto.height))}>Restaurar automático</Button><Button disabled={saving} variant="plain" onClick={() => setEditing(null)}>Cancelar</Button><Button disabled={saving} onClick={confirm}>{saving ? 'Salvando…' : 'Confirmar'}</Button></div>
  </div> : <div className="bp-photo-actions"><Button variant="plain" onClick={() => setDivider(50)}>Centralizar divisor</Button><Button variant="tinted" onClick={() => { setDivider(100); beginEdit(before) }}>Ajustar antes</Button><Button variant="tinted" onClick={() => { setDivider(0); beginEdit(after) }}>Ajustar depois</Button></div>
  return <section className="bp-photo-comparison" aria-label="Comparação fotográfica privada">
    <div className="bp-photo-stage" ref={stage}>
      <PhotoLayer photo={before} url={beforeURL} transform={imageTransform(before)} onLoad={() => setLoaded(s => ({ ...s, before: true }))} onError={() => { setLoaded(s => ({ ...s, before: true })); setError('Falha ao carregar a imagem anterior. Atualize o histórico.') }} />
      <div className="bp-photo-top" style={{ clipPath: `inset(0 0 0 ${divider}%)` }}>
        <PhotoLayer photo={after} url={afterURL} transform={imageTransform(after)} onLoad={() => setLoaded(s => ({ ...s, after: true }))} onError={() => { setLoaded(s => ({ ...s, after: true })); setError('Falha ao carregar a imagem atual. Atualize o histórico.') }} />
      </div>
      {!loaded.before || !loaded.after ? <div className="bp-photo-loading"><FppActionFeedback state="loading">Carregando imagens…</FppActionFeedback></div> : null}
      <div className="bp-photo-label before">ANTES <small>{before.date_label || fmtDate(before.photo_date)}</small></div>
      <div className="bp-photo-label after">DEPOIS <small>{after.date_label || fmtDate(after.photo_date)}</small></div>
      {!editing && <button type="button" className="bp-photo-divider" role="slider" aria-label="Divisor antes e depois" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(divider)} aria-valuetext={`${Math.round(divider)}% antes`} aria-orientation="horizontal" style={{ left: `${divider}%` }}
        onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); moveDivider(event) }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveDivider(event) }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
        onKeyDown={event => {
          const changes = { ArrowLeft: -2, ArrowDown: -2, ArrowRight: 2, ArrowUp: 2, PageDown: -10, PageUp: 10 }
          if (event.key in changes) { event.preventDefault(); setDivider(n => Math.max(0, Math.min(100, n + changes[event.key]))) }
          if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setDivider(event.key === 'Home' ? 0 : 100) }
        }}><span aria-hidden="true"><Icon name="chevronLeft" /><Icon name="chevronRight" /></span></button>}
      {editing && <div className="bp-photo-adjust-drag" aria-label="Arraste para posicionar a foto; também há controles abaixo" onPointerDown={event => {
        if (saving || event.button !== 0) return
        drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, transform: draft }
        event.currentTarget.setPointerCapture(event.pointerId)
      }} onPointerMove={event => {
        if (!drag.current || drag.current.pointer !== event.pointerId) return
        const height = stage.current.getBoundingClientRect().height
        setDraft(clampTransform({ ...drag.current.transform, x: drag.current.transform.x + (event.clientX - drag.current.x) / height, y: drag.current.transform.y + (event.clientY - drag.current.y) / height }))
      }} onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} onPointerCancel={() => { drag.current = null }} />}
    </div>
    {error && <FppActionFeedback state="error">{error}</FppActionFeedback>}
    {children}
    {controls && (collapsibleControls ? <details className="bp-photo-disclosure" open={Boolean(editing) || undefined}><summary>Ajustar alinhamento</summary>{alignmentControls}
      {(!before.auto_transform || !after.auto_transform) && <p className="bp-neutral-note">Detecção sem confiança suficiente em uma das fotos. Usamos o enquadramento original; ajuste o alinhamento se desejar.</p>}
    </details> : alignmentControls)}
  </section>
}
