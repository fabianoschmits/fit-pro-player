import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { avatarSrc, isAvatarId } from '../../lib/avatars.js'
import Icon from '../Icon.jsx'
import { createSupportRepository } from '../../lib/support.js'
import { useDialogFocus } from '../../lib/dialog-focus.js'
import { useFppAction } from '../useFppAction.js'

const reasons = [['spam', 'Spam ou atividade suspeita'], ['harassment', 'Assédio ou discurso de ódio'], ['inappropriate', 'Conteúdo impróprio'], ['misinformation', 'Informação enganosa'], ['other', 'Outro motivo']]

export default function CommunityReportDialog({ client, target, onClose }) {
  const dialog = useRef(null), repository = useMemo(() => createSupportRepository({ client }), [client])
  const [reason, setReason] = useState(''), [description, setDescription] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState(false)
  const action = useFppAction({
    onAction: async () => {
      if (!reason) { setError('Selecione o motivo da denúncia.'); return false }
      if (reason === 'other' && description.trim().length < 3) { setError('Explique o motivo da denúncia com pelo menos 3 caracteres.'); return false }
      setError('')
      return repository.reportCommunityContent({ targetKind: target.targetKind, postId: target.postId, commentId: target.commentId, reason, description: description.trim() || null })
    }, onSuccess: () => setSuccess(true), onError: failure => setError(failure.message || 'Não foi possível enviar a denúncia. Tente novamente.'),
  })
  useDialogFocus(dialog, { onClose, locked: action.locked, titleId: 'community-report-title' })
  const submit = event => { event.preventDefault(); void action.run(event) }
  const contentName = target.targetKind === 'post' ? 'esta publicação' : 'este comentário'
  return <div className="community-overlay community-overlay--report" onMouseDown={event => event.target === event.currentTarget && !action.locked && onClose()}>
    <motion.form ref={dialog} role="dialog" aria-modal="true" aria-label="Denunciar conteúdo" className="community-report-dialog" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onSubmit={submit}>
      <div className="community-sheet-title"><h2 id="community-report-title">Denunciar conteúdo</h2><button type="button" aria-label="Fechar denúncia" disabled={action.locked} onClick={onClose}><Icon name="xmark" /></button></div>
      <div className="community-report-body"><div className="community-report-person">{target.avatarRef && isAvatarId(target.avatarRef) ? <img src={avatarSrc(target.avatarRef)} alt="" /> : <b>{(target.authorName || 'U')[0]}</b>}<p>Denunciando conteúdo de <strong>{target.authorName || 'Usuário'}</strong>.</p></div><p>Conte o que aconteceu com {contentName}. A pessoa denunciada não verá sua identidade.</p><fieldset><legend>Motivo da denúncia</legend><div className="community-report-options">{reasons.map(([value, label]) => <label key={value}><input type="radio" name="community-report-reason" value={value} checked={reason === value} onChange={() => { setReason(value); setError('') }} /> <span>{label}</span></label>)}</div></fieldset>
        {reason === 'other' && <label className="community-report-description" htmlFor="community-report-description">Explique o motivo<textarea id="community-report-description" value={description} onChange={event => { setDescription(event.target.value); setError('') }} maxLength={1000} minLength={3} placeholder="Descreva o problema para a equipe analisar." /></label>}
        {error && <div className="community-error" role="alert">{error}</div>}{success && <div className="community-report-success" role="status"><strong>Denúncia enviada para análise.</strong><span>Você pode acompanhar esta denúncia em Ajuda e suporte, na área Meus chamados.</span><Link to="/support/tickets" onClick={onClose}>Ver meus chamados</Link></div>}
        {!success && <button className="community-primary-action" disabled={action.locked}>{action.busy ? 'Enviando…' : 'Enviar denúncia'}</button>}
      </div>
    </motion.form>
  </div>
}
