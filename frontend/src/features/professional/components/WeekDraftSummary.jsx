import { useRef, useState } from 'react'
import Dialog from '../../../components/Dialog.jsx'
import { Button, TextField, TextArea } from '../../../components/ui.jsx'
import { validateWeeklyPlan } from '../../../lib/professional-program.js'
import { withTimeout } from '../../../lib/professional-ux.js'
import { t } from '../../../lib/i18n.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import { WEEK_DAYS, DAY_LABELS } from '../hooks/useProgramDraft.js'
import SectionHeader from './SectionHeader.jsx'
import CompactList from './CompactList.jsx'
import WorkoutRow from './WorkoutRow.jsx'
import BottomActionBar from './BottomActionBar.jsx'

export default function WeekDraftSummary({ api, programId, search = '', state, versionNumber, onPublish, onPublished, onDay, onCancel, onSaveMetadata }) {
  const [sheet, setSheet] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const locked = useRef(false)
  const published = useRef(null)
  const metadata = api.draft

  const close = () => {
    if (pending) return
    locked.current = true
    setClosing(true)
    setSheet(null)
  }
  const afterClose = () => {
    locked.current = false
    if (!api.isCurrent()) return
    setClosing(false)
    if (published.current) {
      const result = published.current
      published.current = null
      onPublished?.(result)
    }
  }
  const review = () => {
    if (locked.current || sheet || pending || !api.isCurrent()) return
    const result = validateWeeklyPlan(api.draft.weeklyPlan)
    if (!result.ok || !api.draft.title.trim() || api.draft.title.length > 160 || api.draft.description.length > 2000 || api.draft.objective.length > 160) {
      setError(t(result.error === 'weekly-plan-empty'
        ? 'Adicione pelo menos um exercício antes de publicar.'
        : 'Revise os exercícios e os valores informados.'))
      return
    }
    api.updateMetadata({})
    setError('')
    setSheet({
      kind: 'publish',
      snapshot: { ...structuredClone(api.draft), weeklyPlan: result.value },
      token: api.publicationToken(),
    })
  }
  const publish = async () => {
    if (pending || locked.current || !api.isCurrent()) return
    let active = true
    const current = () => active && api.isCurrent() && api.publicationToken().revision === sheet.token.revision
    if (!current()) return
    setPending(true)
    try {
      const result = await withTimeout(Promise.resolve().then(() => current()
        ? onPublish(sheet.snapshot, current)
        : Promise.reject(new Error('context-changed'))), 10000)
      if (!current()) return
      if (api.clearAfterPublication(sheet.token)) published.current = result || true
      locked.current = true
      setClosing(true)
      setSheet(null)
    } catch {
      if (current()) {
        setError(t('Não foi possível publicar. Seu rascunho foi mantido; tente novamente.'))
        locked.current = true
        setClosing(true)
        setSheet(null)
      }
    } finally {
      active = false
      if (api.isCurrent()) setPending(false)
    }
  }
  const saveMetadata = async () => {
    if (pending || !api.isCurrent()) return
    const value = sheet.value
    api.updateMetadata(value)
    setPending(true)
    setError('')
    try {
      await withTimeout(Promise.resolve().then(() => api.isCurrent()
        ? onSaveMetadata(value)
        : Promise.reject(new Error('context-changed'))), 10000)
      if (api.isCurrent()) {
        locked.current = true
        setClosing(true)
        setSheet(null)
      }
    } catch {
      if (api.isCurrent()) setError(t('Não foi possível salvar os dados. Seu rascunho foi mantido.'))
    } finally {
      if (api.isCurrent()) setPending(false)
    }
  }

  return <div className="professional-week-editor">
    <SectionHeader title={t('Dados do programa')} action={
      <Button aria-disabled={pending || closing || !!sheet} onClick={() => {
        if (!locked.current && !sheet && !pending) {
          setSheet({ kind: 'metadata', value: { title: metadata.title, description: metadata.description, objective: metadata.objective } })
        }
      }}>{t('Editar')}</Button>
    } />
    {metadata.objective && <p>{metadata.objective}</p>}
    {metadata.description && <p className="muted">{metadata.description}</p>}
    {versionNumber != null && <p className="muted small">{t('Versão {0}', versionNumber)}</p>}
    {error && <p role="alert">{error}</p>}
    <SectionHeader title={t('Montar semana')} />
    <CompactList>
      {WEEK_DAYS.map(day => onDay
        ? <li className="professional-row" key={day}>
          <button className="professional-row-link" disabled={pending || closing || !!sheet} onClick={() => onDay(day)}>
            <span className="professional-workout-day">{t(DAY_LABELS[day])}</span>
            <span className="professional-row-copy">
              <strong>{metadata.workoutTitles[day] || t(DAY_LABELS[day])}</strong>
              <small>{metadata.weeklyPlan[day]?.length ? t('{0} exercises', metadata.weeklyPlan[day].length) : t('Rest')}</small>
            </span>
          </button>
        </li>
        : <WorkoutRow key={day} day={day} title={metadata.workoutTitles[day]} count={metadata.weeklyPlan[day]?.length || 0}
          to={preserveProfessionalIdentity(professionalPath({ kind: 'programWorkoutEdit', id: programId, day }), search)} state={state} />)}
    </CompactList>
    {(api.dirty || api.persistenceError) && <p className="muted small" role="status">
      {t(api.persistenceError ? 'Não foi possível salvar o rascunho neste dispositivo.' : 'Rascunho salvo neste dispositivo.')}
    </p>}
    <p className="muted small">{t('Publicar salva uma versão do programa. O envio ao aluno é feito no próximo passo.')}</p>
    <BottomActionBar>
      <Button variant="primary" aria-disabled={pending || closing || !!sheet} onClick={review}>
        {t(pending ? 'Publicando…' : 'Publicar nova versão')}
      </Button>
      {onCancel && <Button disabled={pending} onClick={onCancel}>{t('Cancelar')}</Button>}
    </BottomActionBar>
    {sheet?.kind === 'publish' && <Dialog title={t('Revisar semana')} onClose={close}
      onAfterClose={afterClose} locked={pending} className="professional-editor-sheet">
      <p>{sheet.snapshot.title}</p>
      <ul>{WEEK_DAYS.map(day => <li key={day}>
        {t(DAY_LABELS[day])} · {sheet.snapshot.workoutTitles[day] || t(DAY_LABELS[day])} · {sheet.snapshot.weeklyPlan[day]?.length
          ? t('{0} exercises', sheet.snapshot.weeklyPlan[day].length)
          : t('Rest')}
      </li>)}</ul>
      <p>{t('Publicar salva uma versão do programa. O envio ao aluno é feito no próximo passo.')}</p>
      <Button variant="primary" disabled={pending} onClick={publish}>{t(pending ? 'Publicando…' : 'Publicar semana')}</Button>
      <Button disabled={pending} onClick={close}>{t('Cancelar')}</Button>
    </Dialog>}
    {sheet?.kind === 'metadata' && <Dialog title={t('Dados do programa')} onClose={close}
      onAfterClose={afterClose} locked={pending} className="professional-editor-sheet">
      <div className="professional-metadata-fields">
        {[
          ['title', 'Nome do programa', 160],
          ['objective', 'Objetivo', 160],
          ['description', 'Descrição do programa', 2000],
        ].map(([key, label, limit]) => <label key={key}>
          {t(label)}
          {key === 'description'
            ? <TextArea maxLength={limit} value={sheet.value[key]}
              onChange={event => setSheet({ ...sheet, value: { ...sheet.value, [key]: event.target.value } })} />
            : <TextField maxLength={limit} value={sheet.value[key]}
              onChange={event => setSheet({ ...sheet, value: { ...sheet.value, [key]: event.target.value } })} />}
        </label>)}
      </div>
      <Button disabled={pending || !sheet.value.title.trim()} onClick={() => { api.updateMetadata(sheet.value); close() }}>
        {t('Salvar')}
      </Button>
      {onSaveMetadata && <Button disabled={pending || !sheet.value.title.trim()} onClick={saveMetadata}>
        {t('Salvar dados do programa')}
      </Button>}
    </Dialog>}
  </div>
}
