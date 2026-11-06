import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { openAuthSheet } from './AuthSheet.jsx'
import { createProgressPhotoRepository, PHOTO_ANGLES } from '../lib/progress-photo-repository.js'
import { confirmSheet } from '../sheets.jsx'
import { useUI } from '../store/useUI.js'
import { fmtDate } from '../lib/format.js'
import { Button } from './ui.jsx'
import { FppActionFeedback } from './FppFeedback.jsx'
import Dialog from './Dialog.jsx'
import { useStore } from '../store/useStore.js'

const Compare = lazy(() => import('./ProgressPhotoCompare.jsx'))
const Upload = lazy(() => import('./ProgressPhotoUpload.jsx'))
const Demo = lazy(() => import('./ProgressPhotoDemo.jsx'))
const loading = <FppActionFeedback state="loading">Carregando fotos…</FppActionFeedback>

function PrivatePhoto({ photo, repository, large = false }) {
  const [url, setURL] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    setError(false)
    repository.url(photo).then(value => { if (live) setURL(value) }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [photo, repository])
  return error ? <span>Imagem indisponível</span> : url ? <img className={large ? 'bp-photo-full' : 'bp-photo-thumbnail'} src={url} alt={`Fotografia corporal de ${fmtDate(photo.photo_date)}`} loading={large ? 'eager' : 'lazy'} referrerPolicy="no-referrer" onError={() => setError(true)} /> : <span>Carregando…</span>
}

