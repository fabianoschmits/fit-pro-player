import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Dialog from '../../../components/Dialog.jsx'
import { Button, TextField } from '../../../components/ui.jsx'
import { t } from '../../../lib/i18n.js'
import { useProfessionalMutation } from '../hooks/useProfessionalMutation.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ContextActions from './ContextActions.jsx'
import ProgramMetadataFields from './ProgramMetadataFields.jsx'

export default function ProgramActions({ resource }) {
  const location = useLocation(), navigate = useNavigate()
  const { program, version } = resource.data
  const [sheet, setSheet] = useState(null), [closing, setClosing] = useState(false)
  const closedAction = useRef(null), lock = useRef(false)
  const mutation = useProfessionalMutation(resource.isCurrent)
  const source = new URLSearchParams(location.search)
  if (location.pathname.includes('/versions/') && version) source.set('version', version.id)
  const sourceSearch = location.pathname.includes('/versions/') ? `?${source}` : location.search
  const go = (kind, extra = {}) => navigate(preserveProfessionalIdentity(professionalPath({ kind, id: program.id, ...extra }), sourceSearch), { state: location.state })
  const open = value => { if (!lock.current && !mutation.pending && resource.isCurrent()) setSheet(value) }
  const close = action => { lock.current = true; setClosing(true); closedAction.current = action; setSheet(null) }
  const afterClose = () => {
    lock.current = false; setClosing(false)
    const action = closedAction.current; closedAction.current = null
    if (resource.isCurrent()) action?.()
  }
  const archive = archived => mutation.run(() => resource.repo.updateProgram(program.id, { title: program.title, description: program.description || '', archived }),
    () => { if (sheet) close(resource.retry); else resource.retry() }, t('Não foi possível atualizar o programa.'))
  const save = () => {
    const value = sheet.value
    if (!value.title.trim() || value.title.length > 160 || value.objective.length > 160 || value.description.length > 4000) return
    mutation.run(() => resource.repo.updateProgramMetadata({ programId: program.id, ...value }), () => close(resource.retry), t('Não foi possível atualizar o programa.'))
  }
  const duplicate = () => {
    if (!sheet.title.trim() || sheet.title.length > 160) return
    mutation.run(() => resource.repo.duplicateProgram({ programId: program.id, versionId: version?.id || null, title: sheet.title }),
      result => { if (!result?.program?.id) throw new Error('missing-program'); close(() => navigate(preserveProfessionalIdentity(professionalPath({ kind: 'program', id: result.program.id }), location.search.replace(/([?&])version=[^&]*&?/, '$1').replace(/[?&]$/, '')), { state: location.state })) }, t('Não foi possível duplicar o programa.'))
  }
  return <>
    <ContextActions label={t('Ações do programa')} items={[
      { id: 'metadata', label: t('Editar dados'), disabled: mutation.pending || closing, onSelect: () => open({ kind: 'metadata', value: { title: program.title, description: program.description || '', objective: program.objective || '' } }) },
      { id: 'edit', label: t('Editar semana'), disabled: program.archived || mutation.pending || closing, onSelect: () => go('programEdit') },
      { id: 'duplicate', label: t('Duplicar'), disabled: mutation.pending || closing, onSelect: () => open({ kind: 'duplicate', title: `${program.title.slice(0, 152)} — cópia` }) },
      { id: 'versions', label: t('Versões publicadas'), disabled: mutation.pending || closing, onSelect: () => go('programVersions') },
      { id: 'archive', label: t(program.archived ? 'Restaurar' : 'Arquivar'), destructive: !program.archived, disabled: mutation.pending || closing,
        onSelect: () => program.archived ? archive(false) : open({ kind: 'archive' }) },
    ]} />
    {mutation.error && <p role="alert" className="management-error">{mutation.error}</p>}
    {sheet && <Dialog title={t(sheet.kind === 'metadata' ? 'Dados do programa' : sheet.kind === 'duplicate' ? 'Duplicar programa' : 'Arquivar')} locked={mutation.pending} onClose={() => { if (!mutation.pending) close() }} onAfterClose={afterClose} className="professional-editor-sheet">
      {sheet.kind === 'metadata' ? <><ProgramMetadataFields value={sheet.value} disabled={mutation.pending} onChange={value => setSheet({ ...sheet, value })} /><Button disabled={mutation.pending || !sheet.value.title.trim()} onClick={save}>{t('Salvar dados')}</Button></>
        : sheet.kind === 'duplicate' ? <><label>{t('Nome do programa')}<TextField aria-label={t('Nome do programa')} maxLength={160} value={sheet.title} disabled={mutation.pending} onChange={event => setSheet({ ...sheet, title: event.target.value })} /></label><p>{t('A cópia será independente e não terá alunos atribuídos.')}</p><Button disabled={mutation.pending || !sheet.title.trim()} onClick={duplicate}>{t('Duplicar programa')}</Button></>
        : <><p>{t('Arquivar encerra as atribuições ativas deste programa. As versões e o histórico serão preservados.')}</p><Button variant="danger" disabled={mutation.pending} onClick={() => archive(true)}>{t('Confirmar arquivo')}</Button></>}
      {mutation.error && <p role="alert">{mutation.error}</p>}<Button disabled={mutation.pending} onClick={() => close()}>{t('Cancelar')}</Button>
    </Dialog>}
  </>
}
