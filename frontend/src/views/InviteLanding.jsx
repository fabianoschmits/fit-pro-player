import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { normalizeInviteCode, statusLabel, withTimeout } from '../lib/professional-ux.js'
import { Button, Section } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import { t } from '../lib/i18n.js'

export default function InviteLanding() {
  const auth = useAuth(); const navigate = useNavigate(); const { code: rawCode } = useParams(); const code = normalizeInviteCode(rawCode)
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState('')
  useEffect(() => { if (!auth.user?.id) return; withTimeout(repo.previewInvite(code), 10000).then(rows => { setPreview(rows?.[0] || null); if (!rows?.length) setError(t("Convite inválido ou expirado.")) }).catch(cause => setError(cause?.message === 'request-timeout' ? t("A consulta do convite demorou mais que o esperado.") : t("Não foi possível consultar este convite."))).finally(() => setBusy(false)) }, [auth.user?.id, code])
  const accept = async () => { setError(''); try { await repo.acceptInvite(code); sessionStorage.removeItem('fpp-pending-invite'); setMessage(t("Vínculo criado.")); navigate('/student/professionals?invite=accepted', { replace: true }) } catch { setError(t("Não foi possível aceitar este convite. Ele pode ter expirado ou já ter sido utilizado.")) } }
  return <div className="narrow invite-landing"><AppHeader title={t("Convite profissional")} backTo="/student/professionals" />{error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}{busy ? <p role="status">{t("Consultando convite…")}</p> : preview ? <Section title={t("Confira antes de vincular")}><div className="card invite-preview-card"><h2>{preview.professional_name}</h2><p>{preview.bio || t('Perfil profissional')}</p>{preview.specialties?.length > 0 && <p className="muted">{preview.specialties.join(' · ')}</p>}<small className="muted">{t("Verificação: {0}", statusLabel(preview.verification_status))}</small><Button variant="primary" onClick={accept}>{t("Vincular a este profissional")}</Button></div></Section> : <Section title={t("Convite indisponível")}><p className="muted">{t("Peça um novo código ao profissional.")}</p></Section>}</div>
}