function AccountGallery({ userId, mode, body }) {
  const editor = mode === 'editor'
  const [repository, setRepository] = useState(null)
  const [photos, setPhotos] = useState([])
  const [angle, setAngle] = useState('front')
  const [selection, setSelection] = useState({ before: '', after: '' })
  const [urls, setURLs] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const live = useRef(false)
  const revision = useRef(0)
  useEffect(() => {
    live.current = true
    const requestRevision = revision
    const repo = createProgressPhotoRepository(userId)
    setRepository(repo)
    return () => { live.current = false; requestRevision.current++; repo.dispose() }
  }, [userId])

  const refresh = async (repo = repository) => {
    if (!repo) return
    const token = ++revision.current
    setStatus('loading'); setError('')
    try {
      const rows = await repo.list()
      if (live.current && token === revision.current) { setPhotos(rows); setStatus('idle') }
    } catch (err) { if (live.current && token === revision.current) { setStatus('error'); setError(err.message) } }
  }
  useEffect(() => {
    if (!repository) return undefined
    let active = true
    repository.list().then(rows => { if (active) { setPhotos(rows); setAngle(rows.find(photo => !photo.deleting && !photo.upload_pending)?.angle || 'front'); setStatus('idle') } }).catch(err => { if (active) { setError(err.message); setStatus('error') } })
    return () => { active = false }
  }, [repository])
  const matching = photos.filter(photo => photo.angle === angle && !photo.deleting && !photo.upload_pending)
  const before = matching.find(photo => photo.id === selection.before) || matching[0]
  const after = matching.find(photo => photo.id === selection.after && photo.id !== before?.id && photo.photo_date >= before.photo_date) || matching.filter(photo => photo.id !== before?.id && photo.photo_date >= before.photo_date).at(-1)
  useEffect(() => {
    const key = before && after ? `${before.id}:${after.id}` : null
    setURLs(current => current?.key === key ? current : null)
    if (!repository || !before || !after) return undefined
    let active = true
    Promise.all([repository.url(before), repository.url(after)]).then(([a, b]) => {
      if (active) setURLs({ before: a, after: b, key: `${before.id}:${after.id}` })
    }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [repository, before, after])

  const remove = photo => confirmSheet({
    title: 'Excluir fotografia?', message: 'Esta fotografia privada será removida permanentemente da sua conta.', confirmText: 'Excluir', danger: true,
    onConfirm: async () => {
      if (!live.current || busy || uploading) return
      setBusy(true); setError('')
      try {
        await repository.remove(photo)
        if (live.current) { useUI.getState().toast('Fotografia excluída'); setViewing(null); await refresh() }
      } catch (err) { if (live.current) { await refresh(); setError(`${err.message} Se a exclusão ficou pendente, toque em Excluir novamente.`) } }
      finally { if (live.current) setBusy(false) }
    },
  })
  const cleanup = async () => {
    setBusy(true); setError('')
    try { await repository.cleanIncomplete(); if (live.current) { await refresh(); useUI.getState().toast('Limpeza concluída. Envios da última hora foram preservados; use Excluir para removê-los.') } }
    catch (err) { if (live.current) setError(err.message) }
    finally { if (live.current) setBusy(false) }
  }
  const editorFields = editor && <div className="bp-photo-editor-fields">
    <Button className="bp-photo-add" variant="tinted" icon="plus" disabled={!repository || status === 'loading' || busy || uploading} onClick={() => setUploading(true)}>Adicionar foto</Button>
    {uploading && repository && <Suspense fallback={loading}><Upload repository={repository} onCancel={() => setUploading(false)} onSaved={nextAngle => {
      if (!live.current) return
      setUploading(false); setAngle(nextAngle); setSelection({ before: '', after: '' }); useUI.getState().toast('Fotografia salva'); void refresh()
    }} /></Suspense>}
    <details className="bp-photo-disclosure bp-photo-angle"><summary><span>Ângulo</span><small>{PHOTO_ANGLES.find(item => item.value === angle)?.label}</small></summary>
      <label>Ângulo da comparação<select value={angle} disabled={uploading || busy} onChange={event => { setAngle(event.target.value); setSelection({ before: '', after: '' }); setError('') }}>{PHOTO_ANGLES.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    </details>
    {matching.length >= 2 && <details className="bp-photo-disclosure bp-photo-dates"><summary>Datas da comparação</summary><div className="bp-date-selectors"><label>Antes<select value={before.id} disabled={uploading || busy} onChange={event => setSelection({ before: event.target.value, after: '' })}>{matching.slice(0, -1).map(photo => <option key={photo.id} value={photo.id}>{fmtDate(photo.photo_date, true)}</option>)}</select></label>
          <label>Depois<select value={after?.id || ''} disabled={uploading || busy} onChange={event => setSelection(current => ({ ...current, after: event.target.value }))}>{matching.filter(photo => photo.id !== before.id && photo.photo_date >= before.photo_date).map(photo => <option key={photo.id} value={photo.id}>{fmtDate(photo.photo_date, true)}</option>)}</select></label></div>
    </details>}
  </div>
  const pair = Boolean(before && after)
  const urlsReady = pair && urls?.key === `${before.id}:${after.id}`
  const showDemo = status === 'idle' && photos.length === 0
  let comparison = <section className="bp-photo-placeholder bp-empty"><strong>{photos.length ? 'Nenhuma foto deste ângulo' : 'Nenhuma fotografia cadastrada'}</strong><span>{editor ? 'Adicione duas fotos do mesmo ângulo para comparar sua evolução.' : 'Use Editar fotos para preparar sua comparação privada.'}</span></section>
  if (before) comparison = <div className="bp-photo-single"><PrivatePhoto photo={before} repository={repository} large /><p className="bp-neutral-note">Adicione outra foto deste ângulo para comparar sua evolução.</p></div>
  if (pair) comparison = urlsReady ? <Suspense fallback={loading}><Compare key={`${before.id}:${after.id}`} before={before} after={after} beforeURL={urls.before} afterURL={urls.after} controls={editor} collapsibleControls={editor} onSave={async (photo, transform) => {
        await repository.saveTransform(photo, transform)
        if (live.current) { setPhotos(current => current.map(item => item.id === photo.id ? { ...item, manual_transform: transform } : item)); useUI.getState().toast('Alinhamento salvo') }
      }}>{editorFields}</Compare></Suspense> : loading
  if (status === 'loading') comparison = loading
  if (showDemo) comparison = <Suspense fallback={loading}><Demo body={body}>{editorFields}</Demo></Suspense>
  return <div className={`bp-photo-section bp-photo-mode-${mode}`}>
    {comparison}
    {editor && !showDemo && (!urlsReady || status === 'loading') && editorFields}
    {error && <FppActionFeedback state={navigator.onLine === false ? 'offline' : 'error'}>{error}</FppActionFeedback>}
    {editor && <>
      <details className="bp-photo-disclosure bp-photo-history-disclosure" onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary><span>Histórico de fotos</span><small>{photos.length} {photos.length === 1 ? 'foto' : 'fotos'}</small></summary>
      {historyOpen && <ol className="bp-photo-history" aria-label="Histórico cronológico de fotografias">{[...photos].reverse().map(photo => <li className="card bp-photo-record" key={photo.id}>
        {photo.deleting || photo.upload_pending ? <span>{photo.deleting ? 'Exclusão pendente' : 'Envio incompleto'}</span> : <button className="bp-photo-thumb-button" type="button" onClick={() => setViewing(photo)} aria-label={`Visualizar fotografia de ${fmtDate(photo.photo_date)}`}><PrivatePhoto photo={photo} repository={repository} /></button>}
        <div><strong>{fmtDate(photo.photo_date, true)}</strong><span>{PHOTO_ANGLES.find(item => item.value === photo.angle)?.label}</span></div>
        <div className="bp-photo-record-actions">{!photo.deleting && !photo.upload_pending && <Button variant="plain" onClick={() => setViewing(photo)}>Visualizar</Button>}<Button variant="plain" disabled={busy || uploading} onClick={() => remove(photo)}>{photo.deleting ? 'Repetir exclusão' : 'Excluir'}</Button></div>
      </li>)}</ol>}
      {!photos.length && <p>Seu histórico aparecerá aqui após adicionar a primeira foto.</p>}
      </details>
      <details className="bp-photo-disclosure"><summary>Opções de recuperação</summary><div className="bp-photo-actions"><Button variant="plain" disabled={!repository || busy || uploading} onClick={() => refresh()}>Atualizar histórico</Button><Button variant="plain" disabled={!repository || busy || uploading} onClick={cleanup}>Limpar envios incompletos</Button></div></details>
    </>}
    {viewing && <Dialog title={`Fotografia · ${fmtDate(viewing.photo_date)}`} onClose={() => setViewing(null)}><PrivatePhoto photo={viewing} repository={repository} large /><Button variant="plain" onClick={() => setViewing(null)}>Fechar</Button></Dialog>}
  </div>
}

export default function ProgressPhotoGallery({ mode = 'editor' }) {
  const auth = useAuth()
  const body = useStore(state => state.S.body)
  if (!auth.user?.id || auth.user.isAnonymous) return <Suspense fallback={loading}><Demo body={body}>{mode === 'editor' && <div className="bp-photo-demo-signin"><p>Entre ou crie uma conta para adicionar suas fotografias privadas.</p><Button onClick={() => openAuthSheet()}>Entrar ou criar conta</Button></div>}</Demo></Suspense>
  return <AccountGallery key={auth.user.id} userId={auth.user.id} mode={mode} body={body} />
}
