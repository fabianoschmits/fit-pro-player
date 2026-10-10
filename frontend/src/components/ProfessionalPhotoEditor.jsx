import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalPhotoRepository, validateProfessionalPhoto } from '../lib/professional-photo.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import { ManagementAvatar, ManagementPanel } from './ManagementUI.jsx'

export default function ProfessionalPhotoEditor(props) {
  return <PhotoEditorWorkspace key={props.userId} {...props} />
}

function PhotoEditorWorkspace({ userId, profile, onChange }) {
  const repository = useMemo(() => createProfessionalPhotoRepository({ client: getBrowserSupabaseClient() }), [])
  const id = useId(); const input = useRef(null); const active = useRef(false); const pending = useRef(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  useEffect(() => { active.current = true; return () => { active.current = false } }, [userId])
  const persist = async file => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    const isCurrent = () => active.current
    try {
      if (file) validateProfessionalPhoto(file)
      const args = { userId, previousPath: profile.photoPath, isCurrent }
      const next = await (file ? repository.upload({ ...args, file }) : repository.remove(args))
      if (!isCurrent()) return
      onChange(next); setNotice(file ? t('Foto atualizada.') : t('Foto removida.'))
    } catch (cause) {
      if (!isCurrent()) return
      setError(cause.message === 'professional-photo-type' ? t('Escolha uma imagem JPG, PNG ou WebP.')
        : cause.message === 'professional-photo-size' ? t('A imagem deve ter até 5 MB.')
          : t('Não foi possível atualizar a foto. Tente novamente.'))
    } finally {
      pending.current = false
      if (isCurrent()) { setBusy(false); if (input.current) input.current.value = '' }
    }
  }
  return <ManagementPanel title={t('Foto profissional')} description={t('Sua foto aparece para você, convidados e alunos.')} className="management-photo-editor">
    <div className="management-photo-controls"><ManagementAvatar name={profile.professionalName} photoPath={profile.photoPath} /><div>
      <p id={id} className="muted">{t('JPG, PNG ou WebP, até 5 MB.')}</p>
      <input ref={input} className="management-photo-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('Foto profissional')} aria-describedby={id} disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void persist(file) }} />
      <div className="row-actions"><Button disabled={busy} onClick={() => input.current?.click()}>{busy ? t('Salvando foto…') : profile.photoPath ? t('Trocar foto') : t('Adicionar foto')}</Button>{profile.photoPath && <Button disabled={busy} onClick={() => persist(null)}>{t('Remover foto')}</Button>}</div>
    </div></div>
    {error && <p role="alert" className="management-error">{error}</p>}{notice && <p role="status" className="management-notice">{notice}</p>}
  </ManagementPanel>
}
