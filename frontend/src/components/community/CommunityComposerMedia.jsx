import { useEffect, useRef, useState } from 'react'

export function useFilePreview(file) {
  const [url, setUrl] = useState('')
  useEffect(() => { if (!file) { setUrl(''); return }; const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next) }, [file])
  return url
}
export async function cropCommunityImage(file, crop) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image(); image.src = url
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(Error('Não foi possível abrir esta foto. Escolha uma imagem JPEG, PNG ou WebP.')) })
    const aspect = crop.aspect === 'portrait' ? 3 / 4 : 4 / 3
    const cropWidth = Math.min(image.naturalWidth, image.naturalHeight * aspect), cropHeight = cropWidth / aspect
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1600 / Math.max(cropWidth, cropHeight))
    canvas.width = Math.max(1, Math.round(cropWidth * scale)); canvas.height = Math.max(1, Math.round(cropHeight * scale))
    const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Seu navegador não conseguiu preparar a foto.')
    ctx.drawImage(image, (image.naturalWidth - cropWidth) * crop.x / 100, (image.naturalHeight - cropHeight) * crop.y / 100, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82))
    if (!blob) throw Error('Não foi possível preparar a foto. Tente novamente.')
    return new File([blob], 'treino.jpg', { type: 'image/jpeg' })
  } finally { URL.revokeObjectURL(url) }
}
export default function CommunityCropEditor({ file, crop, setCrop, onConfirm, onChangeFile, saving }) {
  const source = useFilePreview(file), drag = useRef(null), dimensions = useRef({ width: 0, height: 0 })
  const start = event => { event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, crop } }
  const move = event => {
    if (!drag.current) return
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect(), size = dimensions.current
    const scale = Math.max(rect.width / size.width, rect.height / size.height)
    const overflowX = size.width * scale - rect.width, overflowY = size.height * scale - rect.height
    setCrop(current => ({ ...current, x: overflowX > 1 ? Math.max(0, Math.min(100, drag.current.crop.x - (event.clientX - drag.current.x) / overflowX * 100)) : 50, y: overflowY > 1 ? Math.max(0, Math.min(100, drag.current.crop.y - (event.clientY - drag.current.y) / overflowY * 100)) : 50 }))
  }
  const nudge = (axis, amount) => setCrop(current => ({ ...current, [axis]: Math.max(0, Math.min(100, current[axis] + amount)) }))
  return <div className={`community-crop-editor community-crop-editor--${crop.aspect}`}>
    <div className="community-crop-stage"><div className="community-crop-viewport" onPointerDown={start} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}><img src={source || undefined} alt="Ajuste da foto" draggable="false" onLoad={event => { dimensions.current = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight } }} style={{ objectPosition: `${crop.x}% ${crop.y}%` }} /></div></div>
    <div className="community-crop-options" role="group" aria-label="Formato da foto">{['landscape', 'portrait'].map(aspect => <button key={aspect} type="button" aria-label={aspect === 'portrait' ? 'Formato vertical' : 'Formato horizontal'} aria-pressed={crop.aspect === aspect} className={`community-crop-orientation${crop.aspect === aspect ? ' is-active' : ''}`} onClick={() => setCrop(current => ({ ...current, aspect }))}><i className={`community-orientation-icon community-orientation-icon--${aspect}`} /></button>)}</div>
    <div className="community-crop-nudge" role="group" aria-label="Mover foto no recorte"><button type="button" aria-label="Mover foto para cima" onClick={() => nudge('y', -10)}>↑</button><button type="button" aria-label="Mover foto para a esquerda" onClick={() => nudge('x', -10)}>←</button><button type="button" aria-label="Mover foto para a direita" onClick={() => nudge('x', 10)}>→</button><button type="button" aria-label="Mover foto para baixo" onClick={() => nudge('y', 10)}>↓</button></div>
    <small>Arraste a foto ou use os controles para escolher o corte</small><button type="button" className="community-crop-confirm" disabled={saving} onClick={onConfirm}>{saving ? 'Preparando…' : 'OK'}</button><label className="community-crop-change">Trocar foto<input type="file" accept="image/*" disabled={saving} onChange={onChangeFile} /></label>
  </div>
}
