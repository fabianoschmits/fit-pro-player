import { useEffect, useRef, useState } from 'react'
import { Button } from './ui.jsx'
import { FppActionFeedback, FppProgress } from './FppFeedback.jsx'
import { PHOTO_ANGLES } from '../lib/progress-photo-repository.js'
import { processProgressPhoto } from '../lib/progress-photo-processing.js'
import { analyzeProgressPhoto } from '../lib/progress-photo-alignment.js'
import { todayISO } from '../lib/format.js'

export default function ProgressPhotoUpload({ repository, onSaved, onCancel }) {
  const [processed, setProcessed] = useState(null)
  const [preview, setPreview] = useState('')
  const [date, setDate] = useState(todayISO)
  const [angle, setAngle] = useState('front')
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const abort = useRef(new AbortController())
  const generation = useRef(0)
  const lock = useRef(false)
  const busy = ['processing', 'analyzing', 'saving'].includes(state)
  useEffect(() => {
    abort.current = new AbortController()
    const controller = abort.current
    const currentGeneration = generation
    return () => { currentGeneration.current++; controller.abort() }
  }, [])
  useEffect(() => {
    if (!processed) return undefined
    const url = URL.createObjectURL(processed.blob)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [processed])
  const select = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || lock.current) return
    const token = ++generation.current
    setError(''); setWarning(''); setProcessed(null); setState('processing')
    try {
      const result = await processProgressPhoto(file)
      if (token === generation.current) { setProcessed(result); setState('idle') }
    } catch (err) { if (token === generation.current) { setError(err.message); setState('error') } }
  }
  const save = async event => {
    event.preventDefault()
    if (!processed || lock.current) return
    if (navigator.onLine === false) { setError('Sem conexão. Conecte-se à internet para salvar a fotografia.'); setState('error'); return }
    lock.current = true
    const token = ++generation.current
    setError(''); setState('analyzing')
    try {
      const automatic = await analyzeProgressPhoto(processed.blob, processed.width, processed.height, angle, abort.current.signal)
      if (token !== generation.current || abort.current.signal.aborted) return
      if (!automatic) setWarning('Alinhamento automático indisponível para esta foto. Você poderá ajustar manualmente.')
      setState('saving')
      await repository.upload(processed, { date, angle, automatic })
      if (token === generation.current) onSaved(angle)
    } catch (err) { if (token === generation.current) { setError(err.message); setState('error') } }
    finally { lock.current = false }
  }
  return <form className="card bp-photo-upload" onSubmit={save} aria-label="Adicionar fotografia corporal">
    <h2>Nova fotografia privada</h2>
    <p>Use corpo inteiro, luz e distância semelhantes. A análise acontece neste dispositivo.</p>
    <div className="bp-photo-actions">
      <label className="bp-photo-file">Escolher da galeria<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={busy} onChange={select} /></label>
      <label className="bp-photo-file">Usar câmera<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={select} /></label>
    </div>
    {preview && <img className="bp-photo-preview" src={preview} alt="Prévia da fotografia selecionada" />}
    <div className="bp-date-selectors"><label>Data do registro<input required type="date" min="1900-01-01" max={todayISO()} value={date} disabled={busy} onChange={event => setDate(event.target.value)} /></label>
      <label>Ângulo<select value={angle} disabled={busy} onChange={event => setAngle(event.target.value)}>{PHOTO_ANGLES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
    {busy && <><FppProgress label={state === 'processing' ? 'Processando imagem' : state === 'analyzing' ? 'Analisando alinhamento' : 'Salvando fotografia'} /><FppActionFeedback state="loading">{state === 'processing' ? 'Processando imagem…' : state === 'analyzing' ? 'Analisando alinhamento neste dispositivo…' : 'Enviando e salvando fotografia…'}</FppActionFeedback></>}
    {warning && <FppActionFeedback state="warning">{warning}</FppActionFeedback>}
    {error && <FppActionFeedback state="error">{error}</FppActionFeedback>}
    <div className="bp-photo-actions"><Button type="button" variant="plain" disabled={state === 'saving'} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={!processed || busy}>Salvar fotografia</Button></div>
  </form>
}
